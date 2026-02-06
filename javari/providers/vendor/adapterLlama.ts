import type { ProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from "../types";

export const llamaAdapter: ProviderAdapter = {
  providerId: "meta-llama-3-8b",
  async execute(input: ProviderExecutionInput): Promise<ProviderExecutionOutput> {
    return {
      completion: `[LLAMA SIMULATED]: ${input.prompt}`,
      tokensUsed: 8,
      raw: { simulated: true },
    };
  },
};
