-- supabase/migrations/20260221_autonomy_core.sql
-- CR AudioViz AI — STEP 11: Autonomy Core Tables
-- autonomy_cycle_reports, autonomy_patches, autonomy_snapshots

-- ── autonomy_snapshots ────────────────────────────────────────────────────────
-- Lightweight index of crawl snapshots (full snapshot is in-memory, not stored)

CREATE TABLE IF NOT EXISTS autonomy_snapshots (
  id            TEXT        PRIMARY KEY,
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ring          INT         NOT NULL DEFAULT 2,
  scope         TEXT        NOT NULL DEFAULT 'core_only',
  api_routes    INT         NOT NULL DEFAULT 0,
  page_routes   INT         NOT NULL DEFAULT 0,
  components    INT         NOT NULL DEFAULT 0,
  libs          INT         NOT NULL DEFAULT 0,
  migrations_n  INT         NOT NULL DEFAULT 0,
  duration_ms   INT         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_as_taken ON autonomy_snapshots (taken_at DESC);
ALTER TABLE autonomy_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_service_all" ON autonomy_snapshots FOR ALL USING (auth.role() = 'service_role');

-- ── autonomy_cycle_reports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS autonomy_cycle_reports (
  id                TEXT        PRIMARY KEY,
  started_at        TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ,
  duration_ms       INT         NOT NULL DEFAULT 0,
  snapshot_id       TEXT,
  anomalies_found   INT         NOT NULL DEFAULT 0,
  patches_attempted INT         NOT NULL DEFAULT 0,
  patches_applied   INT         NOT NULL DEFAULT 0,
  patches_rejected  INT         NOT NULL DEFAULT 0,
  patches_failed    INT         NOT NULL DEFAULT 0,
  ring              INT         NOT NULL DEFAULT 2,
  mode              TEXT        NOT NULL DEFAULT 'continuous',
  status            TEXT        NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed','halted','degraded','error')),
  halt_reason       TEXT,
  summary           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acr_started  ON autonomy_cycle_reports (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_acr_status   ON autonomy_cycle_reports (status, started_at DESC);
ALTER TABLE autonomy_cycle_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acr_service_all" ON autonomy_cycle_reports FOR ALL USING (auth.role() = 'service_role');

-- ── autonomy_patches ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS autonomy_patches (
  id               TEXT        PRIMARY KEY,
  snapshot_id      TEXT,
  anomaly_id       TEXT        NOT NULL,
  file_path        TEXT        NOT NULL,
  fix_type         TEXT        NOT NULL,
  ring             INT         NOT NULL DEFAULT 2,
  description      TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','applied','rejected','rolled_back','failed')),
  validator_score  INT,
  applied_at       TIMESTAMPTZ,
  rolled_back_at   TIMESTAMPTZ,
  rollback_reason  TEXT,
  -- NOTE: old_content and new_content NOT stored in DB (too large; GitHub history is the source of truth)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_snapshot ON autonomy_patches (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ap_file     ON autonomy_patches (file_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ap_status   ON autonomy_patches (status, applied_at DESC);
ALTER TABLE autonomy_patches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_service_all" ON autonomy_patches FOR ALL USING (auth.role() = 'service_role');

-- ── autonomy_anomalies ────────────────────────────────────────────────────────
-- Optional: persist detected anomalies for trending analysis

CREATE TABLE IF NOT EXISTS autonomy_anomalies (
  id           TEXT        PRIMARY KEY,
  snapshot_id  TEXT,
  type         TEXT        NOT NULL,
  severity     TEXT        NOT NULL DEFAULT 'info'
               CHECK (severity IN ('info','warn','error','critical')),
  file_path    TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  fixable      BOOLEAN     NOT NULL DEFAULT false,
  fix_type     TEXT,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aa_type     ON autonomy_anomalies (type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_severity ON autonomy_anomalies (severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_fixable  ON autonomy_anomalies (fixable, detected_at DESC) WHERE fixable = true;
ALTER TABLE autonomy_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa_service_all" ON autonomy_anomalies FOR ALL USING (auth.role() = 'service_role');

-- ── Grants ─────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT         ON autonomy_snapshots     TO service_role;
GRANT SELECT, INSERT, UPDATE ON autonomy_cycle_reports TO service_role;
GRANT SELECT, INSERT, UPDATE ON autonomy_patches       TO service_role;
GRANT SELECT, INSERT         ON autonomy_anomalies     TO service_role;
