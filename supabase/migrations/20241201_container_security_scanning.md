# Deploy Container Security Scanning Microservice

```markdown
# Container Security Scanning Microservice Migration

## Purpose
This SQL migration script sets up the database schema necessary for the Container Security Scanning Microservice, enabling automated scanning of container images and managing vulnerability tracking and remediation processes.

## Usage
To apply this migration, execute the SQL script within your PostgreSQL database environment. This should be done as part of your deployment process, ensuring the required extensions and tables are created or modified as specified.

## Parameters/Props
### Extensions
- **uuid-ossp**: Enables the use of UUIDs for unique identification.
- **pgcrypto**: Allows cryptographic functions which may be needed for handling sensitive data.

### ENUM Types
- **scan_status**: Represents the status of a scan. Possible values: `pending`, `running`, `completed`, `failed`, `cancelled`.
- **severity_level**: Indicates the severity of detected vulnerabilities. Possible values: `critical`, `high`, `medium`, `low`, `info`.
- **remediation_status**: Status of a remedial action. Possible values: `pending`, `in_progress`, `completed`, `ignored`, `not_applicable`.
- **policy_action**: Defines the actions that can be taken on a policy. Possible values: `allow`, `warn`, `block`, `quarantine`.

### Tables
1. **vulnerability_databases**
   - **id** (UUID, primary key): Unique identifier for each database.
   - **name** (VARCHAR): Unique name of the vulnerability database.
   - **description** (TEXT): Description of the database.
   - **source_url** (TEXT): URL to obtain database updates.
   - **update_frequency_hours** (INTEGER): How often the database is updated (default is 24 hours).
   - **last_updated** (TIMESTAMPTZ): Timestamp of the last update.
   - **is_active** (BOOLEAN): Indicates if the database is currently active.
   - **metadata** (JSONB): Additional metadata for the database.
   - **created_at** (TIMESTAMPTZ): Record creation timestamp.
   - **updated_at** (TIMESTAMPTZ): Record update timestamp.
   - **tenant_id** (UUID): Identifier for multi-tenancy support.

2. **container_images**
   - **id** (UUID, primary key): Unique identifier for each container image.
   - **registry** (VARCHAR): Name of the container registry.
   - **repository** (VARCHAR): Name of the repository in the registry.
   - **tag** (VARCHAR): Tag associated with the container image.
   - **digest** (VARCHAR): Digest of the image.
   - **size_bytes** (BIGINT): Size of the image in bytes.
   - **pushed_at** (TIMESTAMPTZ): Timestamp when the image was pushed.
   - **labels** (JSONB): Labels associated with the container image.
   - **manifest** (JSONB): Manifest of the container image.
   - **is_active** (BOOLEAN): Indicates if the image entry is currently active.
   - **created_at** (TIMESTAMPTZ): Record creation timestamp.
   - **updated_at** (TIMESTAMPTZ): Record update timestamp.
   - **tenant_id** (UUID): Identifier for multi-tenancy support.

## Return Values
Executing this migration will result in the creation of the ENUM types and tables necessary for the operation of the container security scanning service. No return values are expected from the SQL execution, but errors will indicate any issues during the migration process.
```