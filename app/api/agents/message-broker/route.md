# Build Inter-Agent Message Broker API

# Inter-Agent Message Broker API Documentation

## Purpose
The Inter-Agent Message Broker API facilitates communication between agents by providing a mechanism to send, receive, and manage messages efficiently while ensuring message integrity, delivery receipt, and rate limiting. The API supports message prioritization and different delivery modes.

## Usage
This API is built using Next.js and integrates with Supabase for data storage and Upstash Redis for message handling and rate limiting.

### API Endpoints
1. **Send Message**: Allows agents to send messages to other agents.
2. **Receive Messages**: Enables agents to retrieve messages based on filters.
3. **Register Agent**: Registers new agents in the system.

## Parameters/Props

### Message Schema
- `id` (optional): UUID of the message.
- `from`: Sender agent's ID.
- `to`: Recipient agent's ID or an array of IDs.
- `type`: Type of message (`direct`, `broadcast`, `request`, `response`).
- `priority`: Message priority (`low`, `normal`, `high`, `critical`, default: `normal`).
- `payload`: A record containing the message data.
- `correlationId` (optional): ID to correlate requests and responses.
- `ttl`: Time-to-live for the message in seconds (1-3600, default: 300).
- `deliveryMode`: Delivery assurance type (`at_most_once`, `at_least_once`, `exactly_once`, default: `at_least_once`).
- `retryCount`: Number of retry attempts on failure (0-5, default: 3).

### Agent Registration Schema
- `agentId`: Unique identifier for the agent.
- `capabilities`: List of agent capabilities.
- `endpoint`: URL where the agent can be reached.
- `status`: Agent's current status (`active`, `inactive`, `maintenance`, default: `active`).

### Message Filter Schema
- `agentId`: ID of the agent requesting messages.
- `limit`: Maximum number of messages to retrieve (1-100, default: 10).
- `priority` (optional): Filter messages based on priority.
- `type` (optional): Filter messages based on message type.
- `since` (optional): Date and time filter for message retrieval.

## Return Values
- Successful operations will return the appropriate status and the relevant message or receipts.
- Error responses will include error codes and messages.

## Examples

### Sending a Message
```typescript
const message = {
  from: "agent_id_1",
  to: "agent_id_2",
  type: "direct",
  priority: "high",
  payload: { content: "Hello, Agent!" },
  ttl: 300,
  deliveryMode: "at_least_once",
};
```

### Registering an Agent
```typescript
const newAgent = {
  agentId: "agent_id_2",
  capabilities: ["process_data", "respond_to_queries"],
  endpoint: "https://example.com/agent_endpoint",
  status: "active",
};
```

### Filtering Messages
```typescript
const filter = {
  agentId: "agent_id_1",
  limit: 10,
  priority: "normal",
  type: "request",
  since: "2023-10-01T00:00:00Z",
};
```

These examples illustrate how to structure messages, agent registrations, and filters for effective communication using the Inter-Agent Message Broker API.