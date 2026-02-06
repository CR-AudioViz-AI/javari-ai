export interface LiveProviderExecuteOptions {
  providerId: string;
  input: any;
  tokens: number;
  requestId: string;
}

export interface LiveProviderResult {
  ok: boolean;
  rawOutput: string;
  tokensUsed: number;
  model?: string;
  finishReason?: string;
}

export interface ProviderCapabilities {
  chat: boolean;
  json: boolean;
  stream: boolean;
  embed: boolean;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;

  // Safe-mode live call wrapper
  executeLive(opts: LiveProviderExecuteOptions): Promise<LiveProviderResult>;
}
