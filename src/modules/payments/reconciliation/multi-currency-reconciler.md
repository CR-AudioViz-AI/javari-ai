# Build Multi-Currency Transaction Reconciliation System

# Multi-Currency Transaction Reconciliation System

## Purpose
The `multi-currency-reconciler.ts` module provides functionalities to reconcile transactions across various payment providers in multiple currencies. It standardizes transaction data, checks for discrepancies, and provides mechanisms to address them.

## Usage
This module is intended for use in applications that require handling and reconciling payment transactions across different currencies. It integrates with payment providers such as Stripe, PayPal, and others by processing raw transaction data, normalizing it, and performing reconciliations based on configurable parameters.

## Parameters/Props

### Types
- **CurrencyCode**: Supports currencies such as `'USD'`, `'EUR'`, `'GBP'`, `'JPY'`, `'CAD'`, `'AUD'`, `'CHF'`, and `'CNY'`.
- **PaymentProvider**: Identifies providers, including `'stripe'`, `'paypal'`, `'square'`, `'adyen'`, and `'checkout'`.
- **TransactionStatus**: Status of transactions like `'pending'`, `'completed'`, `'failed'`, `'cancelled'`, or `'refunded'`.
- **ReconciliationStatus**: Status of reconciliation including `'pending'`, `'matched'`, `'discrepant'`, `'resolved'`, or `'disputed'`.
- **DiscrepancyType**: Types of discrepancies such as `'amount_mismatch'`, `'missing_transaction'`, `'duplicate'`, `'fx_rate_variance'`, or `'timing_mismatch'`.

### Interfaces
- **ProviderTransaction**: Represents a raw transaction from a payment provider with fields including `id`, `provider`, `reference`, `amount`, `currency`, `status`, `timestamp`, `metadata`, `fees`, and `netAmount`.
  
- **NormalizedTransaction**: Represents a normalized transaction for reconciliation with fields including `id`, `providerId`, `provider`, `reference`, `originalAmount`, `originalCurrency`, `baseCurrencyAmount`, `baseCurrency`, `fxRate`, `status`, `timestamp`, `fees`, `netAmount`, and `reconciliationStatus`.

- **MatchingConfig**: Configuration for transaction matching, including:
  - `amountTolerancePercent`: Percentage tolerance for amount discrepancies.
  - `timestampToleranceMinutes`: Time tolerance for matching transactions.
  - `enableReferenceMatching`: Boolean for enabling reference-based matching.
  - `enableFuzzyMatching`: Boolean to allow fuzzy matching techniques.
  - `baseCurrency`: The base currency for conversions.
  - `minimumConfidenceScore`: Minimum score required for confident matches.

- **FXRate**: Contains information on foreign exchange rates used for converting currencies.

## Return Values
The module provides utility functions that return:
- Normalized transaction data.
- Status updates regarding transaction reconciliations.
- Details on any identified discrepancies.

## Examples

### Normalizing a Transaction
```typescript
const rawTransaction: ProviderTransaction = {
  id: 'txn_123',
  provider: 'stripe',
  reference: 'ref_456',
  amount: 100,
  currency: 'USD',
  status: 'completed',
  timestamp: new Date(),
  metadata: {},
  fees: 2,
  netAmount: 98,
};

const normalizedTransaction: NormalizedTransaction = normalizeTransaction(rawTransaction, 'EUR', 0.85);
```

### Setting Matching Configurations
```typescript
const matchingConfig: MatchingConfig = {
  amountTolerancePercent: 1,
  timestampToleranceMinutes: 10,
  enableReferenceMatching: true,
  enableFuzzyMatching: false,
  baseCurrency: 'EUR',
  minimumConfidenceScore: 0.8,
};
```

This module provides the necessary building blocks for a robust multi-currency transaction reconciliation system, helping businesses ensure accurate financial oversight and reporting.