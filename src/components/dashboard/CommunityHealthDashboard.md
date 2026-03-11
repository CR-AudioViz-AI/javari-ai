# Create Interactive Community Health Dashboard

# Community Health Dashboard Component Documentation

## Purpose

The `CommunityHealthDashboard` component is an interactive dashboard designed to visualize community health metrics and engagement statistics. It aggregates key performance indicators (KPIs), including growth data, engagement insights, and community metrics, facilitating real-time analysis and decision-making.

## Usage

To use the `CommunityHealthDashboard` in your React application, import the component and include it in your JSX. Ensure that the necessary data is available to populate the dashboard metrics.

```tsx
import CommunityHealthDashboard from '@/components/dashboard/CommunityHealthDashboard';

function App() {
  return (
    <div>
      <CommunityHealthDashboard />
    </div>
  );
}
```

## Parameters/Props

The `CommunityHealthDashboard` component accepts the following props:

- **metrics** (`CommunityMetric[]`): An array of community metrics that you wish to display.
- **engagementData** (`EngagementData[]`): Historical data related to user engagement.
- **growthData** (`GrowthData[]`): Data regarding the growth of community members over time.

### Interfaces

1. **CommunityMetric**
   - `id`: Unique identifier for the metric (string).
   - `name`: Display name for the metric (string).
   - `value`: Current value of the metric (number).
   - `previousValue`: Previous value of the metric (number).
   - `change`: Numeric change between current and previous value (number).
   - `changeType`: Type of change (`'increase' | 'decrease' | 'neutral'`).
   - `format`: Format of the metric value (`'number' | 'percentage' | 'currency'`).
   - `icon`: React component for displaying the metric icon (React.ComponentType).
   - `color`: Color associated with the metric (string).
   - `target?`: Optional target value for comparison (number).

2. **EngagementData**
   - `date`: Timestamp of the data entry (string).
   - `posts`: Number of posts (number).
   - `comments`: Number of comments (number).
   - `likes`: Number of likes (number).
   - `shares`: Number of shares (number).
   - `activeUsers`: Count of active users on that date (number).

3. **GrowthData**
   - `date`: Timestamp of the growth data (string).
   - `newMembers`: Count of new members (number).
   - `totalMembers`: Total membership count (number).
   - `retention`: Percentage of retained members (number).
   - `churnRate`: Percentage of members who left (number).

## Return Values

The `CommunityHealthDashboard` component renders a dashboard interface displaying the passed metrics, engagement, and growth data in various visual formats such as charts, progress bars, and badges.

## Examples

Here is an example of how to use the `CommunityHealthDashboard` with sample data:

```tsx
const metrics = [
  {
    id: '1',
    name: 'Active Users',
    value: 250,
    previousValue: 200,
    change: 50,
    changeType: 'increase',
    format: 'number',
    icon: Users,
    color: 'green',
  },
  // Additional metrics...
];

const engagementData = [
  {
    date: '2023-10-01',
    posts: 30,
    comments: 150,
    likes: 200,
    shares: 50,
    activeUsers: 100,
  },
  // Additional engagement data...
];

const growthData = [
  {
    date: '2023-09-30',
    newMembers: 20,
    totalMembers: 300,
    retention: 90,
    churnRate: 5,
  },
  // Additional growth data...
];

<CommunityHealthDashboard metrics={metrics} engagementData={engagementData} growthData={growthData} />;
```

This example showcases how to initialize the component with metrics, engagement, and growth data, which will be visualized in the dashboard.