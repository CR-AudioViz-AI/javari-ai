# Create Advanced Revenue Analytics Widget

```markdown
# Advanced Revenue Analytics Migration

## Purpose
The Advanced Revenue Analytics Migration file defines the database schema for tracking and analyzing revenue. It includes setup for revenue transactions with detailed metrics aggregation, predictive modeling capabilities, and reporting features essential for comprehensive revenue management.

## Usage
This migration file should be executed in a PostgreSQL database to create the necessary tables and extensions. Use this migration to set up your revenue analytics environment in an application that manages creator and transaction data.

## Parameters/Props
The migration includes the following key components:

1. **Required Extensions**:
   - `uuid-ossp` - Allows the generation of universally unique identifiers (UUIDs).
   - `pg_stat_statements` - Provides tracking of statement execution statistics.

2. **Tables Created**:
   - `revenue_transactions`: Captures detailed data about each revenue transaction.
   - `revenue_metrics_daily`: Stores aggregated daily revenue metrics.

### `revenue_transactions` Table Structure:
- `id` (UUID): Primary key, auto-generated.
- `creator_id` (UUID): Reference to the user's ID from the `auth.users` table.
- `transaction_type` (VARCHAR): Type of transaction (e.g., 'subscription', 'one_time_payment').
- `source_type` (VARCHAR): Type of source for revenue (e.g., 'content_purchase').
- `source_id` (UUID): Reference to the content items or other sources.
- `amount_cents` (INTEGER): Revenue amount in cents.
- `currency` (VARCHAR): Currency type, default is 'USD'.
- `platform_fee_cents` (INTEGER): Fee charged by the platform.
- `net_amount_cents` (INTEGER): Computed field representing the net amount (amount - platform_fee).
- `payment_method` (VARCHAR): Method of payment (e.g., 'credit_card').
- `payment_processor` (VARCHAR): Processor used for the transaction.
- `payment_processor_transaction_id` (VARCHAR): Identifier from the payment processor.
- `status` (VARCHAR): Status of the transaction (e.g., 'pending').
- `metadata` (JSONB): For storing additional transaction-related details.
- `processed_at` (TIMESTAMP): Timestamp of transaction processing.
- `created_at` (TIMESTAMP): Creation timestamp.
- `updated_at` (TIMESTAMP): Last updated timestamp.

### `revenue_metrics_daily` Table Structure:
- `id` (UUID): Primary key, auto-generated.
- `creator_id` (UUID): Reference to the user's ID from the `auth.users` table.
- `date` (DATE): Date for which metrics are recorded.
- `total_revenue_cents` (INTEGER): Total revenue in cents for the day.
- `subscription_revenue_cents` (INTEGER): Revenue from subscriptions in cents.

## Return Values
Running this migration will result in:
- Creation of the necessary database schema and tables.
- Enables data tracking for creator revenues.
- Facilitates daily revenue metric aggregation.

## Examples
To execute this migration, use the following command in your PostgreSQL environment:

```sql
\i path/to/your/supabase/migrations/20240315000000_advanced_revenue_analytics.sql;
```

After running the migration, you can insert transaction data into the `revenue_transactions` table and compute daily metrics in the `revenue_metrics_daily` table for analytics.
```