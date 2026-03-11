# Create Shared Team Memory Service

# Shared Team Memory Service Documentation

## Purpose
The Shared Team Memory Service allows teams to store, manage, and retrieve shared memory entries efficiently. It facilitates collaboration by categorizing memories, storing metadata, and providing powerful query capabilities.

## Usage
To utilize the Shared Team Memory Service, integrate this service into your application, and interact with the memory store through the defined interfaces and enums.

## Interfaces & Enums

### MemoryEntry<T>
- **Purpose**: Represents an individual memory entry.
- **Properties**:
  - `id: string`: Unique identifier for the memory entry.
  - `teamId: string`: Identifier for the team associated with the memory entry.
  - `agentId: string`: Identifier for the agent creating or updating the memory.
  - `category: MemoryCategory`: Category of the memory.
  - `content: T`: The content of the memory.
  - `metadata: MemoryMetadata`: Metadata associated with the memory.
  - `embedding?: number[]`: Optional vector representation for semantic searching.
  - `relevanceScore?: number`: Optional score indicating how relevant the memory is.
  - `createdAt: Date`: Timestamp when the memory was created.
  - `updatedAt: Date`: Timestamp when the memory was last updated.
  - `expiresAt?: Date`: Optional expiration date for the memory.

### MemoryCategory
- **Purpose**: Enumerates possible categories for memory entries.
- **Values**:
  - `CONTEXT`
  - `LEARNING`
  - `RESULT`
  - `INSIGHT`
  - `TASK_STATE`
  - `COMMUNICATION`

### MemoryMetadata
- **Purpose**: Holds additional information for enhanced memory retrieval.
- **Properties**:
  - `tags: string[]`: Tags associated with the memory.
  - `priority: MemoryPriority`: Priority level of the memory.
  - `visibility: MemoryVisibility`: Visibility setting.
  - `relations: string[]`: Related memory IDs.
  - `version: number`: Version of the memory entry.
  - `source: string`: Origin of the memory content.

### MemoryPriority
- **Purpose**: Classifies memory entries by urgency.
- **Values**:
  - `LOW`
  - `MEDIUM`
  - `HIGH`
  - `CRITICAL`

### MemoryVisibility
- **Purpose**: Defines how accessible the memory is.
- **Values**:
  - `PRIVATE`
  - `TEAM`
  - `PUBLIC`

### TeamContext
- **Purpose**: Represents the context of a team using the memory service.
- **Properties**:
  - `teamId: string`
  - `name: string`
  - `description: string`
  - `activeAgents: string[]`
  - `sharedMemories: string[]`
  - `contextWindow: number`
  - `syncEnabled: boolean`
  - `createdAt: Date`
  - `updatedAt: Date`

### MemoryQuery
- **Purpose**: Defines the parameters for querying memory entries.
- **Properties**:
  - `teamId?: string`
  - `agentId?: string`
  - `categories?: MemoryCategory[]`
  - `tags?: string[]`
  - `content?: string`
  - `embedding?: number[]`
  - `limit?: number`
  - `offset?: number`
  - `priority?: MemoryPriority[]`
  - `visibility?: MemoryVisibility[]`
  - `dateRange?: { from: Date; to: Date }`
  - `semanticThreshold?: number`

### MemoryStore
- **Purpose**: Interface for storing memory entries.
- **Method**:
  - `store<T>(entry: Omit<MemoryEntry<T>, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry<T>>`: Saves a new memory entry and returns the stored entry including auto-generated `id`, `createdAt`, and `updatedAt`.

## Examples

### Storing a Memory Entry
```typescript
const memoryEntry: MemoryEntry = {
  id: "unique-id",
  teamId: "team-123",
  agentId: "agent-456",
  category: MemoryCategory.CONTEXT,
  content: { text: "Example memory content" },
  metadata: {
    tags: ["tag1", "tag2"],
    priority: MemoryPriority.MEDIUM,
    visibility: MemoryVisibility.TEAM,
    relations: [],
    version: 1,
    source: "source-info"
  },
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### Querying Memory Entries
```typescript
const query: MemoryQuery = {
  teamId: "team-123",
  categories: [MemoryCategory.RESULT],
  limit: 10
};
// Execute memory retrieval based on the query using appropriate method in Memory