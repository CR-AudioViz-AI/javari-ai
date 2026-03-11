# Create Team Performance Heat Map Component

```markdown
# Team Performance Heat Map Component

## Purpose
The `TeamPerformanceHeatMap` component visualizes team performance metrics in a heat map format, allowing users to track productivity, collaboration, quality, and more over specified time ranges. It integrates interactive features to examine individual metrics and identify bottlenecks within the team.

## Usage
To use the `TeamPerformanceHeatMap`, import the component and provide the required props. It supports an onClick event for both metrics and bottleneck indicators.

```tsx
import TeamPerformanceHeatMap from 'src/components/analytics/team-performance-heatmap';

const App = () => (
  <TeamPerformanceHeatMap
    teamId="team-123"
    refreshInterval={60000}
    onCellClick={(memberId, metricId, data) => {
      console.log(`Metric clicked: ${metricId} for member: ${memberId}`, data);
    }}
    onBottleneckClick={(bottleneck) => {
      console.log('Bottleneck details:', bottleneck);
    }}
    className="custom-class"
  />
);
```

## Parameters/Props

| Prop               | Type                | Description                                                  |
|--------------------|---------------------|--------------------------------------------------------------|
| `teamId`           | `string`            | Unique identifier for the team whose data should be displayed. |
| `refreshInterval`  | `number` (optional) | Interval in milliseconds to refresh the heat map data (default is `null` for no automatic refresh). |
| `onCellClick`      | `(memberId: string, metricId: string, data: HeatMapData) => void` (optional) | Callback function invoked when a heat map cell is clicked. |
| `onBottleneckClick`| `(bottleneck: BottleneckIndicator) => void` (optional) | Callback function invoked when a bottleneck indicator is clicked. |
| `className`        | `string` (optional) | Additional CSS classes for styling the component.              |

## Return Values
The component does not return any explicit values as it is a UI component. It renders a heat map interface and manages internal state as necessary.

## Examples

### Basic Example

```tsx
<TeamPerformanceHeatMap
  teamId="team-456"
/>
```

### With Callbacks

```tsx
<TeamPerformanceHeatMap
  teamId="team-789"
  refreshInterval={300000}
  onCellClick={(memberId, metricId, data) => {
    alert(`Metric clicked: ${metricId} for member: ${memberId}`);
  }}
  onBottleneckClick={(bottleneck) => {
    console.warn('Bottleneck occurred:', bottleneck);
  }}
/>
```

## Conclusion
The `TeamPerformanceHeatMap` component is a powerful tool for visualizing team performance, enabling real-time interaction with metrics and identifying areas needing attention. Make sure to properly handle the callbacks to enhance user experience.
```