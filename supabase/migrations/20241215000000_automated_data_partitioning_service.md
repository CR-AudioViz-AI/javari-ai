# Deploy Automated Data Partitioning Service

# Automated Data Partitioning Service Migration Documentation

## Purpose
This migration script sets up an Automated Data Partitioning Service in a PostgreSQL database using Supabase. It creates necessary extensions, enumerates types for various statuses, and defines a core configuration table for managing partitioning strategies.

## Usage
To apply this migration, execute the SQL script using a database migration tool compatible with PostgreSQL and Supabase. Ensure the database has the required privileges.

## Parameters/Props

### Extensions
- **uuid-ossp**: Provides functions to generate universally unique identifiers (UUIDs).
- **pg_stat_statements**: Enables tracking of execution statistics of SQL statements.

### Enumerated Types
1. **partition_strategy**: Defines allowed partitioning strategies.
   - `hash`
   - `range`
   - `list`
   - `composite`

2. **rebalancing_status**: Indicates the state of partition rebalancing operations.
   - `pending`
   - `in_progress`
   - `completed`
   - `failed`
   - `cancelled`

3. **partition_health_status**: Provides status indicators for partition health.
   - `healthy`
   - `warning`
   - `critical`
   - `offline`

### Table: `partition_configurations`
- **id** (UUID): Unique identifier for the partition configuration (auto-generated).
- **table_name** (TEXT): Name of the table to be partitioned (mandatory).
- **schema_name** (TEXT): Schema of the table (default is 'public').
- **strategy** (partition_strategy): Partition strategy to be applied (mandatory).
- **partition_key** (TEXT): Key used for partitioning (mandatory).
- **partition_count** (INTEGER): Number of partitions (default is 4).
- **max_size_mb** (INTEGER): Maximum size of each partition in megabytes (default is 1000).
- **min_size_mb** (INTEGER): Minimum size of each partition in megabytes (default is 100).
- **rebalance_threshold** (DECIMAL(3,2)): Threshold at which rebalancing is triggered (default is 0.8).
- **auto_rebalance** (BOOLEAN): Indicates if auto-rebalancing is enabled (default is true).
- **retention_days** (INTEGER): Duration for which data is retained.
- **compression_enabled** (BOOLEAN): Indicates if compression is enabled for partitions (default is false).
- **created_at** (TIMESTAMPTZ): Timestamp for when the configuration was created (default is NOW()).
- **updated_at** (TIMESTAMPTZ): Timestamp for the last update to the configuration (default is NOW()).
- **created_by** (UUID): User who created the entry (references `auth.users`).
- **is_active** (BOOLEAN): Indicates if the partition configuration is active (default is true).

### Constraints
- Unique constraint on `table_name` and `schema_name`.
- Validity checks for `rebalance_threshold`, `min_size_mb`, `max_size_mb`, and `partition_count`.

## Return Values
This migration does not return any values directly but modifies the database schema to include partitioning capabilities. You can query the `partition_configurations` table for managing data partitions effectively after applying this migration.

## Example
To apply this migration, run the following SQL command in your Supabase SQL editor or through your migration tooling:
```sql
-- Execute migration script for Automated Data Partitioning Service
\i supabase/migrations/20241215000000_automated_data_partitioning_service.sql
```

After executing, you can insert a new partition configuration like this:
```sql
INSERT INTO partition_configurations (table_name, strategy, partition_key)
VALUES ('orders', 'range', 'order_date');
```