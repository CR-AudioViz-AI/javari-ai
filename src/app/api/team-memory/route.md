# Create Shared Team Memory API

# Shared Team Memory API Documentation

## Purpose
The Shared Team Memory API facilitates the creation, retrieval, and consolidation of team memory entries, enabling teams to store and access shared knowledge effectively. It leverages OpenAI for generating embeddings to support semantic search capabilities.

## Usage
This API can be used to:
- Create new memory entries for a team
- Retrieve existing memory entries based on context and tags
- Consolidate multiple memory entries into a single entry

## Endpoints
- **POST** `/api/team-memory/create` - Create new team memory
- **GET** `/api/team-memory/retrieve` - Retrieve team memory
- **POST** `/api/team-memory/consolidate` - Consolidate multiple team memories

## Parameters/Props

### 1. Create Memory (`createMemory`)
- `team_id` (string, required): Unique identifier for the team (UUID).
- `content` (string, required): Content of the memory (1-10,000 characters).
- `context` (string, optional): Additional context for the memory.
- `tags` (array of strings, optional): Tags associated with the memory.
- `metadata` (object, optional): Any additional metadata key-value pairs.
- `priority` (string, optional): Priority level of the memory. Defaults to `medium`. Possible values are `low`, `medium`, or `high`.

### 2. Retrieve Memory (`retrieveMemory`)
- `team_id` (string, required): Unique identifier for the team (UUID).
- `context` (string, optional): Context for filtering results.
- `limit` (number, optional): Maximum number of results to return. Defaults to 10, limited between 1 and 100.
- `similarity_threshold` (number, optional): Minimum similarity score for retrieved memories. Defaults to 0.7, between 0 and 1.
- `tags` (string, optional): Comma-separated list of tags to filter memories.

### 3. Consolidate Memory (`consolidateMemory`)
- `team_id` (string, required): Unique identifier for the team (UUID).
- `memory_ids` (array of strings, required): List of memory IDs to consolidate (UUIDs).
- `strategy` (string, optional): Strategy for consolidation. Defaults to `merge`. Possible values: `merge`, `hierarchical`, `temporal`.

## Return Values
The API returns responses based on the operation performed:
- For creation and consolidation, it returns the created or consolidated memory record.
- For retrieval, it returns a list of memory entries that match the query parameters.

## Examples

### Create Memory
```http
POST /api/team-memory/create
Content-Type: application/json

{
  "team_id": "a3c8c4f0-c64f-4c71-a9a8-31b0d9e4dbe3",
  "content": "Team meeting notes from April 2023.",
  "context": "Meeting Notes",
  "tags": ["meeting", "notes"],
  "metadata": {"author": "John Doe"},
  "priority": "high"
}
```

### Retrieve Memory
```http
GET /api/team-memory/retrieve?team_id=a3c8c4f0-c64f-4c71-a9a8-31b0d9e4dbe3&limit=5&similarity_threshold=0.8
```

### Consolidate Memory
```http
POST /api/team-memory/consolidate
Content-Type: application/json

{
  "team_id": "a3c8c4f0-c64f-4c71-a9a8-31b0d9e4dbe3",
  "memory_ids": ["f67d2b02-d53f-42f3-9a3c-5941e781b03c", "b7b1152e-ff30-498c-b999-abfc774ba843"],
  "strategy": "merge"
}
```