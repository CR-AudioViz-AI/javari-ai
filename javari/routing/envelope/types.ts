/**
 * Unified Routing Envelope (URE)
 * 
 * All routing entrypoints must wrap request into this envelope.
 * Normalizes policy, learning, telemetry, validator requirements.
 */
import type { PolicyCriteria } from '../policy/types';

export interface RoutingEnvelopeMetadata {
  readonly requestId: string;
  readonly timestamp: string;
  readonly userId?: string;
  readonly source?: string;
}

export interface UnifiedRoutingEnvelope {
  readonly metadata: RoutingEnvelopeMetadata;
  readonly policy?: PolicyCriteria;              // Optional policy overlay
  readonly useLearning: boolean;                 // Mode A learning
  readonly usePriors: boolean;                   // Provider priors
  readonly requireValidator: boolean;            // Force validator regardless of policy
  readonly dryRun: boolean;                      // No live calls ever
  readonly telemetryEnabled: boolean;            // Mode A telemetry
  readonly payload: unknown;                     // User request (Mode A or B)
  readonly flags?: {                             // Optional execution flags
    autoExecute?: boolean;                       // Auto-execute approved plans
  };
}
