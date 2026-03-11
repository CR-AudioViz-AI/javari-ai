# Build Inter-Agent Message Queue API

# Inter-Agent Message Queue API Documentation

## Purpose
The Inter-Agent Message Queue API facilitates communication between various agents through a message queue mechanism, supporting sending, consuming, and acknowledging messages. This API is designed for distributed systems where agents need to collaborate and share information efficiently.

## Usage
This API provides endpoints to send messages to specific agents or broadcast them, consume messages from the queue, and acknowledge the receipt of messages. It employs Redis for message storage and retrieval, ensuring reliability and performance.

### Endpoints
1. **Send Message**: Sends a message to a specified agent or broadcasts it.
2. **Consume Message**: Retrieves messages from the queue for processing by an agent.
3. **Acknowledge Message**: Confirms the receipt and processing result of a message.

## Parameters / Props

### Send Message
- **targetAgentId** (optional, string): ID of the target agent to send the message.
- **broadcast** (optional, boolean): If true, the message is broadcasted to all agents.
- **messageType** (enum): Type of the message (`task`, `status`, `data`, `control`, `broadcast`).
- **payload** (object): Content of the message, a record of any key-value pairs.
- **priority** (enum): Priority level of the message (`low`, `normal`, `high`).
- **ttl** (integer): Time-to-live for the message in seconds (min: 60, max: 86400).
- **requiresAck** (boolean): Indicates whether acknowledgment is required.
- **retryCount** (integer): Number of times to retry sending the message on failure (max: 5).

### Consume Message
- **count** (integer): Number of messages to consume (min: 1, max: 100).
- **block** (integer): Time to block waiting for messages in milliseconds (max: 30000).

### Acknowledge Message
- **messageId** (string): Unique identifier of the message to acknowledge.
- **status** (enum): Status of the message acknowledgment (`success`, `failed`, `retry`).

## Return Values
- For **Send Message**: Returns a confirmation of message sent or an error.
- For **Consume Message**: Returns an array of messages ready for processing.
- For **Acknowledge Message**: Returns a confirmation of acknowledgment or an error.

## Examples

### Send Message Example
```typescript
const response = await fetch('/api/agents/message-queue/send', {
  method: 'POST',
  body: JSON.stringify({
    targetAgentId: 'agent123',
    messageType: 'task',
    payload: { taskDetails: 'Process data' },
    priority: 'normal'
  }),
  headers: { 'Content-Type': 'application/json' }
});
```

### Consume Message Example
```typescript
const response = await fetch('/api/agents/message-queue/consume', {
  method: 'POST',
  body: JSON.stringify({
    count: 10,
    block: 5000
  }),
  headers: { 'Content-Type': 'application/json' }
});
const messages = await response.json();
```

### Acknowledge Message Example
```typescript
const response = await fetch('/api/agents/message-queue/ack', {
  method: 'POST',
  body: JSON.stringify({
    messageId: 'msg987',
    status: 'success'
  }),
  headers: { 'Content-Type': 'application/json' }
});
```

This API simplifies agent communications through a reliable message queuing mechanism, enabling efficient task management and status updates in distributed environments.