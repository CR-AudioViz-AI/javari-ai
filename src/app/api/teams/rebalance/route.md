# Build Dynamic Team Rebalancing API

# Dynamic Team Rebalancing API Documentation

## Purpose

The Dynamic Team Rebalancing API provides a mechanism to rebalance teams based on various strategies and parameters. This allows organizations to optimize team performance, agent utilization, and manage workload more effectively.

## Usage

This API endpoint allows authorized users to trigger team rebalancing processes and retrieve configuration settings related to team management. It is built on a serverless architecture and interacts with a Supabase backend.

### Endpoint

```
POST /api/teams/rebalance
```

## Parameters / Props

The request body should follow the structure defined in the `RebalanceRequestSchema`:

### RebalanceRequestSchema
- `teamIds` (optional): An array of UUID strings representing the IDs of teams to be rebalanced.
- `strategy` (optional): The strategy to use for rebalancing. Acceptable values are:
  - `weighted_round_robin`
  - `least_connection`
  - `performance_based` (default)
  - `capacity_optimized`
- `forceRebalance` (optional): A boolean flag indicating whether to force a rebalance, regardless of current conditions (default: `false`).
- `maxReassignments` (optional): An integer specifying the maximum number of reassignments to perform during the rebalance (default: `100`, min: `1`, max: `1000`).
- `thresholdOverride` (optional): An object containing:
  - `maxUtilization`: Overrides the maximum utilization threshold (0 to 1).
  - `minPerformanceScore`: Overrides the minimum performance score threshold (0 to 100).
  - `maxResponseTime`: Overrides the maximum response time threshold (integer, minimum 100).

### ConfigUpdateSchema
To update rebalancing configurations:
- `autoRebalanceEnabled` (optional): Enables/disables the automatic rebalance feature.
- `rebalanceInterval` (optional): Defines the interval for automatic rebalancing in seconds (min: `300`, max: `86400`).
- Other parameters follow similar constraints as in `RebalanceRequestSchema`.

## Return Values

Upon success, the API returns a response containing:
- A success status.
- Details of the rebalancing action performed.
- An overview of updated team metrics.

In case of failure, errors will be returned along with relevant error messages based on validation failures or operational issues.

## Examples

### Request Example
```json
POST /api/teams/rebalance
{
  "teamIds": ["123e4567-e89b-12d3-a456-426614174000"],
  "strategy": "performance_based",
  "forceRebalance": false,
  "maxReassignments": 50,
  "thresholdOverride": {
    "maxUtilization": 0.8,
    "minPerformanceScore": 70,
    "maxResponseTime": 200
  }
}
```

### Response Example
```json
{
  "status": "success",
  "message": "Rebalancing completed successfully.",
  "data": {
    "updatedTeams": [
      {
        "teamId": "123e4567-e89b-12d3-a456-426614174000",
        "newDistribution": "Details about the new agent distribution"
      }
    ]
  }
}
```

This documentation provides a concise overview of the Dynamic Team Rebalancing API, enabling developers to integrate and utilize it effectively in their applications.