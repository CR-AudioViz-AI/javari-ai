-- supabase/migrations/20260220_step7_observability.sql
-- CR AudioViz AI — STEP 7: Analytics + Canary + Error Logs
-- 2026-02-20 — Production Hardening

-- ── error_logs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS error_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id      TEXT        NOT NULL,
  error_code    TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  path          TEXT,
  method        TEXT,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  stack_hint    TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_trace      ON error_logs (trace_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_code        ON error_logs (error_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user        ON error_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_created     ON error_logs (created_at DESC);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Admins/service-role can read all; users can read own
CREATE POLICY "error_logs_service_all"
  ON error_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "error_logs_user_own"
  ON error_logs FOR SELECT
  USING (user_id = auth.uid());

-- ── analytics_events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id   TEXT,
  trace_id     TEXT,
  properties   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_name  ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user        ON analytics_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_created     ON analytics_events (created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_service_all"
  ON analytics_events FOR ALL
  USING (auth.role() = 'service_role');

-- Users can see only their own events
CREATE POLICY "analytics_user_own"
  ON analytics_events FOR SELECT
  USING (user_id = auth.uid());

-- ── canary_assignments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS canary_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT        NOT NULL,
  bucket      INT         NOT NULL CHECK (bucket >= 0 AND bucket < 100),
  is_enabled  BOOLEAN     NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_canary_feature ON canary_assignments (feature, is_enabled);
CREATE INDEX IF NOT EXISTS idx_canary_user    ON canary_assignments (user_id);

ALTER TABLE canary_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canary_service_all"
  ON canary_assignments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "canary_user_own"
  ON canary_assignments FOR SELECT
  USING (user_id = auth.uid());

-- ── Cascade cleanup triggers ──────────────────────────────────────────────────

-- Auto-cleanup analytics events older than 90 days (runs on insert via trigger)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM analytics_events
  WHERE created_at < now() - INTERVAL '90 days';
  RETURN NEW;
END;
$$;

-- Only trigger cleanup periodically (on every 1000th insert)
CREATE OR REPLACE FUNCTION analytics_insert_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM analytics_events) % 1000 = 0 THEN
    PERFORM cleanup_old_analytics();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_cleanup ON analytics_events;
CREATE TRIGGER trg_analytics_cleanup
  AFTER INSERT ON analytics_events
  FOR EACH ROW EXECUTE FUNCTION analytics_insert_trigger();

-- ── Updated_at triggers for error_logs ───────────────────────────────────────
-- (No updated_at on error_logs since they're immutable)

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT ON error_logs       TO service_role;
GRANT SELECT, INSERT ON analytics_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON canary_assignments TO service_role;
