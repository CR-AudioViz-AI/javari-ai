// ============================================================================
// CREDIT PACKAGES - CENTRALIZED DEFINITIONS
// ============================================================================
// Purpose: Single source of truth for one-time credit purchase packages
// Used by: Stripe checkout, webhooks, UI components
// Phase: 2 (Tier 1 - Revenue Critical)
// Created: 2026-01-29
// ============================================================================

/**
 * Credit Package Definition
 * 
 * Represents a one-time credit purchase package that can be purchased via Stripe.
 * Each package has a fixed credit amount and price.
 */
export interface CreditPackage {
  /** Unique identifier for the package (used in Stripe metadata) */
  id: string;
  
  /** Human-readable name displayed in UI */
  name: string;
  
  /** Marketing description of the package */
  description: string;
  
  /** Number of credits included in this package */
  credits: number;
  
  /** Price in cents (USD) - Stripe requires cents */
  price_cents: number;
  
  /** Currency code (ISO 4217) */
  currency: 'usd';
  
  /** Whether this package is currently available for purchase */
  active: boolean;
  
  /** 
   * Metadata to be stored in Stripe product/price
   * Used for tracking and webhook processing
   */
  stripe_product_metadata: {
    package_id: string;
    credits: string;
    package_type: 'one_time_credit_purchase';
  };
  
  /**
   * Display helpers
   */
  display: {
    /** Formatted price for display (e.g., "$10.00") */
    price_formatted: string;
    
    /** Price per credit in cents (for comparison) */
    price_per_credit_cents: number;
    
    /** Savings percentage compared to base rate (if applicable) */
    savings_percentage?: number;
  };
}

/**
 * BASE PRICING CONFIGURATION
 * 
 * Define the base credit price for calculating savings
 * Base rate: $0.01 per credit (1 cent per credit)
 */
const BASE_PRICE_PER_CREDIT_CENTS = 1;

/**
 * Calculate display information for a package
 */
function calculateDisplay(credits: number, price_cents: number): CreditPackage['display'] {
  const price_per_credit_cents = price_cents / credits;
  const savings_percentage = ((BASE_PRICE_PER_CREDIT_CENTS - price_per_credit_cents) / BASE_PRICE_PER_CREDIT_CENTS) * 100;
  
  return {
    price_formatted: `$${(price_cents / 100).toFixed(2)}`,
    price_per_credit_cents: Number(price_per_credit_cents.toFixed(4)),
    savings_percentage: savings_percentage > 0 ? Number(savings_percentage.toFixed(0)) : undefined,
  };
}

/**
 * CREDIT PACKAGES DEFINITIONS
 * 
 * One-time credit purchase packages available for direct purchase.
 * These are NOT subscriptions - users pay once and receive credits immediately.
 * 
 * Pricing Strategy:
 * - Starter: $10 for 1,000 credits (baseline, no discount)
 * - Pro: $40 for 5,000 credits (20% savings - $0.008/credit vs $0.01/credit)
 * - Business: $150 for 25,000 credits (40% savings - $0.006/credit vs $0.01/credit)
 * 
 * Note: These are separate from subscription plans (see app/api/stripe/checkout/route.ts)
 */
export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    description: '1,000 credits for occasional use',
    credits: 1000,
    price_cents: 1000, // $10.00
    currency: 'usd',
    active: true,
    stripe_product_metadata: {
      package_id: 'starter',
      credits: '1000',
      package_type: 'one_time_credit_purchase',
    },
    display: calculateDisplay(1000, 1000),
  },
  
  pro: {
    id: 'pro',
    name: 'Pro Pack',
    description: '5,000 credits with 20% savings',
    credits: 5000,
    price_cents: 4000, // $40.00 (20% discount: $0.008/credit)
    currency: 'usd',
    active: true,
    stripe_product_metadata: {
      package_id: 'pro',
      credits: '5000',
      package_type: 'one_time_credit_purchase',
    },
    display: calculateDisplay(5000, 4000),
  },
  
  business: {
    id: 'business',
    name: 'Business Pack',
    description: '25,000 credits with 40% savings',
    credits: 25000,
    price_cents: 15000, // $150.00 (40% discount: $0.006/credit)
    currency: 'usd',
    active: true,
    stripe_product_metadata: {
      package_id: 'business',
      credits: '25000',
      package_type: 'one_time_credit_purchase',
    },
    display: calculateDisplay(25000, 15000),
  },
  
  // Enterprise pack (optional - can be enabled later)
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Pack',
    description: '100,000 credits with 50% savings',
    credits: 100000,
    price_cents: 50000, // $500.00 (50% discount: $0.005/credit)
    currency: 'usd',
    active: false, // Disabled by default - enable when ready
    stripe_product_metadata: {
      package_id: 'enterprise',
      credits: '100000',
      package_type: 'one_time_credit_purchase',
    },
    display: calculateDisplay(100000, 50000),
  },
};

/**
 * Get all active credit packages
 * 
 * @returns Array of active packages, sorted by price (lowest to highest)
 */
export function getActiveCreditPackages(): CreditPackage[] {
  return Object.values(CREDIT_PACKAGES)
    .filter(pkg => pkg.active)
    .sort((a, b) => a.price_cents - b.price_cents);
}

/**
 * Get a credit package by ID
 * 
 * @param id - Package ID (e.g., 'starter', 'pro', 'business')
 * @returns The credit package or undefined if not found
 */
export function getCreditPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES[id];
}

/**
 * Validate if a package ID is valid and active
 * 
 * @param id - Package ID to validate
 * @returns True if package exists and is active
 */
export function isValidPackageId(id: string): boolean {
  const pkg = getCreditPackageById(id);
  return pkg !== undefined && pkg.active;
}

/**
 * Get package by credit amount
 * Useful for reverse lookup from Stripe metadata
 * 
 * @param credits - Credit amount to search for
 * @returns The credit package or undefined if not found
 */
export function getCreditPackageByAmount(credits: number): CreditPackage | undefined {
  return Object.values(CREDIT_PACKAGES).find(pkg => pkg.credits === credits);
}

/**
 * Calculate total price for custom credit amount (if we support custom amounts in future)
 * 
 * @param credits - Number of credits
 * @returns Price in cents based on nearest package rate
 */
export function calculateCustomCreditPrice(credits: number): number {
  // For custom amounts, use the pro rate ($0.008/credit)
  const PRO_RATE_PER_CREDIT = 0.008;
  return Math.round(credits * PRO_RATE_PER_CREDIT * 100);
}

/**
 * Type guard to check if an object is a valid CreditPackage
 * 
 * @param obj - Object to validate
 * @returns True if object matches CreditPackage interface
 */
export function isCreditPackage(obj: any): obj is CreditPackage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.credits === 'number' &&
    typeof obj.price_cents === 'number' &&
    obj.currency === 'usd' &&
    typeof obj.active === 'boolean' &&
    typeof obj.stripe_product_metadata === 'object' &&
    typeof obj.display === 'object'
  );
}

// ============================================================================
// USAGE EXAMPLES (for reference - remove in production)
// ============================================================================

/*
// Example 1: Get all active packages for UI display
const packages = getActiveCreditPackages();
// Returns: [starter, pro, business] (enterprise is inactive)

// Example 2: Get specific package for checkout
const proPackage = getCreditPackageById('pro');
if (proPackage) {
  console.log(`${proPackage.name}: ${proPackage.display.price_formatted}`);
  // Output: "Pro Pack: $40.00"
}

// Example 3: Validate package ID from user input
if (isValidPackageId('starter')) {
  // Proceed with checkout
}

// Example 4: Reverse lookup from Stripe metadata
const package = getCreditPackageByAmount(5000);
// Returns: pro package

// Example 5: Display pricing comparison
const activePackages = getActiveCreditPackages();
activePackages.forEach(pkg => {
  console.log(
    `${pkg.name}: ${pkg.credits.toLocaleString()} credits for ${pkg.display.price_formatted}`,
    pkg.display.savings_percentage ? `(${pkg.display.savings_percentage}% savings)` : ''
  );
});
// Output:
// Starter Pack: 1,000 credits for $10.00
// Pro Pack: 5,000 credits for $40.00 (20% savings)
// Business Pack: 25,000 credits for $150.00 (40% savings)
*/

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

// ============================================================================
// CONSTANTS EXPORTS
// ============================================================================

/** List of all package IDs for type safety */
export const CREDIT_PACKAGE_IDS = Object.keys(CREDIT_PACKAGES) as CreditPackageId[];

/** Number of active packages */
export const ACTIVE_PACKAGE_COUNT = getActiveCreditPackages().length;

// ============================================================================
// END OF FILE
// ============================================================================
