# Build Global Payment Compliance API

```markdown
# Global Payment Compliance API

## Purpose
The Global Payment Compliance API is designed to assess payment transactions against regulatory compliance rules such as Anti-Money Laundering (AML), Know Your Customer (KYC), sanctions, and other financial regulations. It helps businesses ensure that their transactions adhere to jurisdictional requirements while managing risks associated with different payment methods.

## Usage
To use this API, integrate it into your application backend where payment processing occurs. The API allows for checking transaction compliance and updating jurisdiction rules as needed.

## Endpoints
- `POST /api/payment-compliance/check`: Checks the compliance of a payment transaction.
- `POST /api/payment-compliance/rule-update`: Updates compliance rules for a specific jurisdiction.

## Parameters / Props

### Transaction Compliance Check
**Request Body** (for `/check`):
```json
{
  "transaction_id": "string",
  "amount": "number",
  "currency": "string",
  "source_country": "string",
  "destination_country": "string",
  "payment_method": "string",
  "merchant_id": "string",
  "customer_data": {
    "id": "string",
    "type": "string",
    "risk_score": "number",
    "kyc_status": "string"
  },
  "metadata": {
    "key": "value"
  }
}
```

**Validation Schema**:
- `transaction_id`: Required, min 1 char, max 100 chars.
- `amount`: Required, positive number, max 1,000,000.
- `currency`: Required, 3 char string (ISO 4217).
- `source_country`: Required, 2 char string (ISO 3166-1 alpha-2).
- `destination_country`: Required, 2 char string.
- `payment_method`: Required, must be one of ['card', 'bank_transfer', 'digital_wallet', 'crypto'].
- `merchant_id`: Required, min 1 char, max 100 chars.
- `customer_data`: Optional object containing:
  - `id`: optional string.
  - `type`: required, must be either 'individual' or 'business'.
  - `risk_score`: optional number (0-100).
  - `kyc_status`: optional, must be one of ['pending', 'verified', 'rejected'].
- `metadata`: Optional key-value pairs.

### Rule Update
**Request Body** (for `/rule-update`):
```json
{
  "jurisdiction": "string",
  "rule_type": "string",
  "rule_data": {
    "id": "string",
    "version": "string",
    "effective_date": "string",
    "conditions": [],
    "actions": [],
    "priority": "number"
  }
}
```

**Validation Schema**:
- `jurisdiction`: Required, min 2 chars, max 10 chars.
- `rule_type`: Required, must be one of ['aml', 'kyc', 'sanctions', 'limits', 'reporting'].
- `rule_data`: Required object containing compliance rule details.

## Return Values

### Compliance Check Response
Returns `ComplianceResult`:
```json
{
  "compliant": "boolean",
  "jurisdiction": "string",
  "applied_rules": ["string"],
  "violations": [{
    "rule_id": "string",
    "severity": "string",
    "message": "string",
    "resolution_required": "boolean",
    "auto_block": "boolean"
  }],
  "risk_score": "number",
  "recommended_actions": ["string"],
  "next_review_date": "string"
}
```

### Rule Update Response
Returns a success message or the updated rule details.

## Examples

### Compliance Check Example
**Request**:
```json
{
  "transaction_id": "TX123456789",
  "amount": 500,
  "currency": "USD",
  "source_country": "US",
  "destination_country": "CA",
  "payment_method": "card",
  "merchant_id": "M12345",
  "customer_data": {
    "id": "C123",
    "type": "individual",
    "risk_score": 20,
    "kyc_status": "verified"
  }
}
```

### Rule Update Example
**Request**:
```json
{
  "jurisdiction": "US",
  "rule_type": "aml",
  "rule_data": {
    "id": "AML123",
    "version": "1.0",
    "effective_date": "2023-10-01", 
    "conditions": [],
    "actions": ["alert", "review"],
    "priority": 1
  }
}
```
```