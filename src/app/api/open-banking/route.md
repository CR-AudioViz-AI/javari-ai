# Build Open Banking Integration API

```markdown
# Open Banking Integration API

## Purpose
The Open Banking Integration API allows secure interaction with Open Banking services, including account information retrieval and payment initiation. It is compliant with PSD2 regulations and integrates with Supabase for data storage and management.

## Usage
This API can be utilized to authorize requests for account information, initiate payments, and check the status of user consents. It handles request validation and rate limiting to ensure reliable and secure operations.

## Endpoints

### 1. Authorization Endpoint
Handles user authorization and consent.

**Method:** `POST /authorize`

**Parameters:**
- `aspsp_id` (string): The ID of the Account Servicing Payment Service Provider. Minimum length: 1.
- `redirect_uri` (string): The URI to redirect after authorization. Must be a valid URL.
- `scope` (enum): The scope of the request. Possible values: `accounts`, `payments`, `funds_confirmation`.
- `state` (string): An arbitrary string to maintain state between the request and callback. Minimum length: 1.
- `user_id` (string): The unique identifier for the user making the request. Must be a valid UUID.

**Return Values:**
Returns a redirect URI to complete the authorization process.

### 2. Account Information Endpoint
Retrieves account information based on granted consent.

**Method:** `POST /account-info`

**Parameters:**
- `consent_id` (string): Unique identifier for consent. Minimum length: 1.
- `account_id` (string, optional): Specific account ID for detailed information.
- `from_date` (string, optional): Start date for the information request in ISO 8601 format.
- `to_date` (string, optional): End date for the information request in ISO 8601 format.

**Return Values:**
Returns detailed account information if consent is valid and granted.

### 3. Payment Initiation Endpoint
Initiates a payment based on provided details.

**Method:** `POST /payment-initiation`

**Parameters:**
- `consent_id` (string): Unique identifier for consent. Minimum length: 1.
- `debtor_account` (object): Contains:
  - `iban` (string): IBAN of the debtor's account. Must match IBAN format.
- `creditor_account` (object): Contains:
  - `iban` (string): IBAN of the creditor's account. Must match IBAN format.
  - `name` (string): Name of the creditor. Minimum length: 1.
- `instructed_amount` (object): Contains:
  - `currency` (string): Currency code (3 characters).
  - `amount` (string): Amount to be transferred in decimal format with two decimal places.
- `remittance_information` (string, optional): Optional information for the remittance. Max length: 140 characters.

**Return Values:**
Returns the status of the payment initiation if consent is valid.

### 4. Consent Status Endpoint
Checks the status of a consent.

**Method:** `POST /consent-status`

**Parameters:**
- `consent_id` (string): Unique identifier for consent. Minimum length: 1.

**Return Values:**
Returns the current status of the specified consent.

## Example
```javascript
const response = await fetch('/authorize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    aspsp_id: 'bank-123',
    redirect_uri: 'https://myapp.com/callback',
    scope: 'accounts',
    state: 'xyzState',
    user_id: '550e8400-e29b-41d4-a716-446655440000'
  }),
});
```
This example demonstrates how to initiate an authorization request.

## Notes
- Ensure to handle consent management and adhere to user data privacy regulations.
- The API employs rate limiting for enhanced security and to prevent abuse.
```