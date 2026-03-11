# Build Virtual Event Management Service

# Virtual Event Management Service

## Purpose
The Virtual Event Management Service provides an API for managing virtual events including the creation, registration, and tracking of events, participants, and their statuses. It integrates with Supabase for backend data management.

## Usage
This service is intended for web and mobile applications that require functionalities related to event management. It allows users to create events, manage attendees, and track various statuses related to events and registrations.

### Importing the Service
To use this service, import the necessary types and enums from the module:

```typescript
import { Event, EventRegistration, EventAttendance, EventType, EventStatus, RegistrationStatus, RecurrencePattern } from 'src/lib/services/virtual-events';
```

## Parameters/Props

### Event Interface
Represents an event with the following properties:
- `id: string` - Unique identifier for the event.
- `title: string` - Title of the event.
- `description: string` - Detailed description of the event.
- `type: EventType` - Type of the event (e.g., webinar, workshop).
- `status: EventStatus` - Current status of the event (e.g., published, cancelled).
- `start_time: string` - ISO string representing the event start time.
- `end_time: string` - ISO string representing the event end time.
- `timezone: string` - Timezone for the event times.
- `capacity: number` - Maximum number of attendees.
- `registered_count: number` - Count of registered participants.
- `waitlist_count: number` - Count of participants on the waitlist.
- `is_paid: boolean` - Indicates if the event is a paid event.
- `price?: number` - Price for attending the event (optional).
- `currency?: string` - Currency for the price (optional).
- `location_type: 'online' | 'hybrid' | 'physical'` - Type of event location.
- `meeting_url?: string` - URL for online meetings (optional).
- `meeting_id?: string` - ID for the meeting (optional).
- `meeting_password?: string` - Password for the meeting (optional).
- `tags: string[]` - List of tags associated with the event.
- `organizer_id: string` - Identifier for the event organizer.
- `series_id?: string` - Identifier for a series of events (optional).
- `created_at: string` - Timestamp of when the event was created.
- `updated_at: string` - Timestamp of the last update to the event.

### EventRegistration Interface
Represents registration for an event with these properties:
- `id: string` - Unique identifier for the registration.
- `event_id: string` - Identifier for the associated event.
- `user_id: string` - Identifier for the registered user.
- `status: RegistrationStatus` - Current status of the registration.
- `registered_at: string` - Timestamp of registration.
- `cancelled_at?: string` - Timestamp of cancellation (optional).
- `payment_status?: 'pending' | 'completed' | 'failed'` - Payment status of the registration (optional).
- `payment_id?: string` - Identifier for payment processing (optional).
- `waitlist_position?: number` - Position on the waitlist if applicable (optional).

### EventAttendance Interface
Represents attendance at an event with these properties:
- `id: string` - Unique identifier for the attendance record.
- `event_id: string` - Identifier for the associated event.
- `user_id: string` - Identifier for the user attending.
- `joined_at: string` - Timestamp of when the user joined the event.

## Return Values
The service may return:
- Successfully created or updated event/registration objects.
- Status messages indicating success or failure for operations.
- Error messages for validation or processing issues.

## Examples

### Creating an Event
```typescript
const event: Event = {
  id: 'event-123',
  title: 'Tech Conference 2023',
  description: 'Annual tech conference focusing on new technologies.',
  type: EventType.CONFERENCE,
  status: EventStatus.PUBLISHED,
  start_time: '2023-09-01T09:00:00Z',
  end_time: '2023-09-01T17:00:00Z',
  timezone: 'UTC',
  capacity: 1000,
  registered_count: 500,
  waitlist_count: 50,
  is_paid: true,
  price: 199.99,
  currency: 'USD',
  location_type: 'online',
  meeting_url: 'https://example.com/meeting',
  tags: ['tech', 'conference', 'networking'],
  organizer_id: 'org-xyz',
  created_at: new Date().toISOString(),
  updated_at: