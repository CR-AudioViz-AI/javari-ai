# Create Multi-Blockchain Payment Service

```markdown
# Multi-Blockchain Payment Service Migration Documentation

## Purpose
The purpose of this SQL migration script is to set up a database schema for a multi-blockchain payment service. It facilitates the storage and management of blockchain networks, user wallets, and payment transactions, enabling seamless payment processing across various blockchain platforms.

## Usage
This migration script is intended to be executed in a PostgreSQL database environment. It sets up the necessary database tables and configurations required for a multi-blockchain payment service. The script should be run using a database migration tool or directly via a SQL execution interface.

## Parameters/Props

### Extensions
- **uuid-ossp**: Enables the generation of UUIDs for unique identifiers.
- **pg_crypto**: Provides functions for cryptographic operations (used for encrypting private keys and mnemonics).

### Tables

1. **blockchain_networks**
   - **id** (UUID): Unique identifier for the blockchain network.
   - **name** (VARCHAR(100)): Name of the blockchain network.
   - **chain_id** (INTEGER): Unique identifier for the blockchain.
   - **symbol** (VARCHAR(10)): Symbol of the native cryptocurrency.
   - **rpc_endpoint** (TEXT): Endpoint for interacting with the blockchain network.
   - **explorer_url** (TEXT): URL to a block explorer for the blockchain.
   - **native_currency** (VARCHAR(10)): Currency used on the blockchain network.
   - **network_type** (VARCHAR(20)): Defines if the network is a 'mainnet' or 'testnet'.
   - **confirmation_blocks** (INTEGER): Number of blocks to confirm a transaction.
   - **gas_multiplier** (DECIMAL(4,2)): Multiplier for gas estimation.
   - **is_active** (BOOLEAN): Indicates if the network is currently active.
   - **created_at** (TIMESTAMPTZ): Timestamp of creation.
   - **updated_at** (TIMESTAMPTZ): Timestamp of the last update.

2. **payment_wallets**
   - **id** (UUID): Unique identifier for the wallet.
   - **user_id** (UUID): Identifier of the user to whom the wallet belongs.
   - **network_id** (UUID): Identifier of the associated blockchain network.
   - **wallet_address** (VARCHAR(255)): Address of the wallet.
   - **wallet_type** (VARCHAR(20)): Type of wallet ('hot', 'cold', 'multisig').
   - **private_key_encrypted** (TEXT): Encrypted private key of the wallet.
   - **mnemonic_encrypted** (TEXT): Encrypted mnemonic phrase for recovery.
   - **derivation_path** (VARCHAR(100)): Path for deriving wallet keys.
   - **is_active** (BOOLEAN): Indicates if the wallet is active.
   - **balance_cache** (JSONB): Cached balance information of the wallet.
   - **last_sync_at** (TIMESTAMPTZ): Timestamp of the last synchronization.
   - **created_at** (TIMESTAMPTZ): Timestamp of creation.
   - **updated_at** (TIMESTAMPTZ): Timestamp of the last update.

3. **payment_transactions**
   - **id** (UUID): Unique identifier for each transaction.
   - **user_id** (UUID): Identifier of the user making the transaction.
   - **network_id** (UUID): Identifier of the blockchain used.
   - **from_wallet_id** (UUID): Identifier of the sending wallet.
   - **to_wallet_id** (UUID): Identifier of the receiving wallet.
   - Additional fields should be defined to capture complete transaction details.

## Return Values
This SQL script will create several tables in the database upon successful execution, configuring the necessary structure for handling multi-blockchain payments and user wallet management.

## Examples
To execute this migration, use `psql` command-line tool:

```bash
psql -U username -d dbname -f src/database/migrations/20241201_create_multi_blockchain_payments.sql
```
Replace `username` with the database user and `dbname` with the target database name.
```