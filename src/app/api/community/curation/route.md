# Build Community Content Curation API

# Community Content Curation API Documentation

## Purpose
The Community Content Curation API facilitates the submission, moderation, and querying of community-generated content. It provides endpoints for users to submit content, manage its status through moderation workflows, and retrieve content based on various filtering criteria.

## Usage
This API is built using Next.js and can be accessed via HTTP requests. It utilizes middleware for rate limiting and authentication verification, ensuring secure and efficient interactions.

## Parameters / Props

### Submit Content
- **Endpoint**: `POST /api/community/curation/submit`
- **Request Body**:
  - `title` (string): Title of the content (5-200 characters).
  - `description` (string): Description of the content (10-2000 characters).
  - `content_type` (enum): Type of content (options: `'audio'`, `'preset'`, `'tutorial'`, `'template'`).
  - `content_url` (string): URL to the content (valid URL format).
  - `tags` (array): Array of tags associated with the content (max 10, each tag max 50 characters).
  - `category_id` (string): UUID of the category.
  - `metadata` (object): Additional optional metadata.

### Moderate Content
- **Endpoint**: `POST /api/community/curation/moderate`
- **Request Body**:
  - `content_id` (string): UUID of the content.
  - `action` (enum): Moderation action (options: `'approve'`, `'reject'`, `'flag'`, `'request_changes'`).
  - `reason` (string): Optional reason for moderation action (max 500 characters).
  - `feedback` (string): Optional feedback for the user (max 1000 characters).

### Query Content
- **Endpoint**: `GET /api/community/curation/query`
- **Query Parameters**:
  - `status` (enum): Filter by content status (options: `'pending'`, `'approved'`, `'rejected'`, `'flagged'`).
  - `content_type` (enum): Filter by content type.
  - `category_id` (string): UUID of the category (optional).
  - `user_id` (string): UUID of the user (optional).
  - `page` (integer): Page number for pagination (default: 1).
  - `limit` (integer): Number of results per page (default: 20, max: 100).
  - `sort` (enum): Sort by criteria (options: `'created_at'`, `'quality_score'`, `'popularity'`, default: `'created_at'`).

## Return Values
The API returns JSON responses for each endpoint:
- Success: Returns the created, moderated, or queried content along with appropriate status codes.
- Error: Returns error codes and messages in case of validation failures or server errors.

## Examples

### Submit Content Example
```json
POST /api/community/curation/submit
{
  "title": "My Awesome Tutorial",
  "description": "A comprehensive guide to audio editing.",
  "content_type": "tutorial",
  "content_url": "https://example.com/my-awesome-tutorial",
  "tags": ["audio", "editing", "tutorial"],
  "category_id": "b2c65f3f-fb76-474e-bdc8-0678d48b8aa8"
}
```

### Moderate Content Example
```json
POST /api/community/curation/moderate
{
  "content_id": "476f36b7-62f0-414c-b4f2-361cc8257a8d",
  "action": "approve",
  "reason": "Content meets all community guidelines.",
  "feedback": "Great work!"
}
```

### Query Content Example
```json
GET /api/community/curation/query?page=1&limit=10&status=approved
```
This example retrieves a paginated list of approved content from the API.