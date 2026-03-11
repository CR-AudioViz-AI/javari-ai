# Deploy Shared Team Memory Service

```markdown
# Shared Team Memory Service

## Purpose
The Shared Team Memory Service facilitates collaborative memory storage and conflict resolution among team members by managing memory units, providing shared state context, and enabling efficient retrieval of insights and decisions.

## Usage
This service is utilized in team environments where multiple agents or users interact to store, retrieve, and manage shared memories efficiently. It integrates with Supabase for database operations and Redis for session management.

## Parameters/Props

### Interfaces
- **MemoryNode**
  - `id` (string): Unique identifier of the memory.
  - `teamId` (string): Identifier for the team associated with the memory.
  - `agentId` (string): Identifier for the agent/user who created the memory.
  - `content` (string): Main content of the memory.
  - `embedding?` (number[]): Optional vector representation for semantic search.
  - `metadata`: Object containing additional memory details.
    - `type` ('insight' | 'context' | 'learning' | 'decision' | 'preference'): Type of memory.
    - `tags` (string[]): Tags associated with the memory.
    - `confidence` (number): Confidence level of the memory.
    - `timestamp` (Date): Creation time of the memory.
    - `sessionId?` (string): Optional session identifier.
    - `parentNodeId?` (string): Optional parent memory node identifier.
    - `relatedNodes` (string[]): Array of related memory node identifiers.
  - `accessCount` (number): Count of how many times the memory has been accessed.
  - `lastAccessed` (Date): Timestamp of the last access.
  - `expiresAt?` (Date): Optional expiration date of the memory.
  - `isCompressed` (boolean): Indicates if the memory is compressed.
  - `compressionRatio?` (number): Optional ratio indicating compression effectiveness.

- **TeamContext**
  - `id` (string): Unique identifier for the team context.
  - `teamId` (string): Identifier of the team.
  - `sessionId` (string): Identifier for the current session.
  - `activeAgents` (string[]): Array of currently active agents.
  - `sharedState` (Record<string, any>): General state shared among agents.
  - `currentGoals` (string[]): List of goals currently pursued by the team.
  - `recentInsights` (MemoryNode[]): Array of recently added insights.
  - `conflictResolutions` (ConflictResolution[]): Array of recorded conflict resolution strategies.
  - `createdAt` (Date): Timestamp of context creation.
  - `updatedAt` (Date): Timestamp of last update.
  - `isActive` (boolean): Indicates whether the team context is active.

- **ConflictResolution**
  - `id` (string): Unique identifier of the conflict resolution record.
  - `conflictType` ('concurrent_write' | 'semantic_duplicate' | 'contradictory_insight'): Type of conflict encountered.
  - `memoryNodeIds` (string[]): Memory node identifiers involved in the conflict.
  - `resolution` ('merge' | 'prioritize' | 'create_variant'): Strategy applied to resolve the conflict.
  - `resolvedBy` (string): Identifier of the agent who resolved the conflict.
  - `timestamp` (Date): Time when the conflict was resolved.
  - `reasoning` (string): Explanation of the resolution.

- **MemorySearchOptions**
  - `query?` (string): Search string for memory lookup.
  - `semanticSearch?` (boolean): Enable semantic search if true.
  - `filters?`: Optional filters for query refinement.
    - `agentId?` (string): Filter by agent identifier.
    - `type?` (MemoryNode['metadata']['type']): Filter by memory type.
    - `tags?` (string[]): Filter by associated tags.
    - `dateRange?` ([Date, Date]): Filter within specific date range.
    - `sessionId?` (string): Specific session filter.
    - `minConfidence?` (number): Minimum confidence threshold.
  - `limit?` (number): Maximum number of results to return.
  - `offset?` (number): Number of results to skip.
  - `sortBy?` ('relevance' | 'timestamp' | 'access_count' | 'confidence'): Sort order of results.
  - `includeExpired?` (boolean): Whether to include expired memories.

## Return Values
The service returns various objects, including memory nodes, search results based on defined parameters, and metadata for operations performed within the service.

## Examples
```typescript
const memoryNode: MemoryNode = {
    id: "1",
    teamId: "teamA",
    agentId: