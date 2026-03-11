# Deploy Enterprise Audit Trail Microservice

# Enterprise Audit Trail Microservice Migration

## Purpose
The Enterprise Audit Trail microservice is designed to provide comprehensive audit trail tracking through immutable logging. It aids in compliance reporting, forensic analysis, and ensures data integrity by allowing detailed tracking of all significant events within the enterprise environment.

## Usage
To deploy the Enterprise Audit Trail microservice, execute the SQL migration file located at `supabase/migrations/20240101000000_enterprise_audit_trail.sql`. This file creates necessary database structures and enumerations required for logging audit events systematically.

## Parameters/Props
This migration file includes the following core components:

- **Extensions**: 
  - `uuid-ossp`: For generating universally unique identifiers (UUIDs).
  - `pgcrypto`: For cryptographic functions.
  - `pg_trgm`: For text similarity measurement.

- **Enum Types**: Defines specific categories of audit events.
  - `audit_event_type`: Types of events (e.g., authentication, data access).
  - `audit_event_severity`: Level of severity (e.g., low, medium, critical).
  - `audit_session_status`: Status of user sessions (e.g., active, expired).
  - `compliance_report_status`: Status of compliance reports (e.g., draft, completed).

- **Audit Events Table**: 
  - `audit_events`: Main table structure for storing log entries with several fields including:
    - `id`: Unique identifier for each event (UUID).
    - `tenant_id`: Identifier for the tenant associated with the event (UUID).
    - `session_id`: Session identifier (UUID).
    - `user_id`: User identifier (UUID).
    - `event_type`: Type of event (Enum).
    - `event_severity`: Severity of the event (Enum).
    - `event_category`: Category of the event (Text).
    - `event_action`: Specific action taken (Text).
    - `resource_type`: Type of resource affected (Text).
    - `event_data`: Additional event-related data (JSONB).
    - `event_timestamp`: Timestamp of the event occurrence (TIMESTAMPTZ).
    - `created_at`: Record creation timestamp (TIMESTAMPTZ).
    - Additional metadata fields for detailed analytics.

## Return Values
Executing this migration will return the creation status of the underlying database structures. It will establish a new immutable audit event logging mechanism, ready for use in the application.

## Examples
To apply the migration, run the following command in your database management tool or terminal:

```bash
psql -U your_username -d your_database -f supabase/migrations/20240101000000_enterprise_audit_trail.sql
```

After successful execution, you can begin logging audit events by inserting records into the `audit_events` table, for example:

```sql
INSERT INTO audit_events (tenant_id, user_id, event_type, event_action, event_category, event_data)
VALUES 
  (uuid_generate_v4(), uuid_generate_v4(), 'authentication', 'login', 'user_management', '{"login_status": "success"}');
```

This setup allows for extensive monitoring and compliance tracking of events across your enterprise systems.