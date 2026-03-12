# Create Interactive Community Map Interface

# CommunityMap Component

## Purpose
The `CommunityMap` component provides an interactive map interface for communities, allowing users to visualize members, groups, events, and projects. It supports features such as location sharing, member connection, group joining, event attendance, and project collaboration.

## Usage
To use the `CommunityMap` component, import it into your desired React file and provide the necessary props. This component leverages the Mapbox API for rendering the map and requires a valid Mapbox access token.

```tsx
import CommunityMap from './src/components/community/CommunityMap';

const App = () => {
  return (
    <CommunityMap
      mapboxToken="YOUR_MAPBOX_ACCESS_TOKEN"
      initialViewState={{
        longitude: -122.4233,
        latitude: 37.8267,
        zoom: 12,
      }}
      members={membersData}
      groups={groupsData}
      events={eventsData}
      projects={projectsData}
      onLocationShare={handleLocationShare}
      onMemberConnect={handleMemberConnect}
      onGroupJoin={handleGroupJoin}
      onEventAttend={handleEventAttend}
      onProjectCollaborate={handleProjectCollaborate}
    />
  );
};
```

## Parameters/Props

- **mapboxToken**: `string`
  - The Mapbox access token required to render the map.

- **initialViewState**: `{ longitude: number, latitude: number, zoom: number }` (optional)
  - Sets the initial position and zoom level of the map.

- **members**: `CommunityMember[]` (optional)
  - An array of community member objects to display on the map.

- **groups**: `CommunityGroup[]` (optional)
  - An array of community group objects to display on the map.

- **events**: `CommunityEvent[]` (optional)
  - An array of events to display on the map.

- **projects**: `CommunityProject[]` (optional)
  - An array of projects to display on the map.

- **onLocationShare**: `(location: GeolocationCoordinates, privacyLevel: PrivacyLevel) => void` (optional)
  - Callback function triggered when the user shares their location.

- **onMemberConnect**: `(memberId: string) => void` (optional)
  - Callback function triggered to connect with a member.

- **onGroupJoin**: `(groupId: string) => void` (optional)
  - Callback function triggered to join a group.

- **onEventAttend**: `(eventId: string) => void` (optional)
  - Callback function triggered to attend an event.

- **onProjectCollaborate**: `(projectId: string) => void` (optional)
  - Callback function triggered to collaborate on a project.

## Return Values
The component does not return any values. It directly renders a map along with interactive markers and controls based on the provided data and user actions.

## Examples
```tsx
const membersData = [
  { id: '1', name: 'John Doe', coordinates: { longitude: -122.4231, latitude: 37.8268 } },
  // ...other members
];

const groupsData = [
  { id: 'g1', name: 'Running Club', coordinates: { longitude: -122.4235, latitude: 37.8265 } },
  // ...other groups
];

// Example for handling location share
const handleLocationShare = (location, privacyLevel) => {
  console.log('Location shared:', location, 'Privacy Level:', privacyLevel);
};
```

This component integrates numerous UI elements for a cohesive user experience, making it a powerful tool for community engagement through interactive mapping.