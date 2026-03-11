# Deploy Enterprise Workflow Automation Service

```markdown
# Enterprise Workflow Automation Service Migration

## Purpose
The Enterprise Workflow Automation Service Migration is designed to establish a complete database schema essential for managing enterprise workflows. This schema includes various components such as workflow definitions, enum types, and necessary extensions to facilitate workflow automation and management.

## Usage
To implement the Enterprise Workflow Automation Service, execute the `20241201000000_create_enterprise_workflow_automation.sql` SQL file using your PostgreSQL database management system. This migration script creates the required database structures and types to support the workflow automation service.

## Parameters/Props
This migration includes the following key structures and types:

### Extensions
- **uuid-ossp**: Generates universally unique identifiers (UUIDs).
- **pgcrypto**: Provides cryptographic functions.

### Enum Types
- **workflow_status**: Manages the status of workflows.
  - Values: `draft`, `active`, `inactive`, `archived`
- **instance_status**: Tracks instances of workflows.
  - Values: `pending`, `running`, `completed`, `failed`, `cancelled`, `suspended`
- **step_status**: Monitors individual steps within workflows.
  - Values: `pending`, `running`, `completed`, `failed`, `skipped`, `cancelled`
- **approval_status**: Oversees approval steps in workflows.
  - Values: `pending`, `approved`, `rejected`, `delegated`, `expired`
- **document_status**: Defines the status of documents in workflows.
  - Values: `pending`, `routed`, `processed`, `archived`, `error`
- **compliance_severity**: Indicates severity levels in compliance checks.
  - Values: `low`, `medium`, `high`, `critical`
- **integration_type**: Represents types of integrations in workflows.
  - Values: `rest_api`, `database`, `file_system`, `email`, `ldap`, `saml`
- **notification_type**: Specifies types of notifications.
  - Values: `email`, `sms`, `push`, `webhook`, `internal`

### Tables
#### `workflow_definitions`
- **id**: UUID - Unique identifier for the workflow.
- **name**: VARCHAR(255) - Name of the workflow.
- **description**: TEXT - Description of the workflow.
- **version**: INTEGER - Current version number of the workflow (default: 1).
- **schema_definition**: JSONB - Schema defining the workflow structure; must include `steps`.
- **status**: workflow_status - Current status of the workflow (default: 'draft').
- **category**: VARCHAR(100) - Category for organizational purposes.
- **tags**: TEXT[] - Tags for easy retrieval.
- **created_by**: UUID - ID of the user who created the workflow.
- **organization_id**: UUID - ID of the organization the workflow belongs to.
- **is_template**: BOOLEAN - Indicates if the workflow is a template (default: false).
- **template_variables**: JSONB - Variables for template substitution (default: empty JSON).
- **max_execution_time**: INTERVAL - Maximum allowed time for workflow execution (default: '24 hours').
- **retry_policy**: JSONB - Policy defining retry attempts for failures (default: 3 attempts with exponential backoff).
- **created_at**: TIMESTAMPTZ - Timestamp for creation (default: NOW()).
- **updated_at**: TIMESTAMPTZ - Timestamp for last update (default: NOW()).

## Return Values
The migration script does not return any values; rather, it constructs the underlying database schema necessary for the workflow automation service.

## Examples
To apply this migration, run the following command in your SQL interface:

```sql
\i supabase/migrations/20241201000000_create_enterprise_workflow_automation.sql
```
This will create the necessary schema for the Enterprise Workflow Automation Service in your PostgreSQL database.
```