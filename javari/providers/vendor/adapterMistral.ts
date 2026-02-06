import type { ProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from "../types";

export const mistralAdapter: ProviderAdapter = {
  providerId: "mistral-mixtral-8x7b",
  async execute(): Promise<ProviderExecutionOutput> {
    return {
      completion: `{ "simulated": true }`,
      tokensUsed: 5,
    };
  },
};
