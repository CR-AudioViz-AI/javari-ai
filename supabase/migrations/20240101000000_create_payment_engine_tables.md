# Build Multi-Blockchain Payment Engine

# Multi-Blockchain Payment Engine Documentation

## Purpose
The Multi-Blockchain Payment Engine is designed to facilitate cross-chain payments, enabling seamless transactions between different blockchain networks. This database schema provides configurations for payment networks, routes for cross-chain transactions, and essential information for decentralized finance (DeFi) integrations.

## Usage
This SQL migration script sets up the necessary database structure within a Supabase project for managing multi-blockchain payment processes. It creates tables that configure payment networks and define routes for payments across different chains.

## Parameters/Props

### Tables

1. **payment_networks**
   - `id` (UUID): Unique identifier for the payment network.
   - `network_name` (VARCHAR): Name of the blockchain network.
   - `chain_id` (BIGINT): Unique identifier for the blockchain chain.
   - `rpc_url` (TEXT): Remote Procedure Call URL for the network.
   - `explorer_url` (TEXT): URL for the network's block explorer.
   - `native_token` (VARCHAR): Symbol for the native cryptocurrency.
   - `native_decimals` (INTEGER): Number of decimal places for the native token (default: 18).
   - `gas_token` (VARCHAR): Symbol for the token used to pay for transaction fees.
   - `average_block_time` (INTEGER): Average time taken to mine a block (default: 12 seconds).
   - `finality_blocks` (INTEGER): Number of blocks needed to confirm transactions (default: 12).
   - `is_testnet` (BOOLEAN): Indicates if the network is a testnet (default: FALSE).
   - `is_active` (BOOLEAN): Status of the network (default: TRUE).
   - `min_gas_price` (BIGINT): Minimum gas price for transactions (default: 0).
   - `max_gas_price` (BIGINT): Maximum gas price for transactions.
   - `network_fee_multiplier` (DECIMAL): Multiplier for calculating network fees (default: 1.000).
   - `created_at` (TIMESTAMP): Timestamp of when the entry was created.
   - `updated_at` (TIMESTAMP): Timestamp of the last update.

2. **payment_routes**
   - `id` (UUID): Unique identifier for the payment route.
   - `source_network_id` (UUID): ID of the source payment network.
   - `destination_network_id` (UUID): ID of the destination payment network.
   - `token_address` (TEXT): Smart contract address for the token being routed.
   - `bridge_protocol` (VARCHAR): Protocol used for the cross-chain transfer.
   - `route_type` (VARCHAR): Type of routing (default: 'direct').
   - `estimated_time_minutes` (INTEGER): Estimated time for the transfer in minutes (default: 5).
   - `min_amount` (DECIMAL): Minimum amount for transactions (default: 0).
   - `max_amount` (DECIMAL): Maximum amount for transactions.
   - `fee_percentage` (DECIMAL): Percentage fee charged for the route (default: 0.003).
   - `gas_estimate` (BIGINT): Estimated gas required (default: 150,000).
   - `is_active` (BOOLEAN): Status of the route (default: TRUE).
   - `priority_score` (INTEGER): Score determining the priority of the route (default: 100).
   - `success_rate` (DECIMAL): Estimated success rate of the route (default: 1.0000).
   - `created_at` (TIMESTAMP): Timestamp of when the route was created.
   - `updated_at` (TIMESTAMP): Timestamp of the last update.
   - **Unique Constraint**: On combination of source network, destination network, token address, and bridge protocol.

## Return Values
The migrations do not return values as they set up the database schema. Upon execution, the specified tables will be created in the database, enabling further operations related to multi-blockchain payments.

## Examples
To run this script, use your preferred SQL execution method in Supabase with the following command:

```sql
-- Run payment engine migration script
\i 'supabase/migrations/20240101000000_create_payment_engine_tables.sql'
```

This command will execute the SQL commands in the specified file, creating the necessary structures for the payment engine.