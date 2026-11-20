import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { handleProductionRoute } from './src/production.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error('TEST_DATABASE_URL must point to a disposable CI-only PostgreSQL database.');
}

const client = new Client({
  connectionString,
  statement_timeout: 15000,
  query_timeout: 20000,
  application_name: 'kazino-lakay-schema-tests'
});

const migration1 = await readFile(new URL('../database/migrations/0001_production_foundation.sql', import.meta.url), 'utf8');
const migration2 = await readFile(new URL('../database/migrations/0002_locked_game_registry.sql', import.meta.url), 'utf8');
const migration3 = await readFile(new URL('../database/migrations/0003_admin_account_controls.sql', import.meta.url), 'utf8');

try {
  await client.connect();

  // Execute both migrations in order, then execute them again to verify safe re-runs.
  await client.query(migration1);
  await client.query(migration2);
  await client.query(migration3);
  await client.query(migration1);
  await client.query(migration2);
  await client.query(migration3);

  const versions = await client.query(
    `SELECT version FROM schema_migrations
      WHERE version IN ('0001_production_foundation','0002_locked_game_registry','0003_admin_account_controls')
      ORDER BY version`
  );
  assert.deepEqual(versions.rows.map((row) => row.version), [
    '0001_production_foundation',
    '0002_locked_game_registry',
    '0003_admin_account_controls'
  ]);

  const systemAccounts = await client.query(
    `SELECT owner_type, account_kind, currency, normal_balance, balance_minor
       FROM wallet_balances
      WHERE owner_id IS NULL
      ORDER BY owner_type, account_kind, currency`
  );
  assert.equal(systemAccounts.rowCount, 12, 'The database must create 12 empty system ledger accounts.');
  assert.ok(systemAccounts.rows.every((row) => Number(row.balance_minor) === 0), 'System accounts must start empty.');

  const games = await client.query(
    `SELECT COUNT(*)::int AS count,
            BOOL_AND(is_enabled = FALSE) AS all_disabled,
            BOOL_AND(release_phase = 'phase_4_pending') AS phase_four_locked
       FROM game_catalog`
  );
  assert.equal(games.rows[0].count, 22);
  assert.equal(games.rows[0].all_disabled, true);
  assert.equal(games.rows[0].phase_four_locked, true);

  const providers = await client.query(
    `SELECT provider_code, enabled FROM payment_provider_configs ORDER BY provider_code`
  );
  assert.deepEqual(providers.rows, [
    { provider_code: 'moncash', enabled: false },
    { provider_code: 'natcash', enabled: false }
  ]);

  await client.query('BEGIN');
  try {
    const created = await client.query(
      `INSERT INTO app_users (auth_provider, auth_subject, email, display_name, email_verified, account_status)
       VALUES ('firebase', 'ci-phase13-user', 'ci-phase13@example.invalid', 'CI Test', TRUE, 'active')
       RETURNING id`
    );
    const userId = created.rows[0].id;

    const role = await client.query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL`, [userId]
    );
    assert.deepEqual(role.rows.map((row) => row.role), ['player']);

    const target = await client.query(
      `INSERT INTO app_users (auth_provider, auth_subject, email, display_name, email_verified, account_status)
       VALUES ('firebase', 'ci-phase13-target', 'ci-target@example.invalid', 'Target Test', TRUE, 'active')
       RETURNING id`
    );
    const action = await client.query(
      `INSERT INTO admin_account_actions
         (idempotency_key, actor_user_id, target_user_id, action, previous_status, new_status, reason)
       VALUES ($1,$2,$3,'suspend_player','active','suspended',$4)
       RETURNING id`,
      ['ci-admin-action-key-0001', userId, target.rows[0].id, 'CI test verifies immutable admin account events']
    );
    assert.equal(action.rowCount, 1);
    await client.query('SAVEPOINT immutable_admin_action_test');
    await assert.rejects(
      client.query(`UPDATE admin_account_actions SET reason = 'tampered' WHERE id = $1`, [action.rows[0].id]),
      (error) => error.code === '55000'
    );
    await client.query('ROLLBACK TO SAVEPOINT immutable_admin_action_test');
    await client.query('SAVEPOINT duplicate_admin_action_key_test');
    await assert.rejects(
      client.query(
        `INSERT INTO admin_account_actions
           (idempotency_key, actor_user_id, target_user_id, action, previous_status, new_status, reason)
         VALUES ($1,$2,$3,'suspend_player','active','suspended',$4)`,
        ['ci-admin-action-key-0001', userId, target.rows[0].id, 'Duplicate key should be rejected by the database']
      ),
      (error) => error.code === '23505'
    );
    await client.query('ROLLBACK TO SAVEPOINT duplicate_admin_action_key_test');

    const wallet = await client.query(
      `SELECT id, currency, normal_balance
         FROM wallet_accounts
        WHERE owner_type = 'user' AND owner_id = $1 AND account_kind = 'player_wallet'`, [userId]
    );
    assert.equal(wallet.rowCount, 1);
    assert.equal(wallet.rows[0].currency, 'HTG');
    assert.equal(wallet.rows[0].normal_balance, 'credit');

    const platform = await client.query(
      `SELECT id FROM wallet_accounts
        WHERE owner_type = 'platform' AND owner_id IS NULL
          AND account_kind = 'platform_cash' AND currency = 'HTG'`
    );
    assert.equal(platform.rowCount, 1);

    const entries = [
      { account_id: platform.rows[0].id, entry_side: 'debit', amount_minor: 5000, currency: 'HTG' },
      { account_id: wallet.rows[0].id, entry_side: 'credit', amount_minor: 5000, currency: 'HTG' }
    ];
    const posted = await client.query(
      `SELECT post_ledger_transaction($1, $2, $3, $4::jsonb) AS id`,
      ['ci-idempotency-0001', 'ci_test_credit', userId, JSON.stringify(entries)]
    );
    const replay = await client.query(
      `SELECT post_ledger_transaction($1, $2, $3, $4::jsonb) AS id`,
      ['ci-idempotency-0001', 'ci_test_credit', userId, JSON.stringify(entries)]
    );
    assert.equal(replay.rows[0].id, posted.rows[0].id, 'Idempotent replay must return the original transaction id.');

    const balances = await client.query(
      `SELECT account_id, balance_minor FROM wallet_balances
        WHERE account_id = ANY($1::uuid[])`,
      [[wallet.rows[0].id, platform.rows[0].id]]
    );
    const byAccount = new Map(balances.rows.map((row) => [row.account_id, Number(row.balance_minor)]));
    assert.equal(byAccount.get(wallet.rows[0].id), 5000, 'Player liability wallet must increase on credit.');
    assert.equal(byAccount.get(platform.rows[0].id), 5000, 'Platform cash asset must increase on debit.');

    const changedPayload = [
      { account_id: platform.rows[0].id, entry_side: 'debit', amount_minor: 5001, currency: 'HTG' },
      { account_id: wallet.rows[0].id, entry_side: 'credit', amount_minor: 5001, currency: 'HTG' }
    ];
    await client.query('SAVEPOINT idempotency_reuse_test');
    await assert.rejects(
      client.query(
        `SELECT post_ledger_transaction($1, $2, $3, $4::jsonb)`,
        ['ci-idempotency-0001', 'ci_test_credit', userId, JSON.stringify(changedPayload)]
      ),
      (error) => error.code === '23505'
    );
    await client.query('ROLLBACK TO SAVEPOINT idempotency_reuse_test');

    const overspend = [
      { account_id: wallet.rows[0].id, entry_side: 'debit', amount_minor: 5001, currency: 'HTG' },
      { account_id: platform.rows[0].id, entry_side: 'credit', amount_minor: 5001, currency: 'HTG' }
    ];
    await client.query('SAVEPOINT overspend_test');
    await assert.rejects(
      client.query(
        `SELECT post_ledger_transaction($1, $2, $3, $4::jsonb)`,
        ['ci-idempotency-overspend', 'ci_test_overspend', userId, JSON.stringify(overspend)]
      ),
      (error) => error.code === '23514'
    );
    await client.query('ROLLBACK TO SAVEPOINT overspend_test');

    await client.query('SAVEPOINT immutable_ledger_test');
    await assert.rejects(
      client.query(`UPDATE ledger_entries SET amount_minor = 1 WHERE transaction_id = $1`, [posted.rows[0].id]),
      (error) => error.code === '55000'
    );
    await client.query('ROLLBACK TO SAVEPOINT immutable_ledger_test');

    await client.query('SAVEPOINT unbalanced_ledger_test');
    const unbalanced = [
      { account_id: platform.rows[0].id, entry_side: 'debit', amount_minor: 100, currency: 'HTG' },
      { account_id: wallet.rows[0].id, entry_side: 'credit', amount_minor: 99, currency: 'HTG' }
    ];
    await assert.rejects(
      client.query(
        `SELECT post_ledger_transaction($1, $2, $3, $4::jsonb)`,
        ['ci-idempotency-unbalanced', 'ci_test_unbalanced', userId, JSON.stringify(unbalanced)]
      ),
      (error) => error.code === '23514'
    );
    await client.query('ROLLBACK TO SAVEPOINT unbalanced_ledger_test');
  } finally {
    await client.query('ROLLBACK');
  }

  // Exercise production admin account controls against the disposable CI database.
  const adminUid = `ci-admin-${randomUUID()}`;
  const playerUid = `ci-player-${randomUUID()}`;
  const privilegedUid = `ci-privileged-${randomUUID()}`;
  const admin = (await client.query(
    `INSERT INTO app_users (auth_provider, auth_subject, email, display_name, email_verified, account_status)
     VALUES ('firebase',$1,$2,'CI Admin',TRUE,'active') RETURNING id`,
    [adminUid, `${adminUid}@example.invalid`]
  )).rows[0];
  const player = (await client.query(
    `INSERT INTO app_users (auth_provider, auth_subject, email, display_name, email_verified, account_status)
     VALUES ('firebase',$1,$2,'CI Player',TRUE,'active') RETURNING id`,
    [playerUid, `${playerUid}@example.invalid`]
  )).rows[0];
  const privileged = (await client.query(
    `INSERT INTO app_users (auth_provider, auth_subject, email, display_name, email_verified, account_status)
     VALUES ('firebase',$1,$2,'CI Privileged',TRUE,'active') RETURNING id`,
    [privilegedUid, `${privilegedUid}@example.invalid`]
  )).rows[0];
  await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'admin'),($2,'admin')`, [admin.id, privileged.id]);

  const adminTokenHash = 'a'.repeat(64);
  await client.query(
    `INSERT INTO admin_mfa_sessions (user_id, token_hash, expires_at)
     VALUES ($1,$2,now() + interval '10 minutes')`,
    [admin.id, adminTokenHash]
  );
  const base = 'https://kazino-lakay-ci.test';
  const dbEnv = { HYPERDRIVE: { connectionString } };
  const adminIdentity = { uid: adminUid, email: `${adminUid}@example.invalid`, emailVerified: true, tokenHash: adminTokenHash };
  const playerIdentity = { uid: playerUid, email: `${playerUid}@example.invalid`, emailVerified: true, tokenHash: 'b'.repeat(64) };
  const verifyIdentity = async (request) => {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\\s+/i, '');
    if (token === 'ci-admin-token') return adminIdentity;
    if (token === 'ci-player-token') return playerIdentity;
    const error = new Error('unauthorized');
    error.status = 401;
    throw error;
  };
  const adminRequest = async (identityToken, body) => handleProductionRoute(
    new Request(`${base}/api/admin/production/users/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identityToken}` },
      body: JSON.stringify(body)
    }),
    dbEnv,
    verifyIdentity
  );

  const suspendPayload = {
    targetUserId: player.id,
    action: 'suspend',
    reason: 'CI verifies audited production player suspension',
    idempotencyKey: `ci-admin-suspend-${randomUUID()}`
  };
  const suspendedResponse = await adminRequest('ci-admin-token', suspendPayload);
  assert.equal(suspendedResponse.status, 200);
  const suspendedBody = await suspendedResponse.json();
  assert.equal(suspendedBody.accountStatus, 'suspended');
  assert.equal((await client.query('SELECT account_status FROM app_users WHERE id=$1', [player.id])).rows[0].account_status, 'suspended');

  const replayResponse = await adminRequest('ci-admin-token', suspendPayload);
  assert.equal(replayResponse.status, 200);
  assert.equal((await replayResponse.json()).replayed, true);
  const actionCount = await client.query('SELECT COUNT(*)::int AS count FROM admin_account_actions WHERE idempotency_key=$1', [suspendPayload.idempotencyKey]);
  assert.equal(actionCount.rows[0].count, 1);

  const changedReplay = await adminRequest('ci-admin-token', { ...suspendPayload, reason: 'Different reason with same request key' });
  assert.equal(changedReplay.status, 409);

  const reactivateResponse = await adminRequest('ci-admin-token', {
    targetUserId: player.id,
    action: 'reactivate',
    reason: 'CI verifies audited production player reactivation',
    idempotencyKey: `ci-admin-reactivate-${randomUUID()}`
  });
  assert.equal(reactivateResponse.status, 200);
  assert.equal((await reactivateResponse.json()).accountStatus, 'active');

  const selfAction = await adminRequest('ci-admin-token', {
    targetUserId: admin.id,
    action: 'suspend',
    reason: 'CI verifies administrators cannot suspend themselves',
    idempotencyKey: `ci-admin-self-${randomUUID()}`
  });
  assert.equal(selfAction.status, 400);

  const privilegedAction = await adminRequest('ci-admin-token', {
    targetUserId: privileged.id,
    action: 'suspend',
    reason: 'CI verifies privileged accounts need separate review',
    idempotencyKey: `ci-admin-privileged-${randomUUID()}`
  });
  assert.equal(privilegedAction.status, 409);

  const playerAttempt = await adminRequest('ci-player-token', {
    targetUserId: player.id,
    action: 'suspend',
    reason: 'CI verifies player cannot access admin action',
    idempotencyKey: `ci-player-denied-${randomUUID()}`
  });
  assert.equal(playerAttempt.status, 403);

  console.log('Kazino Lakay production PostgreSQL: 3 migrations idempotentes, 22 jeux verrouillés, ledger, idempotence, immutabilité et workflows admin (MFA/role/reason/audit/replay) OK.');
} finally {
  await client.end().catch(() => {});
}
