# Build Real-Time Earnings Visualization Component

# RealTimeEarningsVisualization Component

## Purpose
The `RealTimeEarningsVisualization` component is designed to provide users with a dynamic visual representation of their earnings over a specified time range. It integrates various chart types to display revenue streams, performance metrics, and a conversion funnel, allowing users to understand their financial performance at a glance.

## Usage
To use the `RealTimeEarningsVisualization` component, import it into your desired React component and provide the necessary props.

```tsx
import RealTimeEarningsVisualization from '@/components/dashboard/earnings/RealTimeEarningsVisualization';

const Dashboard = () => {
  return (
    <div>
      <RealTimeEarningsVisualization userId="user123" className="my-earnings-chart" />
    </div>
  );
};
```

## Parameters/Props

### `RealTimeEarningsVisualizationProps`
- **userId** _(string, optional)_: The unique identifier of the user whose earnings data will be visualized.
- **className** _(string, optional)_: Additional CSS classes for styling the component.

## Return Values
The component returns a visual representation of earnings data, including charts for revenues, performance metrics, and conversion funnels. The returned output is a React component that will render inside its parent component’s JSX structure.

## Examples

### Basic Example
```tsx
<RealTimeEarningsVisualization userId="user123" />
```
This example renders the earnings visualization for the user with ID `user123`.

### Custom Class Name
```tsx
<RealTimeEarningsVisualization userId="user123" className="custom-class" />
```
This example adds a custom class for additional styling.

## Functionality
- **Dynamic Data Fetching**: It leverages React Query to fetch earnings data in real-time, ensuring up-to-date metrics.
- **Multiple Chart Types**: Supports various visualization formats (Line, Area, Bar, Funnel) for comprehensive insights.
- **Responsive Design**: It's designed to be responsive and adapt to different screen sizes.
- **PDF Generation**: Integrates with `jspdf` for generating downloadable reports of the earnings data.

## Note
Ensure that the Supabase library is properly configured within your application for the data fetching to work correctly. This component also uses the `date-fns` library for date management and formatting.