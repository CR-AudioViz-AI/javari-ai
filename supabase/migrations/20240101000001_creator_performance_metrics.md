# Implement Creator Performance Metrics Database

# Creator Performance Metrics Database Migration

## Purpose
The Creator Performance Metrics Database migration creates a comprehensive schema for tracking the performance of content creators across various digital platforms. It supports real-time analytics with optimization and structural integrity to store and process complex performance data.

## Usage
This migration file is executed in the database environment using a PostgreSQL-compatible database such as Supabase. It sets up necessary extensions, defines enumerated types for standardized data classification, and creates tables to hold creator information and performance metrics for analysis.

## Parameters / Props
The migration script includes the following main components:

### Extensions
- **uuid-ossp**: Provides functions to generate universally unique identifiers.
- **pg_cron**: Facilitates scheduling of PostgreSQL jobs.
- **timescaledb**: Extends PostgreSQL for time-series data management.

### Enum Types
- `metric_type`: Categorizes metrics into types such as 'view', 'like', 'share', etc.
- `platform_type`: Identifies platforms like 'youtube', 'tiktok', 'instagram', etc.
- `content_type`: Differentiates between content formats like 'video', 'image', etc.
- `conversion_stage`: Stages in the conversion funnel such as 'impression', 'click', etc.
- `demographic_category`: Segments demographics into 'age', 'gender', etc.

### Tables
1. **Creators Table**
   - `id`: Unique identifier for each creator (UUID).
   - `user_id`: Reference to the user's unique ID (UUID).
   - `handle`: Creator's unique handle (String).
   - `display_name`: Creator's display name (String).
   - `email`: Creator's email address (String).
   - `platforms`: Array of supported platforms (Array of platform_type).
   - `verified`: Boolean indicating if the creator is verified (Boolean).
   - `tier`: Creator's tier (String).
   - `created_at`: Timestamp of creation (TIMESTAMPTZ).
   - `updated_at`: Timestamp of the last update (TIMESTAMPTZ).

2. **Creator Metrics Table**
   - `id`: Unique identifier for each metric entry (UUID).
   - `creator_id`: Reference to the corresponding creator (UUID).
   - `platform`: The platform of performance metrics (platform_type).
   - `content_id`: Identifier for the content related to the metric (String).
   - `content_type`: Type of the content (content_type).
   - `metric_type`: Type of the metric (metric_type).
   - `metric_value`: Integer value of the metric (BIGINT).
   - `metric_value_decimal`: Decimal representation for precision (DECIMAL).
   - `timestamp`: Timestamp for the metric entry (TIMESTAMPTZ).

## Return Values
The migration sets up a structured database schema essential for storing and querying performance metrics related to creators. It does not return any values upon execution but establishes the database's necessary tables and types.

## Examples
To execute this migration, use the command:
```bash
psql -d your_database_name -f supabase/migrations/20240101000001_creator_performance_metrics.sql
```

Once executed, you can query the `creators` and `creator_metrics` tables for analytics:
```sql
SELECT * FROM creators WHERE verified = TRUE;
SELECT * FROM creator_metrics WHERE platform = 'youtube' AND metric_type = 'view';
``` 

This schema allows for complex queries and analysis of creator performance across different platforms and content types, enabling data-driven decision-making for marketing and content strategies.