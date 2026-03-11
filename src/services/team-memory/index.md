# Create Distributed Team Memory Service

```markdown
# Distributed Team Memory Service

## Purpose
The Distributed Team Memory Service is designed to facilitate the sharing of context across AI agents within a team environment. It incorporates mechanisms for conflict resolution, memory prioritization, and intelligent garbage collection to manage distributed memory effectively.

## Usage
This service enables AI agents to create, retrieve, update, and delete memory entries that are shared across team interactions. It employs an underlying database managed by Supabase to store memory entries and ensures that these entries are accessible with efficient retrieval mechanisms.

## Parameters/Props
### Types
- `TeamMemory`
  - **id**: `string` - Unique identifier for the memory entry.
  - **agent_id**: `string` - The agent that created this memory.
  - **memory_type**: `'context' | 'preference' | 'knowledge' | 'interaction' | 'error'` - Type/category of memory.
  - **content**: `object` - Memory content and metadata.
    - **data**: `any` - The core content of the memory.
    - **tags**: `string[]` (optional) - Associated tags for the memory.
    - **related_agents**: `string[]` (optional) - List of agents related to this memory.
    - **session_id**: `string` (optional) - ID of the session in which the memory was created.
  - **priority_score**: `number` - Score for memory importance ranking.
  - **access_count**: `number` - Number of times this memory has been accessed.
  - **created_at**: `Date` - Timestamp of memory creation.
  - **updated_at**: `Date` - Timestamp of the last update.
  - **expires_at**: `Date` (optional) - Optional expiration timestamp for the memory.
  - **version**: `number` - Version control for conflict resolution.

- `ConflictResolution`
  - **resolved**: `TeamMemory` - The resolved memory entry resulting from conflict resolution.
  - **conflicts**: `TeamMemory[]` - List of conflicting entries that were merged or discarded.
  - **strategy**: `'merge' | 'latest' | 'priority' | 'manual'` - Strategy used for resolving memory conflicts.

- `MemoryQuery`
  - **agent_id**: `string` (optional) - Filter memories by agent ID.
  - **memory_type**: `TeamMemory['memory_type']` (optional) - Filter memories by specific type.
  - **tags**: `string[]` (optional) - Filter memories by associated tags.
  - **min_priority**: `number` (optional) - Minimum required priority score.
  - **max_age**: `number` (optional) - Specify the maximum age of memory in milliseconds.

## Return Values
The service provides memory entries as objects of type `TeamMemory`, and operations may return resolved conflict objects of type `ConflictResolution`.

## Examples

### Create Memory Entry
```typescript
const memoryEntry: TeamMemory = {
  id: '1',
  agent_id: 'agent-123',
  memory_type: 'context',
  content: { data: { info: 'Team goals for Q1' }, tags: ['goals'], related_agents: ['agent-456'] },
  priority_score: 5,
  access_count: 0,
  created_at: new Date(),
  updated_at: new Date(),
  version: 1,
};
```

### Query Memories
```typescript
const query: MemoryQuery = {
  agent_id: 'agent-123',
  memory_type: 'context',
  min_priority: 3,
};
```

### Resolve Conflict
```typescript
const resolution: ConflictResolution = {
  resolved: resolvedMemoryEntry,
  conflicts: [conflictingMemoryEntry1, conflictingMemoryEntry2],
  strategy: 'merge',
};
```
```