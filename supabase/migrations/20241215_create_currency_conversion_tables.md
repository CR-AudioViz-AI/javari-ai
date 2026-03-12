# Implement Real-Time Currency Conversion API

# Real-Time Currency Conversion API

## Purpose
This documentation outlines the SQL migration script designed to create the necessary database schema for a Real-Time Currency Conversion API using Supabase. The schema includes tables for currency metadata and rate providers which facilitate live currency functions.

## Usage
This SQL migration script should be executed in your Supabase instance using the SQL editor or command line tool. It sets up the environment for storing currency data, managing conversion rates, and logging conversion activities. 

## Parameters/Props
The migration script includes the following database constructs:

### Extensions:
- **uuid-ossp**: Allows for the generation of universally unique identifiers (UUIDs).
- **pg_cron**: Facilitates scheduled tasks.

### Enum Types:
- **currency_type**: Defines types of currency: 
  - 'fiat'
  - 'cryptocurrency'
  - 'stablecoin'
  - 'commodity'
  
- **provider_status**: Status of the rate provider:
  - 'active'
  - 'inactive'
  - 'maintenance'
  
- **conversion_status**: Status of currency conversion:
  - 'pending'
  - 'completed'
  - 'failed'
  - 'cancelled'
  
- **alert_type**: Types of alerts:
  - 'threshold_high'
  - 'threshold_low'
  - 'volatility'
  - 'offline'
  
- **fee_type**: Types of fees for conversion:
  - 'percentage'
  - 'fixed'
  - 'tiered'

### Tables:
- **currency_metadata**: Stores information about different currencies.
  - **Fields**: 
    - id (UUID, Primary Key)
    - code (VARCHAR, Unique)
    - name (VARCHAR)
    - symbol (VARCHAR)
    - type (currency_type)
    - decimals (INTEGER)
    - is_active (BOOLEAN)
    - min_conversion_amount (DECIMAL)
    - max_conversion_amount (DECIMAL)
    - daily_limit (DECIMAL)
    - icon_url (TEXT)
    - description (TEXT)
    - blockchain_network (VARCHAR)
    - contract_address (VARCHAR)
    - created_at (TIMESTAMP)
    - updated_at (TIMESTAMP)

- **rate_providers**: Stores details about rate providers.
  - **Fields**: 
    - id (UUID, Primary Key)
    - name (VARCHAR)
    - api_endpoint (TEXT)
    - status (provider_status)
    - priority (INTEGER)
    - refresh_interval_seconds (INTEGER)
    - timeout_seconds (INTEGER)
    - api_key_encrypted (TEXT)
    - rate_limit_per_minute (INTEGER)

## Return Values
This migration script will return success when executed and will create the specified types and tables in the database. No data will be returned; the result is the modified schema.

## Examples
To run this migration, you can copy and paste the following SQL code into the Supabase SQL editor:

```sql
-- Run the migration script for currency conversion tables
\i 'path/to/20241215_create_currency_conversion_tables.sql';
```
Once executed successfully, you will have the schema in place to support real-time currency conversions along with the necessary metadata and rate providers configuration.