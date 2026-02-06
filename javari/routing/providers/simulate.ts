import { ProviderId } from "./types";
import { scoreProvidersForSubtask } from "./costModel";

interface SimulateRequest {
  providerId: ProviderId;
  input: any;
  tokens: number;
  requestId: string;
}

export async function simulateProviderResponse(
  req: SimulateRequest
) {
  const baseText = typeof req.input === "string"
    ? req.input
    : JSON.stringify(req.input, null, 2);

  const output = `Simulated response from ${req.providerId}:\n\n` +
    baseText +
    `\n\n(tokens=${req.tokens})`;

  // Score once for latency + cost estimation
  const estimates = scoreProvidersForSubtask(
    [req.providerId],
    req.tokens,
    "general",
    req.requestId
  );

  const est = estimates[0];

  return {
    output,
    costCents: est.costCents,
    latencyMs: est.latencyMs,
    reasoning: `Simulated provider ${req.providerId} executed with estimated cost ${est.costCents}¢ and ${est.latencyMs}ms latency.`,
  };
}
