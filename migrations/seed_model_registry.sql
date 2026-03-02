-- Seed Model Registry with current 11 models
INSERT INTO public.model_registry 
  (provider, model, reasoning, json_reliability, code_quality, multimodal, streaming, tools, cost_input, cost_output, latency_class, cost_tier, registry_version)
VALUES
  -- Anthropic
  ('anthropic', 'claude-sonnet-4-20250514', 5, 5, 5, true, true, true, 3.000, 15.000, 'fast', 'moderate', 'v1.0'),
  ('anthropic', 'claude-3-5-sonnet-20241022', 5, 5, 5, true, true, true, 3.000, 15.000, 'fast', 'moderate', 'v1.0'),
  ('anthropic', 'claude-3-5-haiku-20241022', 3, 4, 3, true, true, true, 1.000, 5.000, 'fast', 'low', 'v1.0'),
  
  -- OpenAI
  ('openai', 'gpt-4o', 5, 5, 4, true, true, true, 2.500, 10.000, 'fast', 'moderate', 'v1.0'),
  ('openai', 'gpt-4o-mini', 3, 4, 3, true, true, true, 0.150, 0.600, 'fast', 'low', 'v1.0'),
  
  -- Google
  ('google', 'gemini-2.0-flash-exp', 4, 4, 4, true, true, true, 0.000, 0.000, 'fast', 'free', 'v1.0'),
  ('google', 'gemini-1.5-pro', 4, 4, 4, true, true, true, 1.250, 5.000, 'medium', 'low', 'v1.0'),
  
  -- OpenRouter
  ('openrouter', 'anthropic/claude-sonnet-4', 5, 5, 5, true, true, true, 3.000, 15.000, 'fast', 'moderate', 'v1.0'),
  ('openrouter', 'google/gemini-2.0-flash-exp:free', 4, 4, 4, true, true, true, 0.000, 0.000, 'fast', 'free', 'v1.0'),
  
  -- Perplexity
  ('perplexity', 'sonar-pro', 4, 3, 3, false, true, false, 3.000, 15.000, 'medium', 'moderate', 'v1.0'),
  ('perplexity', 'sonar', 3, 3, 2, false, true, false, 1.000, 1.000, 'fast', 'low', 'v1.0')
ON CONFLICT (provider, model) DO UPDATE SET
  reasoning = EXCLUDED.reasoning,
  json_reliability = EXCLUDED.json_reliability,
  code_quality = EXCLUDED.code_quality,
  multimodal = EXCLUDED.multimodal,
  streaming = EXCLUDED.streaming,
  tools = EXCLUDED.tools,
  cost_input = EXCLUDED.cost_input,
  cost_output = EXCLUDED.cost_output,
  latency_class = EXCLUDED.latency_class,
  cost_tier = EXCLUDED.cost_tier,
  registry_version = EXCLUDED.registry_version,
  updated_at = NOW();
