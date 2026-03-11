# Create Multi-Blockchain Cryptocurrency API

# Multi-Blockchain Cryptocurrency API Schema Documentation

## Purpose
The Multi-Blockchain Cryptocurrency API Schema provides a comprehensive database structure to facilitate the management of cryptocurrencies across multiple blockchain networks. This schema supports functionalities such as tracking blockchain networks, managing crypto wallets, and handling transactions.

## Usage
This schema is used within a PostgreSQL database to support operations for a cryptocurrency API. It enables developers to store and retrieve critical information regarding blockchain networks, wallets, and transactions, thus allowing seamless interaction with various cryptocurrencies.

## Parameters/Props

### Enum Types
- **blockchain_network**: Represents different blockchain networks supported (BITCOIN, ETHEREUM, POLYGON, BSC, ARBITRUM, OPTIMISM, AVALANCHE).
- **wallet_type**: Defines the type of wallets (HOT, COLD, MULTISIG, HARDWARE, PAPER).
- **transaction_status**: Indicates the state of transactions (PENDING, CONFIRMED, FAILED, CANCELLED, REJECTED).
- **transaction_type**: Types of transactions (SEND, RECEIVE, SWAP, STAKE, UNSTAKE, BRIDGE, DEFI_DEPOSIT, DEFI_WITHDRAW).
- **defi_protocol_type**: Categorizes decentralized finance protocols (DEX, LENDING, STAKING, FARMING, BRIDGE, OPTIONS, INSURANCE).

### Tables
1. **blockchain_networks**
   - `id`: UUID (Primary Key)
   - `network`: blockchain_network (Unique)
   - `name`: VARCHAR(100)
   - `chain_id`: INTEGER
   - `rpc_url`: TEXT
   - `explorer_url`: TEXT
   - `native_currency`: VARCHAR(10)
   - `native_decimals`: INTEGER (Default: 18)
   - `is_testnet`: BOOLEAN (Default: false)
   - `is_active`: BOOLEAN (Default: true)
   - `block_time_seconds`: INTEGER
   - `min_confirmations`: INTEGER (Default: 1)
   - `created_at`: TIMESTAMPTZ (Default: NOW())
   - `updated_at`: TIMESTAMPTZ (Default: NOW())

2. **crypto_wallets**
   - `id`: UUID (Primary Key)
   - `user_id`: UUID (Foreign Key)
   - `network`: blockchain_network
   - `address`: TEXT
   - `wallet_type`: wallet_type (Default: 'HOT')
   - `name`: VARCHAR(100)
   - `encrypted_private_key`: TEXT
   - `public_key`: TEXT
   - `derivation_path`: TEXT
   - `is_watching_only`: BOOLEAN (Default: false)

## Return Values
The schema does not have return values, as it is a data structure for storage. However, when queried, it can return structured data about blockchain networks, cryptocurrency wallets, and transaction histories based on the defined tables and relationships.

## Examples

### Creating a New Blockchain Network
```sql
INSERT INTO blockchain_networks (network, name, rpc_url, native_currency, native_decimals)
VALUES ('BITCOIN', 'Bitcoin Mainnet', 'https://btc.rpc.url', 'BTC', 8);
```

### Adding a New Crypto Wallet
```sql
INSERT INTO crypto_wallets (user_id, network, address, wallet_type, name)
VALUES ('some-uuid-user-id', 'ETHEREUM', '0xYourEthereumAddress', 'HOT', 'My Ethereum Wallet');
```

### Querying All Active Blockchain Networks
```sql
SELECT * FROM blockchain_networks
WHERE is_active = true;
```

This schema ensures a robust foundation for developing APIs that interact with multiple blockchain ecosystems while maintaining data integrity and accessibility.