# Build Multi-Cloud Resource Orchestration Service

# Multi-Cloud Resource Orchestration Service Migration

## Purpose
This SQL migration script creates the necessary database schema to facilitate dynamic workload allocation across multiple cloud providers. It establishes enum types and the primary table for storing cloud provider information, enabling effective management of resources across cloud environments.

## Usage
To apply this migration, run the SQL script in a PostgreSQL database where your Multi-Cloud Resource Orchestration Service is hosted. The migration ensures that your database is prepared to handle various workloads and resources efficiently.

## Parameters/Props
This SQL migration does not have external parameters or properties as it is a script executed directly within a PostgreSQL environment. The script includes the following major components:

1. **Extensions**:
    - `uuid-ossp`: Required for UUID generation.
    - `pgcrypto`: For cryptographic functions, especially for handling encrypted credentials.

2. **Enum Types**:
    - `cloud_provider_type`: Values include `'aws'`, `'azure'`, `'gcp'`, `'kubernetes'`, and `'on_premise'`.
    - `workload_status`: Status types for workloads, such as `'pending'`, `'provisioning'`, `'running'`, etc.
    - `resource_type`: Types of resources including `'compute'`, `'storage'`, `'database'`, etc.
    - `migration_status`: Indicates status of migrations: `'planned'`, `'in_progress'`, etc.
    - `priority_level`: For workload prioritization—`'low'`, `'medium'`, etc.
    - `health_status`: Reflects health of resources: `'healthy'`, `'degraded'`, etc.

3. **Cloud Providers Table**:
    - **Columns**:
        - `id`: UUID, primary key.
        - `name`: Provider name (string).
        - `provider_type`: Enum from `cloud_provider_type`.
        - `region`: Provider region (string).
        - `endpoint_url`: URL to interact with the cloud provider (text).
        - `credentials_encrypted`: Encrypted JSON string containing API credentials.
        - `capabilities`: JSONB containing available services and capacities.
        - `cost_multiplier`: Decimal indicating cost adjustments.

## Return Values
Executing this migration results in the following:
- Creation of necessary enum types in the database.
- Establishment of the `cloud_providers` table with specified columns to manage cloud provider configurations.

## Examples
To add a new cloud provider after running the migration, you can execute a SQL command like:

```sql
INSERT INTO cloud_providers (name, provider_type, region, endpoint_url, credentials_encrypted, capabilities, cost_multiplier)
VALUES ('Amazon Web Services', 'aws', 'us-east-1', 'https://api.aws.com', 'encrypted_credentials_here', '{"EC2": true, "S3": true}', 1.0);
```

Ensure that all cloud providers added adhere to the specified types and structure outlined in the migration.