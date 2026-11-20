-- Kazino Lakay migration 0002: locked game registry and round/audit storage.
-- The catalog remains disabled. No wagering or settlement endpoint is shipped
-- in Phase 1-3. This migration prepares storage for Phase 4 only.
BEGIN;

CREATE TABLE IF NOT EXISTS game_catalog (
  game_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  release_phase TEXT NOT NULL DEFAULT 'phase_4_pending'
    CHECK (release_phase IN ('phase_4_pending','review','approved','retired')),
  min_stake_minor BIGINT,
  max_stake_minor BIGINT,
  rtp_basis_points INTEGER,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_stake_minor IS NULL OR min_stake_minor > 0),
  CHECK (max_stake_minor IS NULL OR max_stake_minor >= min_stake_minor),
  CHECK (rtp_basis_points IS NULL OR rtp_basis_points BETWEEN 0 AND 10000)
);

INSERT INTO game_catalog (game_id, display_name, category, is_enabled, release_phase)
VALUES
 ('crash','Vòl Eksprès','crash',FALSE,'phase_4_pending'),
 ('slots','Fwi an Lò','slots',FALSE,'phase_4_pending'),
 ('roulette','Roulèt Royal','table',FALSE,'phase_4_pending'),
 ('blackjack','Blackjack 21','cards',FALSE,'phase_4_pending'),
 ('baccarat','Baccarat Lakay','cards',FALSE,'phase_4_pending'),
 ('keno','Keno 20','lottery',FALSE,'phase_4_pending'),
 ('dice','Dice — De Chans','dice',FALSE,'phase_4_pending'),
 ('mines','Mines — Min Lakay','grid',FALSE,'phase_4_pending'),
 ('plinko','Plinko Drop','arcade',FALSE,'phase_4_pending'),
 ('penalty','Penalty Lakay','sports',FALSE,'phase_4_pending'),
 ('coinflip','Coin Flip','chance',FALSE,'phase_4_pending'),
 ('limbo','Limbo','crash',FALSE,'phase_4_pending'),
 ('hilo','Hi-Lo','cards',FALSE,'phase_4_pending'),
 ('scratch','Scratch Cards','lottery',FALSE,'phase_4_pending'),
 ('wheel','Wheel of Fortune','wheel',FALSE,'phase_4_pending'),
 ('sicbo','Sic Bo','dice',FALSE,'phase_4_pending'),
 ('casinowar','Casino War','cards',FALSE,'phase_4_pending'),
 ('dragontiger','Dragon Tiger','cards',FALSE,'phase_4_pending'),
 ('andarbahar','Andar Bahar','cards',FALSE,'phase_4_pending'),
 ('threecard','Poker 3 Kat','cards',FALSE,'phase_4_pending'),
 ('holdem','Texas Hold’em','cards',FALSE,'phase_4_pending'),
 ('bingo','Bingo Lakay','lottery',FALSE,'phase_4_pending')
ON CONFLICT (game_id) DO UPDATE
SET is_enabled = FALSE,
    release_phase = CASE WHEN game_catalog.release_phase = 'retired' THEN 'retired' ELSE 'phase_4_pending' END,
    updated_at = now();

CREATE TABLE IF NOT EXISTS game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  game_id TEXT NOT NULL REFERENCES game_catalog(game_id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  engine_version TEXT,
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  stake_minor BIGINT NOT NULL CHECK (stake_minor > 0),
  payout_minor BIGINT NOT NULL DEFAULT 0 CHECK (payout_minor >= 0),
  round_status TEXT NOT NULL DEFAULT 'blocked'
    CHECK (round_status IN ('blocked','created','settled','voided','review')),
  result_commitment_hash TEXT CHECK (result_commitment_hash IS NULL OR result_commitment_hash ~ '^[a-f0-9]{64}$'),
  result_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  CHECK (round_status <> 'settled' OR settled_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS game_rounds_user_created_idx ON game_rounds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_rounds_game_created_idx ON game_rounds (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_rounds_status_idx ON game_rounds (round_status, created_at DESC);

CREATE TABLE IF NOT EXISTS game_round_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_round_events_round_idx ON game_round_events (round_id, created_at);

DROP TRIGGER IF EXISTS game_round_events_immutable ON game_round_events;
CREATE TRIGGER game_round_events_immutable
BEFORE UPDATE OR DELETE ON game_round_events
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

-- Runtime account deliberately has no INSERT/UPDATE/DELETE rights on game_catalog,
-- game_rounds or game_round_events in Phase 1-3. Phase 4 must add a separate,
-- reviewed game-engine role and server-side settlement workflow.

INSERT INTO schema_migrations (version)
VALUES ('0002_locked_game_registry')
ON CONFLICT (version) DO NOTHING;

COMMIT;
