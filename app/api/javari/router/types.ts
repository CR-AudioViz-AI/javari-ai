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
  usage: {
    input: number;
    output: number;
  };
  session_id: string;
};
