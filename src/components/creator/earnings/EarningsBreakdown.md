# Generate Creator Earnings Breakdown UI Component

# EarningsBreakdown Component Documentation

## Purpose
The `EarningsBreakdown` component is designed to provide a comprehensive visual representation of a creator's earnings across various revenue streams, including analytics in chart formats. It allows creators to manage, view, and analyze their earnings efficiently.

## Usage
To use the `EarningsBreakdown` component, import it into your React application and include it in your JSX, passing the necessary props:

```tsx
import EarningsBreakdown from '@/components/creator/earnings/EarningsBreakdown';

<EarningsBreakdown creatorId="unique_creator_id" className="custom-class" />
```

## Parameters/Props

### `EarningsBreakdownProps`

| Prop Name    | Type     | Required  | Description                                           |
|--------------|----------|-----------|-------------------------------------------------------|
| `creatorId`  | `string` | Yes       | The unique ID of the creator whose earnings are to be displayed. |
| `className`  | `string` | No        | An optional custom class name for styling the component. |

## Return Values
The `EarningsBreakdown` component returns a JSX element containing:
- A detailed breakdown of earnings structured in tables and charts.
- Interactive UI elements such as dropdowns, buttons, and selectors for filtering data.
- Displays graphical representations like pie charts and line charts for visual data analysis.

## Examples

### Basic Example
```tsx
// Rendering the EarningsBreakdown component for a specific creator
<EarningsBreakdown creatorId="12345" />
```

### Custom Styling Example
```tsx
// Rendering the EarningsBreakdown component with custom styling
<EarningsBreakdown creatorId="12345" className="my-custom-class" />
```

### Use in a Page
```tsx
import EarningsBreakdown from '@/components/creator/earnings/EarningsBreakdown';

const CreatorDashboard = () => {
    return (
        <div>
            <h1>Creator Dashboard</h1>
            <EarningsBreakdown creatorId="67890" className="dashboard-earnings" />
        </div>
    );
};

export default CreatorDashboard;
```

## Additional Information
- Ensure that your environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are properly configured for the Supabase client to function.
- The component makes use of several UI components (like `Card`, `Table`, `selects`) and data visualization libraries (like `recharts`) to present the data efficiently.
- The data displayed (like earnings, revenue streams) is fetched from a Supabase database asynchronously.

This concise documentation provides an overview of how to implement and utilize the `EarningsBreakdown` component effectively in your application.