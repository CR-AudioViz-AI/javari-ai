# Deploy Craiverse State Persistence Microservice

```markdown
# Craiverse State Persistence Microservice

## Purpose
The Craiverse State Persistence Microservice manages the synchronization of world states in the Craiverse ecosystem. It employs advanced conflict resolution techniques to handle concurrent modifications, ensuring that users can edit the state without causing data inconsistencies.

## Features
- CRDT-based conflict resolution using vector clocks
- LZ4 delta compression for efficient state synchronization
- Redis caching for optimizing access to active world states
- Real-time synchronization through WebSockets
- Operational transforms to manage concurrent edits
- Automatic detection and resolution of conflicts

## Usage
This microservice is intended to be used within the Craiverse application architecture to manage state changes across different user sessions. It should be deployed in environments where real-time collaboration is required.

## Parameters/Props

### VectorClock
- `nodeId`: **string** - Identifier for the node (user).
- `clock`: **number** - Clock value for this specific node.
- `vector`: **Record<string, number>** - Map of clock values for other nodes.

### StateOperation
- `id`: **string** - Unique identifier for the operation.
- `type`: **'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE'** - Type of operation being performed.
- `path`: **string[]** - Target entity path in the world state.
- `payload`: **any** - Data associated with the operation.
- `vectorClock`: **VectorClock** - Timestamp and ordering data for the operation.
- `userId`: **string** - Identifier of the user performing the operation.
- `timestamp`: **number** - Timestamp indicating when the operation was executed.

### CompressedDelta
- `data`: **Buffer** - Compressed buffer containing operation data.
- `metadata`:
  - `originalSize`: **number** - Size of the original operation data.
  - `compressedSize`: **number** - Size after compression.
  - `algorithm`: **'lz4'** - Compression algorithm used.
  - `checksum`: **string** - Checksum for data integrity verification.
- `operationIds`: **string[]** - List of operation IDs included in the delta.

### WorldState
- `worldId`: **string** - Identifier for the global world state.
- Additional properties can be defined as needed.

## Return Values
The microservice returns responses indicating the success or failure of operations, including the current world state as modified by the operations.

## Examples

### Creating a New State Operation
```typescript
const newOperation: StateOperation = {
  id: "op123",
  type: "CREATE",
  path: ["entities", "user", "123"],
  payload: { username: "user1", position: { x: 10, y: 20 } },
  vectorClock: { nodeId: "user1", clock: 1, vector: {"user1": 1}},
  userId: "user1",
  timestamp: Date.now(),
};
```

### Compressing a Delta
```typescript
const compressedDelta: CompressedDelta = {
  data: LZ4.compress(Buffer.from(JSON.stringify(stateOperations))),
  metadata: {
    originalSize: 1024,
    compressedSize: 256,
    algorithm: "lz4",
    checksum: "abc123",
  },
  operationIds: ["op123", "op124"],
};
```
```