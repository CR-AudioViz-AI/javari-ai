export type RouterInput = {
  message: string;
  session_id?: string;
  user_id?: string;
  context?: any;
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
};

// Model cost mapping (credits per 1000 tokens)
export const MODEL_COSTS = {
  "openai:o3": 15.0,
  "openai:gpt-4o": 5.0,
  "anthropic:claude-3.5-sonnet": 3.0,
  "mistral:large": 2.0,
  "meta:llama-3-8b": 0.5,
  "xai:grok-beta": 4.0
};
