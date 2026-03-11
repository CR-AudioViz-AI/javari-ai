# Build Intelligent Payment Routing API

# Intelligent Payment Routing API Documentation

## Purpose
The Intelligent Payment Routing API is designed to intelligently route payment transactions to the most suitable payment processors based on various parameters like transaction amount, currency, customer tier, and other rules defined in routing logic. It enhances payment success rates and optimizes processing costs.

## Usage
This API is implemented as a TypeScript module and provides a class `PaymentRoutingEngine` which encapsulates the logic for evaluating and routing payments efficiently. 

### Endpoints
The API can be accessed by making HTTP requests to the designated route defined in your application (specific route setup is required). 

## Parameters/Props

### RoutePaymentRequest
#### Properties:
- `amount` (number) - The total amount of the payment.
- `currency` (string) - The currency code (e.g., 'USD', 'EUR').
- `country` (string) - The country where the payment is being processed.
- `paymentMethod` (string) - The type of payment method (e.g., 'credit_card', 'paypal').
- `customerTier` (string, optional) - The tier of the customer ('basic', 'premium', 'enterprise').
- `merchantId` (string, optional) - Identifier for the merchant.
- `transactionType` (string, optional) - Type of transaction ('purchase', 'subscription', 'refund').

### ProcessorRecommendation
#### Properties:
- `processorId` (string) - Unique identifier for the processor.
- `processorName` (string) - Name of the payment processor.
- `confidenceScore` (number) - Score indicating reliability of the processor.
- `estimatedSuccessRate` (number) - Expected success rate for the payments.
- `estimatedFees` (number) - Estimated processing fees.
- `processingTime` (string) - Estimated time to process.
- `healthStatus` (string) - Indicates the health status of the processor ('healthy', 'degraded', 'down').
- `fallbackOrder` (number) - Order of fallback if the preferred option is unavailable.

### RoutingRule
#### Properties:
- `id` (string) - Unique identifier for the routing rule.
- `country` (string, optional) - Applicable country for the rule.
- `currency` (string, optional) - Applicable currency for the rule.
- `amountMin` (number, optional) - Minimum amount for the rule.
- `amountMax` (number, optional) - Maximum amount for the rule.
- `paymentMethod` (string, optional) - Payment method to be applied.
- `customerTier` (string, optional) - Customer tier for the routing rule.
- `preferredProcessors` (string[]) - List of preferred processors.
- `blockedProcessors` (string[]) - List of blocked processors.
- `priority` (number) - Priority level of the rule.

## Return Values
The API returns a list of `ProcessorRecommendation` objects, suggesting the best processors based on the input parameters and internal routing rules.

## Examples

### Example Request
```typescript
const paymentRequest: RoutePaymentRequest = {
  amount: 150,
  currency: 'USD',
  country: 'US',
  paymentMethod: 'credit_card',
  customerTier: 'premium'
};
```

### Example Response
```json
[
  {
    "processorId": "proc_123",
    "processorName": "FastPay",
    "confidenceScore": 0.95,
    "estimatedSuccessRate": 98.5,
    "estimatedFees": 2.5,
    "processingTime": "3 seconds",
    "healthStatus": "healthy",
    "fallbackOrder": 1
  },
  {
    "processorId": "proc_456",
    "processorName": "QuickCash",
    "confidenceScore": 0.85,
    "estimatedSuccessRate": 95.0,
    "estimatedFees": 2.0,
    "processingTime": "5 seconds",
    "healthStatus": "healthy",
    "fallbackOrder": 2
  }
]
```

This API helps in real-time payment routing decisions by evaluating various factors, leading to improved payment processing efficiency.