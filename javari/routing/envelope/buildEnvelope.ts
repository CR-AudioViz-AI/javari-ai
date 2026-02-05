import { createHash } from 'crypto';
import type { UnifiedRoutingEnvelope, RoutingEnvelopeMetadata } from './types';
import type { PolicyCriteria } from '../policy/types';

export function buildEnvelope(
  payload: unknown,
  opts?: {
    policy?: PolicyCriteria;
    useLearning?: boolean;
    usePriors?: boolean;
    requireValidator?: boolean;
    dryRun?: boolean;
    telemetry?: boolean;
    userId?: string;
    source?: string;
  }
): UnifiedRoutingEnvelope {
  const requestId = createHash('sha256')
    .update(JSON.stringify(payload) + Date.now().toString())
    .digest('hex')
    .substring(0, 16);

  const metadata: RoutingEnvelopeMetadata = {
    requestId,
    timestamp: new Date().toISOString(),
    userId: opts?.userId,
    source: opts?.source,
  };

  return {
    metadata,
    policy: opts?.policy,
    useLearning: opts?.useLearning ?? false,
    usePriors: opts?.usePriors ?? false,
    requireValidator: opts?.requireValidator ?? false,
    dryRun: opts?.dryRun ?? true,
    telemetryEnabled: opts?.telemetry ?? false,
    payload,
  };
}
