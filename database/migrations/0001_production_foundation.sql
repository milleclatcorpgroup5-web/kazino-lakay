-- Kazino Lakay production foundation
-- PostgreSQL 14+ (Cloudflare Hyperdrive-compatible)
-- This migration creates accounts and controls only. It does NOT enable deposits,
-- withdrawals, wagers, or real-money game settlement.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider TEXT NOT NULL DEFAULT 'firebase' CHECK (auth_provider IN ('firebase')),
  auth_subject TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (account_status IN ('pending_review','active','suspended','closed')),
  kyc_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (kyc_status IN ('not_started','pending','approved','rejected','review_required')),
  age_verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (age_verification_status IN ('unverified','pending','verified','rejected')),
  age_verified_at TIMESTAMPTZ,
  kyc_verified_at TIMESTAMPTZ,
  country_code CHAR(2),
  locale TEXT NOT NULL DEFAULT 'ht',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, auth_subject),
  CHECK (email = lower(email))
);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_uq ON app_users (lower(email));
CREATE INDEX IF NOT EXISTS app_users_status_created_idx ON app_users (account_status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_users_kyc_status_idx ON app_users (kyc_status, age_verification_status);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('player','admin','compliance','finance','support','auditor')),
  granted_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_active_unique_idx ON user_roles (user_id, role) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS user_roles_active_user_idx ON user_roles (user_id, role) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user','platform','provider','clearing','house')),
  owner_id UUID,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('player_wallet','platform_cash','provider_clearing','house_revenue','suspense')),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  normal_balance TEXT NOT NULL DEFAULT 'credit' CHECK (normal_balance IN ('debit','credit')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','frozen','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((owner_type = 'user' AND owner_id IS NOT NULL) OR (owner_type <> 'user'))
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_accounts_owner_currency_uq ON wallet_accounts (owner_type, owner_id, account_kind, currency) WHERE owner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_accounts_system_currency_uq ON wallet_accounts (owner_type, account_kind, currency) WHERE owner_id IS NULL;
CREATE INDEX IF NOT EXISTS wallet_accounts_owner_idx ON wallet_accounts (owner_type, owner_id);

-- System accounts are created with accounting-normal balances: assets are debit-normal;
-- revenue and suspense/liability accounts are credit-normal. They contain no money.
INSERT INTO wallet_accounts (owner_type, owner_id, account_kind, currency, normal_balance, account_status)
VALUES
  ('platform', NULL, 'platform_cash', 'HTG', 'debit', 'active'),
  ('platform', NULL, 'platform_cash', 'USD', 'debit', 'active'),
  ('platform', NULL, 'platform_cash', 'EUR', 'debit', 'active'),
  ('provider', NULL, 'provider_clearing', 'HTG', 'debit', 'active'),
  ('provider', NULL, 'provider_clearing', 'USD', 'debit', 'active'),
  ('provider', NULL, 'provider_clearing', 'EUR', 'debit', 'active'),
  ('house', NULL, 'house_revenue', 'HTG', 'credit', 'active'),
  ('house', NULL, 'house_revenue', 'USD', 'credit', 'active'),
  ('house', NULL, 'house_revenue', 'EUR', 'credit', 'active'),
  ('clearing', NULL, 'suspense', 'HTG', 'credit', 'active'),
  ('clearing', NULL, 'suspense', 'USD', 'credit', 'active'),
  ('clearing', NULL, 'suspense', 'EUR', 'credit', 'active')
ON CONFLICT (owner_type, account_kind, currency) WHERE owner_id IS NULL DO NOTHING;

-- App users receive only a player role and an empty HTG wallet automatically.
-- Runtime application code cannot insert privileged roles or platform accounts.
CREATE OR REPLACE FUNCTION create_default_user_records() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'player')
  ON CONFLICT (user_id, role) WHERE revoked_at IS NULL DO NOTHING;
  INSERT INTO wallet_accounts (owner_type, owner_id, account_kind, currency, normal_balance, account_status)
  VALUES ('user', NEW.id, 'player_wallet', 'HTG', 'credit', 'active')
  ON CONFLICT (owner_type, owner_id, account_kind, currency) WHERE owner_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION create_default_user_records() FROM PUBLIC;
DROP TRIGGER IF EXISTS app_users_default_records ON app_users;
CREATE TRIGGER app_users_default_records
AFTER INSERT ON app_users
FOR EACH ROW EXECUTE FUNCTION create_default_user_records();

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  transaction_type TEXT NOT NULL,
  transaction_status TEXT NOT NULL DEFAULT 'posted' CHECK (transaction_status IN ('posted','reversed')),
  actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  CHECK (length(idempotency_key) BETWEEN 8 AND 160)
);
CREATE INDEX IF NOT EXISTS ledger_transactions_created_idx ON ledger_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_transactions_type_idx ON ledger_transactions (transaction_type, created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  entry_side TEXT NOT NULL CHECK (entry_side IN ('debit','credit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_transaction_idx ON ledger_entries (transaction_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_created_idx ON ledger_entries (account_id, created_at DESC);

-- For wallet/liability accounts, a credit increases the user's available balance.
-- Balances are derived from immutable ledger entries, never edited directly.
CREATE OR REPLACE VIEW wallet_balances AS
SELECT
  a.id AS account_id,
  a.owner_type,
  a.owner_id,
  a.account_kind,
  a.currency,
  a.normal_balance,
  a.account_status,
  COALESCE(b.balance_minor, 0)::BIGINT AS balance_minor
FROM wallet_accounts a
LEFT JOIN (
  SELECT e.account_id,
         SUM(CASE WHEN e.entry_side = a.normal_balance THEN e.amount_minor ELSE -e.amount_minor END)::BIGINT AS balance_minor
    FROM ledger_entries e
    JOIN wallet_accounts a ON a.id = e.account_id
    JOIN ledger_transactions t ON t.id = e.transaction_id AND t.transaction_status = 'posted'
   GROUP BY e.account_id
) b ON b.account_id = a.id;

-- Posted accounting evidence is append-only. Corrections must be new, linked
-- reversal transactions; no historical entry may be edited or deleted.
CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'posted_ledger_is_immutable' USING ERRCODE = '55000';
END;
$$;
DROP TRIGGER IF EXISTS ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
DROP TRIGGER IF EXISTS ledger_transactions_immutable ON ledger_transactions;
CREATE TRIGGER ledger_transactions_immutable
BEFORE UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

-- Atomic double-entry posting with idempotency. The idempotency key must be unique
-- per business request; a replay with an identical payload returns the original id.
CREATE OR REPLACE FUNCTION post_ledger_transaction(
  p_idempotency_key TEXT,
  p_transaction_type TEXT,
  p_actor_user_id UUID,
  p_entries JSONB,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_external_reference TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hash TEXT;
  v_existing ledger_transactions%ROWTYPE;
  v_transaction_id UUID;
  v_entry_count INTEGER;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;
  IF p_transaction_type IS NULL OR length(trim(p_transaction_type)) = 0 OR length(p_transaction_type) > 80 THEN
    RAISE EXCEPTION 'invalid_transaction_type' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'entries_must_be_array' USING ERRCODE = '22023';
  END IF;
  v_entry_count := jsonb_array_length(p_entries);
  IF v_entry_count < 2 OR v_entry_count > 100 THEN
    RAISE EXCEPTION 'invalid_entry_count' USING ERRCODE = '22023';
  END IF;
  v_hash := encode(digest(convert_to(p_transaction_type || '|' || COALESCE(p_actor_user_id::TEXT, '') || '|' || p_entries::TEXT || '|' || COALESCE(p_metadata, '{}'::jsonb)::TEXT || '|' || COALESCE(p_external_reference, ''), 'UTF8'), 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  SELECT * INTO v_existing FROM ledger_transactions WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash OR v_existing.transaction_type <> p_transaction_type THEN
      RAISE EXCEPTION 'idempotency_key_reused_with_different_payload' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS e(account_id UUID, entry_side TEXT, amount_minor BIGINT, currency TEXT)
    LEFT JOIN wallet_accounts a ON a.id = e.account_id
    WHERE a.id IS NULL
       OR a.account_status <> 'active'
       OR a.currency <> e.currency
       OR e.entry_side IS NULL OR e.entry_side NOT IN ('debit','credit')
       OR e.amount_minor IS NULL OR e.amount_minor <= 0
       OR e.currency IS NULL OR e.currency !~ '^[A-Z]{3}$'
  ) THEN
    RAISE EXCEPTION 'invalid_or_inactive_ledger_account' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT e.currency
    FROM jsonb_to_recordset(p_entries) AS e(account_id UUID, entry_side TEXT, amount_minor BIGINT, currency TEXT)
    GROUP BY e.currency
    HAVING SUM(CASE WHEN e.entry_side = 'debit' THEN e.amount_minor ELSE -e.amount_minor END) <> 0
  ) THEN
    RAISE EXCEPTION 'ledger_entries_not_balanced_per_currency' USING ERRCODE = '23514';
  END IF;

  -- Serialize postings that touch the same wallets before checking available balance.
  PERFORM 1 FROM wallet_accounts a
   WHERE a.id IN (SELECT e.account_id FROM jsonb_to_recordset(p_entries) AS e(account_id UUID, entry_side TEXT, amount_minor BIGINT, currency TEXT))
   ORDER BY a.id FOR UPDATE;

  INSERT INTO ledger_transactions (idempotency_key, request_hash, transaction_type, actor_user_id, external_reference, metadata)
  VALUES (p_idempotency_key, v_hash, p_transaction_type, p_actor_user_id, p_external_reference, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_transaction_id;

  INSERT INTO ledger_entries (transaction_id, account_id, entry_side, amount_minor, currency)
  SELECT v_transaction_id, e.account_id, e.entry_side, e.amount_minor, e.currency
  FROM jsonb_to_recordset(p_entries) AS e(account_id UUID, entry_side TEXT, amount_minor BIGINT, currency TEXT);

  -- A player's wallet is a liability account: it cannot become negative.
  IF EXISTS (
    SELECT 1
    FROM wallet_balances b
    JOIN wallet_accounts a ON a.id = b.account_id
    WHERE a.account_kind = 'player_wallet'
      AND b.balance_minor < 0
      AND a.id IN (
        SELECT e.account_id
        FROM jsonb_to_recordset(p_entries) AS e(account_id UUID, entry_side TEXT, amount_minor BIGINT, currency TEXT)
      )
  ) THEN
    RAISE EXCEPTION 'player_wallet_insufficient_funds' USING ERRCODE = '23514';
  END IF;

  RETURN v_transaction_id;
END;
$$;
REVOKE ALL ON FUNCTION post_ledger_transaction(TEXT, TEXT, UUID, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON ledger_transactions, ledger_entries FROM PUBLIC;

CREATE TABLE IF NOT EXISTS kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  provider_code TEXT NOT NULL,
  provider_reference TEXT,
  case_status TEXT NOT NULL DEFAULT 'pending' CHECK (case_status IN ('pending','in_review','approved','rejected','expired','error')),
  age_result TEXT NOT NULL DEFAULT 'unverified' CHECK (age_result IN ('unverified','pending','verified','rejected')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decision_reason_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider_code, provider_reference)
);
CREATE INDEX IF NOT EXISTS kyc_cases_user_idx ON kyc_cases (user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS kyc_cases_status_idx ON kyc_cases (case_status, opened_at DESC);

CREATE TABLE IF NOT EXISTS responsible_gaming_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  daily_deposit_limit_minor BIGINT CHECK (daily_deposit_limit_minor IS NULL OR daily_deposit_limit_minor > 0),
  weekly_deposit_limit_minor BIGINT CHECK (weekly_deposit_limit_minor IS NULL OR weekly_deposit_limit_minor > 0),
  daily_wager_limit_minor BIGINT CHECK (daily_wager_limit_minor IS NULL OR daily_wager_limit_minor > 0),
  daily_loss_limit_minor BIGINT CHECK (daily_loss_limit_minor IS NULL OR daily_loss_limit_minor > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);

CREATE OR REPLACE FUNCTION prevent_responsible_limit_increase() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.daily_deposit_limit_minor IS NOT NULL AND (NEW.daily_deposit_limit_minor IS NULL OR NEW.daily_deposit_limit_minor > OLD.daily_deposit_limit_minor))
     OR (OLD.weekly_deposit_limit_minor IS NOT NULL AND (NEW.weekly_deposit_limit_minor IS NULL OR NEW.weekly_deposit_limit_minor > OLD.weekly_deposit_limit_minor))
     OR (OLD.daily_wager_limit_minor IS NOT NULL AND (NEW.daily_wager_limit_minor IS NULL OR NEW.daily_wager_limit_minor > OLD.daily_wager_limit_minor))
     OR (OLD.daily_loss_limit_minor IS NOT NULL AND (NEW.daily_loss_limit_minor IS NULL OR NEW.daily_loss_limit_minor > OLD.daily_loss_limit_minor)) THEN
    RAISE EXCEPTION 'responsible_gaming_limits_cannot_be_raised_or_removed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS responsible_limits_no_increase ON responsible_gaming_limits;
CREATE TRIGGER responsible_limits_no_increase
BEFORE UPDATE ON responsible_gaming_limits
FOR EACH ROW EXECUTE FUNCTION prevent_responsible_limit_increase();

CREATE TABLE IF NOT EXISTS self_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  reason_code TEXT NOT NULL DEFAULT 'user_request',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  permanent BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((permanent = TRUE AND ends_at IS NULL) OR (permanent = FALSE AND ends_at IS NOT NULL AND ends_at > starts_at))
);
CREATE INDEX IF NOT EXISTS self_exclusions_active_idx ON self_exclusions (user_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('login_step_up','withdrawal','profile_change','account_recovery')),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','authenticator')),
  destination_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_challenges_user_purpose_idx ON otp_challenges (user_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_mfa_credentials (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE RESTRICT,
  secret_ciphertext BYTEA NOT NULL,
  secret_iv BYTEA NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA1' CHECK (algorithm = 'SHA1'),
  digits SMALLINT NOT NULL DEFAULT 6 CHECK (digits = 6),
  period_seconds SMALLINT NOT NULL DEFAULT 30 CHECK (period_seconds = 30),
  verified_at TIMESTAMPTZ,
  last_accepted_counter BIGINT NOT NULL DEFAULT -1,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_mfa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, token_hash)
);
CREATE INDEX IF NOT EXISTS admin_mfa_sessions_expiry_idx ON admin_mfa_sessions (expires_at);

CREATE TABLE IF NOT EXISTS payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  wallet_account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  provider_code TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  request_status TEXT NOT NULL DEFAULT 'disabled' CHECK (request_status IN ('disabled','pending','processing','confirmed','failed','cancelled','reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  wallet_account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  provider_code TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  request_status TEXT NOT NULL DEFAULT 'disabled' CHECK (request_status IN ('disabled','pending','under_review','approved','processing','paid','rejected','cancelled','failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_user_idx ON security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON security_events (severity, created_at DESC);
DROP TRIGGER IF EXISTS security_events_immutable ON security_events;
CREATE TRIGGER security_events_immutable
BEFORE UPDATE OR DELETE ON security_events
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  actor_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','denied','failed')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  signal_code TEXT NOT NULL,
  risk_score SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  alert_status TEXT NOT NULL DEFAULT 'open' CHECK (alert_status IN ('open','investigating','cleared','confirmed')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  signal_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS fraud_alerts_status_created_idx ON fraud_alerts (alert_status, created_at DESC);

-- Payment providers are deliberately seeded as disabled placeholders.
INSERT INTO payment_provider_configs (provider_code, display_name, enabled, environment, capabilities)
VALUES
  ('moncash', 'MonCash', FALSE, 'sandbox', '{"deposits":false,"withdrawals":false}'::jsonb),
  ('natcash', 'NatCash', FALSE, 'sandbox', '{"deposits":false,"withdrawals":false}'::jsonb)
ON CONFLICT (provider_code) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('0001_production_foundation')
ON CONFLICT (version) DO NOTHING;

-- Deployment security note:
-- Run the Worker with a dedicated PostgreSQL role, not the database owner.
-- Grant only the DML required for app_users, user_roles, wallet_accounts,
-- compliance tables, security_events, audit_logs and fraud_alerts. Revoke direct
-- INSERT/UPDATE/DELETE on ledger_transactions and ledger_entries from the runtime
-- role; expose ledger posting only through a separately reviewed SECURITY DEFINER
-- function / controlled service role before any real-money settlement is built.
-- The Worker currently has no route that posts ledger entries or enables payments.

COMMIT;
