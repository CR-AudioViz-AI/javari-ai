# Deploy Automated Creator Payout Microservice

# Automated Creator Payout Microservice

## Purpose
The Automated Creator Payout Microservice is designed to handle creator payouts through multiple payment methods. It manages payment processing, tax calculations, compliance reporting, retry logic, and fraud detection to ensure secure and accurate transactions.

## Usage
The microservice is built using Express.js, and it is structured to handle HTTP requests for payout operations. It utilizes Bull for job management, Stripe and other payment platforms for processing payments, and Supabase for database interactions.

## Parameters/Props

### PayoutRequest
An object defining the payout request parameters:
- **creatorId**: `string` - Unique identifier for the creator.
- **amount**: `number` - Amount to be paid.
- **currency**: `string` - Currency in which the payment will be made.
- **paymentMethod**: `PaymentMethod` - The payment method details.
- **taxInfo**: `TaxInfo` - Information about the tax implications of the payout.
- **metadata**: `Record<string, any>` (optional) - Additional information relevant to the payout.

### PaymentMethod
An object defining how the payment will be made:
- **type**: `string` - Type of payment ('stripe', 'paypal', or 'wise').
- **accountId**: `string` - The account identifier for the payment method.
- **details**: `StripeAccount | PayPalAccount | WiseAccount` - Specific account details based on the payment type.

### TaxInfo
An object providing tax information:
- **country**: `string` - The country of the creator for tax calculations.
- **taxId**: `string` (optional) - The tax identification number.
- **withholdingRate**: `number` - The rate at which tax will be withheld.
- **exemptionStatus**: `boolean` - Indicates if the creator is exempt from certain taxes.
- **w9Filed**: `boolean` - Indicates if a W-9 form has been filed.

### PayoutResult
The result object returned after processing a payout:
- **transactionId**: `string` - Identifier for the completed transaction.
- **status**: `PayoutStatus` - Current status of the payout.
- **amount**: `number` - Total amount issued in the payout.
- **netAmount**: `number` - Amount after deductions (tax, fees).
- **taxDeducted**: `number` - Amount of tax deducted from the payout.
- **fees**: `number` - Transaction fees associated with the payout.
- **paymentMethodUsed**: `string` - The method used for payment.
- **processedAt**: `Date` - Timestamp of when the payout was processed.
- **estimatedDelivery**: `Date` (optional) - Estimated time for the funds to be delivered.

## Return Values
The microservice returns a `PayoutResult` object for each payout request, encapsulating all information about the transaction, including any deductions made, the payment status, and the method used.

## Examples

### Making a Payout Request
```typescript
const payoutRequest: PayoutRequest = {
  creatorId: "creator123",
  amount: 100,
  currency: "USD",
  paymentMethod: {
    type: "stripe",
    accountId: "acct_1C8FYe2eZvKYlo2C",
    details: {
      accountId: "acct_1C8FYe2eZvKYlo2C",
      country: "US",
      currency: "USD"
    }
  },
  taxInfo: {
    country: "US",
    taxId: "123-45-6789",
    withholdingRate: 30,
    exemptionStatus: false,
    w9Filed: true
  }
};
```

### Sample Response
```json
{
  "transactionId": "txn_1C8FYe2eZvKYlo2C",
  "status": "completed",
  "amount": 100,
  "netAmount": 70,
  "taxDeducted": 30,
  "fees": 2,
  "paymentMethodUsed": "Stripe",
  "processedAt": "2023-10-01T12:00:00Z",
  "estimatedDelivery": "2023-10-02T12:00:00Z"
}
``` 

This microservice enables automated, efficient, and compliant payout processing, tailored to diverse creator needs and payment preferences.