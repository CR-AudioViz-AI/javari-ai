# Build Multi-Stream Revenue Visualization

```markdown
# MultiStreamRevenueVisualization Component

## Purpose
The `MultiStreamRevenueVisualization` component visualizes revenue data from multiple streams (e.g., subscriptions, tips, merchandise, and brand partnerships) for a specified creator. It provides users with interactive charts and metrics that summarize revenue performance over different time ranges.

## Usage
To use the `MultiStreamRevenueVisualization` component, import it into your React application and provide the required props. The component renders a visual representation of revenue streams and allows users to filter the data by time range.

```tsx
import MultiStreamRevenueVisualization from 'src/components/dashboard/MultiStreamRevenueVisualization';

// Example usage of MultiStreamRevenueVisualization
<MultiStreamRevenueVisualization creatorId="creator_12345" currency="USD" refreshInterval={60000} onExport={(data, format) => console.log(data, format)} />
```

## Parameters/Props
| Prop                | Type                          | Description                                                                                      |
|---------------------|-------------------------------|--------------------------------------------------------------------------------------------------|
| `creatorId`        | `string`                     | The unique identifier for the creator whose revenue streams will be visualized.                 |
| `currency`         | `string` (optional)          | The currency symbol to use for displaying amounts (e.g., "USD"). Defaults to undefined.          |
| `refreshInterval`  | `number` (optional)          | The interval (in milliseconds) for refreshing the data automatically. Defaults to undefined.     |
| `onExport`         | `(data: RevenueData[], format: 'csv' | 'pdf') => void` (optional) | Callback function triggered when the export operation is initiated. Allows for exporting revenue data. |
| `className`        | `string` (optional)          | Additional CSS class names to style the component.                                              |

## Return Values
The component does not have a return value, but it renders visualization charts and streamlined metrics for revenue analysis and allows exporting of data.

## Examples
### Basic Example
```tsx
<MultiStreamRevenueVisualization 
    creatorId="123" 
    currency="EUR" 
/>
```

### With Custom Refresh Interval
```tsx
<MultiStreamRevenueVisualization 
    creatorId="456" 
    currency="USD" 
    refreshInterval={30000} 
/>
```

### Exporting Data
```tsx
<MultiStreamRevenueVisualization 
    creatorId="789" 
    onExport={(data, format) => {
        // Handle data export according to format
        console.log('Exporting data:', data, 'Format:', format);
    }} 
/>
```

## Notes
- The component uses `recharts` for rendering charts, requiring the library to be installed in your project.
- The component supports filtering by time range, which can be customized or extended as needed.
```