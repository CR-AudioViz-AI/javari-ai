# Build Flexible Subscription Tier Service

# Subscription Tier Service Documentation

## Purpose
The `subscription-tier.service.ts` file defines a service for managing flexible subscription tiers for users. It facilitates tier configurations, user subscriptions, usage tracking, and recommendations for tier upgrades or downgrades based on user activity.

## Usage
To utilize the Subscription Tier Service, import the service and use the provided methods to manage tiers, track user subscriptions, and analyze usage.

```typescript
import { SubscriptionTierService } from 'lib/services/subscription-tier.service';
```

## Parameters/Props

### Interfaces

#### `SubscriptionTier`
Defines the structure of a subscription tier.

- `id`: string - Unique identifier for the tier.
- `name`: string - Machine-readable name of the tier.
- `display_name`: string - User-friendly name of the tier.
- `price_monthly`: number - Monthly price of the tier.
- `price_yearly`: number - Yearly price of the tier.
- `stripe_price_id_monthly`: string - Stripe price ID for monthly billing.
- `stripe_price_id_yearly`: string - Stripe price ID for yearly billing.
- `features`: TierFeature[] - List of features included in the tier.
- `limits`: TierLimits - Usage limits for the tier.
- `is_active`: boolean - Status of the tier.
- `sort_order`: number - Order for tier display.
- `created_at`: string - Timestamp of creation.
- `updated_at`: string - Timestamp of last update.

#### `TierFeature`
Defines features associated with a subscription tier.

- `feature_key`: string - Key identifier for the feature.
- `feature_name`: string - Display name of the feature.
- `enabled`: boolean - Whether the feature is active.
- `limit`: number (optional) - Usage limit for the feature.
- `overage_rate`: number (optional) - Rate charged for overages.

#### `TierLimits`
Defines usage limits for a tier.

- `audio_processing_minutes`: number - Max minutes for audio processing.
- `visualizations_per_month`: number - Monthly limit on visualizations.
- `export_count`: number - Maximum allowed exports.
- `storage_gb`: number - Storage limit in GB.
- `api_requests_per_hour`: number - Limit of API requests per hour.
- `concurrent_sessions`: number - Max number of concurrent sessions.

#### `UserSubscription`
Details a user's current subscription.

- `id`: string - Unique identifier for the subscription.
- `user_id`: string - User's identifier.
- `tier_id`: string - Corresponding tier ID.
- `stripe_subscription_id`: string - ID from Stripe for the subscription.
- `status`: string - Current status of the subscription (e.g., active, canceled).
- `current_period_start`: string - Start date of the subscription period.
- `current_period_end`: string - End date of the subscription period.
- `cancel_at_period_end`: boolean - Flag to determine cancellation at period end.
- `created_at`: string - Creation timestamp.
- `updated_at`: string - Last updated timestamp.

#### `UsageRecord`
Tracks usage of features by a user.

- `id`: string - Unique identifier for the usage record.
- `user_id`: string - Identifier of the user.
- `feature_key`: string - Key of the feature used.
- `usage_count`: number - Count of features used.
- `usage_date`: string - Date of usage.
- `metadata`: Record<string, any> (optional) - Additional metadata about usage.

#### `TierRecommendation`
Indicates recommended changes in the user's subscription tier based on usage analysis.

- `current_tier_id`: string - User's current tier.
- `recommended_tier_id`: string - Suggested tier for the user.
- `reason`: string - Rationale behind the recommendation.
- `potential_savings`: number (optional) - Possible savings if the recommendation is followed.
- `additional_cost`: number (optional) - Added cost if the recommendation is followed.
- `confidence_score`: number - Confidence of the recommendation.
- `usage_analysis`: UsageAnalysis - Analysis data backing the recommendation.

#### `UsageAnalysis`
Details analysis of the user's feature usage.

- `period_days`: number - Duration of the analysis in days.
- `features_over_limit`: string[] - Features surpassing their respective limits.

## Return Values
Each method within the service returns specific data structures as outlined in the parameters and interfaces. This includes tier information, subscription details, usage records, and recommendations.

## Examples
```typescript
// Create a new subscription tier
const newTier: SubscriptionTier = {
  id: 'tier_1',
  name: 'Basic',
  display_name: 'Basic Plan',
  price_monthly: 9.99,
  price_yearly: 99.99,
  stripe_price_id_monthly: 'price_1Example',
  stripe_price