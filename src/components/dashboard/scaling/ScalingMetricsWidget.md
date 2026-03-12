# Create Scaling Performance Metrics Widget

```markdown
# Scaling Performance Metrics Widget

## Purpose
The `ScalingMetricsWidget` is a React component that visualizes key performance metrics related to application scaling. It provides insights into CPU usage, memory usage, requests per second, response times, and cost analysis. The widget also includes configuration for alerts and real-time updates for monitoring scaling events.

## Usage
To use the `ScalingMetricsWidget`, import it into your React component and include it in your JSX. You can customize various props to suit your requirements.

### Importing
```tsx
import ScalingMetricsWidget from 'src/components/dashboard/scaling/ScalingMetricsWidget';
```

### Example
```tsx
<ScalingMetricsWidget 
  className="my-custom-class"
  refreshInterval={60} // refresh every 60 seconds
  showCostAnalysis={true}
  showAlertConfig={true}
  timeRange="1h" // options: '1h', '6h', '24h', '7d'
/>
```

## Parameters/Props

| Prop                   | Type               | Default    | Description                                                                                          |
|------------------------|--------------------|------------|------------------------------------------------------------------------------------------------------|
| `className`            | `string`           | `''`       | Optional CSS class to customize the widget styling.                                                 |
| `refreshInterval`      | `number`           | `60`       | Interval in seconds for refreshing data automatically.                                              |
| `showCostAnalysis`     | `boolean`          | `false`    | Flag to display cost analysis data.                                                                  |
| `showAlertConfig`      | `boolean`          | `false`    | Flag to display configuration options for alerts based on performance thresholds.                    |
| `timeRange`            | `'1h' | '6h' | '24h' | '7d'`| Time range for metrics data selection.                                                               |

## Return Values
The `ScalingMetricsWidget` component returns a rendered widget that displays:
- Performance indicators (CPU, memory usage, requests rate, etc.)
- Visual charts (line, area, and pie charts) for data representation
- Alert configuration options if enabled
- Real-time updates if the `useRealtimeSubscription` hook is utilized for live data streaming.

## Additional Components
- **PerformanceIndicator**: Displays a single performance metric with optional threshold checks and trend indicators.
- **ResourceGauge**: Visual representation of resource usage compared to a maximum value.
- **ScalingEvent**: Shows information about scaling events such as scale-ups or scale-downs.

## Example Visualizations
1. **LineChart**: Shows trends over time for CPU and memory usage.
2. **PieChart**: Represents the distribution of active instances.
3. **AreaChart**: Visualizes requests per second and response times over selected time ranges.

The component is designed to enhance monitoring of application performance, specifically in cloud or scalable environments, assisting developers and operations teams in making informed scaling decisions.
```