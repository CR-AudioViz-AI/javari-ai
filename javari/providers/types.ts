export interface ProviderExecutionInput {
  modelId: string;
  prompt: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderExecutionOutput {
  completion: string;
  tokensUsed: number;
  raw?: any;
}

export interface ProviderAdapter {
  readonly providerId: string;
  execute(input: ProviderExecutionInput): Promise<ProviderExecutionOutput>;
  stream?(input: ProviderExecutionInput): AsyncGenerator<string>;
}
