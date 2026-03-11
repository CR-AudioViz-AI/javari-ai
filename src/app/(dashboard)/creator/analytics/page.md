# Build Creator Performance Dashboard

# Creator Performance Analytics Dashboard Documentation

## Purpose
The Creator Performance Analytics Dashboard provides a comprehensive view of creator performance metrics, including revenue trends, audience engagement, content performance, and growth analytics. It also incorporates machine learning predictions and allows for real-time updates and report exports.

## Usage
Import the `CreatorAnalyticsPage` component into your application where you want to display the analytics dashboard.

```tsx
import CreatorAnalyticsPage from 'src/app/(dashboard)/creator/analytics/page';
```

Use the component like any other React component:

```tsx
function App() {
  return (
    <div>
      <CreatorAnalyticsPage />
    </div>
  );
}
```

## Parameters/Props
The `CreatorAnalyticsPage` component does not accept any props. It manages its own state for presenting the analytics data.

### Internal State Management:
- **activeTab**: Tracks the currently active tab within the dashboard (e.g., overview, revenue, engagement).
- **filters**: Holds the selected filters for displaying analytics (e.g., date ranges, metrics).

### Hooks Used:
- **useCreatorAnalytics**: Custom hook to fetch and manage analytics data.

## Return Values
The component renders a fully interactive analytics dashboard, which includes:
- Revenue trends and forecast charts
- Audience engagement metrics displays
- Content performance tracking components
- Summary cards of growth metrics
- Analytics filters for data customization
- An export button for downloading reports

## Components Included
The following sub-components are utilized within the `CreatorAnalyticsPage`:
- `RevenueChart`: Displays a graphical representation of revenue trends.
- `AudienceEngagementMetrics`: Shows metrics related to audience interactions.
- `ContentPerformanceGrid`: Renders metrics related to specific pieces of content.
- `GrowthMetricsCard`: Highlights growth statistics with machine learning predictions.
- `RevenueForecastChart`: Projects future revenue based on current trends.
- `AnalyticsFilters`: Allows users to set filters for viewing specified data.
- `MetricsSummaryCards`: Summarizes key metrics in card form.
- `ExportReportButton`: Facilitates exporting of analytics reports.

## Examples
Here’s a basic example of how to implement the dashboard in a React application:

```tsx
import React from 'react';
import CreatorAnalyticsPage from 'src/app/(dashboard)/creator/analytics/page';

const App = () => {
  return (
    <div className="app-container">
      <h1>Creator Performance Dashboard</h1>
      <CreatorAnalyticsPage />
    </div>
  );
};

export default App;
```

This implementation creates a container for the dashboard, along with a heading.

---

This documentation serves as a quick guide to integrating and using the Creator Performance Analytics Dashboard (`CreatorAnalyticsPage`) in your application, ensuring comprehensive analytics capabilities for creators.