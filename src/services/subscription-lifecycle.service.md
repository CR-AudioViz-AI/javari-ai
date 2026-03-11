# Build Advanced Subscription Lifecycle Service

```markdown
# Advanced Subscription Lifecycle Service

## Purpose
The `SubscriptionLifecycleService` provides a comprehensive management system for subscription plans, handling billing cycles, dunning (debt recovery), and subscription state management. It integrates with Stripe for payment processing and utilizes Supabase as a backend data store.

## Usage
To utilize the `SubscriptionLifecycleService`, you need to instantiate the service and call its methods to manage subscriptions for users. This includes creating, updating, and canceling subscriptions, as well as handling dunning processes.

## Parameters / Props

### SubscriptionPlan
- `id` (string): Unique identifier for the subscription plan.
- `name` (string): Human-readable name of the plan.
- `tier` (`'free' | 'basic' | 'professional' | 'enterprise'`): Subscription level.
- `priceMonthly` (number): Monthly price.
- `priceYearly` (number): Yearly price.
- `features` (string[]): Some key features included in the plan.
- `limits` (object): Limits associated with the plan.
  - `maxProjects` (number): Maximum number of projects allowed.
  - `maxStorage` (number): Maximum storage in GB.
  - `maxProcessingTime` (number): Limit of processing time in minutes per month.
  - `maxTeamMembers` (number): Maximum team members permitted.
- `stripeProductId` (string): Stripe product identifier.
- `stripePriceIds` (object): Stripe pricing details.
  - `monthly` (string): Monthly pricing ID from Stripe.
  - `yearly` (string): Yearly pricing ID from Stripe.
- `isActive` (boolean): Whether the plan is currently active.
- `sortOrder` (number): Integer to determine order of plans.

### DunningConfig
- `maxRetries` (number): Maximum retry attempts for payment failures.
- `retryIntervals` (number[]): Days between each retry.
- `emailTemplates` (object): Email templates for communications.
  - `firstRetry` (string): Template for the first retry.
  - `secondRetry` (string): Template for the second retry.
  - `finalNotice` (string): Template for final notice.
  - `cancellation` (string): Template for cancellation notice.
- `gracePeriodDays` (number): Days allowed for payment after failure.
- `autoDowngradeToFree` (boolean): Auto downgrade to free plan after failure.

### Subscription
- `id` (string): Unique subscription identifier.
- `userId` (string): ID of the user associated with the subscription.
- `planId` (string): Associated subscription plan ID.
- `stripeSubscriptionId` (string): Unique ID from Stripe for the subscription.
- `status` (`'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid' | 'paused'`): Current status of the subscription.
- `currentPeriodStart` (Date): Start date of the subscription period.
- `currentPeriodEnd` (Date): End date of the subscription period.
- `billingCycle` (BillingCycle): Billing cycle type.
- `customBillingConfig` (CustomBillingConfig, optional): Custom billing configuration.
- `pausedAt` (Date, optional): Timestamp when the subscription was paused.
- `pauseReason` (string, optional): Reason for pausing the subscription.
- `cancelAtPeriodEnd` (boolean): Whether the subscription will cancel at the end of the current period.

## Return Values
Each method in the service returns a Promise that resolves to an object representing the successful operation of subscription management, or an error message detailing any issues encountered.

## Examples
```typescript
// Example of creating a new subscription
const newSubscription = await subscriptionLifecycleService.createSubscription({
  userId: 'user-123',
  planId: 'plan-456',
});

// Example of canceling a subscription
const canceledSubscription = await subscriptionLifecycleService.cancelSubscription('sub-789');

// Example of retrieving subscription details
const subscriptionDetails = await subscriptionLifecycleService.getSubscription('sub-789');
```
```