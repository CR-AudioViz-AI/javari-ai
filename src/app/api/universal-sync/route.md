# Implement Universal Data Sync API

# Universal Data Sync API Documentation

## Purpose
The Universal Data Sync API provides a standardized way to facilitate data synchronization between various enterprise application systems (SAP, Oracle, Salesforce, Dynamics) in real-time or batch modes. It supports configuration of synchronization settings, initiation of sync actions, and monitoring of sync statuses.

## Usage
The API can be accessed through designated HTTP routes, typically configured in a Next.js environment. The client can send requests to configure synchronization settings, control sync processes, and manage incoming webhooks.

## Parameters/Props

### Request Body Schema
The API requires a request body that adheres to the following schemas:

#### Sync Configuration Schema (`syncConfigSchema`)
- **systemType** (`string`): Type of the system to sync (`sap`, `oracle`, `salesforce`, or `dynamics`).
- **connectionConfig** (`object`):
  - **endpoint** (`string`): URL of the system endpoint.
  - **credentials** (`object`): A record containing any necessary authentication details.
  - **environment** (`string`): Type of environment (`production`, `sandbox`, or `development`).
- **syncSettings** (`object`):
  - **entities** (`array` of `string`): List of entities to sync (min 1).
  - **syncMode** (`string`): Mode of synchronization (`full`, `incremental`, or `real-time`).
  - **batchSize** (`number`): Number of records per sync batch (min 1, max 10,000).
  - **frequency** (`number`): Sync frequency in seconds (min 60, max 86,400).
  - **conflictResolution** (`string`): Strategy for handling conflicts (`source-wins`, `target-wins`, `manual`, `latest-timestamp`).
- **webhookConfig** (`object`, optional):
  - **enabled** (`boolean`): Flag to enable webhook notifications (default true).
  - **endpoints** (`array` of `string`): List of webhook URLs to notify on events (default empty).

#### Sync Action Schema (`syncActionSchema`)
- **action** (`string`): Action to be performed on the sync process (`start`, `stop`, `pause`, `resume`, `force-sync`).

## Return Values
The API returns an HTTP response with relevant status codes:
- **200 OK**: Successful operation.
- **201 Created**: Successfully created a sync configuration.
- **400 Bad Request**: Validation error for request body.
- **404 Not Found**: Specified resource not found.
- **500 Internal Server Error**: An unexpected error occurred during processing.

### Example Responses
- **Success**:
  ```json
  {
    "status": "success",
    "message": "Synchronization started successfully",
    "syncJobId": "12345"
  }
  ```
- **Error**:
  ```json
  {
    "status": "error",
    "message": "Invalid sync configuration data",
    "errors": [
      {
        "field": "batchSize",
        "message": "Must be at least 1"
      }
    ]
  }
  ```

## Examples

### Start Data Sync
```json
POST /api/universal-sync/start

{
  "systemType": "sap",
  "connectionConfig": {
    "endpoint": "https://sap.example.com/api",
    "credentials": {
      "username": "myUser",
      "password": "myPass"
    },
    "environment": "production"
  },
  "syncSettings": {
    "entities": ["Customers", "Orders"],
    "syncMode": "incremental",
    "batchSize": 1000,
    "frequency": 3600,
    "conflictResolution": "latest-timestamp"
  }
}
```

### Stop Data Sync
```json
POST /api/universal-sync/stop

{
  "action": "stop"
}
``` 

This documentation provides a comprehensive guide on how to configure and interact with the Universal Data Sync API efficiently.