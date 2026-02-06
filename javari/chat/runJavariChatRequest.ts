import { buildEnvelope } from "../routing/envelope/buildEnvelope";
import { routeRequest } from "../routing/routeRequest";

/**
 * Unified Chat Request Entry Point
 *
 * Converts raw chat input into a routing envelope,
 * executes routing (and optionally execution),
 * and returns a UI-ready response object.
 */

export interface JavariChatResponse {
  requestId: string;
  mode: 'A' | 'B';
  primaryModel?: string;
  fallbackModel?: string;
  validatorModel?: string;
  decision: any;
  costEstimate?: any;
  executionPlan?: any;
  executionResult?: any;
  timestamp: string;
}

export async function runJavariChatRequest(
  input: any,
  opts: {
    userId?: string;
    source?: string;
    autoExecute?: boolean;
    applyPolicy?: boolean;
    applyLearning?: boolean;
  } = {}
): Promise<JavariChatResponse> {

  const envelope = buildEnvelope(input, {
    userId: opts.userId || "chat-user",
    source: opts.source || "javari-chat",
    dryRun: !opts.autoExecute,
    useLearning: opts.applyLearning ?? false,
    usePriors: opts.applyLearning ?? false,
    policy: opts.applyPolicy
      ? {
          id: "user-ux-prose",
          name: "User UX Prose Policy",
          rules: [
            { intent: "user_ux_prose" },
            { riskLevel: "low" },
            { reasoningDepth: "standard" },
            { outputStrictness: "flexible" },
          ],
        }
      : undefined,
  });

  // Add autoExecute flag to envelope
  const envelopeWithFlags = {
    ...envelope,
    flags: {
      autoExecute: opts.autoExecute ?? false,
    },
  };

  const routed = await routeRequest(envelopeWithFlags);

  const result: JavariChatResponse = {
    requestId: envelope.metadata.requestId,
    mode: routed.mode,
    decision: routed.decision,
    costEstimate: routed.decision.costEstimate || null,
    executionPlan: routed.executionPlan || null,
    executionResult: routed.executionResult || null,
    primaryModel: routed.executionPlan?.primaryModel,
    fallbackModel: routed.executionPlan?.fallbackModel,
    validatorModel: routed.executionPlan?.validatorModel,
    timestamp: new Date().toISOString(),
  };

  return result;
}
