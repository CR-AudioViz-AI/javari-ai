# Deploy Community Event Management Platform

# Community Event Management Platform Service

## Purpose
The Community Event Management Platform Service is designed to facilitate the management of community events, including the creation of events, RSVP management, integration with calendar services (Google Calendar and Outlook), and attendance tracking for workshops, webinars, and networking sessions.

## Usage
Import the `EventService` class from the module and instantiate it. You can use its methods to create events, manage RSVPs, and handle notifications.

```typescript
import { EventService } from './src/services/community-events/index';

const eventService = new EventService();
```

## Parameters/Props

### Event Object
The `Event` object must contain the following fields:

- `id: string` - Unique identifier for the event.
- `title: string` - Title of the event.
- `description: string` - Description of the event.
- `date: string` - Date of the event (ISO 8601 format).
- `location: string` - Physical or virtual location of the event.
- `attendees: Attendee[]` - List of attendees for the event.

### RSVP Object
The `RSVP` object includes:

- `eventId: string` - The ID of the event for which the RSVP is made.
- `userId: string` - The ID of the user responding to the RSVP.
- `status: 'going' | 'maybe' | 'not going'` - The response status for the event.

### Attendee Object
The `Attendee` object contains:

- `id: string` - Unique identifier of the attendee.
- `name: string` - Name of the attendee.
- `email: string` - Email address of the attendee.

### User Object
The `User` object includes:

- `id: string` - Unique identifier for the user.
- `name: string` - Name of the user.
- `email: string` - Email address of the user.

## Return Values
The `createEvent` method returns a Promise that resolves to the created `Event` object if the event is successfully created, or throws an error if the creation fails.

## Examples

### Creating an Event

```typescript
const newEvent = {
  id: '1',
  title: 'Community Workshop',
  description: 'A workshop about community building.',
  date: '2023-11-20T10:00:00Z',
  location: 'Online',
  attendees: [],
};

eventService.createEvent(newEvent)
  .then(event => console.log('Event Created:', event))
  .catch(error => console.error('Error Creating Event:', error.message));
```

### RSVP for an Event

Use appropriate methods (not shown in the provided code) to handle RSVPs, assuming they follow a similar structure.

## Note
Ensure that you replace the `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your actual Supabase project credentials and configure calendar services as needed. The service utilizes external APIs for functionality; correct setup and permissions are necessary for seamless operation.