# Build Real-Time Agent Usage Metrics API

```markdown
# Real-Time Agent Usage Metrics API

## Purpose
The Real-Time Agent Usage Metrics API provides a WebSocket interface for monitoring and retrieving live metrics related to agent performance in real-time. It serves as a critical component for applications requiring up-to-the-minute insights into agent activities.

## Usage
This API can be utilized in web applications where you need to establish a WebSocket connection to stream live metrics such as requests per minute, average response time, error rate, and more for individual agents.

## Parameters/Props

### AgentMetrics Interface
- `agent_id` (string): Unique identifier of the agent.
- `requests_per_minute` (number): Number of requests handled by the agent in the last minute.
- `avg_response_time` (number): Average response time of the agent in milliseconds.
- `error_rate` (number): Percentage of failed requests.
- `satisfaction_score` (number): Customer satisfaction score for the agent.
- `total_requests` (number): Total number of requests handled by the agent.
- `active_users` (number): Number of users interacting with the agent in real-time.
- `last_updated` (string): Timestamp of the last update of the metrics.

### MetricsCache Interface
- A dictionary where keys are `agentId` (string) and values are objects holding the following:
  - `metrics`: Current metrics as defined in the `AgentMetrics` interface.
  - `lastUpdate`: UNIX timestamp of the last data update.
  - `requestBuffer`: Array of recorded request objects with `timestamp`, `response_time`, and `success` status.

## Return Values
When a client connects to the WebSocket, the server streams live metrics data encapsulated in JSON format based on the format defined in the `AgentMetrics` interface. 

### Client Messages
Clients can send messages to the server to request specific metrics updates or to interact further.

## Examples

### Setting Up WebSocket Connection
To connect to the metrics WebSocket server from the client:
```javascript
const socket = new WebSocket('ws://your-server-url/metrics');

socket.onopen = () => {
  console.log('Connected to metrics server');
};

socket.onmessage = (event) => {
  const metricsData = JSON.parse(event.data);
  console.log('Received metrics:', metricsData);
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

socket.onclose = () => {
  console.log('Connection closed');
};
```

### Sending a Message to Request Updates
```javascript
const requestMessage = JSON.stringify({ action: 'getMetrics', agentId: 'agent_123' });
socket.send(requestMessage);
```

By utilizing this API, your application can dynamically display real-time performance metrics for agents, allowing for more informed operational decisions and enhanced user experiences.
```