# Create Cryptocurrency Payment Gateway API

```markdown
# Cryptocurrency Payment Gateway API

## Purpose
The Cryptocurrency Payment Gateway API enables the management and processing of cryptocurrency transactions within applications. It supports atomic swaps, multi-signature wallets, and compliance features for secure and efficient cryptocurrency handling.

## Usage
This API allows developers to create and manage cryptocurrency wallets, execute transactions, and ensure compliance with regulatory standards. It is designed for integration into fintech applications, e-commerce platforms, and any service needing cryptocurrency payment processing.

## Parameters / Props

### Custom Types
- **cryptocurrency**: Enum for supported cryptocurrencies (BTC, ETH, USDC, USDT, DAI, WETH, WBTC).
- **transaction_status**: Enum reflecting the status of a transaction (pending, initiated, confirmed, completed, failed, cancelled, expired).
- **atomic_swap_state**: Enum representing the states of an atomic swap (created, locked, revealed, redeemed, refunded, expired).
- **compliance_status**: Enum for compliance review stages (pending, approved, rejected, under_review, flagged).
- **kyc_status**: Enum representing the Know Your Customer process (not_started, pending, approved, rejected, expired).

### Tables

#### `crypto_wallets`
- **id**: UUID (Primary Key) - Unique identifier for the wallet.
- **user_id**: UUID (Foreign Key) - Identifier for the user owning the wallet.
- **wallet_address**: TEXT - The cryptocurrency wallet address.
- **cryptocurrency**: ENUM - The type of cryptocurrency contained in the wallet.
- **wallet_type**: TEXT - Type of wallet (standard, multi_sig, contract).
- **is_multi_sig**: BOOLEAN - Flag indicating if the wallet is multi-signature.
- **required_signatures**: INTEGER - Number of signatures required for transaction approval.
- **public_keys**: JSONB - Public keys associated with multi-signature wallets.
- **wallet_metadata**: JSONB - Additional metadata for the wallet.
- **balance_wei**: TEXT - Balance in wei (smallest unit).
- **balance_decimal**: DECIMAL - Balance in decimal format.
- **is_active**: BOOLEAN - Activation status of the wallet.
- **created_at**: TIMESTAMPTZ - Timestamp of wallet creation.
- **updated_at**: TIMESTAMPTZ - Timestamp of last wallet update.

#### `multi_signature_requirements`
- **id**: UUID (Primary Key) - Unique identifier for multi-signature requirements.
- **wallet_id**: UUID (Foreign Key) - Reference to the wallet that uses multi-signature.

### Constraints
- Unique wallet constraint on (`wallet_address`, `cryptocurrency`).
- Valid multi-signature check ensuring correct configuration based on `is_multi_sig` and `required_signatures`.

## Return Values
The API will return JSON objects containing information about wallet creations, updates, transaction statuses, and any compliance issues encountered during operations. Each operation will yield a success or error message based on the outcome.

## Examples

### Create a Crypto Wallet
```sql
INSERT INTO crypto_wallets (user_id, wallet_address, cryptocurrency, wallet_type)
VALUES ('user-uuid', '0x123...abc', 'ETH', 'multi_sig');
```

### Query Wallet Balance
```sql
SELECT balance_decimal FROM crypto_wallets WHERE wallet_address = '0x123...abc' AND cryptocurrency = 'ETH';
```

### Update Multi-Signature Configuration
```sql
UPDATE crypto_wallets
SET is_multi_sig = TRUE, required_signatures = 3
WHERE id = 'wallet-uuid';
```
```