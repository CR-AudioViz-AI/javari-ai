# Build Payment Analytics Visualization Component

# PaymentAnalyticsVisualization Component

## Purpose
The `PaymentAnalyticsVisualization` component provides a visual representation of payment analytics, allowing users to view, filter, and analyze transaction data interactively. It includes various chart types such as bar charts, pie charts, and sankey diagrams to represent payment metrics and trends.

## Usage
To use the `PaymentAnalyticsVisualization` component, import it into your React application and render it, passing the necessary props to customize its behavior and appearance.

```tsx
import PaymentAnalyticsVisualization from 'src/components/analytics/PaymentAnalyticsVisualization';

const App = () => {
  return (
    <PaymentAnalyticsVisualization 
      merchantId="12345" 
      defaultDateRange={{ from: new Date('2023-01-01'), to: new Date('2023-12-31') }} 
      enableExport={true} 
      enableDrillDown={true} 
    />
  );
};
```

## Parameters/Props

| Prop                | Type                  | Description                                                        |
|---------------------|-----------------------|--------------------------------------------------------------------|
| `className`         | `string` (optional)   | Custom CSS class for styling the component.                       |
| `merchantId`        | `string` (optional)   | ID of the merchant for whom the payment data is to be fetched.   |
| `defaultDateRange`  | `DateRange` (optional)| Specifies the initial date range for the analytics view.         |
| `enableExport`      | `boolean` (optional)  | If true, provides functionality to export payment data.           |
| `enableDrillDown`   | `boolean` (optional)  | If true, enables drill-down capabilities for detailed analysis.   |

## Return Values
The component renders a series of visual graphs and metrics based on the payment transactions fetched from the backend, providing insight into the financial performance of a merchant. It includes:
- Insights through metric cards (total payments, transactions count, etc.)
- Interactive charts (bar, pie, and sankey) showcasing transactions.
- Export functionality for transaction data (if enabled).

## Examples

### Basic Usage
```tsx
<PaymentAnalyticsVisualization 
  merchantId="12345" 
  defaultDateRange={{ from: new Date('2023-01-01'), to: new Date('2023-03-31') }} 
/>
```

### Enabling Export and Drill Down
```tsx
<PaymentAnalyticsVisualization 
  merchantId="67890" 
  enableExport={true} 
  enableDrillDown={true} 
/>
```

### Custom Styling
```tsx
<PaymentAnalyticsVisualization 
  className="my-custom-class" 
  merchantId="11223" 
/>
```

## Additional Information
The component leverages `react-query` for fetching and caching transaction data, and utilizes `recharts` for rendering dynamic charts. Ensure all required libraries are installed and properly configured in your React environment for optimal functionality.