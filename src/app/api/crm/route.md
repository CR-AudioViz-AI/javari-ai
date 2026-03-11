# Implement Enterprise CRM Integration API

# Enterprise CRM Integration API Documentation

## Purpose
The Enterprise CRM Integration API facilitates seamless integration with various CRM providers, allowing for actions such as connecting to a CRM, synchronizing data, disconnecting, generating customer insights, and scoring leads. This API supports Salesforce, HubSpot, and Dynamics CRM systems.

## Usage
This API is designed for use in server-side applications, where it handles incoming HTTP requests to manage CRM connections and operations. It expects a specific request structure and returns appropriate responses based on the requested action.

## Parameters/Props

### CRMRequest
The main interface for requests sent to the API:
- **action** (string): The action to perform. Must be one of `connect`, `sync`, `disconnect`, `insights`, or `score_leads`.
- **provider** (CRMProvider): The CRM provider to interact with. Valid values include `salesforce`, `hubspot`, or `dynamics`.
- **connectionId** (string, optional): An identifier for an existing connection if performing actions that require it (e.g., `sync`, `disconnect`).
- **credentials** (object, optional): Specific credentials needed for the CRM provider:
  - **clientId** (string): Client ID for authentication.
  - **clientSecret** (string): Client Secret for authentication.
  - **refreshToken** (string): Token to refresh access to the CRM.
  - **instanceUrl** (string): The base URL for the CRM instance.
  - **accessToken** (string): Current access token for the authenticated session.
  - **hubId** (string): HubSpot account ID.
  - **tenantId** (string): Tenant ID for accessing resources in certain providers.
- **syncOptions** (object, optional): Options for data synchronization:
  - **entities** (array): An array of entity names to sync.
  - **direction** (string): Sync direction, either `inbound`, `outbound`, or `bidirectional`.
  - **batchSize** (number): Number of records to process in each batch.
  - **filterCriteria** (object, optional): Criteria to filter which records to sync.
- **insightOptions** (object, optional): Options for generating customer insights:
  - **customerId** (string, optional): ID of the customer to generate insights for.
  - **timeRange** (string, optional): Period for which to retrieve insights.
  - **metrics** (array, optional): Specific metrics to be included in the insights.

## Return Values
The API returns a `NextResponse` object, which contains:
- **status** (number): HTTP status code indicating success or error.
- **data** (object, optional): Contains relevant data based on the action performed, including success messages, insights, or error details.

## Examples

### Connect to CRM
```json
{
  "action": "connect",
  "provider": "salesforce",
  "credentials": {
    "clientId": "your_client_id",
    "clientSecret": "your_client_secret",
    "accessToken": "your_access_token"
  }
}
```

### Synchronize Data
```json
{
  "action": "sync",
  "provider": "hubspot",
  "connectionId": "abc123",
  "syncOptions": {
    "entities": ["contacts", "deals"],
    "direction": "bidirectional",
    "batchSize": 100,
    "filterCriteria": {
      "status": "active"
    }
  }
}
```

### Generate Customer Insights
```json
{
  "action": "insights",
  "provider": "dynamics",
  "insightOptions": {
    "customerId": "customer_123",
    "timeRange": "last_30_days",
    "metrics": ["engagement", "revenue"]
  }
}
```

This documentation serves as a guide for implementing and utilizing the Enterprise CRM Integration API effectively.