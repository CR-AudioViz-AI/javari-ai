# Deploy Instant Creator Payout Service

# Instant Creator Payout Service

## Purpose
The Instant Creator Payout Service is designed to facilitate immediate payout processing for creators, utilizing integration with payment platforms such as Stripe. It handles various aspects of payout calculations, including tax calculations and revenue sharing, ensuring creators receive their earnings promptly based on their chosen payout schedule and configurations.

## Usage
To utilize the Instant Creator Payout Service, import the necessary functions and interfaces, configure the creator’s payout settings, and trigger payout operations using purchase event data.

### Example
```typescript
import { CreatorPayoutConfig, PurchaseEvent, PayoutTransaction } from './path/to/instant-payout-service';

// Create a new payout configuration
const payoutConfig: CreatorPayoutConfig = {
  creator_id: "creator123",
  stripe_account_id: "acct_456",
  minimum_payout_threshold: 20.00,
  payout_schedule: 'instant',
  platform_fee_rate: 0.05,
  revenue_share_rate: 0.8,
  tax_jurisdiction: "CA"
};

// Function to handle a purchase event
const handlePurchaseEvent = (event: PurchaseEvent): PayoutTransaction => {
  // Logic for processing the purchase and calculating payout
  // Returns a PayoutTransaction object
};
```

## Parameters/Props

### PurchaseEvent
- **id**: Unique identifier for the purchase.
- **content_id**: Identifier for the content purchased.
- **creator_id**: Identifier for the content creator.
- **buyer_id**: Identifier for the buyer.
- **purchase_type**: Type of purchase - either 'purchase' or 'license'.
- **amount**: Total amount paid by the buyer.
- **currency**: Currency of the transaction.
- **platform_fee_rate**: Fee rate taken by the platform.
- **timestamp**: Date and time of the purchase.
- **metadata**: Optional additional data related to the purchase.

### CreatorPayoutConfig
- **creator_id**: Identifier for the creator receiving payouts.
- **stripe_account_id**: Stripe account for handling payments.
- **tax_id**: Optional tax identification.
- **tax_jurisdiction**: Tax jurisdiction for the creator.
- **minimum_payout_threshold**: Minimum amount required for payouts.
- **payout_schedule**: Frequency of payouts (instant, daily, weekly, monthly).
- **revenue_share_rate**: The portion of earnings that the creator retains.

### PayoutTransaction
- **id**: Unique identifier for the payout transaction.
- **creator_id**: Identifier for the creator associated with the payout.
- **purchase_event_id**: Related purchase event identifier.
- **gross_amount**: Total amount before fees/taxes.
- **platform_fee**: Amount deducted as a platform fee.
- **tax_amount**: Amount withheld for taxes.
- **net_amount**: Final amount payable to the creator.
- **currency**: Currency of the transaction.
- **status**: Current status of the payout.
- **stripe_transfer_id**: Identifier for the Stripe transfer (if applicable).
- **processed_at**: Date and time the payout was processed.
- **error_message**: Error message if the payout failed.
- **tax_calculation**: Tax details for this transaction.
- **metadata**: Optional additional data related to the transaction.

## Return Values
The service primarily returns a `PayoutTransaction` object after processing a purchase event, which contains all the details of the payout transaction, including any calculated taxes and fees. 

### Example Return Value
```json
{
  "id": "txn_789",
  "creator_id": "creator123",
  "purchase_event_id": "event_001",
  "gross_amount": 100.00,
  "platform_fee": 5.00,
  "tax_amount": 0.00,
  "net_amount": 95.00,
  "currency": "USD",
  "status": "completed",
  "tax_calculation": {
    "gross_amount": 100.00,
    "tax_rate": 0,
    "tax_amount": 0.00,
    "net_amount": 95.00,
    "tax_jurisdiction": "CA",
    "tax_breakdown": {}
  }
}
```