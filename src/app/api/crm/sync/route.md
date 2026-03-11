# Build CRM Data Synchronization API

# CRM Data Synchronization API Documentation

## Purpose
The CRM Data Synchronization API facilitates the synchronization of CRM data across various systems such as Salesforce, HubSpot, and Dynamics. It enables operations like create, update, and delete for specified records, while also handling conflict resolution strategies and supporting both incremental and full data sync modes.

## Usage
To utilize the CRM Data Synchronization API, send a POST request to the `/api/crm/sync` endpoint with the required parameters. The API supports both synchronous and asynchronous operations, depending on the use case.

## Parameters/Props
### Request Body
The API accepts a JSON body with the following parameters:

- **providers** (optional): An array of strings specifying the CRM providers. Must be one or more of `'salesforce'`, `'hubspot'`, or `'dynamics'`.
  
- **recordTypes** (optional): An array of strings indicating the types of records to synchronize.
  
- **mode**: A string specifying the sync mode. Options include:
  - `'incremental'`: Sync only changed records.
  - `'full'`: Sync all records.
  - `'bidirectional'`: Sync records in both directions.

- **conflictStrategy**: A string that defines the strategy for conflict resolution. Options include:
  - `'latest_wins'`: The most recent change takes priority.
  - `'merge'`: Combine conflicting changes.
  - `'manual'`: Requires user intervention to resolve conflicts.
  - `'source_priority'`: Prioritize the source system changes.

- **batchSize**: A number defining the amount of records to process in one go (min: 1, max: 1000). Default is 100.

- **dryRun**: A boolean indicating whether the synchronization should be performed in dry run mode (no actual changes made). Default is `false`.

### Webhook Payload
When a webhook is triggered, the payload includes:

- **provider**: The name of the CRM provider.
- **eventType**: The type of event that triggered the webhook.
- **recordId**: The ID of the impacted record.
- **recordType**: The type of the impacted record.
- **data**: The associated data for the record.
- **timestamp**: The time when the event occurred.

## Return Values
The API will return a JSON response that includes:

- **status**: A string indicating success or failure of the synchronization.
- **message**: A relevant message providing additional context.
- **data** (optional): Any relevant data resulting from the synchronization process, like record counts or conflict summaries.

## Examples
### Sample Request
```json
POST /api/crm/sync
{
  "providers": ["salesforce", "hubspot"],
  "recordTypes": ["contacts", "leads"],
  "mode": "incremental",
  "conflictStrategy": "latest_wins",
  "batchSize": 100,
  "dryRun": false
}
```

### Sample Response
```json
{
  "status": "success",
  "message": "Synchronization completed successfully.",
  "data": {
    "totalRecordsSynced": 150,
    "conflicts": 3
  }
}
```

## Notes
- Ensure required environment variables are set for database and Redis clients.
- Validate API inputs against schemas to prevent errors during the sync operation.
- Consider using the `dryRun` mode for testing before actual synchronization.