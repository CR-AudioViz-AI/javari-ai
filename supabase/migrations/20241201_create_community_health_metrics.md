# Implement Community Health Metrics Database

```markdown
# Community Health Metrics Database Migration

## Purpose
The Community Health Metrics Database is designed for comprehensive tracking of community health indicators, including engagement rates, growth patterns, and satisfaction metrics. It aids in analyzing community dynamics and informs decision-making processes by providing vital statistics on community interactions and overall health.

## Usage
This SQL migration script sets up the necessary schema for storing and analyzing community health metrics within a Supabase PostgreSQL database. Execute this script to create the required tables, data types, and extensions necessary for managing health metrics.

## Parameters/Props
The migration script performs the following actions:

1. **Enable Required Extensions**:
   - `uuid-ossp`: To generate UUIDs.
   - `timescaledb`: For time-series data handling.
   - `pg_cron`: For scheduling tasks within the database.

2. **Create Enum Types**:
   - `engagement_type`: Represents various community engagement actions (e.g., post creation, comment addition).
   - `satisfaction_scale`: Indicates levels of satisfaction from very dissatisfied to very satisfied.
   - `health_metric_type`: Defines various health metrics (e.g., engagement rate, growth rate).
   - `cohort_period`: Specifies aggregation periods (e.g., daily, weekly).

3. **Health Metric Definitions Table**:
   - **`health_metric_definitions`**: Stores metadata about health metrics.
     - Fields: `id`, `name`, `type`, `description`, `calculation_method`, `target_value`, `warning_threshold`, `critical_threshold`, `unit`, `is_active`, `created_at`, `updated_at`.

4. **Community Health Metrics Table**:
   - **`community_health_metrics`**: Main table for storing actual recorded metrics.
     - Fields: `id`, `community_id`, `metric_definition_id`, `recorded_at`, `value`, `trend_direction`.

## Return Values
- No return values as this script is a migration that modifies the database schema. Upon execution, it creates new tables and types for future data storage and retrieval.

## Examples
To execute this migration, use the following command in your Supabase SQL interface:

```sql
\i supabase/migrations/20241201_create_community_health_metrics.sql
```

After running this migration, to insert a new health metric definition, you could execute:

```sql
INSERT INTO health_metric_definitions (name, type, description, calculation_method, target_value, warning_threshold, critical_threshold, unit)
VALUES ('Community Engagement Rate', 'engagement_rate', 'Measures the active participation of community members.', 'Total engagements / Total members', 0.75, 0.50, 0.25, 'ratio');
```

To record a new community health metric, use:

```sql
INSERT INTO community_health_metrics (community_id, metric_definition_id, recorded_at, value, trend_direction)
VALUES ('<community-uuid>', '<metric-definition-uuid>', now(), 0.80, 1);
```
```