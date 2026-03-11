# Build Workday HR Integration API

```markdown
# Workday HR Integration API

## Purpose
The Workday HR Integration API facilitates the synchronization of employee and organizational data between a system and Workday. It allows the initiation of synchronization requests and handles incoming webhook events from Workday.

## Usage
To use this API, send a request to the defined endpoint with the appropriate data. Ensure that your environment is configured correctly with necessary credentials and that you are adhering to defined schemas for requests.

## Parameters / Props
### Environment Variables
The API requires the following environment variables:

- **SUPABASE_URL**: The URL for the Supabase instance.
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key for Supabase.
- **REDIS_URL**: The URL for the Redis instance.
- **WORKDAY_TENANT_URL**: The URL for the Workday tenant.
- **WORKDAY_CLIENT_ID**: Client ID for Workday API access.
- **WORKDAY_CLIENT_SECRET**: Client secret for Workday API access.
- **WORKDAY_REFRESH_TOKEN**: Refresh token for Workday API access.
- **ENCRYPTION_KEY**: A key for encrypting sensitive information.
- **WEBHOOK_SECRET**: Secret used for validating incoming webhooks.

### Request Schemas
#### Sync Request
- **syncType**: `enum` (options: `employees`, `org-chart`, `performance`, `full`)
- **force**: `boolean` (optional, default: `false`)
- **filters**: `object` (optional)
  - **departmentId**: `string` (optional)
  - **locationId**: `string` (optional)
  - **lastModified**: `string` (ISO 8601 date string, optional)

#### Webhook Event
- **eventType**: `enum` (options: `employee.created`, `employee.updated`, `employee.terminated`, `org.restructured`)
- **timestamp**: `string` (ISO 8601 date string)
- **data**: `object` (variable structure containing Workday data)
- **signature**: `string` (signature for webhook verification)

## Return Values
The API returns structured responses based on the request type:
- **Sync Requests**: A confirmation response indicating the sync status, including successfully processed items.
- **Webhook Events**: Acknowledgment upon successful processing of the incoming event.

## Examples

### Sync Request Example
```json
POST /api/integrations/workday/sync
{
  "syncType": "employees",
  "force": false,
  "filters": {
    "departmentId": "123",
    "locationId": "456",
    "lastModified": "2023-01-01T00:00:00Z"
  }
}
```

### Webhook Event Example
```json
POST /api/integrations/workday/webhook
{
  "eventType": "employee.created",
  "timestamp": "2023-01-01T00:00:00Z",
  "data": {
    "id": "employee-789",
    "workerId": "wd-789",
    ...
  },
  "signature": "sha256=abcd1234"
}
```

### Notes
- Ensure to validate all incoming data against the defined schemas.
- Maintain secure handling of environment variables and sensitive information.
```