# Create Agent Revenue Attribution API

# Agent Revenue Attribution API

## Purpose
The Agent Revenue Attribution API allows you to track revenue events associated with agents, calculate attribution for various agents based on different models, and initiate payouts based on tracked revenue. This API is crucial for systems that need to accurately attribute financial performance to specific agents or deployments in a marketplace or similar environment.

## Usage
This API is implemented as a series of functions that handle tracking revenue, calculating attribution, and initiating payouts. It integrates with Supabase for data storage and Stripe for potential payment processing.

## Parameters / Props

### RevenueTrackingSchema
- **agentId**: `string` (UUID) - The unique identifier for the agent.
- **deploymentId**: `string` (UUID) - The unique identifier for the deployment.
- **revenue**: `number` - The amount of revenue to track (must be positive).
- **currency**: `string` - The 3-character currency code (ISO 4217).
- **transactionId**: `string` - The unique identifier for the transaction.
- **contextData**: `object` (optional) - Additional context related to the transaction.
- **attributionWeights**: `object` (optional) - Custom weights for various attribution models.

### AttributionCalculationSchema
- **transactionId**: `string` - The unique identifier for the transaction being analyzed.
- **involvedAgents**: `array` of `string` (UUIDs) - List of agent IDs involved in the revenue event.
- **attributionModel**: `string` - The model used for attribution (`'linear'`, `'first_touch'`, `'last_touch'`, `'time_decay'`, `'position_based'`).
- **customWeights**: `object` (optional) - Custom weights to be applied during attribution calculation.

### PayoutInitiationSchema
- **agentIds**: `array` of `string` (UUIDs, optional) - List of agent IDs for whom payouts are initiated.
- **periodStart**: `string` (datetime) - The start of the payout period.
- **periodEnd**: `string` (datetime) - The end of the payout period.
- **minimumPayout**: `number` (optional) - Minimum amount required to process the payout.

## Return Values
- The functions may return various data types:
  - **Revenue Tracking**: Returns the recorded revenue event or throws an error if the operation fails.
  - **Attribution Calculation**: Returns the attribution results based on the specified model or throws an error for validation issues.
  - **Payout Initiation**: Returns the status of the payout operation or throws an error on failure.

## Examples

### Track Revenue
```javascript
const revenueData = {
  agentId: "e5b6c4d9-e4a0-4f1a-bd35-fend846db555",
  deploymentId: "dfc47e11-4edf-4828-b5d5-7514bfcb5265",
  revenue: 1500.00,
  currency: "USD",
  transactionId: "txn_123456789",
  contextData: { campaign: "Spring Sale" },
  attributionWeights: { agent1: 0.3, agent2: 0.7 }
};

RevenueAttributionService.trackRevenue(revenueData);
```

### Calculate Attribution
```javascript
const attributionData = {
  transactionId: "txn_123456789",
  involvedAgents: ["e5b6c4d9-e4a0-4f1a-bd35-fend846db555", "b8c47e11-12ab-4828-b5d5-7514caeb2236"],
  attributionModel: "linear"
};

RevenueAttributionService.calculateAttribution(attributionData);
```

### Initiate Payout
```javascript
const payoutData = {
  agentIds: ["e5b6c4d9-e4a0-4f1a-bd35-fend846db555"],
  periodStart: "2023-01-01T00:00:00Z",
  periodEnd: "2023-02-01T00:00:00Z",
  minimumPayout: 100.00
};

RevenueAttributionService.initiatePayout(payoutData);
``` 

This API aims at providing comprehensive revenue tracking and agent attribution capabilities, facilitating effective financial management and agent performance analysis in business environments.