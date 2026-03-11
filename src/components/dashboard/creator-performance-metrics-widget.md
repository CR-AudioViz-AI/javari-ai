# Build Creator Performance Metrics Widget

# Creator Performance Metrics Widget

## Purpose
The `CreatorPerformanceMetricsWidget` component is designed to visualize and track key performance indicators for content creators over selected time ranges. It provides insights into earnings, audience growth, engagement levels, and conversion metrics through various charts and data representations.

## Usage
To use the `CreatorPerformanceMetricsWidget`, import it into your component and pass the necessary props for customization. The component fetches metric data and provides visual representations using charts from the `recharts` library.

```tsx
import CreatorPerformanceMetricsWidget from 'path/to/creator-performance-metrics-widget';

const MyDashboard = () => {
  return (
    <CreatorPerformanceMetricsWidget 
      creatorId="12345" 
      className="my-custom-class" 
      onExportData={() => console.log('Exporting data...')}
      refreshInterval={30000} // 30 seconds
    />
  );
};
```

## Parameters/Props

| Prop                  | Type                     | Default  | Description                                                                                                                               |
|-----------------------|--------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `creatorId`           | `string`                 | -        | ID of the creator whose performance metrics are being visualized.                                                                         |
| `className`           | `string`                 | -        | Optional CSS class for styling the widget.                                                                                               |
| `onExportData`        | `() => void`             | -        | Function to execute when data export is triggered.                                                                                       |
| `refreshInterval`     | `number`                 | -        | Time in milliseconds to refresh the data automatically. Set to a value like `30000` for 30 seconds.                                       |

## Return Values
The `CreatorPerformanceMetricsWidget` does not return any values as it directly renders the performance metrics charts and UI elements. However, it fetches and displays data based on the passed `creatorId`.

## Examples
1. **Basic Usage:**
   ```tsx
   <CreatorPerformanceMetricsWidget creatorId="creator123" />
   ```

2. **With Custom Class Name:**
   ```tsx
   <CreatorPerformanceMetricsWidget creatorId="creator123" className="custom-metrics-widget" />
   ```

3. **With Data Export Functionality:**
   ```tsx
   const handleExport = () => {
     console.log('Exporting creator performance data...');
   };

   <CreatorPerformanceMetricsWidget 
     creatorId="creator123" 
     onExportData={handleExport} 
   />
   ```

4. **Automatic Data Refresh:**
   ```tsx
   <CreatorPerformanceMetricsWidget 
     creatorId="creator123" 
     refreshInterval={60000} // Refresh every minute
   />
   ```

## Conclusion
The `CreatorPerformanceMetricsWidget` provides a comprehensive view of a content creator's metrics, making it an essential tool for creators and analysts looking to monitor performance in a visually appealing way. Modify its props to fit your data visualization needs effectively.