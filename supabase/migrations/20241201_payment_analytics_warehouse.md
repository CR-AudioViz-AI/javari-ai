# Implement Payment Analytics Data Warehouse

```markdown
# Payment Analytics Data Warehouse Migration

## Purpose
The Payment Analytics Data Warehouse schema is designed to facilitate comprehensive payment analytics through optimized database structures. It supports transaction analysis, revenue reporting, and financial forecasting while ensuring data integrity and performance optimization.

## Usage
This SQL migration script is intended for use with the Supabase platform. It creates necessary schemas, tables, and indexes required for payment analytics. To apply this migration, execute the SQL script in a Supabase SQL editor or through a migration tool connected to your PostgreSQL database.

## Parameters/Props
The script encompasses the following components:

### Extensions
- **uuid-ossp**: For generating universally unique identifiers (UUIDs).
- **pgcrypto**: For cryptographic functions.
- **pg_stat_statements**: For tracking SQL statement execution statistics.
- **timescaledb**: For time-series data capabilities.

### Schemas
- **analytics**: Main schema for storing analytic data.
- **dimensions**: Schema for dimension tables related to analytics.
- **forecasting**: Schema for storing forecasting-related data.

### Tables and Their Properties

#### `dimensions.currency_rates`
- **id**: UUID - Primary key, automatically generated.
- **base_currency**: VARCHAR(3) - The currency being exchanged.
- **target_currency**: VARCHAR(3) - The currency being converted to.
- **exchange_rate**: DECIMAL(18,8) - The exchange rate for the currency pair.
- **rate_date**: DATE - The date the exchange rate is applicable.
- **source**: VARCHAR(50) - Source of the exchange rate (default: 'api').
- **created_at**: TIMESTAMPTZ - Timestamp of record creation (default: NOW()).
- **updated_at**: TIMESTAMPTZ - Timestamp of last record update (default: NOW()).
- **Constraints**: Unique constraint on the combination of base_currency, target_currency, and rate_date.

#### `dimensions.payment_methods`
- **id**: UUID - Primary key, automatically generated.
- **method_code**: VARCHAR(20) - Unique code for the payment method.
- **method_name**: VARCHAR(100) - Name of the payment method.
- **method_type**: VARCHAR(50) - Type of the payment method (e.g., card, bank_transfer).
- **provider**: VARCHAR(100) - Payment provider's name.
- **region**: VARCHAR(10) - Applicable region for the payment method.
- **processing_fee_percent**: DECIMAL(5,4) - Percentage fee for processing.
- **fixed_fee_cents**: INTEGER - Fixed fee in cents for transactions.

### Indexes
- `idx_currency_rates_date`: Index on `rate_date` for sorting and querying efficiency.
- `idx_currency_rates_pair`: Index on `base_currency` and `target_currency` for quick lookups.
- `idx_currency_rates_updated`: Index on `updated_at` for tracking changes.

## Return Values
This migration script does not return values per se; instead, it creates the specified schemas, tables, and indexes within the database. Successfully executing the script establishes the foundation for payment analytics functionalities.

## Examples
To execute this migration script, you can use:

```sql
\i 'path/to/supabase/migrations/20241201_payment_analytics_warehouse.sql';
```

After running the script, you can start inserting data into the `dimensions.currency_rates` and `dimensions.payment_methods` tables as follows:

```sql
INSERT INTO dimensions.currency_rates (base_currency, target_currency, exchange_rate, rate_date, source) 
VALUES ('USD', 'EUR', 0.85, '2024-01-01', 'api');

INSERT INTO dimensions.payment_methods (method_code, method_name, method_type, provider, region) 
VALUES ('CC', 'Credit Card', 'card', 'Visa', 'US');
```
```