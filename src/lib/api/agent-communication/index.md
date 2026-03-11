# Build Agent-to-Agent Communication Protocol API

# Agent Communication Protocol API Documentation

## Purpose
The Agent Communication Protocol API facilitates robust communication between agents in a distributed system. It allows agents to send and receive messages while ensuring secure transmission, message acknowledgment, and management of agent states.

## Usage
To utilize the Agent Communication API, an instance of `AgentCommunicationClient` should be created with proper configuration. Agents can then be registered, and messages can be sent and received using the provided methods.

## Parameters / Props

### `CommunicationConfig`
The configuration object for initializing the `AgentCommunicationClient`. It should include:

- `supabaseUrl`: URL for the Supabase database.
- `supabaseKey`: API key for accessing Supabase.
- `redisUrl`: Optional URL for Redis instance.
- `encryptionKey`: Key used for encrypting messages.
- `jwtSecret`: Secret key for signing JWTs.
- `messageRetryAttempts`: Number of retry attempts for message delivery.
- `messageRetryDelay`: Delay between retries in milliseconds.
- `agentTimeoutMs`: Timeout duration for agent responsiveness in milliseconds.

### `Message`
A standard message object exchanged between agents. It includes:
- `id`: Unique identifier for the message.
- `agentId`: ID of the agent sending the message.
- `targetId`: ID of the target agent.
- `messageType`: Type of the message being sent.
- `payload`: The actual data/content of the message.
- `timestamp`: When the message was created.
- `signature`: Digital signature for message integrity.
- `priority`: Priority level of the message (`low`, `normal`, `high`, `urgent`).
- `encrypted`: Indicates if the message is encrypted.
- `acknowledgmentRequired`: Boolean indicating if an acknowledgment is needed.
- `expiresAt`: Optional expiration time for the message.

### `MessageAcknowledgment`
An object for acknowledging message receipt. It includes:
- `messageId`: ID of the message being acknowledged.
- `agentId`: ID of the agent sending the acknowledgment.
- `status`: Status of the acknowledgment (`received`, `processed`, `failed`).
- `timestamp`: When the acknowledgment was created.
- `errorMessage`: Optional message when acknowledgment fails.

## Return Values
The `AgentCommunicationClient` methods return promises that resolve to various results, including:
- Confirmation of message sent.
- Acknowledgment status.
- Error messages in case of failure.

## Examples

### Initialize Communication Client
```typescript
const config: CommunicationConfig = {
  supabaseUrl: 'https://your-supabase-url',
  supabaseKey: 'your-supabase-key',
  redisUrl: 'your-redis-url',
  encryptionKey: 'your-encryption-key',
  jwtSecret: 'your-jwt-secret',
  messageRetryAttempts: 3,
  messageRetryDelay: 500,
  agentTimeoutMs: 10000
};

const agentClient = new AgentCommunicationClient(config);
```

### Sending a Message
```typescript
const message: Message = {
  id: 'message-1',
  agentId: 'agent-1',
  targetId: 'agent-2',
  messageType: 'text',
  payload: { text: 'Hello, Agent 2!' },
  timestamp: new Date(),
  signature: 'signature-value',
  priority: 'normal',
  encrypted: false,
  acknowledgmentRequired: true
};

await agentClient.sendMessage(message);
```

### Handling Acknowledgment
```typescript
agentClient.onMessageAcknowledgment((ack: MessageAcknowledgment) => {
  console.log(`Message ${ack.messageId} from ${ack.agentId} status: ${ack.status}`);
});
```

This documentation provides concise instructions on using the Agent Communication Protocol API, including setup, types, and example usage.