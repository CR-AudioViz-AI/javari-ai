# Build Community Event Management API

# Community Event Management API Documentation

## Purpose
The Community Event Management API facilitates the creation, modification, registration, and analytics tracking of community events. It is designed for developers to integrate event management functionalities within their applications seamlessly.

## Usage
The API offers endpoints to create, update, register for events, and collect analytics data by following the specified schemas for data validation. It utilizes the `supabase` database to store event information and the `Resend` service for notification handling.

## Parameters/Props

### Schemas

- **createEventSchema**: Validates event creation data.
  - `title`: `string` - Must be 1-255 characters long.
  - `description`: `string` - Max 2000 characters.
  - `type`: `enum` - ['webinar', 'workshop', 'networking', 'hybrid'].
  - `start_time`: `datetime` - Start time of the event.
  - `end_time`: `datetime` - End time of the event.
  - `timezone`: `string` - Timezone of the event.
  - `max_attendees`: `integer` - Optional, positive integer for attendee limits.
  - `is_public`: `boolean` - Defaults to `true`.
  - `registration_deadline`: `datetime` - Optional deadline for registration.
  - `meeting_url`: `string` - Optional URL for the meeting.
  - `meeting_platform`: `enum` - Optional, ['zoom', 'teams', 'meet', 'custom'].
  - `tags`: `array` - Optional list of strings (max length: 10).
  - `metadata`: `record` - Optional additional event data.
  - `price`: `number` - Defaults to `0`, must be non-negative.
  - `currency`: `string` - Defaults to 'USD', must be 3 characters long.

- **updateEventSchema**: Same as `createEventSchema`, but partial (optional fields).

- **registerEventSchema**: Validates user registration data for events.
  - `user_notes`: `string` - Optional personal notes up to 500 characters.
  - `dietary_requirements`: `string` - Optional requirements up to 200 characters.
  - `emergency_contact`: `string` - Optional contact info up to 100 characters.

- **analyticsSchema**: Validates event analytics data.
  - `event_id`: `uuid` - Identifier for the event.
  - `user_id`: `uuid` - Optional user identifier.
  - `action`: `enum` - ['view', 'register', 'join', 'leave', 'interact', 'complete'].
  - `metadata`: `record` - Optional additional analytics data.
  - `timestamp`: `datetime` - Optional timestamp of the action.

## Return Values
The API returns responses based on the operation:
- **Create/Update Event**: Success or error messages along with event data.
- **Register for Event**: Confirmation or error messages related to registration status.
- **Analytics Tracking**: Acknowledgment of the action logged.

## Examples

### Create Event
```javascript
const eventData = {
  title: "Community Workshop",
  description: "An interactive workshop on community building.",
  type: "workshop",
  start_time: "2023-10-30T10:00:00Z",
  end_time: "2023-10-30T12:00:00Z",
  timezone: "UTC",
  max_attendees: 50,
  is_public: true,
  tags: ["workshop", "community"],
};

const userId = "user-uuid"; // Replace with actual user UUID
const response = await eventManager.createEvent(eventData, userId);
```

### Register for Event
```javascript
const registrationData = {
  user_notes: "Looking forward to the event!",
  dietary_requirements: "Vegetarian",
};

const eventId = "event-uuid"; // Replace with actual event UUID
const response = await eventManager.registerEvent(eventId, registrationData);
```

This concise API documentation provides everything you need to integrate and utilize the Community Event Management API effectively.