-- Command Center Backend Tables
-- Created: 2026-02-22 02:36 ET
-- Purpose: Autonomous observability, control, and explainability infrastructure

-- ============================================================
-- TABLE 1: autonomy_control_events
-- Logs all manual control actions taken on the autonomy system
-- ============================================================
CREATE TABLE IF NOT EXISTS public.autonomy_control_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN (
    'start_cycle',
    'pause_autonomy',
    'resume_autonomy',
    'kill_switch_on',
    'kill_switch_off',
    'step',
    'run_task',
    'manual_intervention',
    'config_change'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_control_events_created ON public.autonomy_control_events(created_at DESC);
CREATE INDEX idx_control_events_action ON public.autonomy_control_events(action);

COMMENT ON TABLE public.autonomy_control_events IS 'Audit log of all control actions on autonomy system';

-- ============================================================
-- TABLE 2: autonomy_model_usage
-- Tracks token usage, latency, and retries per model per cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.autonomy_model_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_model_usage_cycle ON public.autonomy_model_usage(cycle_id);
CREATE INDEX idx_model_usage_model ON public.autonomy_model_usage(model);
CREATE INDEX idx_model_usage_created ON public.autonomy_model_usage(created_at DESC);

COMMENT ON TABLE public.autonomy_model_usage IS 'Per-cycle model usage metrics for cost tracking and performance analysis';

-- ============================================================
-- TABLE 3: autonomy_drift_events
-- Detects and logs drift in canonical docs, roadmap, schema, or model behavior
-- ============================================================
CREATE TABLE IF NOT EXISTS public.autonomy_drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drift_type TEXT NOT NULL CHECK (drift_type IN (
    'canonical_drift',
    'roadmap_drift',
    'schema_drift',
    'model_behavior_drift',
    'dependency_drift'
  )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5), -- 1=info, 5=critical
  cycle_id UUID,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drift_created ON public.autonomy_drift_events(created_at DESC);
CREATE INDEX idx_drift_type ON public.autonomy_drift_events(drift_type);
CREATE INDEX idx_drift_severity ON public.autonomy_drift_events(severity DESC);
CREATE INDEX idx_drift_unresolved ON public.autonomy_drift_events(resolved) WHERE resolved = false;

COMMENT ON TABLE public.autonomy_drift_events IS 'Drift detection events across canonical, roadmap, schema, and behavior';

-- ============================================================
-- TABLE 4: autonomy_roadmap_versions
-- Snapshots of roadmap state for version control and rollback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.autonomy_roadmap_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  diff JSONB,
  created_by TEXT NOT NULL DEFAULT 'autonomy_system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(roadmap_id, version)
);

CREATE INDEX idx_roadmap_versions_id ON public.autonomy_roadmap_versions(roadmap_id);
CREATE INDEX idx_roadmap_versions_version ON public.autonomy_roadmap_versions(roadmap_id, version DESC);
CREATE INDEX idx_roadmap_versions_created ON public.autonomy_roadmap_versions(created_at DESC);

COMMENT ON TABLE public.autonomy_roadmap_versions IS 'Version-controlled snapshots of active roadmaps';

-- ============================================================
-- TABLE 5: autonomy_explainability_logs
-- Reasoning traces, canonical references, and model decisions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.autonomy_explainability_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL,
  task_id TEXT,
  reasoning TEXT NOT NULL,
  canonical_refs JSONB DEFAULT '[]'::jsonb,
  model TEXT NOT NULL,
  validator_outcome JSONB,
  safety_gates_hit JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_explain_cycle ON public.autonomy_explainability_logs(cycle_id);
CREATE INDEX idx_explain_task ON public.autonomy_explainability_logs(task_id);
CREATE INDEX idx_explain_created ON public.autonomy_explainability_logs(created_at DESC);

COMMENT ON TABLE public.autonomy_explainability_logs IS 'Explainability traces for autonomous decisions';

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.autonomy_control_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_model_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_drift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_roadmap_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_explainability_logs ENABLE ROW LEVEL SECURITY;

-- No direct policies - access ONLY through SECURITY DEFINER functions

-- ============================================================
-- SECURITY DEFINER FUNCTION 1: log_control_event
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_control_event(
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_actor TEXT DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.autonomy_control_events (action, metadata, actor)
  VALUES (p_action, p_metadata, p_actor);
END;
$$;

COMMENT ON FUNCTION public.log_control_event IS 'Logs control actions on autonomy system';

-- ============================================================
-- SECURITY DEFINER FUNCTION 2: log_model_usage
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_model_usage(
  p_cycle_id UUID,
  p_model TEXT,
  p_tokens_in INTEGER,
  p_tokens_out INTEGER,
  p_latency_ms INTEGER,
  p_retries INTEGER DEFAULT 0,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.autonomy_model_usage (
    cycle_id, model, tokens_in, tokens_out, latency_ms, retries, success, error_message
  )
  VALUES (
    p_cycle_id, p_model, p_tokens_in, p_tokens_out, p_latency_ms, p_retries, p_success, p_error_message
  );
END;
$$;

COMMENT ON FUNCTION public.log_model_usage IS 'Logs model usage metrics per cycle';

-- ============================================================
-- SECURITY DEFINER FUNCTION 3: log_drift
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_drift(
  p_drift_type TEXT,
  p_details JSONB,
  p_severity INTEGER,
  p_cycle_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drift_id UUID;
BEGIN
  INSERT INTO public.autonomy_drift_events (drift_type, details, severity, cycle_id)
  VALUES (p_drift_type, p_details, p_severity, p_cycle_id)
  RETURNING id INTO v_drift_id;
  
  RETURN v_drift_id;
END;
$$;

COMMENT ON FUNCTION public.log_drift IS 'Logs drift detection event and returns drift ID';

-- ============================================================
-- SECURITY DEFINER FUNCTION 4: save_roadmap_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_roadmap_snapshot(
  p_roadmap_id TEXT,
  p_snapshot JSONB,
  p_diff JSONB DEFAULT NULL,
  p_created_by TEXT DEFAULT 'autonomy_system'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INTEGER;
  v_snapshot_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_next_version
  FROM public.autonomy_roadmap_versions
  WHERE roadmap_id = p_roadmap_id;
  
  -- Insert snapshot
  INSERT INTO public.autonomy_roadmap_versions (
    roadmap_id, version, snapshot, diff, created_by
  )
  VALUES (
    p_roadmap_id, v_next_version, p_snapshot, p_diff, p_created_by
  )
  RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$;

COMMENT ON FUNCTION public.save_roadmap_snapshot IS 'Saves versioned roadmap snapshot with auto-incrementing version';

-- ============================================================
-- SECURITY DEFINER FUNCTION 5: record_explainability
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_explainability(
  p_cycle_id UUID,
  p_task_id TEXT,
  p_reasoning TEXT,
  p_canonical_refs JSONB DEFAULT '[]'::jsonb,
  p_model TEXT DEFAULT 'unknown',
  p_validator_outcome JSONB DEFAULT NULL,
  p_safety_gates_hit JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.autonomy_explainability_logs (
    cycle_id, task_id, reasoning, canonical_refs, model, validator_outcome, safety_gates_hit
  )
  VALUES (
    p_cycle_id, p_task_id, p_reasoning, p_canonical_refs, p_model, p_validator_outcome, p_safety_gates_hit
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.record_explainability IS 'Records explainability trace for autonomous decision';

-- ============================================================
-- GRANT EXECUTE TO SERVICE ROLE
-- ============================================================
GRANT EXECUTE ON FUNCTION public.log_control_event TO service_role;
GRANT EXECUTE ON FUNCTION public.log_model_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.log_drift TO service_role;
GRANT EXECUTE ON FUNCTION public.save_roadmap_snapshot TO service_role;
GRANT EXECUTE ON FUNCTION public.record_explainability TO service_role;
