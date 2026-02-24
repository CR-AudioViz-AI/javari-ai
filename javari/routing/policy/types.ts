/**
 * Policy type definitions
 * 
 * Placeholder - will be expanded with full policy schema
 */

export interface PolicyCriteria {
  readonly id: string;
  readonly name: string;
  readonly rules?: any[];
  readonly budgetLimit?: number;
  readonly requireValidator?: boolean;
}
