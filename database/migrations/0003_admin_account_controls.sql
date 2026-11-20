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

-- Privileged state transitions are performed only by this SECURITY DEFINER
-- function. The application role receives EXECUTE, not direct UPDATE access to
-- app_users.account_status or direct write access to this action registry.
CREATE OR REPLACE FUNCTION manage_player_account_status(
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_idempotency_key TEXT,
  p_token_hash TEXT
) RETURNS TABLE (user_id UUID, account_status TEXT, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $
DECLARE
  v_existing admin_account_actions%ROWTYPE;
  v_previous_status TEXT;
  v_next_status TEXT;
  v_email_verified BOOLEAN;
  v_action_code TEXT;
BEGIN
  IF p_actor_user_id IS NULL OR p_target_user_id IS NULL
     OR p_action NOT IN ('suspend','reactivate')
     OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 16 AND 128
     OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}
COMMIT;
 THEN
    RAISE EXCEPTION 'invalid_admin_account_action' USING ERRCODE = '22023';
  END IF;

  IF p_actor_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'admin_cannot_manage_own_account' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM app_users u
      JOIN user_roles r ON r.user_id = u.id AND r.revoked_at IS NULL AND r.role = 'admin'
     WHERE u.id = p_actor_user_id AND u.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM admin_mfa_sessions s
     WHERE s.user_id = p_actor_user_id
       AND s.token_hash = p_token_hash
       AND s.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'admin_mfa_required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  v_action_code := CASE WHEN p_action = 'suspend' THEN 'suspend_player' ELSE 'reactivate_player' END;

  SELECT * INTO v_existing
    FROM admin_account_actions
   WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.actor_user_id <> p_actor_user_id
       OR v_existing.target_user_id <> p_target_user_id
       OR v_existing.action <> v_action_code
       OR v_existing.reason <> trim(p_reason) THEN
      RAISE EXCEPTION 'idempotency_key_reused_with_different_payload' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT p_target_user_id, v_existing.new_status, TRUE;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = p_target_user_id AND revoked_at IS NULL
       AND role IN ('admin','compliance','finance','support','auditor')
  ) THEN
    RAISE EXCEPTION 'privileged_account_requires_separate_review' USING ERRCODE = '42501';
  END IF;

  SELECT account_status, email_verified
    INTO v_previous_status, v_email_verified
    FROM app_users
   WHERE id = p_target_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player_account_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'suspend' THEN
    IF v_previous_status <> 'active' THEN
      RAISE EXCEPTION 'only_active_player_can_be_suspended' USING ERRCODE = '23514';
    END IF;
    v_next_status := 'suspended';
  ELSE
    IF v_previous_status <> 'suspended' THEN
      RAISE EXCEPTION 'only_suspended_player_can_be_reactivated' USING ERRCODE = '23514';
    END IF;
    IF v_email_verified IS NOT TRUE THEN
      RAISE EXCEPTION 'email_verification_required_before_reactivation' USING ERRCODE = '23514';
    END IF;
    v_next_status := 'active';
  END IF;

  UPDATE app_users
     SET account_status = v_next_status, updated_at = now()
   WHERE id = p_target_user_id;

  INSERT INTO admin_account_actions
    (idempotency_key, actor_user_id, target_user_id, action, previous_status, new_status, reason)
  VALUES
    (p_idempotency_key, p_actor_user_id, p_target_user_id, v_action_code,
     v_previous_status, v_next_status, trim(p_reason));

  INSERT INTO audit_logs
    (actor_user_id, actor_role, action, target_type, target_id, outcome, reason, metadata)
  VALUES
    (p_actor_user_id, 'admin',
     CASE WHEN p_action = 'suspend' THEN 'player_account_suspended' ELSE 'player_account_reactivated' END,
     'app_users', p_target_user_id::TEXT, 'success', trim(p_reason),
     jsonb_build_object('previousStatus', v_previous_status, 'newStatus', v_next_status, 'idempotencyKey', p_idempotency_key));

  RETURN QUERY SELECT p_target_user_id, v_next_status, FALSE;
END;
$;
REVOKE ALL ON FUNCTION manage_player_account_status(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

INSERT INTO schema_migrations (version)
VALUES ('0003_admin_account_controls')
ON CONFLICT (version) DO NOTHING;

COMMIT;
