# Create Community Event Calendar Component

```markdown
# Community Event Calendar Component

## Purpose
The Community Event Calendar component is designed to display, create, and manage community events. Users can view events by day, week, or month, and interact with the events through a user-friendly interface. This component enables community engagement by allowing users to participate in and organize events seamlessly.

## Usage
To use the `EventCalendar` component, import it into your React application and render it within your desired layout. Ensure that you have the required dependencies installed.

```tsx
import EventCalendar from '@/components/community/event-calendar';

// Inside your component
<EventCalendar />
```

## Parameters/Props
The `EventCalendar` component currently does not accept any external props. It manages its internal state and interactions using React hooks and the React Query library.

### Internal Features
- **Event Fetching**: Automatically fetches events from a Supabase database.
- **Event Creation**: Provides a dialog for users to create new events with fields for title, description, date & time, location, and more.
- **Dynamic Calendar View**: Users can navigate between months and view each day’s events.
- **Responsive Design**: Adapts to various screen sizes to ensure usability on mobile and desktop devices.

## Return Values
The component does not return any values as it manages its own internal state. It renders a calendar UI that visually represents events through a grid layout.

## Example
Here’s a simple example demonstrating the inclusion of the `EventCalendar` component within a functional component:

```tsx
import React from 'react';
import EventCalendar from '@/components/community/event-calendar';

const CommunityPage: React.FC = () => {
    return (
        <div>
            <h1>Community Event Calendar</h1>
            <EventCalendar />
        </div>
    );
};

export default CommunityPage;
```

## Dependencies
- **React**: For creating the component structure.
- **Framer Motion**: For animations and transitions.
- **Date-fns**: For date manipulation functionalities.
- **React Query**: For data fetching and state management with Supabase.
- **UI Components**: Various UI components from your design library such as dialogs, buttons, and inputs.

## Important Notes
- Ensure that the Supabase client is properly configured for data fetching.
- The component relies on user authentication provided by the `useAuth` hook to manage event creation.
- Customize styles and functionality according to your implementation needs by extending or modifying the existing component structure.

This component is a vital part of promoting community involvement through event participation and should align with overall design and functionality goals of your application.
```