# Implement Shared Team Memory API

# Shared Team Memory API Documentation

## Purpose
The Shared Team Memory API allows teams to create, update, and search for memory entries that encapsulate important information, decisions, learnings, and references. This API is integrated with Supabase for data storage and OpenAI for potential content generation or analysis.

## Usage
The API is exposed through HTTP methods to handle the creation, updating, and searching of team memory entries. It is intended for use in collaborative environments, supporting the organization and retrieval of team knowledge.

## Parameters/Props

### Environment Variables
- `SUPABASE_URL`: URL for Supabase instance.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for database operations.
- `OPENAI_API_KEY`: Key for OpenAI API access.

### Create Memory
#### Request Body (JSON)
- `title` (string, required): The title of the memory (1-200 characters).
- `content` (string, required): Content of the memory (1-10,000 characters).
- `category` (enum, required): Type of memory (options: decision, learning, context, process, insight, reference).
- `tags` (array of strings, optional): Tags associated with the memory (up to 20).
- `metadata` (object, optional): Additional metadata related to the memory.
- `team_id` (string, required): UUID of the team creating the memory.
- `priority` (enum, optional): Priority level of the memory (options: low, medium, high, defaults to medium).

### Update Memory
#### Request Body (JSON)
- Same parameters as "Create Memory" but `team_id` is omitted as it cannot be modified.

### Search Memory
#### Request Body (JSON)
- `query` (string, required): Search term (1-500 characters).
- `team_id` (string, required): UUID of the team.
- `category` (enum, optional): Category filter for search.
- `tags` (array of strings, optional): Tags filter for search.
- `limit` (number, optional): Maximum number of results (1-50, defaults to 20).
- `threshold` (number, optional): Minimum threshold for relevance (0-1, defaults to 0.7).

## Return Values
- **Create Memory / Update Memory**: Returns the created or updated memory entry, including its ID and timestamps.
- **Search Memory**: Returns an array of matching memory entries along with metadata including relevance scores.

## Example

### Create Memory
```json
POST /api/team/memory
{
  "title": "Team Decision on Project X",
  "content": "We decided to move forward with Project X, allocating resources to the development team.",
  "category": "decision",
  "tags": ["project", "decision", "2023"],
  "team_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Update Memory
```json
PATCH /api/team/memory/{memory_id}
{
  "content": "Updated decision to include additional resources for the marketing team.",
  "priority": "high"
}
```

### Search Memory
```json
POST /api/team/memory/search
{
  "query": "Project X",
  "team_id": "123e4567-e89b-12d3-a456-426614174000",
  "limit": 10
}
```

This API is a powerful tool for teams to efficiently capture and retrieve their collective knowledge, ensuring nothing important is lost over time.