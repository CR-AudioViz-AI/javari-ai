# Implement Inter-Agent Message Routing API

# Inter-Agent Message Routing API

The Inter-Agent Message Routing API is designed to facilitate communication between different agents within a distributed system. It handles the routing of messages, validates the integrity and context of each message, and manages conversation contexts.

## Purpose

This API allows agents to send and receive messages efficiently while maintaining the necessary validations and structures for successful communication across the network. It is utilized in scenarios where agents need to share tasks, responses, updates, and error messages based on various message types with context handling.

## Usage

To route messages between agents via the API, send a POST request to the corresponding endpoint with a valid message object that follows the specified schemas.

## Parameters/Props

The main interfacing function is `route(message: AgentMessage)`. 

### AgentMessage Interface

```typescript
interface AgentMessage {
  id: string;               // Unique identifier for the message
  senderId: string;        // The ID of the sender agent
  recipientId?: string;    // The ID of the recipient agent (optional)
  messageType: 'task' | 'response' | 'broadcast' | 'query' | 'error'; // Type of message
  payload: Record<string, any>; // Content of the message
  priority: 'low' | 'medium' | 'high' | 'urgent'; // Message priority level
  contextId: string;       // Identifier for the conversation context
  timestamp: number;       // Timestamp of message creation
  encrypted: boolean;      // Indicates if the message is encrypted
  capabilities?: string[]; // Optional capabilities linked to the message
  metadata?: Record<string, any>; // Optional metadata related to the message
}
```

### ContextUpdateSchema

A schema for updating the conversation context:

```typescript
const ContextUpdateSchema = z.object({
  contextId: z.string(),
  sharedState: z.record(z.any()).optional(),
  participants: z.array(z.string()).optional(),
});
```

## Return Values

The `route` function returns a promise that resolves with an array of strings:
- **Promise<string[]>** - An array containing the IDs of the recipients to whom the message was routed successfully.

## Examples

### Example of Routing a Message

```typescript
import { MessageRouter } from './path/to/router';

const router = new MessageRouter();

const message: AgentMessage = {
  id: 'msg-123',
  senderId: 'agent-001',
  messageType: 'task',
  payload: { taskDetails: 'Process order #456' },
  priority: 'high',
  contextId: 'ctx-001',
  timestamp: Date.now(),
  encrypted: false,
};

router.route(message)
  .then(recipients => {
    console.log('Message routed to:', recipients);
  })
  .catch(error => {
    console.error('Error routing message:', error);
  });
```

### Error Handling

When an error occurs (e.g., validation failure, recipient not found), the `route` method will catch and throw an error appropriately, providing contextual information for debugging.

This API streamlines agent interactions in a scalable manner while ensuring message integrity and status tracking.