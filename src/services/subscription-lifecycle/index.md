# Deploy Automated Subscription Lifecycle Manager

# Automated Subscription Lifecycle Manager

## Purpose
The Automated Subscription Lifecycle Manager is designed to handle the complete lifecycle of subscriptions, including creation, billing, renewals, cancellations, and dunning management. It automates tasks such as payment retries and email notifications, ensuring a smooth experience for users and improved subscription retention.

## Usage
To utilize the Subscription Lifecycle Manager, initialize it with the required configuration parameters and call the relevant methods for subscription management. Ensure that the appropriate environments for external integrations (such as Stripe, Supabase, Redis, and Resend) are properly set up and accessible.

## Parameters / Props

### `SubscriptionConfig`
The configuration object required to initialize the Subscription Manager.

- `stripeSecretKey` (string): The secret key for Stripe API access.
- `supabaseUrl` (string): The URL to the Supabase instance.
- `supabaseServiceKey` (string): The service role key for Supabase.
- `redisUrl` (string): The connection URL for Redis.
- `redisToken` (string): The authentication token for Redis.
- `resendApiKey` (string): The API key for sending emails via Resend.
- `webhookSecret` (string): The authentication secret for incoming webhooks from payment providers.

### `Subscription`
Represents a subscription entity with various properties:

- `id` (string): Unique identifier for the subscription.
- `userId` (string): Identifier for the user associated with the subscription.
- `stripeSubscriptionId` (string): Subscription ID from Stripe.
- `stripePriceId` (string): Price ID from Stripe for the subscription.
- `status` (SubscriptionStatus): Current status of the subscription.
- `currentPeriodStart` (Date): Start date of the current billing period.
- `currentPeriodEnd` (Date): End date of the current billing period.
- `trialEnd` (Date, optional): End date of the trial period (if applicable).
- `cancelAtPeriodEnd` (boolean): Flag indicating if the subscription will cancel at the end of the period.
- `canceledAt` (Date, optional): When the subscription was canceled.
- `endedAt` (Date, optional): When the subscription ended.
- `metadata` (Record<string, any>): Additional metadata related to the subscription.
- `createdAt` (Date): Timestamp when the subscription was created.
- `updatedAt` (Date): Timestamp when the subscription was last updated.

### `SubscriptionStatus`
Defines possible statuses for a subscription:

- `incomplete`
- `incomplete_expired`
- `trialing`
- `active`
- `past_due`
- `canceled`
- `unpaid`

### `BillingCycle`
Represents a billing cycle associated with a subscription:

- `subscriptionId` (string): Identifier for the subscription.
- `amount` (number): Amount for the billing cycle.
- `currency` (string): Currency of the billing amount.
- `periodStart` (Date): Start date of the billing cycle.
- `periodEnd` (Date): End date of the billing cycle.
- `prorationAmount` (number, optional): Amount for proration adjustments.
- `retryCount` (number): Number of retry attempts made for payment.
- `lastAttempt` (Date, optional): Last date a payment was attempted.
- `nextRetry` (Date, optional): The next scheduled retry date.

### `DunningSequence`
Details the process of dunning management:

- `subscriptionId` (string): Identifier for the subscription.
- `stage` (DunningStage): Current stage in the dunning process.
- `emailsSent` (number): Count of emails sent during the dunning process.
- `lastEmailSent` (Date, optional): Date the last email was sent.
- `nextEmailScheduled` (Date, optional): Date the next email is scheduled.
- `gracePeriodEnd` (Date): End date of the grace period for the subscription.

### `DunningStage`
Enumerates stages of the dunning process:

- `initial`
- `reminder_1`
- `reminder_2`
- `final_notice`
- `suspended`

### `PaymentRetry`
Tracks information for payment retry attempts:

- `subscriptionId` (string): Identifier for the subscription.
- `invoiceId` (string): Identifier of the invoice associated with the payment attempt.
- `attemptCount` (number): Number of retry attempts made. 

## Example
```typescript
const config: SubscriptionConfig = {
  stripeSecretKey: 'sk_test_...',
  supabaseUrl: 'https://your-supabase-url.supabase.co',
  supabaseServiceKey: 'your-supabase-service-key',
  redisUrl: 'https://your-redis-url',
  redisToken: 'your-redis-token',
  resendApiKey