# Create Virtual Event Streaming API

```markdown
# Virtual Event Streaming API Documentation

## Purpose
The Virtual Event Streaming API facilitates the creation, management, and interaction within virtual events. It enables users to create events, join existing events, perform streaming actions, and interact with other participants.

## Usage
The API is implemented within the route `app/api/v1/events/streaming/route.ts` and primarily handles HTTP requests related to event streaming functionalities including creation, joining, and managing event statuses.

## Parameters / Props

### 1. Event Creation
- **Request Body:**
```json
{
  "title": "string (required)",
  "description": "string (optional, max 1000 characters)",
  "scheduledAt": "string (required, ISO 8601 datetime)",
  "duration": "number (required, min 5 max 480 minutes)",
  "maxParticipants": "number (required, min 1 max 10000)",
  "isPrivate": "boolean (optional, default: false)",
  "features": {
    "chat": "boolean (optional, default: true)",
    "polls": "boolean (optional, default: false)",
    "handRaise": "boolean (optional, default: false)",
    "breakoutRooms": "boolean (optional, default: false)",
    "recording": "boolean (optional, default: false)",
    "screenShare": "boolean (optional, default: false)"
  }
}
```

### 2. Joining an Event
- **Request Body:**
```json
{
  "eventId": "string (required, UUID format)",
  "displayName": "string (required, min 1 max 50 characters)",
  "role": "string (optional, options: ['host', 'presenter', 'participant'], default: 'participant')"
}
```

### 3. Stream Actions
- **Request Body:**
```json
{
  "action": "string (required, options: ['start', 'stop', 'pause', 'resume', 'updateQuality'])",
  "eventId": "string (required, UUID format)",
  "streamId": "string (optional)",
  "quality": "string (optional, options: ['360p', '720p', '1080p'])"
}
```

### 4. Interactions
- **Request Body:**
```json
{
  "eventId": "string (required, UUID format)",
  "type": "string (required, options: ['chat', 'poll', 'handRaise', 'reaction'])",
  "data": "object (required, arbitrary data structure)"
}
```

## Return Values
The API typically returns a JSON response indicating the success or failure of the requested operation along with relevant data:
- Success responses will include event details or status messages.
- Error responses will specify the error type and message, facilitating debugging.

## Examples

### Create an Event
Request:
```json
POST /api/v1/events/streaming
{
  "title": "Virtual Conference 2023",
  "description": "A conference about latest trends in technology.",
  "scheduledAt": "2023-10-20T14:00:00Z",
  "duration": 120,
  "maxParticipants": 500,
  "isPrivate": false,
  "features": {
    "chat": true,
    "polls": false,
    "handRaise": true,
    "breakoutRooms": false,
    "recording": true,
    "screenShare": true
  }
}
```

### Join an Event
Request:
```json
POST /api/v1/events/streaming/join
{
  "eventId": "a4b2c0d8-e021-4872-8d3e-d3a1c56fe5f5",
  "displayName": "John Doe",
  "role": "participant"
}
```

### Stream Action
Request:
```json
POST /api/v1/events/streaming/action
{
  "action": "start",
  "eventId": "a4b2c0d8-e021-4872-8d3e-d3a1c56fe5f5"
}
```
```