# Implement Shared Team Memory Service

# Shared Team Memory Service Migration Documentation

## Purpose
The Shared Team Memory Service Migration is designed to establish the database schema required for managing contextual team memories and AI agent memories. It allows teams to store, retrieve, and manage shared knowledge and memories effectively with relevant access controls and embedding support for AI applications.

## Usage
To apply the migration, execute the SQL script located at `src/lib/database/migrations/20241201_shared_team_memory.sql` in your PostgreSQL database environment. This will create the necessary tables and extensions for the Shared Team Memory Service.

## Parameters/Props
### Extensions
- **pgvector**: Enables vector-based data types for storing embedding information.
- **uuid-ossp**: Provides functions to generate universally unique identifiers (UUID).

### Tables
1. **team_memory_contexts**
   - `id (UUID)`: Unique identifier for each context.
   - `team_id (UUID)`: Identifier for the team associated with the context.
   - `context_type (VARCHAR)`: Type of context (e.g., conversation, task).
   - `title (VARCHAR)`: Descriptive title of the context.
   - `content (TEXT)`: Detailed content of the memory.
   - `embedding (VECTOR)`: Vector representation (1536 dimensions) of the context.
   - `metadata (JSONB)`: Additional metadata for the context.
   - `tags (TEXT[])`: Associated tags for easier search and categorization.
   - `relevance_score (FLOAT)`: Measurement of the context's relevance.
   - `access_level (VARCHAR)`: Defines accessibility (private, team, public).
   - `created_by (UUID)`: ID of the user who created the memory.
   - `created_at (TIMESTAMP)`: Timestamp of creation.
   - `updated_at (TIMESTAMP)`: Last update timestamp.
   - `expires_at (TIMESTAMP)`: Optional expiration date.
   - `is_archived (BOOLEAN)`: Indicates if the memory is archived.
   - `archive_reason (TEXT)`: Reason for archiving the memory.

2. **ai_agent_memories**
   - `id (UUID)`: Unique identifier for each agent memory.
   - `agent_id (VARCHAR)`: Identifier for the AI agent.
   - `team_id (UUID)`: Identifier for the associated team.
   - `memory_type (VARCHAR)`: Type of memory (e.g., working, episodic).
   - `content (TEXT)`: Detailed content of the agent's memory.
   - `embedding (VECTOR)`: Vector representation of the memory.
   - `context_window (INTEGER)`: Maximum context window size for the memory.
   - `importance_score (FLOAT)`: Importance level (0 to 1).
   - `last_accessed (TIMESTAMP)`: When the memory was last accessed.
   - `access_count (INTEGER)`: Number of times the memory has been accessed.
   - `created_at (TIMESTAMP)`: Timestamp of creation.
   - `updated_at (TIMESTAMP)`: Last updated timestamp.
   - `parent_memory_id (UUID)`: Reference to a parent memory for hierarchical storage.
   - `related_contexts (UUID[])`: Associated contexts for enhanced memory relevance.

## Return Values
Executing the migration will create the specified tables and configure the necessary extensions in the database, which will allow for efficient team memory management and facilitate AI memory contexts.

## Examples
To execute this migration in a PostgreSQL environment, use the following command:

```bash
psql -U <username> -d <database> -f src/lib/database/migrations/20241201_shared_team_memory.sql
```

Once executed, database administrators can verify the creation of the two tables, `team_memory_contexts` and `ai_agent_memories`, and ensure they are ready for use in applications providing shared memory functionality.