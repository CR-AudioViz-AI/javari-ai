# Build Shared Team Memory API

# Shared Team Memory API Documentation

## Purpose
The Shared Team Memory API provides endpoints for managing memories within a collaborative team environment. It allows users to create, retrieve, and manage memories with various attributes, facilitating better knowledge sharing and context within a team.

## Usage
The API is designed to be integrated into applications that require shared memory functionality, supporting memory entries that include content, type, tags, privacy levels, and expiration dates. 

## Endpoints
### 1. Create Memory
**POST /api/team-memory**

Creates a new memory entry.

#### Parameters
- **content (string)**: The content of the memory (1-10000 characters).
- **type (string)**: The type of memory. Must be one of: `learning`, `context`, `decision`, `insight`, `reference`.
- **tags (array)**: An optional array of tags associated with the memory (default: `[]`).
- **privacy_level (string)**: The privacy setting of the memory. Must be one of: `public`, `team`, `private` (default: `team`).
- **project_id (string)**: An optional UUID associated with a project.
- **metadata (object)**: An optional object for additional metadata (default: `{}`).
- **expires_at (string)**: An optional expiration date in ISO format.

#### Return Values
- **201 Created**: On successful memory creation, it returns the created memory data.
- **400 Bad Request**: If validation fails.

### 2. Get Memories
**GET /api/team-memory**

Retrieves a list of memories based on specified filters.

#### Parameters
- **limit (number)**: Number of memories to return (1-100, default: `20`).
- **offset (number)**: Number of memories to skip for pagination (default: `0`).
- **type (string)**: Optional filter for memory type.
- **project_id (string)**: Optional filter for project UUID.
- **privacy_level (string)**: Optional filter for privacy level.
- **include_expired (boolean)**: Whether to include expired memories (default: `false`).

#### Return Values
- **200 OK**: Returns an array of memory objects matching the query.
- **400 Bad Request**: If validation fails.

## Examples
### Creating a Memory Example
```json
POST /api/team-memory
{
  "content": "We decided on using a new framework for the project.",
  "type": "decision",
  "tags": ["project", "decision", "framework"],
  "privacy_level": "team",
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "metadata": {"author": "John Doe"},
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### Getting Memories Example
```json
GET /api/team-memory?limit=10&offset=0&type=decision&privacy_level=team
```

This call retrieves up to 10 decision-type memories that are set to team privacy.

## Dependencies
- **Supabase**: For database interactions.
- **OpenAI**: For generating embeddings related to memory content.
- **Zod**: For request validation.

This documentation provides the necessary information to effectively utilize the Shared Team Memory API for collaborative memory management.