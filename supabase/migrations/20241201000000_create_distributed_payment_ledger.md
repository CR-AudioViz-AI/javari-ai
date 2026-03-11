# Build Distributed Payment Ledger Database

```markdown
# Distributed Payment Ledger Database Migration

## Purpose
This migration file creates the schema for a distributed payment ledger database using PostgreSQL. It establishes essential types, tables, and constraints to efficiently manage and track financial transactions within a distributed system.

## Usage
Execute the SQL migration in a PostgreSQL environment where Supabase is set up, to initialize the payment ledger schema. This is done via a migration tool or directly through a SQL execution interface.

## Parameters/Props
The migration creates several ENUM types and tables:

### ENUM Types
1. **ledger_entry_type**: Defines various entry types for transactions.
   - `debit`
   - `credit`
   - `transfer`
   - `settlement`
   - `adjustment`
   - `fee`
   - `refund`

2. **ledger_entry_status**: Represents the current status of a ledger entry.
   - `pending`
   - `confirmed`
   - `settled`
   - `disputed`
   - `reversed`

3. **block_status**: Indicates the status of ledger blocks.
   - `open`
   - `sealed`
   - `finalized`

4. **settlement_status**: Dictates the status of a settlement process.
   - `pending`
   - `processing`
   - `completed`
   - `failed`
   - `disputed`

### Tables
1. **ledger_blocks**: 
   - **id**: UUID (Primary Key)
   - **block_number**: bigint (Unique for tenant)
   - **previous_block_hash**: text 
   - **merkle_root**: text 
   - **block_hash**: text (Unique)
   - **status**: block_status (Default: 'open')
   - **tenant_id**: UUID (Associates with a tenant)
   - **created_at**: timestamptz (Default: current timestamp)
   - **sealed_at**: timestamptz
   - **finalized_at**: timestamptz
   - **transaction_count**: integer (Default: 0)
   - **total_amount**: decimal(20,8) (Default: 0)
   - **metadata**: jsonb (Default: '{}')

2. **payment_ledger_entries**:
   - **id**: UUID (Primary Key)

### Constraints
- Ensures uniqueness of `block_number` for each `tenant_id` in `ledger_blocks`.
- Guarantees uniqueness of `block_hash` in `ledger_blocks`.

## Return Values
This migration does not return values as it primarily structures the database. Upon successful execution, the new schema will be available for use.

## Examples
To run the migration, use the following SQL command:
```sql
\i supabase/migrations/20241201000000_create_distributed_payment_ledger.sql
```
After execution, you may query the tables and types using:
```sql
SELECT * FROM ledger_blocks;
SELECT * FROM payment_ledger_entries;
```

This schema can now be utilized for creating, reading, updating, and deleting payment records in a robust and distributed manner.
```