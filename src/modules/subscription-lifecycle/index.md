# Build Advanced Subscription Lifecycle Manager

# Advanced Subscription Lifecycle Manager

## Purpose
The Advanced Subscription Lifecycle Manager is designed to handle subscription management tasks seamlessly. It integrates with Stripe for payment processing, Supabase for storage, and Resend for communication, providing a comprehensive solution for managing subscription lifecycles, their states, billing cycles, and any plan changes necessary.

## Usage
To utilize the Subscription Lifecycle Manager, import the necessary methods and classes, configure the subscription settings according to the user's requirements, and perform operations such as creating, updating, or canceling subscriptions.

```typescript
import { createClient } from '@supabase/supabase-js';
import { SubscriptionLifecycleManager } from './src/modules/subscription-lifecycle';
```

## Parameters/Props

### SubscriptionConfig
```typescript
interface SubscriptionConfig {
  userId: string;               // Unique identifier for the user
  planId: string;               // Unique identifier for the subscription plan
  billingCycle: BillingCycle;   // Type of billing cycle (monthly, quarterly, yearly)
  trialDays?: number;           // Optional trial period in days
  promoCode?: string;           // Optional promotional code
  paymentMethodId: string;      // Identifier for the user's payment method
}
```

### Subscription
```typescript
interface Subscription {
  id: string;                   // Unique identifier for the subscription
  userId: string;               // User associated with the subscription
  planId: string;               // Plan identifier
  stripeSubscriptionId: string; // Stripe-generated subscription identifier
  state: SubscriptionState;     // Current state of the subscription
  billingCycle: BillingCycle;   // Billing cycle type
  currentPeriodStart: Date;     // Start date of the current billing period
  currentPeriodEnd: Date;       // End date of the current billing period
  trialEnd?: Date;              // Trial end date, if applicable
  cancelAtPeriodEnd: boolean;   // If true, subscription will be canceled at end of the current period
  createdAt: Date;              // Creation date of the subscription
  updatedAt: Date;              // Last update date of the subscription
}
```

### BillingHistory
```typescript
interface BillingHistory {
  id: string;                   // Unique identifier for the billing entry
  subscriptionId: string;       // Associated subscription identifier
  amount: number;               // Amount charged
  currency: string;             // Currency of the transaction
  status: string;               // Payment status
  invoiceId: string;            // Related invoice identifier
  paymentIntentId?: string;     // Optional payment intent identifier
  billingDate: Date;            // Date of billing
  paidDate?: Date;              // Date payment was made, if applicable
  createdAt: Date;              // Creation date of the billing entry
}
```

### ProrationResult
```typescript
interface ProrationResult {
  creditAmount: number;         // Amount credited due to proration
  chargeAmount: number;         // Amount charged due to proration
  netAmount: number;            // Net amount after proration calculation
  prorationItems: Array<{       // Items included in the proration
    description: string;        // Description of the line item
    amount: number;             // Amount for the line item
    quantity: number;           // Quantity of the line item
    unitAmount: number;         // Unit amount of the line item
  }>
}
```

## Return Values
Methods within the Subscription Lifecycle Manager will return subscription objects upon successful creation or updates, billing history records when querying, and proration results upon adjustment of subscription plans.

## Examples
Creating a subscription:
```typescript
const subscriptionConfig: SubscriptionConfig = {
  userId: 'user-123',
  planId: 'plan-456',
  billingCycle: BillingCycle.MONTHLY,
  trialDays: 14,
  paymentMethodId: 'pm-789'
};

const subscription = await subscriptionLifecycleManager.createSubscription(subscriptionConfig);
```

Querying billing history:
```typescript
const billingHistory = await subscriptionLifecycleManager.getBillingHistory(subscription.id);
```

Calculating proration:
```typescript
const proration = await subscriptionLifecycleManager.calculateProration(subscription.id, newPlanId);
```