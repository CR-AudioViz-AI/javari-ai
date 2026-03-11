# Implement Multi-CRM Universal Connector API

# Multi-CRM Universal Connector API

## Purpose

The Multi-CRM Universal Connector API is designed to facilitate integration between various CRM systems, allowing for operations such as creating, reading, updating, and deleting CRM entities as well as synchronizing data across different platforms. This API supports well-known CRM providers like Salesforce, HubSpot, and Dynamics.

## Usage

The API can be accessed via HTTP requests, and it supports various operations defined in the request schema. The API ensures data synchronization and integration while adhering to any established rate limits.

### Endpoints

- **POST /api/crm/universal**: Main endpoint for CRM operations.
  
## Parameters/Props

### Request Schema

The request body must adhere to the following validation schema:

- `operation` (string, required): The type of operation to perform. Valid values are:
  - `'create'`
  - `'read'`
  - `'update'`
  - `'delete'`
  - `'sync'`
  - `'batch'`

- `provider` (string, required): The CRM provider to be used. Valid values are:
  - `'salesforce'`
  - `'hubspot'`
  - `'dynamics'`

- `entity` (string, required): The type of entity to operate on. Valid values are:
  - `'contact'`
  - `'lead'`
  - `'opportunity'`
  - `'account'`
  - `'deal'`

- `data` (object, optional): The data payload for create/update operations.

- `filters` (object, optional): Filtering criteria for read operations.

- `connectionId` (string, required): Identifier for the specific CRM connection.

- `syncDirection` (string, optional): Direction of synchronization. Valid values:
  - `'inbound'`
  - `'outbound'`
  - `'bidirectional'`

- `batchSize` (number, optional): Number of records to process in a batch (1 to 1000).

### Sync Request Schema

For synchronization operations, utilize the following schema:

- `sourceProvider` (string, required): The CRM provider to sync data from.
- `targetProvider` (string, required): The CRM provider to sync data to.
- `entities` (array, required): List of entities to synchronize.
- `syncMode` (string, required): Mode of synchronization. Valid values:
  - `'full'`
  - `'incremental'`
  - `'selective'`
- `fieldMappings` (object, optional): Field mapping definitions.
- `filters` (object, optional): Criteria for filtering synchronization.

## Return Values

Upon a successful operation, the API returns a response indicating the outcome of the request, typically including:

- `status`: An HTTP status code (e.g., 200 for success).
- `data`: Resulting data or confirmation of operations performed.
- `message`: A descriptive message about the request outcome.

In the case of errors, an appropriate error message will be returned alongside an error code.

## Examples

### Create Contact

```json
POST /api/crm/universal
{
  "operation": "create",
  "provider": "salesforce",
  "entity": "contact",
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com"
  },
  "connectionId": "abc-123",
  "batchSize": 1
}
```

### Sync Data Between CRMs

```json
POST /api/crm/universal
{
  "operation": "sync",
  "sourceProvider": "hubspot",
  "targetProvider": "dynamics",
  "entities": ["contact"],
  "syncMode": "full",
  "connectionId": "xyz-789"
}
```

This API provides a streamlined approach to connect and synchronize various CRM platforms, making customer relationship management more cohesive and unified.