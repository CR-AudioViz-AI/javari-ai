# Create Dynamic Team Rebalancing API

# Dynamic Team Rebalancing API

## Purpose
The Dynamic Team Rebalancing API is designed to facilitate the efficient reallocation of agents within a team based on various performance metrics and triggers. It allows for manual and automated rebalancing to maintain or enhance team performance.

## Usage
This API provides a single endpoint that accepts a rebalancing request which specifies the conditions and criteria for rebalancing a team. Below is a description of the inputs and outputs.

## Endpoint
- **URL:** `/api/team/rebalance`
- **Method:** `POST`

## Parameters/Props
The request body should be in JSON format and must adhere to the structure defined by the `RebalanceRequestSchema`.

### Request Body Schema
```json
{
  "teamId": "string (UUID)",
  "trigger": "string ('manual' | 'performance' | 'requirement_change')",
  "targetMetrics": {
    "efficiency": "number (0 to 1)",
    "accuracy": "number (0 to 1)",
    "responseTime": "number (positive)"
  },
  "constraints": {
    "maxSwaps": "integer (positive, default: 3)",
    "preserveCore": "boolean (default: true)",
    "allowDowngrade": "boolean (default: false)"
  }
}
```

- **teamId**: Unique identifier for the team to be rebalanced.
- **trigger**: Specifies the reason for rebalancing (manual, performance, or requirement change).
- **targetMetrics**: Optional metrics to guide rebalancing.
  - **efficiency**: Desired efficiency level (0 to 1).
  - **accuracy**: Desired accuracy level (0 to 1).
  - **responseTime**: Desired maximum response time.
- **constraints**: Optional parameters for rebalancing.
  - **maxSwaps**: Maximum number of agent swaps allowed (default is 3).
  - **preserveCore**: Flag to indicate whether core agents should be preserved (default is true).
  - **allowDowngrade**: Whether to allow downgrade of agent performance (default is false).

## Return Values
- **Response Codes**:
  - `200 OK`: Successful rebalancing request.
  - `400 Bad Request`: Validation errors in the request body.
  - `404 Not Found`: The specified team ID does not exist.
  - `500 Internal Server Error`: General server error during processing.

### Response Body
On success, the response will return details about the rebalancing operation, including the updated team status and the changes made to the agents.

```json
{
  "success": true,
  "teamId": "string (UUID)",
  "updatedAgents": [
    {
      "id": "string (UUID)",
      "status": "string ('active' | 'standby' | 'swapping' | 'error')"
    }
  ],
  "newStatus": "string ('active' | 'rebalancing' | 'paused' | 'error')"
}
```

## Examples

### Example Request
```json
POST /api/team/rebalance
{
  "teamId": "123e4567-e89b-12d3-a456-426614174000",
  "trigger": "performance",
  "targetMetrics": {
    "efficiency": 0.9,
    "accuracy": 0.85
  },
  "constraints": {
    "maxSwaps": 2,
    "preserveCore": true,
    "allowDowngrade": false
  }
}
```

### Example Response
```json
{
  "success": true,
  "teamId": "123e4567-e89b-12d3-a456-426614174000",
  "updatedAgents": [
    {
      "id": "456e4567-e89b-12d3-a456-426614174001",
      "status": "active"
    }
  ],
  "newStatus": "rebalancing"
}
```

This documentation provides a concise overview of the Dynamic Team Rebalancing API, facilitating effective integration and usage for developers.