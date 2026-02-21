-- ============================================================================
-- JAVARI REVENUE & BILLING SCHEMA
-- CR AudioViz AI — STEP 5 implementation
-- Created: 2026-02-20
-- Tables: user_subscription, user_entitlements, credit_ledger,
--         usage_events, ai_cost_events, module_access
-- All tables: RLS enabled, audit timestamps, trace_id support
-- ============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Drop & recreate (idempotent) ──────────────────────────────────────────────
DROP TABLE IF EXISTS ai_cost_events    CASCADE;
DROP TABLE IF EXISTS usage_events      CASCADE;
DROP TABLE IF EXISTS credit_ledger     CASCADE;
DROP TABLE IF EXISTS module_access     CASCADE;
DROP TABLE IF EXISTS user_entitlements CASCADE;
DROP TABLE IF EXISTS user_subscription CASCADE;

-- ── 1. user_subscription ─────────────────────────────────────────────────────
-- One row per user. Single source of truth for tier.
CREATE TABLE user_subscription (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier               TEXT        NOT NULL DEFAULT 'free'
                                 CHECK (tier IN ('free','creator','pro','enterprise')),
  status             TEXT        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','cancelled','past_due','paused')),
  stripe_customer_id TEXT,
  stripe_sub_id      TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  credits_per_cycle  INTEGER     NOT NULL DEFAULT 100,
  credits_granted_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN   NOT NULL DEFAULT false,
  metadata           JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_subscription IS 'One row per user — subscription tier, Stripe link, credit grant schedule';

-- ── 2. user_entitlements ──────────────────────────────────────────────────────
-- Feature flags granted by subscription tier or manual override
CREATE TABLE user_entitlements (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT        NOT NULL,
  -- Feature keys: chat, autonomy, multi_ai_team, module_factory,
  --               factory_schema, realtime, file_upload, api_access
  granted_by  TEXT        NOT NULL DEFAULT 'subscription'
                          CHECK (granted_by IN ('subscription','manual','trial','promo')),
  expires_at  TIMESTAMPTZ,  -- NULL = never expires
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, feature)
);

COMMENT ON TABLE user_entitlements IS 'Per-feature access flags. Populated from subscription tier or manual grants.';

-- ── 3. credit_ledger ─────────────────────────────────────────────────────────
-- Double-entry style: every credit change is a row (immutable)
CREATE TABLE credit_ledger (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       INTEGER     NOT NULL,   -- positive = credit, negative = debit
  balance_after INTEGER    NOT NULL,   -- running balance snapshot
  type         TEXT        NOT NULL
               CHECK (type IN ('grant','purchase','deduction','refund','adjustment','promo','expiry')),
  description  TEXT        NOT NULL,
  trace_id     TEXT,        -- links to usage_event or ai_cost_event
  idempotency_key TEXT     UNIQUE,     -- prevents double-charges
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE credit_ledger IS 'Immutable credit ledger. Every debit/credit is a permanent row.';

-- Index for fast balance queries
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger (user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_trace        ON credit_ledger (trace_id) WHERE trace_id IS NOT NULL;

-- ── 4. usage_events ───────────────────────────────────────────────────────────
-- Every Javari feature invocation (not just AI calls)
CREATE TABLE usage_events (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  -- event_types: chat, autonomy_goal, multi_ai_team, module_factory,
  --              factory_file, api_call, memory_write, heartbeat
  feature        TEXT        NOT NULL,
  session_id     TEXT,
  goal_id        TEXT,        -- links to javari_task_state.goal_id
  module_id      TEXT,        -- links to module factory run
  credits_used   INTEGER     NOT NULL DEFAULT 0,
  duration_ms    INTEGER,
  success        BOOLEAN     NOT NULL DEFAULT true,
  error_code     TEXT,
  metadata       JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usage_events IS 'Every feature invocation. Rollup source for daily/monthly summaries.';

CREATE INDEX idx_usage_events_user_created  ON usage_events (user_id, created_at DESC);
CREATE INDEX idx_usage_events_goal          ON usage_events (goal_id)   WHERE goal_id IS NOT NULL;
CREATE INDEX idx_usage_events_feature_date  ON usage_events (feature, created_at DESC);

-- ── 5. ai_cost_events ────────────────────────────────────────────────────────
-- Every AI model call with token counts + cost
CREATE TABLE ai_cost_events (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_event_id   UUID        REFERENCES usage_events(id) ON DELETE SET NULL,
  provider         TEXT        NOT NULL,  -- anthropic, openai, groq, mistral, etc.
  model            TEXT        NOT NULL,
  input_tokens     INTEGER     NOT NULL DEFAULT 0,
  output_tokens    INTEGER     NOT NULL DEFAULT 0,
  cost_usd         NUMERIC(12,8) NOT NULL DEFAULT 0,
  credits_charged  INTEGER     NOT NULL DEFAULT 0,
  tier             TEXT        NOT NULL DEFAULT 'moderate',
  margin_multiplier NUMERIC(4,2) NOT NULL DEFAULT 4.0,
  goal_id          TEXT,
  module_id        TEXT,
  agent_role       TEXT,        -- architect, engineer, validator, etc.
  latency_ms       INTEGER,
  success          BOOLEAN     NOT NULL DEFAULT true,
  error_msg        TEXT,
  trace_id         TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_cost_events IS 'Per-model-call accounting. Feeds cost aggregation and profitability reporting.';

CREATE INDEX idx_ai_cost_user_created  ON ai_cost_events (user_id, created_at DESC);
CREATE INDEX idx_ai_cost_provider      ON ai_cost_events (provider, model, created_at DESC);
CREATE INDEX idx_ai_cost_goal          ON ai_cost_events (goal_id) WHERE goal_id IS NOT NULL;

-- ── 6. module_access ─────────────────────────────────────────────────────────
-- Track which modules user has generated/purchased access to
CREATE TABLE module_access (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id   TEXT        NOT NULL,
  module_name TEXT        NOT NULL,
  access_type TEXT        NOT NULL DEFAULT 'generated'
              CHECK (access_type IN ('generated','purchased','shared','trial')),
  files_count INTEGER     NOT NULL DEFAULT 0,
  credits_spent INTEGER   NOT NULL DEFAULT 0,
  bundle_json JSONB,       -- store file list (not full content)
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module_id)
);

COMMENT ON TABLE module_access IS 'Tracks module_factory outputs accessible to each user.';

CREATE INDEX idx_module_access_user ON module_access (user_id, created_at DESC);

-- ── RLS: Enable on all tables ─────────────────────────────────────────────────
ALTER TABLE user_subscription  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_access      ENABLE ROW LEVEL SECURITY;

-- user_subscription: users see own row only
CREATE POLICY "sub_select_own" ON user_subscription FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sub_update_own" ON user_subscription FOR UPDATE USING (auth.uid() = user_id);

-- user_entitlements
CREATE POLICY "ent_select_own" ON user_entitlements FOR SELECT USING (auth.uid() = user_id);

-- credit_ledger: read own; insert via service role only
CREATE POLICY "ledger_select_own" ON credit_ledger FOR SELECT USING (auth.uid() = user_id);

-- usage_events: read own; insert via service role
CREATE POLICY "usage_select_own" ON usage_events FOR SELECT USING (auth.uid() = user_id);

-- ai_cost_events: read own
CREATE POLICY "cost_select_own" ON ai_cost_events FOR SELECT USING (auth.uid() = user_id);

-- module_access: read/write own
CREATE POLICY "mod_select_own" ON module_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mod_insert_own" ON module_access FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mod_update_own" ON module_access FOR UPDATE USING (auth.uid() = user_id);

-- ── Trigger: updated_at auto-maintenance ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_sub_updated   BEFORE UPDATE ON user_subscription AFTER UPDATE ON user_subscription
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_mod_updated   BEFORE UPDATE ON module_access
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Function: get_credit_balance(uuid) ───────────────────────────────────────
-- Returns current balance for a user from the ledger.
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO   v_balance
  FROM   credit_ledger
  WHERE  user_id = p_user_id;
  RETURN v_balance;
END;
$$;

-- ── Function: deduct_credits(uuid, int, text, text, text) ────────────────────
-- Atomically checks balance, deducts, writes ledger row.
-- Returns new balance or raises exception if insufficient.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id         UUID,
  p_amount          INTEGER,
  p_description     TEXT,
  p_trace_id        TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- Idempotency: if key already exists, return current balance
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
      RETURN get_credit_balance(p_user_id);
    END IF;
  END IF;

  -- Lock user row to prevent race conditions
  PERFORM 1 FROM user_subscription WHERE user_id = p_user_id FOR UPDATE;

  v_current_balance := get_credit_balance(p_user_id);
  v_new_balance     := v_current_balance - p_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: balance=% required=%',
      v_current_balance, p_amount;
  END IF;

  INSERT INTO credit_ledger
    (user_id, amount, balance_after, type, description, trace_id, idempotency_key)
  VALUES
    (p_user_id, -p_amount, v_new_balance, 'deduction', p_description, p_trace_id, p_idempotency_key);

  RETURN v_new_balance;
END;
$$;

-- ── Function: grant_credits(uuid, int, text, text) ───────────────────────────
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_type        TEXT,
  p_description TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_balance INTEGER;
BEGIN
  v_new_balance := get_credit_balance(p_user_id) + p_amount;

  INSERT INTO credit_ledger (user_id, amount, balance_after, type, description)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_description);

  RETURN v_new_balance;
END;
$$;

-- ── Seed: default free subscription for new users (trigger) ──────────────────
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create free tier subscription
  INSERT INTO user_subscription (user_id, tier, credits_per_cycle)
  VALUES (NEW.id, 'free', 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- Grant initial 100 free credits
  PERFORM grant_credits(NEW.id, 100, 'grant', 'Welcome credits — free tier');

  -- Grant free tier entitlements
  INSERT INTO user_entitlements (user_id, feature, granted_by)
  VALUES
    (NEW.id, 'chat',       'subscription'),
    (NEW.id, 'autonomy',   'subscription'),
    (NEW.id, 'api_access', 'subscription')
  ON CONFLICT (user_id, feature) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attach to auth.users new registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_new_user_subscription'
    AND   tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER trg_new_user_subscription
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION create_default_subscription();
  END IF;
END $$;
