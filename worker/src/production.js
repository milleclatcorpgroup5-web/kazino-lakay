import { Client } from 'pg';
import { GAMES } from '../../src/games/catalog.js';

const PRODUCTION_GAME_CATALOG = Object.freeze(GAMES.map((game) => Object.freeze({
  id: game.id,
  gameId: game.id,
  name: game.name,
  displayName: game.name,
  category: game.category,
  symbol: game.symbol,
  tone: game.tone,
  summary: game.summary,
  enabled: false,
  releasePhase: 'phase_4_pending'
})));

const encoder = new TextEncoder();
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

class ProductionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new ProductionError(status, message);
}

async function withDb(env, callback) {
  if (!env.HYPERDRIVE?.connectionString) {
    fail(503, 'Bazdone PostgreSQL la poko konekte. Konfigire binding HYPERDRIVE la anvan ou aktive mòd pwodiksyon an.');
  }
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    statement_timeout: 8000,
    query_timeout: 10000,
    application_name: 'kazino-lakay-worker'
  });
  try {
    await client.connect();
    return await callback(client);
  } catch (error) {
    if (error instanceof ProductionError) throw error;
    console.error('[Kazino Lakay production DB]', error?.code || error?.name || 'DatabaseError');
    if (['42P01', '3F000'].includes(error?.code)) {
      fail(503, 'Estrikti PostgreSQL la poko konplè. Aplike migrasyon 0001_production_foundation.sql epi 0002_locked_game_registry.sql.');
    }
    if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '08001', '08006'].includes(error?.code)) {
      fail(503, 'Bazdone PostgreSQL la pa disponib kounye a. Verifye Hyperdrive ak founisè PostgreSQL la.');
    }
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

async function readBody(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 16_384) fail(413, 'Demann nan twò gwo.');
  const text = await request.text();
  if (text.length > 16_384) fail(413, 'Demann nan twò gwo.');
  try { return text ? JSON.parse(text) : {}; }
  catch { fail(400, 'Fòma JSON demann nan pa valab.'); }
}

function normaliseCurrency(value) {
  const currency = String(value || 'HTG').trim().toUpperCase();
  if (!['HTG', 'USD', 'EUR'].includes(currency)) fail(400, 'Lajan sa a poko disponib nan baz aplikasyon an.');
  return currency;
}

async function upsertUser(client, identity, displayName = '') {
  if (!identity.email) fail(400, 'Kont sa a dwe gen yon imel valide.');
  const result = await client.query(
    `INSERT INTO app_users (auth_provider, auth_subject, email, display_name, email_verified)
     VALUES ('firebase', $1, $2, $3, $4)
     ON CONFLICT (auth_provider, auth_subject) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = CASE WHEN app_users.display_name = '' THEN EXCLUDED.display_name ELSE app_users.display_name END,
           email_verified = EXCLUDED.email_verified,
           updated_at = now()
     RETURNING id, auth_subject, email, display_name, email_verified, account_status,
               kyc_status, age_verification_status, created_at, updated_at`,
    [identity.uid, identity.email, displayName || identity.name || '', identity.emailVerified]
  );
  // The database AFTER INSERT trigger creates a player-only role and zero HTG
  // wallet. This Worker role has no permission to manufacture admin roles or
  // platform/system accounts. No Firestore demo points are imported.
  return result.rows[0];
}

async function getUserBySubject(client, uid) {
  const result = await client.query(
    `SELECT u.id, u.auth_subject, u.email, u.display_name, u.email_verified,
            u.account_status, u.kyc_status, u.age_verification_status,
            u.age_verified_at, u.kyc_verified_at, u.created_at, u.updated_at,
            COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.role IS NOT NULL), ARRAY['player']) AS roles
       FROM app_users u
       LEFT JOIN user_roles r ON r.user_id = u.id AND r.revoked_at IS NULL
      WHERE u.auth_provider = 'firebase' AND u.auth_subject = $1
      GROUP BY u.id`,
    [uid]
  );
  return result.rows[0] || null;
}

async function getCompliance(client, userId) {
  const [exclusion, limits] = await Promise.all([
    client.query(
      `SELECT id, starts_at, ends_at, permanent
         FROM self_exclusions
        WHERE user_id = $1 AND starts_at <= now() AND (permanent = TRUE OR ends_at > now())
        ORDER BY created_at DESC LIMIT 1`, [userId]
    ),
    client.query(
      `SELECT currency, daily_deposit_limit_minor, weekly_deposit_limit_minor,
              daily_wager_limit_minor, daily_loss_limit_minor, updated_at
         FROM responsible_gaming_limits WHERE user_id = $1 ORDER BY currency`,
      [userId]
    )
  ]);
  return {
    selfExcluded: exclusion.rows.length > 0,
    selfExclusion: exclusion.rows[0] || null,
    limits: limits.rows
  };
}

function publicProfile(user, compliance) {
  const isAdmin = user.roles?.some((role) => ['admin', 'compliance', 'finance', 'auditor', 'support'].includes(role)) || false;
  // Keep real-money play locked until licensing, provider validation and Phase 4 pass.
  const canPlay = false;
  return {
    uid: user.auth_subject,
    email: user.email,
    displayName: user.display_name,
    role: isAdmin ? 'admin' : 'player',
    roles: user.roles || ['player'],
    accountStatus: user.account_status,
    kycStatus: user.kyc_status,
    ageVerificationStatus: user.age_verification_status,
    emailVerified: user.email_verified,
    selfExcluded: compliance.selfExcluded,
    responsibleGamingLimits: compliance.limits,
    canPlay,
    pointsBalance: 0,
    walletCurrency: 'HTG',
    walletBalanceMinor: 0,
    createdAt: user.created_at
  };
}

async function profilePayload(client, user) {
  const compliance = await getCompliance(client, user.id);
  return publicProfile(user, compliance);
}

async function currentWallet(client, userId) {
  const result = await client.query(
    `SELECT a.id, a.currency, a.account_status, COALESCE(b.balance_minor, 0)::BIGINT AS balance_minor
       FROM wallet_accounts a
       LEFT JOIN wallet_balances b ON b.account_id = a.id
      WHERE a.owner_type = 'user' AND a.owner_id = $1 AND a.account_kind = 'player_wallet'
      ORDER BY a.currency`,
    [userId]
  );
  return result.rows;
}

async function addAudit(client, actorId, actorRole, action, targetType, targetId, outcome = 'success', reason = null, metadata = {}) {
  await client.query(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, target_type, target_id, outcome, reason, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [actorId || null, actorRole || 'system', action, targetType || null, targetId || null, outcome, reason, JSON.stringify(metadata || {})]
  );
}

async function keyedHash(value, env) {
  const salt = String(env.SECURITY_HASH_SALT || '');
  if (salt.length < 32 || !value) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(String(value))));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function recordSecurityContext(client, identity, request, env, eventType = 'profile_bootstrap') {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const agent = request.headers.get('User-Agent') || '';
  const [ipHash, agentHash] = await Promise.all([keyedHash(ip, env), keyedHash(agent, env)]);
  const user = await getUserBySubject(client, identity.uid);
  if (!user) return;
  const recent = await client.query(
    `SELECT 1 FROM security_events WHERE user_id=$1 AND event_type=$2 AND created_at > now() - interval '1 hour' LIMIT 1`,
    [user.id, eventType]
  );
  if (recent.rowCount) return;
  await client.query(
    `INSERT INTO security_events (user_id,event_type,severity,ip_hash,user_agent_hash,metadata)
     VALUES ($1,$2,'info',$3,$4,'{}'::jsonb)`,
    [user.id, eventType, ipHash, agentHash]
  );
  if (!ipHash) return;
  const shared = await client.query(
    `SELECT COUNT(DISTINCT user_id)::int AS account_count
       FROM security_events WHERE ip_hash=$1 AND user_id IS NOT NULL
        AND created_at > now() - interval '24 hours'`, [ipHash]
  );
  const accountCount = Number(shared.rows[0]?.account_count || 0);
  // This is a review signal only; shared networks are not proof of wrongdoing.
  if (accountCount >= 4) {
    const signalKey = `shared-network:${ipHash}`;
    await client.query(
      `INSERT INTO fraud_alerts (user_id,signal_code,risk_score,severity,evidence,signal_key)
       VALUES ($1,'multiple_accounts_shared_network',45,'medium',$2::jsonb,$3)
       ON CONFLICT (signal_key) DO NOTHING`,
      [user.id, JSON.stringify({ distinctAccountsLast24h: accountCount, source: 'privacy_hashed_network_signal' }), signalKey]
    );
  }
}

async function requireAdminMember(client, identity, requireMfa = true, allowedRoles = ['admin', 'compliance', 'finance', 'auditor', 'support']) {
  const user = await getUserBySubject(client, identity.uid);
  if (!user || user.account_status !== 'active') fail(403, 'Kont administratè a pa aktif nan baz pwodiksyon an.');
  const role = user.roles?.find((item) => allowedRoles.includes(item));
  if (!role) fail(403, 'Wòl administratè pa otorize pou kont sa a.');
  if (requireMfa) {
    if (!identity.tokenHash) fail(401, 'Sesyon an pa kapab verifye pou MFA. Rekonekte.');
    const session = await client.query(
      `SELECT 1 FROM admin_mfa_sessions
        WHERE user_id = $1 AND token_hash = $2 AND expires_at > now() LIMIT 1`,
      [user.id, identity.tokenHash]
    );
    if (!session.rowCount) fail(403, 'MFA obligatwa. Verifye kòd aplikasyon otantifikatè a.');
  }
  return { user, role };
}

function base32Encode(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const output = [];
  for (const char of String(input).toUpperCase().replace(/=+$/g, '').replace(/\s/g, '')) {
    const index = alphabet.indexOf(char);
    if (index < 0) fail(500, 'Kle MFA a pa nan bon fòma.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function base64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encryptionKey(env) {
  const secret = String(env.MFA_ENCRYPTION_KEY || '');
  if (secret.length < 32) fail(503, 'MFA_ENCRYPTION_KEY manke oswa li twò kout. Jenere yon sekrè o aza 32 bytes epi mete li kòm Worker Secret.');
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptMfaSecret(secret, env) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(secret));
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

async function decryptMfaSecret(row, env) {
  const key = await encryptionKey(env);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(row.secret_iv) }, key, new Uint8Array(row.secret_ciphertext));
  return new TextDecoder().decode(clear);
}

async function totpAt(secret, timeMs) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = Math.floor(timeMs / 30000);
  const message = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i -= 1) { message[i] = n & 255; n = Math.floor(n / 256); }
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | ((hmac[offset + 1] & 255) << 16) |
    ((hmac[offset + 2] & 255) << 8) | (hmac[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, '0');
}

function constantTimeCodeMatch(a, b) {
  if (!/^\d{6}$/.test(String(b || '')) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyTotp(secret, supplied) {
  const currentStep = Math.floor(Date.now() / 30000);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    if (constantTimeCodeMatch(await totpAt(secret, step * 30000), supplied)) return step;
  }
  return null;
}

async function handleAdminMfaEnroll(client, identity, env) {
  const { user, role } = await requireAdminMember(client, identity, false);
  const existing = await client.query(
    'SELECT verified_at, disabled_at FROM admin_mfa_credentials WHERE user_id = $1', [user.id]
  );
  if (existing.rowCount) {
    fail(409, 'Gen yon kle MFA deja anrejistre pou kont sa a. Pou rekòmanse oswa chanje aparèy la, swiv pwosedi rekiperasyon administratè a.');
  }
  const random = crypto.getRandomValues(new Uint8Array(20));
  const secret = base32Encode(random);
  const encrypted = await encryptMfaSecret(secret, env);
  const saved = await client.query(
    `INSERT INTO admin_mfa_credentials (user_id, secret_ciphertext, secret_iv, verified_at, last_accepted_counter)
     VALUES ($1,$2,$3,NULL,-1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id`,
    [user.id, encrypted.ciphertext, encrypted.iv]
  );
  if (!saved.rowCount) fail(409, 'MFA deja anrejistre. Kontakte administrasyon sekirite a pou rekiperasyon.');
  await addAudit(client, user.id, role, 'admin_mfa_enrollment_started', 'admin_mfa', user.id, 'success', 'TOTP enrollment inisye.');
  const account = encodeURIComponent(user.email || identity.email);
  const issuer = encodeURIComponent('Kazino Lakay');
  const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { ok: true, secret, otpauthUri: uri, instructions: 'Ajoute kle a nan yon aplikasyon otantifikatè, epi verifye premye kòd 6 chif la. Kle a parèt yon sèl fwa.' };
}

async function handleAdminMfaVerify(client, identity, code, env, request) {
  const { user, role } = await requireAdminMember(client, identity, false);
  if (!identity.tokenHash) fail(401, 'Sesyon an pa kapab verifye. Rekonekte.');
  const recentFailures = await client.query(
    `SELECT COUNT(*)::int AS count FROM security_events
      WHERE user_id=$1 AND event_type='admin_mfa_failed' AND created_at >= now() - interval '15 minutes'`,
    [user.id]
  );
  if (Number(recentFailures.rows[0]?.count || 0) >= 5) {
    fail(429, 'Gen twòp tantativ MFA ki echwe. Tann omwen 15 minit anvan ou eseye ankò.');
  }
  const result = await client.query(
    `SELECT secret_ciphertext, secret_iv FROM admin_mfa_credentials
      WHERE user_id = $1 AND disabled_at IS NULL`, [user.id]
  );
  if (!result.rowCount) fail(404, 'Konfigire MFA anvan ou verifye kòd la.');
  const secret = await decryptMfaSecret(result.rows[0], env);
  const matchedStep = await verifyTotp(secret, code);
  if (matchedStep === null) {
    const [ipHash, agentHash] = await Promise.all([
      keyedHash(request.headers.get('CF-Connecting-IP') || '', env),
      keyedHash(request.headers.get('User-Agent') || '', env)
    ]);
    await client.query(
      `INSERT INTO security_events (user_id,event_type,severity,ip_hash,user_agent_hash,metadata)
       VALUES ($1,'admin_mfa_failed','high',$2,$3,'{}'::jsonb)`, [user.id, ipHash, agentHash]
    );
    const attempts = await client.query(
      `SELECT COUNT(*)::int AS count FROM security_events
        WHERE user_id=$1 AND event_type='admin_mfa_failed' AND created_at >= now() - interval '15 minutes'`, [user.id]
    );
    const attemptCount = Number(attempts.rows[0]?.count || 0);
    if (attemptCount >= 5) {
      const bucket = Math.floor(Date.now() / 900000);
      await client.query(
        `INSERT INTO fraud_alerts (user_id,signal_code,risk_score,severity,evidence,signal_key)
         VALUES ($1,'repeated_admin_mfa_failures',80,'high',$2::jsonb,$3)
         ON CONFLICT (signal_key) DO NOTHING`,
        [user.id, JSON.stringify({ failedAttemptsLast15Minutes: attemptCount }), `admin-mfa-fail:${user.id}:${bucket}`]
      );
    }
    await addAudit(client, user.id, role, 'admin_mfa_verification', 'admin_mfa', user.id, 'denied', 'Kòd TOTP pa valab.');
    fail(401, 'Kòd MFA a pa valab oswa li ekspire. Eseye pwochen kòd la.');
  }
  const accepted = await client.query(
    `UPDATE admin_mfa_credentials SET verified_at=COALESCE(verified_at,now()), last_accepted_counter=$2
      WHERE user_id=$1 AND disabled_at IS NULL AND last_accepted_counter < $2 RETURNING user_id`,
    [user.id, matchedStep]
  );
  if (!accepted.rowCount) fail(409, 'Kòd sa a deja sèvi. Tann pwochen kòd 6 chif la.');
  await client.query(
    `INSERT INTO admin_mfa_sessions (user_id, token_hash, expires_at)
     VALUES ($1,$2,now() + interval '10 minutes')
     ON CONFLICT (user_id, token_hash) DO UPDATE SET verified_at = now(), expires_at = now() + interval '10 minutes'`,
    [user.id, identity.tokenHash]
  );
  await addAudit(client, user.id, role, 'admin_mfa_verified', 'admin_mfa', user.id, 'success');
  return { ok: true, verified: true, expiresInSeconds: 600 };
}

async function openKycCase() {
  fail(503, 'Entegrasyon KYC ak verifikasyon laj la poko konstwi ak teste. Pa voye dokiman idantite; kont lan rete bloke.');
}

async function setResponsibleLimits(client, user, body) {
  const currency = normaliseCurrency(body.currency);
  const fields = {
    dailyDepositLimitMinor: 'daily_deposit_limit_minor',
    weeklyDepositLimitMinor: 'weekly_deposit_limit_minor',
    dailyWagerLimitMinor: 'daily_wager_limit_minor',
    dailyLossLimitMinor: 'daily_loss_limit_minor'
  };
  const existing = await client.query('SELECT * FROM responsible_gaming_limits WHERE user_id = $1 AND currency = $2', [user.id, currency]);
  const current = existing.rows[0] || {};
  const updates = {};
  let hasChange = false;
  for (const [input, column] of Object.entries(fields)) {
    if (!(input in body)) continue;
    const raw = body[input];
    const next = raw === null || raw === '' ? null : Number(raw);
    if (next !== null && (!Number.isSafeInteger(next) || next <= 0 || next > 100_000_000_000)) {
      fail(400, `Limit ${input} la dwe yon kantite antye pozitif an santim/goud minimòm.`);
    }
    const previous = current[column] == null ? null : Number(current[column]);
    const loosens = (previous !== null && next === null) || (previous !== null && next !== null && next > previous);
    if (loosens) fail(409, 'Ou kapab bese limit jwèt ou yo touswit. Pou ogmante oswa retire yon limit, yon peryòd refleksyon ak yon pwosedi apa obligatwa.');
    updates[column] = next;
    hasChange = true;
  }
  if (!hasChange) fail(400, 'Pa gen okenn limit pou mete ajou.');
  const values = [user.id, currency, updates.daily_deposit_limit_minor ?? current.daily_deposit_limit_minor ?? null,
    updates.weekly_deposit_limit_minor ?? current.weekly_deposit_limit_minor ?? null,
    updates.daily_wager_limit_minor ?? current.daily_wager_limit_minor ?? null,
    updates.daily_loss_limit_minor ?? current.daily_loss_limit_minor ?? null];
  await client.query(
    `INSERT INTO responsible_gaming_limits
       (user_id,currency,daily_deposit_limit_minor,weekly_deposit_limit_minor,daily_wager_limit_minor,daily_loss_limit_minor)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id,currency) DO UPDATE SET
       daily_deposit_limit_minor = EXCLUDED.daily_deposit_limit_minor,
       weekly_deposit_limit_minor = EXCLUDED.weekly_deposit_limit_minor,
       daily_wager_limit_minor = EXCLUDED.daily_wager_limit_minor,
       daily_loss_limit_minor = EXCLUDED.daily_loss_limit_minor,
       updated_at = now()`, values
  );
  await addAudit(client, user.id, 'player', 'responsible_gaming_limits_updated', 'responsible_gaming_limits', user.id, 'success', 'Limit yo bese oswa rete menm jan.');
  return { ok: true, limits: (await getCompliance(client, user.id)).limits };
}

async function selfExclude(client, user, body) {
  const duration = String(body.duration || '');
  const durations = { '1_day': 1, '7_days': 7, '30_days': 30, '90_days': 90, '365_days': 365 };
  const permanent = duration === 'permanent';
  if (!permanent && !(duration in durations)) fail(400, 'Chwazi 1, 7, 30, 90, 365 jou oswa eksklizyon pèmanan.');
  const active = await client.query(
    `SELECT id FROM self_exclusions WHERE user_id = $1 AND starts_at <= now() AND (permanent = TRUE OR ends_at > now()) LIMIT 1`, [user.id]
  );
  if (active.rowCount) fail(409, 'Gen yon oto-eksklizyon ki deja aktif. Li pa kapab anile anvan dat li fini.');
  const reason = String(body.reasonCode || 'user_request').slice(0, 40);
  const result = await client.query(
    `INSERT INTO self_exclusions (user_id, reason_code, ends_at, permanent, requested_by)
     VALUES ($1,$2,CASE WHEN $3 THEN NULL ELSE now() + make_interval(days => $4) END,$3,$1)
     RETURNING id, starts_at, ends_at, permanent`,
    [user.id, reason, permanent, permanent ? 0 : durations[duration]]
  );
  await addAudit(client, user.id, 'player', 'self_exclusion_started', 'self_exclusion', result.rows[0].id);
  return { ok: true, exclusion: result.rows[0], message: 'Oto-eksklizyon an aktive. Ou pa kapab jwe pandan peryòd sa a.' };
}

async function getAdminSummary(client, user, role) {
  const [users, cases, exclusions, alerts, security] = await Promise.all([
    client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE account_status='active')::int AS active, COUNT(*) FILTER (WHERE account_status='suspended')::int AS suspended FROM app_users`),
    client.query(`SELECT COUNT(*)::int AS pending FROM kyc_cases WHERE case_status IN ('pending','in_review')`),
    client.query(`SELECT COUNT(DISTINCT user_id)::int AS active FROM self_exclusions WHERE starts_at <= now() AND (permanent=TRUE OR ends_at>now())`),
    client.query(`SELECT COUNT(*)::int AS open FROM fraud_alerts WHERE alert_status IN ('open','investigating')`),
    client.query(`SELECT COUNT(*)::int AS last_24h FROM security_events WHERE created_at >= now() - interval '24 hours'`)
  ]);
  await addAudit(client, user.id, role, 'admin_production_summary_viewed', 'dashboard', null);
  return { users: users.rows[0], kycPending: cases.rows[0].pending, selfExcludedUsers: exclusions.rows[0].active, openFraudAlerts: alerts.rows[0].open, securityEventsLast24h: security.rows[0].last_24h, paymentsEnabled: false, realMoneyGamesEnabled: false };
}

async function handleAdminUsers(client, searchTerm = '') {
  const result = await client.query(
    `SELECT u.id, u.email, u.display_name, u.account_status, u.kyc_status,
            u.age_verification_status, u.email_verified, u.created_at,
            COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.role IS NOT NULL), ARRAY['player']) AS roles
       FROM app_users u LEFT JOIN user_roles r ON r.user_id=u.id AND r.revoked_at IS NULL
      WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`,
    [searchTerm]
  );
  return { users: result.rows };
}

async function managePlayerAccount(client, actor, body) {
  const targetId = String(body.targetUserId || '').trim();
  const action = String(body.action || '').trim();
  const reason = String(body.reason || '').trim();
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
    fail(400, 'ID kont jwè a pa valab.');
  }
  if (!['suspend','reactivate'].includes(action)) fail(400, 'Aksyon an dwe suspend oswa reactivate.');
  if (reason.length < 10 || reason.length > 500) fail(400, 'Bay yon rezon ant 10 ak 500 karaktè.');
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) fail(400, 'Kle idempotans lan pa valab.');

  const actionCode = action === 'suspend' ? 'suspend_player' : 'reactivate_player';
  const expectedFrom = action === 'suspend' ? 'active' : 'suspended';
  const nextStatus = action === 'suspend' ? 'suspended' : 'active';

  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [idempotencyKey]);
    const replay = await client.query(
      `SELECT actor_user_id, target_user_id, action, previous_status, new_status, reason
         FROM admin_account_actions WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (replay.rowCount) {
      const prior = replay.rows[0];
      if (prior.actor_user_id !== actor.id || prior.target_user_id !== targetId ||
          prior.action !== actionCode || prior.reason !== reason) {
        fail(409, 'Kle idempotans sa a te sèvi pou yon lòt aksyon.');
      }
      await client.query('COMMIT');
      return { ok: true, replayed: true, userId: targetId, accountStatus: prior.new_status };
    }

    const targetResult = await client.query(
      `SELECT u.id, u.account_status, u.email_verified,
              COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.role IS NOT NULL), ARRAY['player']) AS roles
         FROM app_users u
         LEFT JOIN user_roles r ON r.user_id = u.id AND r.revoked_at IS NULL
        WHERE u.id = $1
        GROUP BY u.id
        FOR UPDATE OF u`,
      [targetId]
    );
    if (!targetResult.rowCount) fail(404, 'Kont jwè sa a pa jwenn.');
    const target = targetResult.rows[0];
    if (target.id === actor.id) fail(400, 'Ou pa kapab sispann oswa reyaktive pwòp kont ou.');
    if (target.roles.some((role) => ['admin','compliance','finance','support','auditor'].includes(role))) {
      fail(409, 'Kont ki gen wòl administrasyon mande yon pwosedi separe ak verifikasyon an doub.');
    }
    if (target.account_status !== expectedFrom) {
      fail(409, action === 'suspend'
        ? 'Se sèlman kont aktif ki kapab sispann.'
        : 'Se sèlman kont sispann ki kapab reyaktive.');
    }
    if (action === 'reactivate' && !target.email_verified) {
      fail(409, 'Kont lan pa kapab reyaktive anvan imel li verifye.');
    }

    await client.query(
      `UPDATE app_users SET account_status = $1, updated_at = now() WHERE id = $2`,
      [nextStatus, targetId]
    );
    await client.query(
      `INSERT INTO admin_account_actions
         (idempotency_key, actor_user_id, target_user_id, action, previous_status, new_status, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [idempotencyKey, actor.id, targetId, actionCode, expectedFrom, nextStatus, reason]
    );
    await addAudit(
      client, actor.id, 'admin', action === 'suspend' ? 'player_account_suspended' : 'player_account_reactivated',
      'app_users', targetId, 'success', reason, { previousStatus: expectedFrom, newStatus: nextStatus, idempotencyKey }
    );
    await client.query('COMMIT');
    return { ok: true, replayed: false, userId: targetId, accountStatus: nextStatus };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function health(env) {
  if (!env.HYPERDRIVE?.connectionString) {
    return { service: 'kazino-lakay', status: 'maintenance', mode: 'production', databaseConfigured: false, databaseReady: false, realMoneyGamesEnabled: false, paymentsEnabled: false, securityMonitoringConfigured: String(env.SECURITY_HASH_SALT || '').length >= 32, kycProviderConfigured: false, reason: 'HYPERDRIVE_NOT_CONFIGURED' };
  }
  try {
    return await withDb(env, async (client) => {
      const result = await client.query(`
        SELECT
          to_regclass('public.app_users') IS NOT NULL
          AND to_regclass('public.wallet_accounts') IS NOT NULL
          AND to_regclass('public.ledger_transactions') IS NOT NULL
          AND to_regclass('public.ledger_entries') IS NOT NULL
          AND to_regclass('public.game_catalog') IS NOT NULL
          AND to_regclass('public.game_rounds') IS NOT NULL
          AND to_regclass('public.admin_account_actions') IS NOT NULL
          AND EXISTS (SELECT 1 FROM schema_migrations WHERE version='0001_production_foundation')
          AND EXISTS (SELECT 1 FROM schema_migrations WHERE version='0002_locked_game_registry')
          AND EXISTS (SELECT 1 FROM schema_migrations WHERE version='0003_admin_account_controls') AS schema_ready,
          current_timestamp AS checked_at
      `);
      const ready = result.rows[0]?.schema_ready === true;
      return { service: 'kazino-lakay', status: ready ? 'ok' : 'maintenance', mode: 'production', databaseConfigured: true, databaseReady: ready, realMoneyGamesEnabled: false, paymentsEnabled: false, securityMonitoringConfigured: String(env.SECURITY_HASH_SALT || '').length >= 32, kycProviderConfigured: false, schema: ready ? '0001+0002+0003' : 'migrations_missing', checkedAt: result.rows[0]?.checked_at || null };
    });
  } catch {
    return { service: 'kazino-lakay', status: 'maintenance', mode: 'production', databaseConfigured: true, databaseReady: false, realMoneyGamesEnabled: false, paymentsEnabled: false, securityMonitoringConfigured: String(env.SECURITY_HASH_SALT || '').length >= 32, kycProviderConfigured: false, reason: 'DATABASE_CHECK_FAILED' };
  }
}

export async function handleProductionRoute(request, env, verifyIdentity) {
  const { pathname, searchParams } = new URL(request.url);
  if (pathname === '/api/production/health' && request.method === 'GET') return json(await health(env));
  if (pathname === '/api/games' && request.method === 'GET') {
    return json({
      mode: 'production',
      games: PRODUCTION_GAME_CATALOG,
      count: PRODUCTION_GAME_CATALOG.length,
      enabled: false,
      gameSettings: Object.fromEntries(PRODUCTION_GAME_CATALOG.map((game) => [game.id, { enabled: false, releasePhase: game.releasePhase }])),
      enabledGameCount: 0,
      releasePhase: 'phase_4_pending',
      maintenanceMessage: '22 jwèt yo parèt nan katalòg production lan, men tout rete bloke pandan analiz règ, matematik, verifikasyon sekirite ak apwobasyon legal Faz 4 yo.'
    });
  }
  if (pathname === '/api/games/demo' || pathname === '/api/games/play') {
    return json({ error: 'Jwèt yo dezaktive nan mòd pwodiksyon pandan verifikasyon ak Faz 4 yo poko fini.', mode: 'production', realMoneyGamesEnabled: false, paymentsEnabled: false }, 423);
  }
  if (!pathname.startsWith('/api/')) return null;

  try {
    if (pathname === '/api/profile/bootstrap' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, false);
      const body = await readBody(request);
      const displayName = String(body.displayName || identity.name || '').trim().slice(0, 60);
      return await withDb(env, async (client) => {
        const user = await upsertUser(client, identity, displayName);
        await recordSecurityContext(client, identity, request, env, 'profile_bootstrap');
        return json(await profilePayload(client, user));
      });
    }

    if (pathname === '/api/me' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, false);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste. Rekonekte pou kreye li.');
        return json(await profilePayload(client, user));
      });
    }

    if (pathname === '/api/wallet' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        const [accounts, transactions] = await Promise.all([
          currentWallet(client, user.id),
          client.query(
            `SELECT t.id, t.transaction_type, t.created_at, e.entry_side, e.amount_minor, e.currency,
                   CASE WHEN e.entry_side='credit' THEN e.amount_minor ELSE -e.amount_minor END AS delta_minor
               FROM ledger_transactions t JOIN ledger_entries e ON e.transaction_id=t.id
               JOIN wallet_accounts a ON a.id=e.account_id
              WHERE a.owner_type='user' AND a.owner_id=$1 AND a.account_kind='player_wallet'
              ORDER BY t.created_at DESC LIMIT 30`, [user.id]
          )
        ]);
        const htg = accounts.find((account) => account.currency === 'HTG');
        return json({ wallet: { uid: identity.uid, currency: 'HTG', balanceMinor: Number(htg?.balance_minor || 0), balancePoints: 0, accountStatus: htg?.account_status || 'active', mode: 'production', depositsEnabled: false, withdrawalsEnabled: false }, accounts, transactions: transactions.rows });
      });
    }

    if (pathname === '/api/compliance/status' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        const compliance = await getCompliance(client, user.id);
        return json({ kycStatus: user.kyc_status, ageVerificationStatus: user.age_verification_status, accountStatus: user.account_status, selfExcluded: compliance.selfExcluded, selfExclusion: compliance.selfExclusion, limits: compliance.limits, canPlay: false, reason: 'LEGAL_AND_GAME_ENGINE_LOCK' });
      });
    }

    if (pathname === '/api/compliance/kyc/start' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        return json(await openKycCase(client, user, env), 202);
      });
    }

    if (pathname === '/api/compliance/limits' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        return json({ limits: (await getCompliance(client, user.id)).limits });
      });
    }

    if (pathname === '/api/compliance/limits' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, true);
      const body = await readBody(request);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        return json(await setResponsibleLimits(client, user, body));
      });
    }

    if (pathname === '/api/compliance/self-exclusion' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, true);
      const body = await readBody(request);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        return json(await selfExclude(client, user, body), 201);
      });
    }

    if (pathname === '/api/security/admin-mfa/status' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const { user } = await requireAdminMember(client, identity, false);
        const [credential, session] = await Promise.all([
          client.query('SELECT 1 FROM admin_mfa_credentials WHERE user_id = $1 AND disabled_at IS NULL LIMIT 1', [user.id]),
          client.query('SELECT 1 FROM admin_mfa_sessions WHERE user_id = $1 AND token_hash = $2 AND expires_at > now() LIMIT 1', [user.id, identity.tokenHash])
        ]);
        return json({ enrolled: credential.rowCount > 0, verified: session.rowCount > 0, expiresInSeconds: session.rowCount ? 600 : 0 });
      });
    }

    if (pathname === '/api/security/admin-mfa/enroll' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => json(await handleAdminMfaEnroll(client, identity, env)));
    }

    if (pathname === '/api/security/admin-mfa/verify' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, true);
      const body = await readBody(request);
      return await withDb(env, async (client) => json(await handleAdminMfaVerify(client, identity, String(body.code || ''), env, request)));
    }

    if (pathname === '/api/admin/production/summary' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const { user, role } = await requireAdminMember(client, identity, true, ['admin', 'compliance', 'finance', 'auditor', 'support']);
        return json(await getAdminSummary(client, user, role));
      });
    }

    if (pathname === '/api/admin/production/users/status' && request.method === 'POST') {
      const identity = await verifyIdentity(request, env, true);
      const body = await readBody(request);
      return await withDb(env, async (client) => {
        const { user } = await requireAdminMember(client, identity, true, ['admin']);
        return json(await managePlayerAccount(client, user, body));
      });
    }

    if (pathname === '/api/admin/production/users' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const { user, role } = await requireAdminMember(client, identity, true, ['admin', 'compliance', 'support']);
        await addAudit(client, user.id, role, 'admin_production_users_viewed', 'app_users', null);
        const query = String(searchParams.get('q') || '').trim().slice(0, 100);
        return json(await handleAdminUsers(client, query));
      });
    }

    if (pathname === '/api/admin/production/audit' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const { user, role } = await requireAdminMember(client, identity, true, ['admin', 'auditor', 'compliance']);
        await addAudit(client, user.id, role, 'admin_audit_viewed', 'audit_logs', null);
        const rows = await client.query(`SELECT id, actor_user_id, actor_role, action, target_type, target_id, outcome, reason, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
        return json({ logs: rows.rows });
      });
    }

    if (pathname.startsWith('/api/admin/')) {
      return json({ error: 'Ansyen API administrasyon ki te baze sou pwen/Firestore la fèmen nan mòd pwodiksyon. Sèvi ak nouvo API /api/admin/production yo.' }, 410);
    }

    if (pathname === '/api/history' && request.method === 'GET') {
      const identity = await verifyIdentity(request, env, true);
      return await withDb(env, async (client) => {
        const user = await getUserBySubject(client, identity.uid);
        if (!user) fail(404, 'Pwofil pwodiksyon an poko egziste.');
        return json({ items: [], mode: 'production', message: 'Istwa paryaj la ap antre nan Faz 4; okenn ansyen pwen demonstrasyon pa enpòte.' });
      });
    }

    if (pathname === '/api/production/ready' && request.method === 'GET') return json(await health(env));
    if (searchParams.has('debug')) return json({ error: 'Debug pa disponib nan pwodiksyon.' }, 404);
    return null;
  } catch (error) {
    const status = error instanceof ProductionError ? error.status : Number(error?.status) || 500;
    const message = error instanceof ProductionError ? error.message : (error?.status ? String(error.message || 'Demann lan pa otorize.') : 'Yon erè pwodiksyon rive. Gade Worker Logs pou detay teknik; pa pataje sekrè yo.');
    console.error('[Kazino Lakay production API]', status, error?.code || error?.name || 'Error');
    return json({ error: message }, status);
  }
}

export async function productionHealth(env) {
  return health(env);
}
