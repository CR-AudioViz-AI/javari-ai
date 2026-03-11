# Implement Infrastructure as Code Management API

# Infrastructure as Code Management API

## Purpose
The Infrastructure as Code Management API provides endpoints to manage infrastructure resources using code. It supports operations such as creating, updating, and querying different types of infrastructure defined using Terraform, Kubernetes, or Helm.

## Usage
This API is implemented as a Next.js route. It handles HTTP requests to create or modify infrastructure components and retrieve infrastructure data based on specific filters.

## Endpoints
### POST /api/infrastructure
Creates a new infrastructure resource according to the specifications provided in the request body.

### Parameters/Props
#### Request Body for Creating Infrastructure (POST)
- `name` **(string)**: A unique name for the infrastructure resource (1-255 characters, alphanumeric with `-` and `_`).
- `type` **(enum)**: The type of infrastructure. Possible values are `terraform`, `kubernetes`, or `helm`.
- `description` **(string, optional)**: A brief description of the infrastructure (max 1000 characters).
- `manifest` **(string)**: The manifest content (must not be empty).
- `variables` **(object, optional)**: Key-value pairs of variables used in the infrastructure definition.
- `tags` **(array, optional)**: An array of tags associated with the infrastructure (max 20 items).
- `environment` **(enum)**: The deployment environment. Possible values are `dev`, `staging`, or `production`.
- `project_id` **(string)**: A valid UUID representing the project identifier.
- `auto_remediate` **(boolean, default: false)**: Indicates if auto-remediation should be enabled.
- `drift_detection` **(boolean, default: true)**: Indicates if drift detection should be enabled.

#### Request Body for Updating Infrastructure (PUT)
The same parameters as the creation request, but all fields are optional (partial updates allowed).

#### Query Parameters for Retrieving Infrastructure (GET)
- `project_id` **(string, optional)**: Filter by project identifier.
- `environment` **(enum, optional)**: Filter by environment (`dev`, `staging`, `production`).
- `type` **(enum, optional)**: Filter by infrastructure type (`terraform`, `kubernetes`, `helm`).
- `status` **(enum, optional)**: Filter by status (`active`, `inactive`, `error`, `drifted`).
- `limit` **(number, optional)**: Limit the number of returned results (default 50, maximum 100).
- `offset` **(number, optional)**: Number of results to skip (default 0).
- `search` **(string, optional)**: Search term for name filtering (max 255 characters).

## Return Values
Upon successful operations, the API typically responds:
- **201 Created:** When a new infrastructure resource is successfully created.
- **200 OK:** When an infrastructure resource is successfully updated or retrieved.
- **400 Bad Request:** When the request body or parameters are invalid.
- **429 Too Many Requests:** When the rate limit is exceeded.

## Examples
### Example for Creating Infrastructure
```json
{
  "name": "my-infra",
  "type": "terraform",
  "description": "Infrastructure for staging environment",
  "manifest": "{...}",
  "variables": {
    "key1": "value1",
    "key2": "value2"
  },
  "tags": ["dev", "test"],
  "environment": "staging",
  "project_id": "b1e9fbb3-e573-4b13-bf8e-6816294d0158",
  "auto_remediate": true,
  "drift_detection": true
}
```

### Example Query Parameters to Retrieve Infrastructure
```
GET /api/infrastructure?project_id=b1e9fbb3-e573-4b13-bf8e-6816294d0158&environment=dev&limit=10&offset=0
```  

This API effectively integrates infrastructure management with code while ensuring security and performance through validation and rate limiting.