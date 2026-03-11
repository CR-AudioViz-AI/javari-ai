# Build Shared Team Workspace API

# Shared Team Workspace API Documentation

## Purpose
The Shared Team Workspace API provides endpoints to create and manage workspaces for teams, allowing for different visibility settings, descriptions, and configurations. It enables users to retrieve workspaces, apply filters, and manage workspace settings effectively.

## Usage
This API can be used in Next.js applications to manage collaborative workspaces. It supports creating new workspaces and retrieving existing workspaces with various filters and sorting options.

## Endpoints

### 1. `GET /api/workspaces`

Retrieves a list of workspaces with optional filtering parameters.

#### Parameters / Props
- **page** (number): The page number for pagination, must be at least 1. Default is 1.
- **limit** (number): The number of workspaces to return per page, must be between 1 and 50. Default is 20.
- **search** (string): An optional search term to filter workspaces by name or description.
- **visibility** (string): Filter workspaces based on visibility. Options: `private`, `team`, `public`.
- **role** (string): Filter workspaces based on user role. Options: `owner`, `admin`, `member`, `viewer`.
- **sort** (string): The property to sort workspaces by. Options: `created_at`, `updated_at`, `name`, `member_count`. Default is `updated_at`.
- **order** (string): Sorting order. Options: `asc` or `desc`. Default is `desc`.

#### Return Values
Returns a JSON object containing:
- **error** (optional): An error message indicating validation issues or API errors.
- **data**: An array of workspaces or an empty array if no workspaces match the filters.

### 2. `POST /api/workspaces` (not fully detailed in the provided code)

Creates a new workspace using the provided data.

#### Request Body (for creating a workspace)
- **name** (string, required): The name of the workspace, must be 1-100 characters.
- **description** (string, optional): A description of the workspace, max 500 characters.
- **visibility** (string, optional): Visibility level for the workspace (`private`, `team`, `public`). Default is `team`.
- **settings** (object, optional): A configuration object for workspace settings, including:
  - **allowGuestAccess** (boolean): Indicates if guest access is allowed. Default is false.
  - **requireApproval** (boolean): Indicates if member approval is needed. Default is true.
  - **enableAIAgents** (boolean): Indicates if AI agents are enabled. Default is true.
  - **maxMembers** (number): Maximum number of members allowed in the workspace, must be 1-100. Default is 50.

#### Return Values
Returns a JSON object with:
- **id**: Unique identifier for the newly created workspace.
- **name**: Name of the workspace created.
- **description**: Description of the workspace (if provided).
- **visibility**: Visibility setting of the workspace.
- **settings**: The settings object provided during creation.

## Examples

### Example Request: Retrieving Workspaces
```http
GET /api/workspaces?page=1&limit=20&search=team
```

### Example Response: Successfully Retrieved Workspaces
```json
{
  "data": [
    {
      "id": "123",
      "name": "Team Alpha",
      "description": "Collaborative workspace for Team Alpha",
      "visibility": "team",
      "settings": {
        "allowGuestAccess": false,
        "requireApproval": true,
        "enableAIAgents": true,
        "maxMembers": 50
      },
      "owner_id": "456",
      "member_count": 10,
      "resource_count": 5,
      "agent_count": 2,
      "created_at": "2023-10-01T12:00:00Z",
      "updated_at": "2023-10-05T12:00:00Z",
      "user_role": "admin",
      "last_activity": null
    }
  ]
}
``` 

This should provide a clear and concise overview of how to interact with the Shared Team Workspace API.