# Build Virtual Event Management API

# Virtual Event Management API

## Purpose
The Virtual Event Management API facilitates the creation, updating, and management of virtual events, handling registrations and attendance tracking. It utilizes the Supabase database for backend storage and provides validation through schemas defined with the Zod library.

## Usage
This API can be utilized in applications requiring event scheduling, management of participant registrations, and attendance tracking. It is built as a server-side endpoint in a Next.js application.

## Endpoints

### Create Event
**POST /api/events**

Creates a new event.

#### Parameters
- **title**: `string` (1-200 characters) - The event title.
- **description**: `string` (1-2000 characters) - The event description.
- **start_time**: `string` (datetime format) - The event start time.
- **end_time**: `string` (datetime format) - The event end time.
- **timezone**: `string` (max 50 characters) - The timezone for the event.
- **max_participants**: `number` (1-10000) - Maximum participants allowed.
- **is_public**: `boolean` (optional) - Event visibility, defaults to `true`.
- **tags**: `array of strings` (max 20 items, 50 characters each, optional) - Tags associated with the event.
- **meeting_url**: `string` (url, optional) - URL for the meeting.
- **registration_required**: `boolean` (optional) - Indicates if registration is necessary, defaults to `false`.
- **event_type**: `enum` - Type of event (`webinar`, `workshop`, `meeting`, `conference`, `social`).
- **cover_image_url**: `string` (url, optional) - URL for the event cover image.

#### Return Values
- **201 Created**: On successful event creation, the API returns the created event object.
- **400 Bad Request**: If validation fails.

### Update Event
**PATCH /api/events**

Updates an existing event.

#### Parameters
- Accepts all fields defined in `EventCreateSchema`, with all properties being optional.

#### Return Values
- **200 OK**: On successful event update, the API returns the updated event object.
- **400 Bad Request**: If validation fails.

### Register for Event
**POST /api/events/register**

Register a user for an event.

#### Parameters
- **event_id**: `string` (UUID) - The ID of the event to register for.
- **additional_info**: `string` (max 500 characters, optional) - Additional details from the registrant.

#### Return Values
- **201 Created**: On successful registration, returns the registration object.
- **400 Bad Request**: If validation fails.

### Attendance Tracking
**POST /api/events/attendance**

Track attendance for an event.

#### Parameters
- **event_id**: `string` (UUID) - The ID of the event.
- **session_duration**: `number` (integer, optional) - Duration of the session attended in minutes.

#### Return Values
- **200 OK**: On successful attendance tracking.
- **400 Bad Request**: If validation fails.

## Examples

### Creating an Event Example
```json
{
  "title": "Monthly Webinar",
  "description": "An informative webinar on industry trends.",
  "start_time": "2023-10-25T10:00:00Z",
  "end_time": "2023-10-25T11:00:00Z",
  "timezone": "UTC",
  "max_participants": 100,
  "event_type": "webinar"
}
```

### Register for an Event Example
```json
{
  "event_id": "74bfc9e6-e665-4f67-b4f5-830180f1ef5c",
  "additional_info": "Looking forward to this event!"
}
``` 

This documentation outlines the core functionality and usage of the Virtual Event Management API, including the endpoint structure, parameters, and return values. Use the provided examples as guidance for implementing requests.