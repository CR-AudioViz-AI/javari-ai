export type RouterInput = {
  message: string;
  session_id?: string;
  user_id?: string;
  context?: any;
  supermode?: boolean;
};

export type IntentClassification = {
  requiresReasoning: boolean;
  requiresValidation: boolean;
  jsonRequired: boolean;
  highRisk: boolean;
  lowCostPreferred: boolean;
};

export type ModelSelection = {
  model: string;
  confidence: number;
  reason: string;
};

export type ExecutionResult = {
  output: string;
  tokens: number;
  duration_ms: number;
  usage: {
    input: number;
    output: number;
    total: number;
  };
  credit_cost: number;
};

export type ValidationResult = {
  approved: boolean;
  output: string;
};

export type CouncilDraft = {
  model: string;
  output: string;
  tokens: number;
  duration_ms: number;
  evidence: string[];
  confidence: number;
};

export type CouncilTimelineStep = {
  timestamp: number;
  model: string;
  action: string;
  duration_ms: number;
};

export type ModelContributorScore = {
  model: string;
  score: number;
  reasoning: string;
  evidence_count: number;
  selected: boolean;
};

export type CouncilResult = {
  final: string;
  timeline: CouncilTimelineStep[];
  contributors: ModelContributorScore[];
  validated: boolean;
  total_tokens: number;
  duration_ms: number;
  credit_cost: number;
};

export type FinalResponse = {
  reply: string;
  model: string;
  validator: string;
  credits: number;
  credit_balance: number;
  usage: {
    input: number;
    output: number;
    total: number;
  };
  credit_cost: number;
  session_id: string;
  enforced: boolean;
  usage_log_id?: string;
  supermode?: boolean;
  timeline?: CouncilTimelineStep[];
  contributors?: ModelContributorScore[];
};

export type UserAuth = {
  user_id: string;
  email: string;
  credit_balance: number;
};

export type UsageLog = {
  user_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  credit_cost: number;
  request_message: string;
  response_text: string;
  session_id?: string;
  supermode?: boolean;
};

// Model cost mapping (credits per 1000 tokens)
export const MODEL_COSTS = {
  "openai:o3": 15.0,
  "openai:gpt-4o": 5.0,
  "anthropic:claude-3.5-sonnet": 3.0,
  "mistral:large": 2.0,
  "meta:llama-3-70b": 0.5,
  "xai:grok-3": 4.0,
  "groq:llama-3-70b": 0.1,
  "together:llama-3-70b": 0.2,
  "perplexity:sonar": 1.0,
  "cohere:command-r": 0.8,
  "huggingface:llama-3.2": 0.05
};

export const COUNCIL_MODELS = [
  "openai:gpt-4o",
  "anthropic:claude-3.5-sonnet",
  "mistral:large",
  "groq:llama-3-70b",
  "xai:grok-3",
  "perplexity:sonar",
  "together:llama-3-70b"
];

export const COUNCIL_MULTIPLIER = 3.0;
