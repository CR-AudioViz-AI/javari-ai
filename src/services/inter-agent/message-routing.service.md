# Implement Inter-Agent Message Routing Service

# Inter-Agent Message Routing Service

## Purpose
The Inter-Agent Message Routing Service is designed to facilitate the reliable exchange of messages between agents in a distributed system. It handles message delivery patterns, guarantees, and tracking statuses, ensuring efficient and secure communication.

## Usage
To use the Inter-Agent Message Routing Service, import the necessary modules and instantiate the service with appropriate routing configurations. The service allows for sending messages, acknowledging receipt, and monitoring the status of messages.

```typescript
import { MessageRoutingService } from './src/services/inter-agent/message-routing.service';

// Initialize the message routing service with configurations
const routingService = new MessageRoutingService({
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  messageTimeoutMs: 60000,
  ackTimeoutMs: 5000,
  enableEncryption: true,
  enableMetrics: true,
});
```

## Parameters / Props
### RoutingConfig
- **maxQueueSize**: `number` - The maximum number of messages that can be queued.
- **maxRetries**: `number` - The maximum number of retries for delivering a message.
- **retryDelayMs**: `number` - Delay in milliseconds before retrying message delivery.
- **messageTimeoutMs**: `number` - Duration after which a message will be considered expired.
- **ackTimeoutMs**: `number` - Duration to wait for an acknowledgment before timing out.
- **enableEncryption**: `boolean` - If true, messages will be encrypted.
- **enableMetrics**: `boolean` - If true, metrics will be collected for monitoring.

### AgentMessage Interface
- **id**: `string` - Unique identifier for the message.
- **fromAgentId**: `string` - ID of the sending agent.
- **toAgentId**: `string` - (Optional) ID of the receiving agent.
- **toAgentGroup**: `string` - (Optional) ID of the agent group for multicast delivery.
- **type**: `string` - Type of the message.
- **payload**: `Record<string, any>` - Content of the message.
- **priority**: `MessagePriority` - Priority level of the message.
- **deliveryPattern**: `DeliveryPattern` - Delivery pattern for the message.
- **deliveryGuarantee**: `DeliveryGuarantee` - Delivery guarantee level for the message.
- **timestamp**: `Date` - Time when the message was created.
- **expiresAt**: `Date` - (Optional) Time when the message expires.
- **retryCount**: `number` - Current retry count for the message.
- **maxRetries**: `number` - Maximum allowed retries for the message.
- **metadata**: `Record<string, any>` - Additional metadata for the message.

## Return Values
The service methods return instances of `MessageAck` upon processing message acknowledgments. `MessageAck` contains:
- **messageId**: `string` - ID of the acknowledged message.
- **agentId**: `string` - ID of the agent that acknowledged the message.
- **status**: `'success' | 'failure'` - Acknowledgment status.
- **error**: (Optional) `string` - Error description in case of failure.
- **timestamp**: `Date` - Time when the acknowledgment was sent.

## Examples
### Sending a Message
```typescript
const message: AgentMessage = {
  id: uuidv4(),
  fromAgentId: 'agent123',
  toAgentId: 'agent456',
  type: 'text',
  payload: { content: 'Hello!' },
  priority: MessagePriority.NORMAL,
  deliveryPattern: DeliveryPattern.DIRECT,
  deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
  timestamp: new Date(),
  retryCount: 0,
  maxRetries: 3,
  metadata: {},
};

routingService.sendMessage(message);
```

### Acknowledging a Message
```typescript
const ack: MessageAck = routingService.acknowledgeMessage('messageId', 'agent456', 'success');
console.log(ack);
```

This documentation outlines the structure and usage of the Inter-Agent Message Routing Service, facilitating smooth communication between agents.