# Build Shared Team Context Memory Service

# Shared Team Memory Service

## Purpose
The Shared Team Memory Service is designed to maintain persistent shared memory across AI team members. This service enables context sharing, collaborative learning, and cross-agent knowledge persistence utilizing vector-based semantic search and real-time synchronization.

## Usage
To utilize the Shared Team Memory Service, import the service within your application and create a client instance for interacting with shared memory functionalities. You can use this service to store, retrieve, and synchronize memory contexts among AI agents.

## Parameters/Props
The service handles various interfaces to structure memory contexts and manage memory operations:

### MemoryContext
- `id`: Unique identifier for the context.
- `agentId`: Identifier for the AI agent that owns the context.
- `agentType`: Type of the agent (e.g., Assistant, Collaborator).
- `contextType`: Type of context (decision, insight, pattern, solution, error, learning).
- `title`: Title of the context.
- `content`: Detailed content of the context.
- `metadata`: Additional metadata as a record of key-value pairs.
- `tags`: Array of tags associated with the context.
- `priority`: Priority level of the context (numeric).
- `confidence`: Confidence score (numeric).
- `timestamp`: Date the context was created.
- `expiresAt`: Optional expiration date.
- `relatedContexts`: Array of related context IDs.
- `accessCount`: Count of how many times the context has been accessed.
- `lastAccessed`: Date when the context was last accessed.

### ContextVector
- `contextId`: Identifier for the context this vector relates to.
- `embedding`: Array of numeric values representing the context's embedding.
- `dimensions`: Number of dimensions in the embedding.
- `model`: Model name used for generating the embedding.
- `createdAt`: Date the vector was created.
- `updatedAt`: Date the vector was last updated.

### MemorySearchQuery
- `query`: The search term.
- `agentId`: Optional filter by agent ID.
- `contextTypes`: Optional filter by types of context.
- `tags`: Array of optional tags for filtering.
- `minConfidence`: Optional minimum confidence score filter.
- `maxAge`: Optional maximum context age filter.
- `limit`: Optional limit for the number of results.
- `includeVectorSearch`: Boolean to include vector-based search.
- `semanticThreshold`: Float value for similarity threshold in relevance scoring.

### MemorySearchResult
- `context`: The matched `MemoryContext`.
- `similarity`: Similarity score against the query.
- `rank`: Rank position in the search results.
- `relevanceScore`: Score representing the relevance of the result.

### MemorySyncEvent
- `type`: Type of event (created, updated, deleted, accessed).
- `contextId`: Identifier for the context involved.
- `agentId`: Identifier for the agent involved.
- `timestamp`: Date the event occurred.

## Return Values
The service methods will return various types of results including memory contexts, search results, and status updates from memory synchronization events.

## Examples
```typescript
import { SharedTeamMemoryService, MemorySearchQuery } from './src/services/shared-team-memory.service';

// Create an instance of the service
const memoryService = new SharedTeamMemoryService();

// Example to store a new memory context
const newContext = {
  id: 'unique-context-id',
  agentId: 'agent-001',
  agentType: 'Assistant',
  contextType: 'insight',
  title: 'Future Trends in AI',
  content: 'AI is expected to evolve rapidly in the next decade...',
  metadata: {},
  tags: ['AI', 'trends'],
  priority: 1,
  confidence: 0.9,
  timestamp: new Date(),
  relatedContexts: [],
  accessCount: 0,
  lastAccessed: new Date(),
};

// Example to search for contexts
const searchQuery: MemorySearchQuery = {
  query: 'AI trends',
  limit: 5,
};

// Execute the search
memoryService.searchMemory(searchQuery).then(results => {
  console.log(results);
});
```
This documentation outlines how to use the Shared Team Memory Service effectively with examples tailored for developers.