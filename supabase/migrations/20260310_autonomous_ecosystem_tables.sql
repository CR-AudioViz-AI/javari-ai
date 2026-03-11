-- supabase/migrations/20260310_autonomous_ecosystem_tables.sql
-- Purpose: Autonomous Ecosystem Builder — full schema for Phase 5-9 tables.
--          build_artifacts, exec_logs, worker_logs.
--          Idempotent: safe to run multiple times.
-- Date: 2026-03-10

-- ── build_artifacts ─────────────────────────────────────────────────────────
-- Records every artifact produced by the AI Build Team pipeline.

CREATE TABLE IF NOT EXISTS build_artifacts (
  artifact_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid        NOT NULL,
  artifact_type    text        NOT NULL DEFAULT 'build_module',
  repo             text        NOT NULL DEFAULT 'CR-AudioViz-AI/javari-ai',
  branch           text,
  commit_sha       text,
  file_path        text,
  deployment_url   text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','building','committed','deployed','completed','failed')),
  build_team_ms    integer,
  architect_ms     integer,
  engineer_ms      integer,
  validator_ms     integer,
  documenter_ms    integer,
  total_ms         integer,
  error_message    text,
  metadata         jsonb       DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS build_artifacts_task_id_idx    ON build_artifacts (task_id);
CREATE INDEX IF NOT EXISTS build_artifacts_status_idx     ON build_artifacts (status);
CREATE INDEX IF NOT EXISTS build_artifacts_created_at_idx ON build_artifacts (created_at DESC);
CREATE INDEX IF NOT EXISTS build_artifacts_type_idx       ON build_artifacts (artifact_type);

ALTER TABLE build_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON build_artifacts;
CREATE POLICY "Service role full access" ON build_artifacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── roadmap_tasks — ensure metadata column exists ──────────────────────────

ALTER TABLE roadmap_tasks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ── exec_logs — execution log per task ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS exec_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid,
  task_title      text,
  task_type       text,
  status          text        CHECK (status IN ('running','completed','failed','retry')),
  model_used      text,
  cost_usd        numeric(10,6) DEFAULT 0,
  duration_ms     integer,
  artifact_id     uuid,
  commit_sha      text,
  deployment_url  text,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exec_logs_task_id_idx    ON exec_logs (task_id);
CREATE INDEX IF NOT EXISTS exec_logs_created_at_idx ON exec_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS exec_logs_status_idx     ON exec_logs (status);

ALTER TABLE exec_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON exec_logs;
CREATE POLICY "Service role full access" ON exec_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── worker_cycle_logs — per-cycle telemetry ─────────────────────────────────

CREATE TABLE IF NOT EXISTS worker_cycle_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        text        UNIQUE,
  tasks_run       integer     DEFAULT 0,
  tasks_completed integer     DEFAULT 0,
  tasks_failed    integer     DEFAULT 0,
  artifact_builds integer     DEFAULT 0,
  commits_created integer     DEFAULT 0,
  deployments     integer     DEFAULT 0,
  cost_usd        numeric(10,6) DEFAULT 0,
  duration_ms     integer,
  status          text        DEFAULT 'completed',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_cycle_logs_created_at_idx ON worker_cycle_logs (created_at DESC);

ALTER TABLE worker_cycle_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON worker_cycle_logs;
CREATE POLICY "Service role full access" ON worker_cycle_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── knowledge_graph_nodes — ensure table exists ────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL,
  type        text    DEFAULT 'module',
  description text,
  phase       text,
  metadata    jsonb   DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON knowledge_graph_nodes;
CREATE POLICY "Service role full access" ON knowledge_graph_nodes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── knowledge_graph_edges — ensure table exists ────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node   uuid    REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  to_node     uuid    REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  edge_type   text    DEFAULT 'depends_on',
  weight      numeric(5,2) DEFAULT 1.0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_graph_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON knowledge_graph_edges;
CREATE POLICY "Service role full access" ON knowledge_graph_edges
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── ai_router_logs — telemetry for all AI calls through JavariRouter ─────────

CREATE TABLE IF NOT EXISTS ai_router_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type   text        NOT NULL DEFAULT 'simple_task',
  provider    text        NOT NULL,
  model_used  text        NOT NULL,
  tokens_in   integer     DEFAULT 0,
  tokens_out  integer     DEFAULT 0,
  cost_usd    numeric(10,6) DEFAULT 0,
  latency_ms  integer     DEFAULT 0,
  ok          boolean     DEFAULT true,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_router_logs_created_at_idx ON ai_router_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_router_logs_task_type_idx  ON ai_router_logs (task_type);
CREATE INDEX IF NOT EXISTS ai_router_logs_provider_idx   ON ai_router_logs (provider);

ALTER TABLE ai_router_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON ai_router_logs;
CREATE POLICY "Service role full access" ON ai_router_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── chat_sessions — telemetry for all Javari chat interactions ───────────────

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL DEFAULT 'anonymous',
  mode        text        NOT NULL DEFAULT 'single',
  intent      text        NOT NULL DEFAULT 'chat',
  messages    integer     NOT NULL DEFAULT 1,
  models_used text[]      DEFAULT '{}',
  cost_total  numeric(10,6) DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx   ON chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_created_at_idx ON chat_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_intent_idx    ON chat_sessions (intent);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON chat_sessions;
CREATE POLICY "Service role full access" ON chat_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── module_registry — tracks platform modules and their build status ─────────

CREATE TABLE IF NOT EXISTS module_registry (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text        NOT NULL UNIQUE,
  capability  text        NOT NULL,
  status      text        NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned','in_progress','complete','failed')),
  version     text        NOT NULL DEFAULT '0.1.0',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS module_registry_capability_idx ON module_registry (capability);
CREATE INDEX IF NOT EXISTS module_registry_status_idx     ON module_registry (status);

ALTER TABLE module_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON module_registry;
CREATE POLICY "Service role full access" ON module_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at auto-trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_module_registry_updated_at ON module_registry;
CREATE TRIGGER update_module_registry_updated_at
  BEFORE UPDATE ON module_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── orchestrator_cycles — telemetry for every autonomous orchestrator cycle ──

CREATE TABLE IF NOT EXISTS orchestrator_cycles (
  id                 text        PRIMARY KEY,
  cycle_start        timestamptz NOT NULL DEFAULT now(),
  cycle_end          timestamptz,
  tasks_created      integer     NOT NULL DEFAULT 0,
  tasks_completed    integer     NOT NULL DEFAULT 0,
  modules_generated  integer     NOT NULL DEFAULT 0,
  errors             text[]      DEFAULT '{}',
  cost_usd           numeric(10,6) DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orchestrator_cycles_start_idx ON orchestrator_cycles (cycle_start DESC);

ALTER TABLE orchestrator_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON orchestrator_cycles;
CREATE POLICY "Service role full access" ON orchestrator_cycles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
