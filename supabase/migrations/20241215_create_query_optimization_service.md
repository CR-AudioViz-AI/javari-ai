# Deploy Database Query Optimization Service

# Database Query Optimization Service Documentation

## Purpose
This SQL migration script sets up a Database Query Optimization Service within a Supabase environment. It enables extensions, defines custom types, and establishes the `query_performance_logs` table for logging and analyzing query performance metrics.

## Usage
Run the SQL migration script in your Supabase database environment to enable the Query Optimization Service and create the necessary structures for performance logging and analysis.

## Parameters/Props
The migration includes several components:

### Extensions
- **pg_stat_statements**: Provides a means for tracking execution statistics of all SQL statements.
- **pg_cron**: Allows for the scheduling of periodic jobs.
- **btree_gin**: Enables a GIN index on btree data types.
- **pg_trgm**: Facilitates indexing of text data to enhance search operations.

### Custom Types
1. **optimization_status**: ENUM type to represent the status of optimization processes.
   - Values: `pending`, `analyzing`, `optimizing`, `completed`, `failed`, `skipped`

2. **query_category**: ENUM type to classify queries.
   - Values: `select`, `insert`, `update`, `delete`, `ddl`, `utility`

3. **optimization_type**: ENUM type to denote the type of optimization performed.
   - Values: `index_creation`, `query_rewrite`, `parameter_tuning`, `partition_suggestion`, `materialized_view`

### Table: `query_performance_logs`
- **id**: UUID, primary key.
- **query_id**: BIGINT, identifier for the query.
- **query_hash**: TEXT, hash of the normalized query.
- **normalized_query**: TEXT, standardized version of the query.
- **raw_query**: TEXT, original query text.
- **database_name**: TEXT, name of the database.
- **user_name**: TEXT, user who executed the query.
- **application_name**: TEXT, application that submitted the query.
- **query_category**: ENUM, defaults to `select`.
- **execution_time_ms**: DECIMAL, execution time in milliseconds.
- **rows_examined**: BIGINT, number of rows examined.
- **rows_returned**: BIGINT, number of rows returned.
- **buffer_hits**: BIGINT, number of buffer hits.
- **buffer_misses**: BIGINT, number of buffer misses.
- **temp_files_created**: INTEGER, number of temporary files created.
- **temp_bytes_used**: BIGINT, bytes used by temp files.
- **calls_count**: INTEGER, number of times the query was called.
- **mean_exec_time_ms**: DECIMAL, mean execution time.
- **cpu_time_ms**: DECIMAL, CPU time used.
- **io_time_ms**: DECIMAL, IO time spent.
- **lock_wait_time_ms**: DECIMAL, lock wait time.
- **query_plan**: JSONB, execution plan.
- **table_scans**: JSONB, table scan details.
- **index_scans**: JSONB, index scan details.
- **captured_at**: TIMESTAMPTZ, time when the log was captured.
- **created_at**: TIMESTAMPTZ, timestamp of record creation.
- **updated_at**: TIMESTAMPTZ, timestamp of last update.

## Return Values
This migration does not return values but sets up the schema in the database. It establishes functionality for logging and analyzing query performance, which can be utilized in subsequent queries or analyses.

## Examples
To apply the migration, execute the following command in your Supabase SQL editor:
```sql
\i supabase/migrations/20241215_create_query_optimization_service.sql;
```
After execution, the `query_performance_logs` table will be prepared to capture performance metrics for all subsequent queries executed against the database.