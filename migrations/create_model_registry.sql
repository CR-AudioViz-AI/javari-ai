-- Model Registry Table
CREATE TABLE IF NOT EXISTS public.model_registry (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  reasoning SMALLINT NOT NULL CHECK (reasoning BETWEEN 1 AND 5),
  json_reliability SMALLINT NOT NULL CHECK (json_reliability BETWEEN 1 AND 5),
  code_quality SMALLINT NOT NULL CHECK (code_quality BETWEEN 1 AND 5),
  multimodal BOOLEAN NOT NULL DEFAULT FALSE,
  streaming BOOLEAN NOT NULL DEFAULT FALSE,
  tools BOOLEAN NOT NULL DEFAULT FALSE,
  cost_input NUMERIC(10, 6) NOT NULL,
  cost_output NUMERIC(10, 6) NOT NULL,
  latency_class TEXT NOT NULL CHECK (latency_class IN ('fast', 'medium', 'slow')),
  cost_tier TEXT NOT NULL CHECK (cost_tier IN ('free', 'low', 'moderate', 'expensive')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  registry_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, model)
);

CREATE INDEX IF NOT EXISTS idx_model_registry_enabled ON public.model_registry(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_model_registry_provider ON public.model_registry(provider);
CREATE INDEX IF NOT EXISTS idx_model_registry_cost_tier ON public.model_registry(cost_tier);

COMMENT ON TABLE public.model_registry IS 'Central model registry with capability vectors and cost metadata';
COMMENT ON COLUMN public.model_registry.reasoning IS 'Reasoning capability 1-5 (1=poor, 5=excellent)';
COMMENT ON COLUMN public.model_registry.json_reliability IS 'JSON output reliability 1-5';
COMMENT ON COLUMN public.model_registry.code_quality IS 'Code generation quality 1-5';
COMMENT ON COLUMN public.model_registry.cost_input IS 'Cost per million input tokens (USD)';
COMMENT ON COLUMN public.model_registry.cost_output IS 'Cost per million output tokens (USD)';
COMMENT ON COLUMN public.model_registry.registry_version IS 'Semantic version for tracking registry updates';
