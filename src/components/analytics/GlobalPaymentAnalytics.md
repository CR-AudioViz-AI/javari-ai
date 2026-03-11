# Create Global Payment Analytics Component

# GlobalPaymentAnalytics Component

## Purpose
The `GlobalPaymentAnalytics` component is designed to display an interactive analytics dashboard for monitoring payment metrics across different countries and payment methods. It allows users to visualize data through charts and control the analytics view using dynamic filters.

## Usage
To use the `GlobalPaymentAnalytics` component, import it in your React application and ensure that you have the necessary dependencies and the Supabase client configured.

```tsx
import GlobalPaymentAnalytics from '@/components/analytics/GlobalPaymentAnalytics';

// Inside your functional component
<GlobalPaymentAnalytics />;
```

## Parameters/Props
The `GlobalPaymentAnalytics` component does not require any props to be passed explicitly. It manages its internal state for the selected period and country using global state management via Zustand.

### PaymentStore (Internal State)
- **selectedPeriod**: (string) The currently selected time period for analytics.
- **selectedCountry**: (string) The currently selected country for filter analytics.

## Return Values
The component does not return values but renders multiple visual components, including:
- Payment Summary Metrics (Total Volume, Total Transactions, Success Rate, etc.).
- Charts (Line, Bar, Pie) visualizing transactions over periods or by payment method/country.
- Interactive elements (Tabs, Selects) for user input.

## Example

```tsx
import React from 'react';
import GlobalPaymentAnalytics from '@/components/analytics/GlobalPaymentAnalytics';

const AnalyticsPage: React.FC = () => {
  return (
    <div>
      <h1>Global Payment Analytics</h1>
      <GlobalPaymentAnalytics />
    </div>
  );
};

export default AnalyticsPage;
```

### Interactivity
The user can interact with:
- **Tabs**: To switch between different views of the data.
- **Select dropdowns**: To filter the analytics by country or payment method.
- **Charts**: Mouseover provides detailed insights on individual points.

### Example of Metrics Displayed
- **Total Volume:** Displays the total value of transactions in currency
- **Total Transactions:** Number of transactions processed
- **Success Rate:** Percentage of successful transactions against total attempts
- **Growth Rate:** Year over year growth in payment volumes

### Real-time Data Updates
The component listens for real-time updates on payment transactions, refunds, and failures to reflect current metrics automatically without needing a page refresh.

## Dependencies
Ensure to have the following libraries installed:
- `react`
- `@tanstack/react-query`
- `zustand`
- `date-fns`
- `recharts`
- `supabase`
- `lucide-react`
- And custom UI components from the project (e.g., `Alert`, `Card`, `Skeleton`, etc.)

## Notes
This component is intended for a server-client architecture utilizing React and Supabase for data fetching and state management. It is designed for production-level applications requiring robust analytics capabilities.