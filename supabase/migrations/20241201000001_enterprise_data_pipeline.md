# Build Enterprise Data Pipeline API

```markdown
# Enterprise Data Pipeline API Migration Documentation

## Purpose
This SQL migration script sets up the complete database schema required for the Enterprise Data Pipeline infrastructure. It establishes essential extensions, custom enum types, and a table for managing connection credentials securely.

## Usage
This migration script should be executed in a PostgreSQL database to initialize the necessary structure for the Enterprise Data Pipeline. It should be run as part of your database migration workflow using a tool like Supabase or any SQL migration framework.

## Parameters/Props

### Extensions
- **uuid-ossp**: Used for generating universally unique identifiers (UUIDs).
- **pg_cron**: Used for scheduling cron jobs in PostgreSQL.

### Enum Types
- **connection_type**: Defines types of data connections.
  - Values: `database`, `file_system`, `cloud_storage`, `api`, `stream`, `webhook`
  
- **pipeline_status**: Indicates the status of the data pipeline.
  - Values: `draft`, `active`, `paused`, `deprecated`, `error`
  
- **run_status**: Describes the execution status of a pipeline run.
  - Values: `pending`, `running`, `completed`, `failed`, `cancelled`, `timeout`
  
- **transformation_type**: Specifies the type of transformations to be applied to data.
  - Values: `filter`, `map`, `aggregate`, `join`, `split`, `validate`, `enrich`, `normalize`
  
- **data_quality_severity**: Indicates the severity level of data quality issues.
  - Values: `info`, `warning`, `error`, `critical`

### Table Structure
#### `connection_credentials`
- **id**: (UUID) Primary key, automatically generated.
- **name**: (VARCHAR) Unique name for the credentials (mandatory).
- **connection_type**: (ENUM) Type of connection (mandatory).
- **encrypted_credentials**: (JSONB) Encrypted storage for connection credentials (mandatory).
- **description**: (TEXT) Optional description of the credentials.
- **is_active**: (BOOLEAN) Indicates if the credential is active (default: true).
- **created_by**: (UUID) Reference to the user who created the record.
- **created_at**: (TIMESTAMP) Timestamp of creation (default: current time).
- **updated_at**: (TIMESTAMP) Timestamp of the last update (default: current time).

## Return Values
Executing this migration will create the necessary schema, including the defined enums and the `connection_credentials` table in the database. It will not return rows but will modify the database structure.

## Examples
To execute the migration, run the following SQL command in your PostgreSQL environment:
```sql
-- Run migration script for Enterprise Data Pipeline
\i supabase/migrations/20241201000001_enterprise_data_pipeline.sql
```

After executing the script, you can verify the creation of enums and the `connection_credentials` table by querying the database schema:
```sql
SELECT * FROM pg_enum WHERE enumtype = 'connection_type';
SELECT * FROM information_schema.tables WHERE table_name = 'connection_credentials';
```

This documentation provides the necessary details to understand and use the migration script effectively.
```