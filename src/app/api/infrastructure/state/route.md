# Implement Infrastructure State Management API

```markdown
# Infrastructure State Management API

## Purpose
The Infrastructure State Management API enables users to manage and query the state of their infrastructure efficiently. It allows for the storage, retrieval, and locking of infrastructure states, supporting various cloud providers.

## Usage
The API is designed for use within a Next.js application and integrates with Supabase for database operations and Redis for caching. It requires specific environmental configurations, including cloud provider credentials and service tokens.

## Parameters / Props

### Environment Variables
The following environment variables need to be defined:

- `SUPABASE_URL`: URL for the Supabase instance (must be a valid URL).
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role access key.
- `REDIS_URL`: URL for the Redis instance (must be a valid URL).
- Optional:
  - `TERRAFORM_CLOUD_TOKEN`: Token for Terraform Cloud API.
  - `AWS_ACCESS_KEY_ID`: AWS access key ID.
  - `AWS_SECRET_ACCESS_KEY`: AWS secret access key.
  - `AZURE_CLIENT_ID`: Azure client ID.
  - `AZURE_CLIENT_SECRET`: Azure client secret.
  - `GCP_SERVICE_ACCOUNT_KEY`: Google Cloud service account key.

### Infrastructure State Schema
- `id`: (optional) UUID for the infrastructure state.
- `name`: (string) Name of the infrastructure (1-100 characters).
- `provider`: (enum) Cloud provider (`aws`, `azure`, `gcp`, `multi-cloud`).
- `region`: (string) Region identifier (1 or more characters).
- `environment`: (enum) Environment type (`development`, `staging`, `production`).
- `terraform_version`: (optional) Version of Terraform used.
- `terraform_state`: (optional) Object for the Terraform state.
- `resources`: (optional) Array of resource objects, each including:
  - `id`: Resource identifier.
  - `type`: Type of resource.
  - `name`: Resource name.
  - `status`: (enum) Resource status (`creating`, `active`, `updating`, `deleting`, `error`).
  - `provider_id`: Identifier for the provider.
  - `configuration`: Resource configuration as an object.
  - `dependencies`: (optional) Array of resource IDs on which the resource depends.
- `tags`: (optional) Dictionary for tagging purposes.

### State Query Schema
- `provider`: (optional) Filter for a specific cloud provider.
- `region`: (optional) Filter for a specific region.
- `environment`: (optional) Filter for a specific environment.
- `status`: (optional) Filter for a specific status of infrastructure.
- `limit`: (optional, default: 20) Maximum number of records to return (1-100).
- `offset`: (optional, default: 0) Offset for pagination (minimum 0).

### State Lock Schema
- `operation`: (enum) Type of operation being performed (`plan`, `apply`, `destroy`).
- `user_id`: UUID for the user performing the operation.
- `metadata`: Additional metadata related to the operation.

## Return Values
The API will return structured responses indicating the success or failure of operations, along with data when applicable. The data will often be represented in JSON format.

## Examples

### Create Infrastructure State
```http
POST /api/infrastructure/state
{
  "name": "My Infrastructure",
  "provider": "aws",
  "region": "us-west-1",
  "environment": "production",
  "resources": [
    {
      "id": "abc123",
      "type": "ec2",
      "name": "Web Server",
      "status": "active",
      "provider_id": "aws:ec2:us-west-1:abc123",
      "configuration": {}
    }
  ]
}
```

### Query Infrastructure States
```http
GET /api/infrastructure/state?provider=aws&limit=10&offset=0
```

### Lock Infrastructure State
```http
POST /api/infrastructure/state/lock
{
  "operation": "apply",
  "user_id": "user-uuid"
}
```
```