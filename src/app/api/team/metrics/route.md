# Generate Team Performance Metrics API

# Team Performance Metrics API Documentation

## Purpose
The Team Performance Metrics API provides endpoints to track and query performance metrics for team members, enabling organizations to measure collaboration, task completion, and overall productivity. It allows for recording various activities and retrieving insightful performance data.

## Usage
This API can be used to:
- Record agent activities to track performance metrics.
- Retrieve aggregated and detailed metrics for analysis over specified timeframes. 

## Parameters/Props

### Track Metrics Endpoint
- **`agentId`**: *(string, required)* A unique identifier for the agent (UUID format).
- **`eventType`**: *(enum, required)* Type of event to track. Possible values: `collaboration`, `task_completion`, `knowledge_share`, `peer_review`.
- **`metadata`**: *(object, optional)* Additional information related to the event:
  - **`taskId`**: *(string, optional)* Identifier of the task related to the event.
  - **`collaboratorIds`**: *(array of strings, optional)* List of UUIDs of collaborators involved.
  - **`duration`**: *(number, optional)* Duration of the activity in seconds (positive number).
  - **`quality_score`**: *(number, optional)* Performance score between 0 and 100.
  - **`complexity`**: *(enum, optional)* Complexity level of the task. Possible values: `low`, `medium`, `high`.

### Metrics Query Endpoint
- **`timeframe`**: *(enum, optional)* Timeframe for the metrics. Defaults to `week`. Possible values: `day`, `week`, `month`, `quarter`.
- **`agentId`**: *(string, optional)* Optional agent’s UUID to filter metrics for a specific agent.
- **`includeInsights`**: *(boolean, optional)* Whether to include machine learning insights in the response. Defaults to `true`.
- **`granularity`**: *(enum, optional)* Granularity of the metrics data. Defaults to `day`. Possible values: `hour`, `day`, `week`.

## Return Values
The API returns a structured response with the following fields:

### For Tracking Metrics
- Success or failure message with status code.

### For Querying Metrics
- **`overview`**: *(object)* Contains:
  - `totalTasks`: Total number of tasks completed.
  - `completionRate`: Rate of task completion.
  - `collaborationScore`: Score indicating collaboration effectiveness.
  - `avgResponseTime`: Average response time.
  - `productivityIndex`: Index indicating overall productivity.

- **`agents`**: *(array)* List of agent contributions containing:
  - `agentId`
  - `name`
  - `tasksCompleted`
  - `collaborationEvents`
  - `qualityScore`
  - `productivityScore`
  - `specializations`
  - `weeklyTrend`
  
- **`collaboration`**: *(object)* Metrics on collaboration that includes:
  - `networkDensity`
  - `crossFunctionalIndex`
  - `knowledgeFlowRate`
  - `peerReviewEffectiveness`
  - `communicationPatterns` (array of objects detailing communication between agents)

- **`trends`**: *(array)* Metrics trends over specified periods.
- **`insights`**: *(array)* Machine learning insights related to agent performance metrics.

## Examples

### Example of Tracking a Metric
```json
POST /api/team/metrics/track
{
  "agentId": "123e4567-e89b-12d3-a456-426614174000",
  "eventType": "task_completion",
  "metadata": {
    "taskId": "task-001",
    "quality_score": 85,
    "duration": 3600
  }
}
```

### Example of Querying Metrics
```json
GET /api/team/metrics/query?timeframe=week&agentId=123e4567-e89b-12d3-a456-426614174000&granularity=day
```

The response will include the performance metrics overview, agent contributions, collaboration metrics, trends, and insights as described.