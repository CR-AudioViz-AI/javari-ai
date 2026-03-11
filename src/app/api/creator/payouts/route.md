# Build Automated Payout Scheduling API

# Automated Payout Scheduling API Documentation

## Purpose
The Automated Payout Scheduling API provides functionality for managing and executing automated payouts for creators based on their defined payout rules. It integrates with Stripe to process the payout transactions and uses a cron job to schedule these payouts on a regular basis.

## Usage
To use the Automated Payout Scheduling API, ensure that the necessary environment variables are set, specifically `STRIPE_SECRET_KEY`. The API initializes a payout scheduler that runs daily at 9 AM UTC to check for creators eligible for payouts and processes them.

## Parameters/Props
### Controller Parameters
- **supabase**: An instance of Supabase client used for database operations.
  
### PayoutRule Interface
- **id**: The unique identifier for the payout rule.
- **creator_id**: The ID of the creator associated with the payout rule.
- **frequency**: The frequency of payouts, can be 'weekly', 'biweekly', or 'monthly'.
- **minimum_threshold**: Minimum earnings required to trigger a payout.
- **auto_payout_enabled**: Boolean indicating if automatic payouts are enabled.
- **next_payout_date**: The date the next payout is scheduled.
- **created_at**: Timestamp of when the record was created.
- **updated_at**: Timestamp of the last update to the record.

### CreatorEarnings Interface
- **creator_id**: The ID of the creator.
- **total_earnings**: Total earnings accrued by the creator.
- **pending_earnings**: Earnings pending payout.
- **last_payout_amount**: Amount of the last payout.
- **last_payout_date**: Date when the last payout was made.

### PayoutHistory Interface
- **id**: Unique identifier for the payout history record.
- **creator_id**: The ID of the creator associated with the payout.
- **amount**: Amount paid out.
- **stripe_transfer_id**: Unique identifier for the Stripe transfer.
- **status**: Status of the payout ('pending', 'completed', 'failed').
- **created_at**: Timestamp of when the record was created.

## Return Values
The API does not explicitly return values through public endpoints. Instead, it processes payouts in background jobs. However, when querying for creators' earnings or payout history, the relevant data structures above would be returned as results.

## Examples
### Payout Scheduling
The following code snippet demonstrates how the payout scheduler is initiated when the `PayoutScheduler` class is instantiated:

```typescript
const supabaseClient = createServerComponentClient({ cookies });
const payoutScheduler = new PayoutScheduler(supabaseClient);
```

### Scheduled Payout Execution
The payout executions will automatically check the database for creators with enabled payout rules during the cron scheduled time:

```typescript
// Scheduled job to run daily at 9 AM UTC
cron.schedule('0 9 * * *', async () => {
    await payoutScheduler.executeScheduledPayouts();
});
```

### Processing Payout for a Creator
Inside the `processPayoutForCreator` method, payouts are processed based on the earnings of the creators meeting their thresholds:

```typescript
private async processPayoutForCreator(rule: PayoutRule): Promise<void> {
    const earnings = await this.getCreatorEarnings(rule.creator_id);
    
    if (earnings.pending_earnings >= rule.minimum_threshold) {
        // Process payout logic
    }
}
```

This framework allows for robust automated management of creator payouts, enhancing cash flow operations for platforms utilizing automated payment structures.