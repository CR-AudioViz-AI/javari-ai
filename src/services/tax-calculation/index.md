# Deploy Automated Tax Calculation Microservice

# Tax Calculation Microservice Documentation

## Purpose
The Tax Calculation Microservice automates the tax calculation process across multiple jurisdictions. It features real-time rate updates, exemption handling, compliance reporting, and supports various product types (digital, physical, service).

## Usage
To use the Tax Calculation Microservice, integrate it with your backend to submit transaction data and receive calculated tax information. 

## Parameters/Props

### Transaction
The main input to the tax calculation function should adhere to the `TransactionSchema`. 

- **id** (string): Unique identifier for the transaction.
- **amount** (number): Transaction amount. Must be positive.
- **currency** (string): Currency code (ISO 4217), must be exactly 3 characters.
- **productType** (string): Type of product sold (`'digital'`, `'physical'`, or `'service'`).
- **customerLocation**: Object containing:
  - **country** (string): 2-character country code.
  - **state** (string, optional): State of the customer.
  - **city** (string, optional): City of the customer.
  - **postalCode** (string, optional): Postal code of the customer.
- **businessLocation**: Object containing:
  - **country** (string): 2-character country code.
  - **state** (string, optional): State of the business.
- **exemptionId** (string, optional): ID of any relevant exemptions.
- **metadata** (object, optional): Additional transaction data.

### Tax Rate
Define tax rates using the `TaxRateSchema`.

- **jurisdiction** (string): Geographic jurisdiction for the tax rate.
- **rate** (number): Tax rate, between 0 (0%) and 1 (100%).
- **type** (string): Type of tax (`'sales'`, `'vat'`, `'gst'`, or `'use'`).
- **effectiveDate** (date): Date from which the rate is applicable.
- **expiryDate** (date, optional): Date when the rate expires.

### Exemption
Exemption details should comply with the `ExemptionSchema`.

- **id** (string): Unique identifier for the exemption.
- **customerId** (string): ID of the customer receiving the exemption.
- **type** (string): Type of exemption (`'resale'`, `'nonprofit'`, `'government'`, or `'manufacturing'`).
- **jurisdiction** (string): Jurisdiction of the exemption.
- **certificateNumber** (string): Certificate number of the exemption.
- **validUntil** (date): Expiration date of the exemption.
- **status** (string): Status of the exemption (`'active'`, `'expired'`, or `'revoked'`).

## Return Values
The service returns a `TaxCalculationResult` object:

- **transactionId** (string): ID of the processed transaction.
- **totalTax** (number): Total calculated tax amount.
- **breakdown** (array): Detailed breakdown of taxes by jurisdiction including:
  - **jurisdiction** (string)
  - **type** (string)
  - **rate** (number)
  - **taxableAmount** (number)
  - **taxAmount** (number)
  - **exemptionApplied** (boolean)
- **exemptions** (array of strings): List of applicable exemptions.
- **calculatedAt** (date): Timestamp of calculation.
- **ruleVersion** (string): Version of the applied tax rules.

## Examples
```typescript
const transaction = {
  id: "txn_123",
  amount: 200,
  currency: "USD",
  productType: "digital",
  customerLocation: { country: "US", state: "CA" },
  businessLocation: { country: "US", state: "NY" },
  exemptionId: "ex_emp123"
};

// Call tax calculation function (pseudo-code)
const result = calculateTax(transaction);
console.log(result.totalTax); // e.g., 15.00
``` 

Refer to the source code for detailed integration instructions.