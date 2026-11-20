-- Kazino Lakay migration 0003: audited player-account status controls.
-- This adds administrative account suspension/reactivation only. It does not
-- grant privileged roles, modify wallet balances, or enable games/payments.
BEGIN;

CREATE TABLE IF NOT EXISTS admin_account_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE
    CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  actor_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  target_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('suspend_player','reactivate_player')),
  previous_status TEXT NOT NULL CHECK (previous_status IN ('active','suspended')),
  new_status TEXT NOT NULL CHECK (new_status IN ('active','suspended')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (actor_user_id <> target_user_id),
  CHECK (
    (action = 'suspend_player' AND previous_status = 'active' AND new_status = 'suspended')
    OR
    (action = 'reactivate_player' AND previous_status = 'suspended' AND new_status = 'active')
  )
);
CREATE INDEX IF NOT EXISTS admin_account_actions_target_created_idx
  ON admin_account_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_account_actions_actor_created_idx
  ON admin_account_actions (actor_user_id, created_at DESC);

DROP TRIGGER IF EXISTS admin_account_actions_immutable ON admin_account_actions;
CREATE TRIGGER admin_account_actions_immutable
BEFORE UPDATE OR DELETE ON admin_account_actions
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

INSERT INTO schema_migrations (version)
VALUES ('0003_admin_account_controls')
ON CONFLICT (version) DO NOTHING;

COMMIT;
