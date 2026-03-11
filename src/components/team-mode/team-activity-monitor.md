# Build Real-Time Team Activity Monitor Component

# Team Activity Monitor Component

## Purpose
The **Team Activity Monitor** component is designed to provide real-time insights into team activities within a collaborative environment. It tracks various activities performed by agents, including tasks started, completed, communications, and status changes. The component supports filtering and metrics visualization to enhance the management of team performance.

## Usage
To use the `TeamActivityMonitor` component, import it into your desired file and render it with the required props.

```tsx
import TeamActivityMonitor from '@/components/team-mode/team-activity-monitor';

const MyComponent = () => {
  return (
    <TeamActivityMonitor
      teamId="your-team-id"
      className="custom-class"
      maxActivities={50}
      showFilters={true}
      showMetrics={true}
      autoRefresh={true}
      refreshInterval={30000}
    />
  );
};
```

## Parameters/Props

| Prop Name         | Type                 | Description                                                  |
|-------------------|----------------------|--------------------------------------------------------------|
| `teamId`          | `string`             | Unique identifier for the team.                             |
| `className`       | `string` (optional)  | Additional CSS classes for custom styling.                  |
| `maxActivities`   | `number` (optional)  | Maximum number of activities to display. Default is unlimited.|
| `showFilters`     | `boolean` (optional) | If true, shows filtering options. Default is false.         |
| `showMetrics`     | `boolean` (optional) | If true, displays overall team metrics. Default is false.   |
| `autoRefresh`     | `boolean` (optional) | If true, enables automatic refresh of activities. Default is false. |
| `refreshInterval` | `number` (optional)  | Interval in milliseconds for auto-refresh. Default is 30000 (30 seconds). |

## Return Values
The component does not return any values explicitly. It renders a UI that displays:
- A list of recent team activities, including agents and actions.
- Optional filtering controls.
- Optional metrics summarizing team performance.

## Examples
### Basic Example
```tsx
<TeamActivityMonitor teamId="team-1" />
```

### With Custom Maximum Activities and Metrics
```tsx
<TeamActivityMonitor 
  teamId="team-2" 
  maxActivities={20} 
  showMetrics={true} 
/>
```

### Using Filters and Auto-Refresh
```tsx
<TeamActivityMonitor 
  teamId="team-3" 
  showFilters={true} 
  autoRefresh={true} 
  refreshInterval={15000} 
/>
```

This component helps teams to closely monitor their activities and fosters better communication and productivity. Make sure to replace any mock data handling with actual implementations tailored to your application's needs.