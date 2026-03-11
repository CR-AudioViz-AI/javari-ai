# Build Virtual Event Management API

```markdown
# Virtual Event Management API

## Purpose
The Virtual Event Management API provides endpoints for creating, updating, and managing events in an online environment. It supports various event types, ticketing options, and participant roles. The API integrates with external services such as Supabase for data storage, Pusher for real-time notifications, Stripe for payment handling, and Redis for caching.

## Usage
This API can be used to manage virtual events by creating new events, updating existing ones, and handling participant interactions. Ideal for platforms hosting events like concerts, conferences, and workshops.

### Base URL
```
/api/craiverse/events
```

## Parameters / Props

### Event Creation Parameters
- **title**: `string` (min: 1, max: 200) - Title of the event.
- **description**: `string` (min: 10, max: 2000) - Description of the event.
- **event_type**: `enum` - Type of the event (`concert`, `conference`, `meetup`, `workshop`, `panel`).
- **start_time**: `string` (datetime) - Event start time.
- **end_time**: `string` (datetime) - Event end time.
- **max_participants**: `number` (optional, min: 1, max: 10000) - Maximum participants allowed.
- **is_private**: `boolean` (default: false) - Event privacy status.
- **requires_tickets**: `boolean` (default: false) - Whether tickets are required.
- **ticket_price**: `number` (optional, min: 0) - Price of the ticket.
- **venue_type**: `enum` - Type of venue (`audio_room`, `video_conference`, `hybrid`, `live_stream`).
- **tags**: `array` of `string` (optional, max: 10) - Event tags.
- **cover_image_url**: `string` (optional, url) - URL of the event cover image.
- **streaming_platform**: `enum` (optional) - Streaming platform used (`zoom`, `twilio`, `custom`).
- **moderation_settings**: `object` (optional) - Settings related to event moderation.
  
### Event Update Parameters
- Same as **Event Creation Parameters**, but all fields are optional.

### Participant Join Parameters
- **user_id**: `string` (UUID) - Unique identifier for the user.
- **role**: `enum` (default: `attendee`) - Role of the participant (`attendee`, `speaker`, `moderator`).
- **ticket_id**: `string` (optional, UUID) - Identifier of the ticket if required.

## Return Values
Returns a response object containing:
- **status**:`boolean` - Indicates success or failure of the request.
- **message**: `string` - Provides additional context about the request outcome.
- **data**: `object` (for successful creation/update) - Contains the created or updated event details or participant info.

## Examples

### Creating an Event
```json
POST /api/craiverse/events
{
    "title": "Dev Conference 2023",
    "description": "Annual conference for developers.",
    "event_type": "conference",
    "start_time": "2023-11-01T10:00:00Z",
    "end_time": "2023-11-01T17:00:00Z",
    "max_participants": 500,
    "is_private": false,
    "requires_tickets": true,
    "ticket_price": 20,
    "venue_type": "video_conference"
}
```

### Updating an Event
```json
PATCH /api/craiverse/events/{event_id}
{
    "ticket_price": 25,
    "max_participants": 600
}
```

### Joining an Event
```json
POST /api/craiverse/events/{event_id}/join
{
    "user_id": "a0eebd2c-e7c8-4e21-9998-60b20e18b210",
    "role": "speaker"
}
```
```