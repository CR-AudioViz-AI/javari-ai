import type { ProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from "../types";
import { createHash } from "crypto";

export const claudeAdapter: ProviderAdapter = {
  providerId: "anthropic-claude-sonnet",

  async execute(input: ProviderExecutionInput): Promise<ProviderExecutionOutput> {
    const hash = createHash("sha256").update(input.prompt).digest("hex");
    return {
      completion: `[CLAUDE SIMULATED OUTPUT]: ${input.prompt}`,
      tokensUsed: (hash.charCodeAt(0) % 20) + 20,
      raw: { simulated: true },
    };
  },
};
