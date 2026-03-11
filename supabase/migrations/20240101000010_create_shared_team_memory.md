# Build Shared Team Memory Module

# Shared Team Memory Module Documentation

## Purpose
The Shared Team Memory Module provides a structured way to store, manage, and resolve conflicts in collective team memory using a database schema. It includes the necessary tables and types to handle different memory types, lifecycle management, and conflict resolution strategies.

## Usage
This SQL migration should be executed within a PostgreSQL database to create the necessary schema.

## Parameters/Props

### Extensions
- `uuid-ossp`: Enables UUID generation functions.
- `vector`: Allows storage of vector embeddings.

### Enum Types
- **memory_type**: Types of memories stored (values: `episodic`, `semantic`, `procedural`, `contextual`).
- **memory_status**: Status of the memory (values: `active`, `archived`, `tombstone`).
- **conflict_resolution_strategy**: Strategies for resolving conflicts (values: `last_write_wins`, `merge`, `manual`, `vector_clock`).

### Tables

#### team_memories
- **id**: UUID, primary key.
- **team_id**: UUID, identifier for the team.
- **agent_id**: UUID, identifier for the agent related to the memory.
- **memory_type**: Enum, type of memory (default: `semantic`).
- **title**: Text, title of the memory.
- **content**: Text, content of the memory.
- **embedding**: Vector (1536 dimensions), used for embedding representations.
- **metadata**: JSONB, additional memory data.
- **tags**: Array of text, tags associated with the memory.
- **vector_clock**: JSONB, for conflict-free replicated data types (CRDT).
- **replica_id**: UUID, identifier for the memory replica.
- **logical_timestamp**: BIGINT, timestamp for logical operations.
- **parent_memory_id**: UUID, references another memory if applicable.
- **status**: Enum, current status of the memory (default: `active`).
- **importance_score**: Float, score between 0 and 1 indicating importance.
- **access_count**: Integer, count of memory accesses.
- **last_accessed_at**: TIMESTAMP, last accessed timestamp.
- **created_at**: TIMESTAMP, memory creation time (default: NOW()).
- **updated_at**: TIMESTAMP, last update time (default: NOW()).
- **expires_at**: TIMESTAMP, expiration time of the memory.
- **FOREIGN KEY**: Enforces relationships with `parent_memory_id`.

#### memory_conflicts
- **id**: UUID, primary key.
- **team_id**: UUID, identifier for the team.
- **memory_id**: UUID, identifier for the memory in conflict.
- **conflicting_memory_id**: UUID, identifier for the conflicting memory.
- **conflict_type**: Text, description of the conflict.
- **resolution_strategy**: Enum, chosen strategy for conflict resolution.

## Return Values
This schema does not return values directly, but it establishes the structure for managing team memories, including conflict resolution tracking.

## Examples
To create the necessary schema, run the following SQL command:

```sql
\i supabase/migrations/20240101000010_create_shared_team_memory.sql
```

This command initializes the `team_memories` and `memory_conflicts` tables along with required types and ensures that UUID and vector support is enabled.