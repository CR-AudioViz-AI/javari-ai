# Create Team Agent Message Queue API

# Team Agent Message Queue API

## Purpose
The Team Agent Message Queue API allows teams to send and manage messages between agents in a structured way. It supports different message types, priorities, and delivery guarantees, enabling robust communication and task execution within teams.

## Usage
This API is designed to be used in a Next.js application. It facilitates sending both single and bulk messages to target agents, tracking their statuses, and managing delivery attempts.

## Parameters / Props

### Request Parameters
#### `/api/teams/[teamId]/agents/message-queue`
- `teamId`: **string** - Unique identifier for the team.
  
#### Query Parameters (for bulk messages)
- `messages`: **array** - An array of message objects adhering to the `messageSchema`.
- `broadcast`: **boolean** (default: `false`) - If `true`, sends the message to all agents in the team.

### Message Schema
Each message object in the request follows this structure:
- `targetAgentId`: **string** - UUID of the target agent.
- `content`: **object** - Contains:
  - `type`: **enum** - Can be `command`, `data`, `query`, or `notification`.
  - `payload`: **any** - The message content.
  - `metadata`: **object** (optional) - Additional metadata as key-value pairs.
- `priority`: **enum** (default: `medium`) - Can be `low`, `medium`, `high`, or `critical`.
- `deliveryGuarantee`: **enum** (default: `at-least-once`) - Can be `at-most-once`, `at-least-once`, or `exactly-once`.
- `ttl`: **number** (default: `3600`) - Time-to-live for the message in seconds (1 to 86400 seconds).

### Return Values
The API responses will contain information about the status of sent messages:
- Success response:
  - `status`: **string** - Typically `success`.
  - `data`: **object** - Contains details of the sent message(s).
- Error response:
  - `status`: **string** - Description of the error encountered.

## Examples

### Sending a Single Message
```javascript
POST /api/teams/1234/agents/message-queue
{
  "targetAgentId": "550e8400-e29b-41d4-a716-446655440000",
  "content": {
    "type": "command",
    "payload": { "action": "start" }
  },
  "priority": "high",
  "deliveryGuarantee": "at-least-once"
}
```

### Sending Bulk Messages
```javascript
POST /api/teams/1234/agents/message-queue
{
  "messages": [
    {
      "targetAgentId": "550e8400-e29b-41d4-a716-446655440001",
      "content": {
        "type": "data",
        "payload": { "info": "Update" }
      }
    },
    {
      "targetAgentId": "550e8400-e29b-41d4-a716-446655440002",
      "content": {
        "type": "notification",
        "payload": { "message": "Meeting at 3 PM" }
      }
    }
  ],
  "broadcast": true
}
```

### Handling Responses
A successful response would look like:
```json
{
  "status": "success",
  "data": {
    "messageId": "message_123",
    "status": "pending"
  }
}
```

Error responses contain:
```json
{
  "status": "error",
  "message": "Invalid target agent ID"
}
``` 

This API ensures reliable communication among team agents, enhancing workflow management and operational effectiveness.