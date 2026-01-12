// lib/javari-guardrails.ts
// Feature flags and safety constraints for autonomous operations

export interface JavariGuardrails {
  // Destructive actions
  allowDataDeletion: boolean;
  allowSchemaMutation: boolean;
  allowFileSystemWrite: boolean;
  
  // Autonomous limits
  maxStepsPerTask: number;
  maxRetries: number;
  requireExplicitConfirmation: string[]; // Actions requiring user OK
  
  // Safety
  enableSelfHealing: boolean;
  enableAutoRecovery: boolean;
  enableContinuousMode: boolean;
}

export const PRODUCTION_GUARDRAILS: JavariGuardrails = {
  // Destructive actions OFF by default
  allowDataDeletion: false,
  allowSchemaMutation: false,
  allowFileSystemWrite: false, // Will enable via explicit flags later
  
  // Autonomous limits
  maxStepsPerTask: 20,
  maxRetries: 2,
  requireExplicitConfirmation: [
    'delete_user_data',
    'drop_table',
    'modify_schema',
    'charge_payment'
  ],
  
  // Safety features ON
  enableSelfHealing: true,
  enableAutoRecovery: true,
  enableContinuousMode: true,
};

export function getGuardrails(): JavariGuardrails {
  return PRODUCTION_GUARDRAILS;
}

export function isActionAllowed(action: string, guardrails: JavariGuardrails): boolean {
  // Check if action requires confirmation
  if (guardrails.requireExplicitConfirmation.includes(action)) {
    return false; // Requires user confirmation
  }
  
  // Check destructive action flags
  if (action.includes('delete') && !guardrails.allowDataDeletion) {
    return false;
  }
  
  if (action.includes('schema') && !guardrails.allowSchemaMutation) {
    return false;
  }
  
  // Default: allow
  return true;
}
