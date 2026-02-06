import type { ProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from "../types";

export const openaiAdapter: ProviderAdapter = {
  providerId: "openai-gpt4-turbo",

  async execute(input: ProviderExecutionInput): Promise<ProviderExecutionOutput> {
    return {
      completion: `[OPENAI SIMULATED]: ${input.prompt}`,
      tokensUsed: 15,
      raw: { simulated: true },
    };
  },
};
