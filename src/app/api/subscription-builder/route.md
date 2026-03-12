# Implement Flexible Subscription Builder API

# Flexible Subscription Builder API Documentation

## Purpose
The Flexible Subscription Builder API allows developers to create and manage flexible subscription tiers, incorporating usage limits, feature gates, and variable pricing models. It integrates with Supabase for database management, Stripe for payment processing, and Redis for caching.

## Usage
This API can be utilized to handle subscription-related operations, including creating subscription tiers, updating existing tiers, and calculating pricing based on usage data.

### Endpoints
- **POST /api/subscription-builder**: Create a new subscription tier.
- **PUT /api/subscription-builder/:id**: Update an existing subscription tier.
- **GET /api/subscription-builder/:id/pricing**: Calculate pricing based on usage data.

## Parameters / Props

### Subscription Tier Schema
```typescript
const SubscriptionTierSchema = z.object({
  name: z.string().min(1).max(100),  // Name of the tier
  description: z.string().max(500).optional(),  // Optional description of the tier
  pricing_rules: PricingRuleSchema,  // Pricing rules associated with the tier
  usage_limits: z.array(UsageLimitSchema),  // Limits on usage for the tier
  feature_gates: z.array(FeatureGateSchema),  // Features available in the tier
  is_enterprise: z.boolean().default(false),  // Indicates if it is an enterprise tier
  is_active: z.boolean().default(true),  // Activation status of the tier
  trial_days: z.number().min(0).max(365).optional(),  // Optional trial period in days
  setup_fee: z.number().min(0).optional()  // Optional setup fee
});
```

### Pricing Rule Schema
```typescript
const PricingRuleSchema = z.object({
  type: z.enum(['fixed', 'usage_based', 'graduated', 'per_unit']),  // Pricing model type
  base_price: z.number().min(0),  // Base price of the subscription
  currency: z.string().length(3),  // Currency code (e.g., USD)
  tiers: z.array(z.object({
    up_to: z.number().nullable(),  // Upper limit for tiered pricing
    unit_price: z.number().min(0),  // Price per unit for graduated pricing
  })).optional(),  // Optional tier structures
  billing_period: z.enum(['monthly', 'yearly', 'weekly', 'daily']),  // Billing cycle
});
```

### Usage Limit Schema
```typescript
const UsageLimitSchema = z.object({
  type: z.enum(['api_calls', 'storage_gb', 'bandwidth_gb', 'transcription_minutes', 'ai_generations']),
  limit: z.number().min(0),  // Maximum allowed usage
  overage_rate: z.number().min(0).optional(),  // Rate for overage usage
  reset_period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),  // Reset period for usage tracking
});
```

## Return Values
- **On successful creation/update**: Returns a confirmation with the details of the created/updated subscription tier.
- **On pricing calculation**: Returns calculated cost based on the provided usage data.

## Examples

### Create Subscription Tier
```bash
POST /api/subscription-builder
{
  "name": "Pro Plan",
  "description": "Advanced features for professional users.",
  "pricing_rules": {
    "type": "usage_based",
    "base_price": 10,
    "currency": "USD",
    "billing_period": "monthly"
  },
  "usage_limits": [
    { "type": "api_calls", "limit": 1000, "reset_period": "monthly" },
    // Additional usage limits here
  ],
  "feature_gates": [],
  "is_active": true
}
```

### Update Subscription Tier
```bash
PUT /api/subscription-builder/1234-5678-1234
{
  "trial_days": 30
}
```

### Calculate Pricing
```bash
GET /api/subscription-builder/pricing
{
  "tier_id": "1234-5678-1234",
  "usage_data": {
    "api_calls": 1500,
    // Additional usage metrics here
  }
}
```

This concise documentation provides an overview of the Flexible Subscription Builder API's capabilities, schemas, and functionalities, enabling developers to integrate subscription management into their applications effectively.