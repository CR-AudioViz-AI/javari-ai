# Implement Shared Team Context Service

```markdown
# Shared Team Context Service

## Purpose
The Shared Team Context Service provides a structured way to manage and store shared contexts among team members. This service allows teams to organize insights, decisions, observations, goals, constraints, and resources in a collaborative environment, enhancing knowledge sharing and decision-making processes.

## Usage
To use the Shared Team Context Service, run the provided SQL script to set up the necessary database structure, including required extensions, enums, and tables. This setup supports semantic search and contextual memory features for team contexts.

## Parameters/Props

- **Extensions**: 
  - `pgvector`: Required for handling vector embeddings.
  - `uuid-ossp`: Required for generating universally unique identifiers (UUIDs).

- **Enum Types**:
  - `context_entry_type`: Contains values ('observation', 'decision', 'insight', 'goal', 'constraint', 'resource').
  - `decision_status`: Contains values ('proposed', 'approved', 'rejected', 'implemented', 'superseded').
  - `access_pattern_type`: Contains values ('semantic_search', 'temporal_query', 'decision_lookup', 'agent_memory').

- **Tables**:
  - `team_contexts`: Stores metadata about shared contexts (team ID, name, description, etc.).
    - **Fields**:
      - `id`: UUID, primary key.
      - `team_id`: UUID, foreign key referencing the team.
      - `name`: VARCHAR(255), unique context name.
      - `description`: TEXT, context detail.
      - `created_at`: TIMESTAMP, entry creation time.
      - `updated_at`: TIMESTAMP, last update time.
      - `created_by`: UUID, user who created the context.
      - `metadata`: JSONB, additional context data.
      - `is_active`: BOOLEAN, context activity status.
      - `version`: INTEGER, version control.
      - `embedding_model`: VARCHAR(100), model used for embeddings.
      - `context_window_size`: INTEGER, size of context window.
      - `max_entries`: INTEGER, maximum entries allowed.
      - `retention_days`: INTEGER, days to retain entries.

  - `context_entries`: Contains entries related to each team context.
    - **Fields**:
      - `id`: UUID, primary key.
      - `team_context_id`: UUID, foreign key referencing `team_contexts.id`.
      - `agent_id`: UUID, identifier for the contributing agent.
      - `entry_type`: ENUM, type of context entry.
      - `title`: VARCHAR(500), title of the entry.
      - `content`: TEXT, content of the entry.
      - `embedding`: Vector(1536), embedding for semantic search.
      - `created_at`: TIMESTAMP, entry creation time.
      - `updated_at`: TIMESTAMP, last updated time.

## Return Values
The SQL script does not return values directly; rather, it sets up the database schema for the Shared Team Context Service. Once executed, teams can utilize the defined structures for storing and retrieving contextual data as needed.

## Examples
To create shared contexts and entries, execute the following SQL commands:

```sql
INSERT INTO team_contexts (team_id, name, description, created_by) 
VALUES ('<team-uuid>', 'Project A Context', 'Context for project A discussions.', '<user-uuid>');

INSERT INTO context_entries (team_context_id, agent_id, entry_type, title, content) 
VALUES ('<context-uuid>', '<agent-uuid>', 'decision', 'Decision on Budget', 'Approved budget for Q2.');
```

This documentation provides a foundational understanding of the Shared Team Context Service's implementation details and structure within the database.
```