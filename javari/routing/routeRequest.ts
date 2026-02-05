/**
 * Unified Routing Dispatcher (URE-native)
 *
 * Takes UnifiedRoutingEnvelope, performs validation,
 * normalizes flags, and dispatches to Mode A, Mode B,
 * or Execution pathways.
 */

import type { UnifiedRoutingEnvelope } from './envelope/types';
import { buildEnvelope } from './envelope/buildEnvelope';
import { decideModeAWithLearning } from './modeA/decideModeAWithLearning';
import { orchestrate } from './modeB/orchestrator';
import { resolveExecutionModels } from './execution/resolveExecutionModels';
import { isRoutingEnabled } from './flags';

export interface RouteRequestInput {
  readonly payload: any;
  readonly policy?: any;
}

export interface RouteRequestResult {
  readonly envelope: UnifiedRoutingEnvelope;
  readonly mode: 'A' | 'B';
  readonly decision: any;
  readonly executionPlan?: any;
}

export async function routeRequest(env: UnifiedRoutingEnvelope): Promise<RouteRequestResult> {
  if (!env || !env.payload) {
    throw new Error("Invalid RoutingEnvelope: missing payload");
  }

  if (!isRoutingEnabled()) {
    return {
      envelope: env,
      mode: 'A',
      decision: {
        reason: "Routing disabled via feature flag",
      },
    };
  }

  const payload = env.payload;

  // Decide Mode A vs Mode B (simple rule for now)
  const isModeB = !!payload.objective && !!payload.taskType;
  const mode: 'A' | 'B' = isModeB ? 'B' : 'A';

  if (mode === 'A') {
    const decision = decideModeAWithLearning(payload, []);
    const exec = env.policy
      ? resolveExecutionModels(env.policy, decision.selectedProvider.id)
      : null;

    return {
      envelope: env,
      mode,
      decision,
      executionPlan: exec,
    };
  }

  // MODE B
  const decision = orchestrate(payload, []);
  const exec = env.policy
    ? resolveExecutionModels(env.policy, decision.plan.assignments[0].providerId)
    : null;

  return {
    envelope: env,
    mode,
    decision,
    executionPlan: exec,
  };
}
