/**
 * Feature flags for routing system
 */

export function isRoutingEnabled(): boolean {
  // Default: routing enabled
  // Can be controlled via env var: JAVARI_ROUTING_ENABLED
  return process.env.JAVARI_ROUTING_ENABLED !== 'false';
}

export function isValidatorLiveEnabled(): boolean {
  // Default: use simulated validator
  return process.env.JAVARI_VALIDATOR_LIVE_ENABLED === 'true';
}

export function isLearningEnabled(): boolean {
  // Default: learning disabled until explicitly enabled
  return process.env.JAVARI_LEARNING_ENABLED === 'true';
}
