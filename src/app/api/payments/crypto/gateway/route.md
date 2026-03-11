# Implement Multi-Chain Cryptocurrency Gateway API

```markdown
# Multi-Chain Cryptocurrency Gateway API

## Purpose
The Multi-Chain Cryptocurrency Gateway API provides a seamless way to process cryptocurrency payments across multiple blockchains, including Ethereum, Polygon, Binance Smart Chain (BSC), Solana, and Bitcoin. It efficiently handles payment initialization, validation, and processing.

## Usage
The API is designed to be invoked as part of a Next.js application. It allows frontend applications to interact with a secure backend to implement cryptocurrency transactions. 

### Endpoint
- **URL:** `/api/payments/crypto/gateway`
- **Method:** `POST`

## Parameters / Props
The body of the request must be a JSON object conforming to the `initializePaymentSchema`. The following parameters are expected:

- `amount` (number): The amount to be paid (must be a positive number).
- `currency` (string): The currency type, which can be one of the following: 'USD', 'EUR', 'BTC', 'ETH', 'SOL'.
- `supportedChains` (array): List of supported chains for the transaction (e.g., ['ethereum', 'polygon']).
- `recipientAddress` (string, optional): The address of the recipient. This should be a valid blockchain address.
- `metadata` (object, optional): Additional data related to the payment (key-value pairs).
- `expiresIn` (number, optional): Time in seconds before the payment expires (default is 3600 seconds, minimum 300, maximum 86400).

## Return Values
The API responds with a JSON object that contains:
- `success` (boolean): Indicates whether the payment initialization was successful.
- `paymentId` (string): Unique identifier for the transaction (if applicable).
- `message` (string): Additional information regarding the success or failure of the payment initialization.

## Examples

### Example Request
```json
POST /api/payments/crypto/gateway
{
  "amount": 100,
  "currency": "ETH",
  "supportedChains": ["ethereum", "polygon"],
  "recipientAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "metadata": {
    "orderId": "12345",
    "description": "Payment for service"
  },
  "expiresIn": 3600
}
```

### Example Response
```json
{
  "success": true,
  "paymentId": "abc123",
  "message": "Payment initialized successfully."
}
```

## Environment Variables
The API requires specific environment variables to be set in your application for configuration:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ETHEREUM_RPC_URL`
- `POLYGON_RPC_URL`
- `BSC_RPC_URL`
- `SOLANA_RPC_URL`
- `BITCOIN_RPC_URL`
- `BITCOIN_RPC_USER`
- `BITCOIN_RPC_PASSWORD`
- `ONEINCH_API_KEY`
- `CHAINLINK_API_KEY`
- `ALCHEMY_API_KEY`
- `FIREBLOCKS_API_KEY`
- `FIREBLOCKS_PRIVATE_KEY`
- `REDIS_URL`
- `ENCRYPTION_KEY` (must be exactly 32 characters long)

## Conclusion
The Multi-Chain Cryptocurrency Gateway API simplifies cryptocurrency transaction processes across various blockchains while providing robust payment validation and management capabilities.
```