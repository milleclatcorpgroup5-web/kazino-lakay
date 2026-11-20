import { Client } from 'pg';

export async function productionHealth(env) {
  const configured = Boolean(env.HYPERDRIVE?.connectionString);
  const securityReady = String(env.SECURITY_HASH_SALT || '').length >= 32 &&
    String(env.MFA_ENCRYPTION_KEY || '').length >= 32;
  if (!configured) {
    return {
      service: 'kazino-lakay',
      status: 'maintenance',
      mode: 'production',
      databaseConfigured: false,
      databaseReady: false,
      paymentsEnabled: false,
      realMoneyGamesEnabled: false,
      securityMonitoringConfigured: securityReady,
      kycProviderConfigured: false,
      reason: 'HYPERDRIVE_NOT_CONFIGURED'
    };
  }

  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    statement_timeout: 8000,
    query_timeout: 10000,
    application_name: 'kazino-lakay-health'
  });
  try {
    await client.connect();
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
    return {
      service: 'kazino-lakay',
      status: ready ? 'ok' : 'maintenance',
      mode: 'production',
      databaseConfigured: true,
      databaseReady: ready,
      paymentsEnabled: false,
      realMoneyGamesEnabled: false,
      securityMonitoringConfigured: securityReady,
      kycProviderConfigured: false,
      schema: ready ? '0001+0002+0003' : 'migrations_missing',
      checkedAt: result.rows[0]?.checked_at || null
    };
  } catch (error) {
    console.error('[Kazino Lakay health]', error?.code || error?.name || 'DatabaseError');
    return {
      service: 'kazino-lakay',
      status: 'maintenance',
      mode: 'production',
      databaseConfigured: true,
      databaseReady: false,
      paymentsEnabled: false,
      realMoneyGamesEnabled: false,
      securityMonitoringConfigured: securityReady,
      kycProviderConfigured: false,
      reason: 'DATABASE_CHECK_FAILED'
    };
  } finally {
    await client.end().catch(() => {});
  }
}
