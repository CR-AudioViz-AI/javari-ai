# Build Agent Usage Heat Map Visualization

# Agent Usage Heat Map Visualization

## Purpose
The Agent Usage Heat Map component visualizes the usage metrics of agents across different geographical regions. It displays a heatmap based on agent activity, allowing users to analyze their performance with real-time insights.

## Usage
To use the `AgentUsageHeatMap` component, import it into your React application and include it in your JSX. Ensure that you provide the necessary props to customize the visualization according to your requirements.

```tsx
import { AgentUsageHeatMap } from 'src/components/marketplace/analytics/AgentUsageHeatMap';

<AgentUsageHeatMap 
  className="custom-class"
  height={500}
  autoRefresh={true}
  refreshInterval={30000}
  showControls={true}
  defaultTimeRange="24h"
  onRegionSelect={(region) => console.log(region)}
/>
```

## Parameters/Props

### `AgentUsageHeatMapProps`
- **className**: `string` (optional)  
  Custom CSS class for styling the component.

- **height**: `number` (optional)  
  Height of the heat map in pixels.

- **autoRefresh**: `boolean` (optional)  
  Enables automatic refreshing of the data. Default is `false`.

- **refreshInterval**: `number` (optional)  
  Time in milliseconds for refresh interval when `autoRefresh` is enabled. Default is `30000`.

- **showControls**: `boolean` (optional)  
  Displays control options (time range, intensity metrics). Default is `true`.

- **defaultTimeRange**: `'1h' | '24h' | '7d' | '30d'` (optional)  
  Sets the initial time range for the data. Default is `'24h'`.

- **onRegionSelect**: `(region: RegionMetrics | null) => void` (optional)  
  Callback function that receives the selected region's metrics when a region is clicked.

## Return Values
The `AgentUsageHeatMap` component returns a React element containing the heat map visualization. It also manages interactive features such as region selection and data refresh options.

## Examples

### Example 1: Basic Usage
```tsx
<AgentUsageHeatMap 
  height={600}
  onRegionSelect={(region) => console.log(`Selected region: ${region?.region}`)}
/>
```

### Example 2: Customized Component
```tsx
<AgentUsageHeatMap 
  className="heatmap-styles"
  autoRefresh={true}
  refreshInterval={60000}
  showControls={false}
  defaultTimeRange="7d"
  onRegionSelect={(region) => {
    if (region) {
      alert(`Region: ${region.region} - Active Users: ${region.activeUsers}`);
    }
  }}
/>
```

This documentation provides an overview of the `AgentUsageHeatMap` component, its properties, and how to effectively integrate it into your project for enhanced visualization of agent usage data.