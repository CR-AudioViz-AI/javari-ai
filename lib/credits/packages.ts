// ============================================================================
// CREDIT PACKAGES - CENTRALIZED DEFINITIONS
// ============================================================================
// Purpose: Single source of truth for one-time credit purchase packages
// Used by: Stripe checkout, webhooks, UI components
// Phase: 2 (Tier 1 - Revenue Critical)
// Created: 2026-01-29
// ============================================================================
export interface CreditPackage {
  // Enterprise pack (optional - can be enabled later)
  // For custom amounts, use the pro rate ($0.008/credit)
// ============================================================================
// USAGE EXAMPLES (for reference - remove in production)
// ============================================================================
// Example 1: Get all active packages for UI display
// Returns: [starter, pro, business] (enterprise is inactive)
// Example 2: Get specific package for checkout
  // Output: "Pro Pack: $40.00"
// Example 3: Validate package ID from user input
  // Proceed with checkout
// Example 4: Reverse lookup from Stripe metadata
// Returns: pro package
// Example 5: Display pricing comparison
// Output:
// Starter Pack: 1,000 credits for $10.00
// Pro Pack: 5,000 credits for $40.00 (20% savings)
// Business Pack: 25,000 credits for $150.00 (40% savings)
// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type CreditPackageId = keyof typeof CREDIT_PACKAGES;
// ============================================================================
// CONSTANTS EXPORTS
// ============================================================================
// ============================================================================
// END OF FILE
// ============================================================================
export default {}
