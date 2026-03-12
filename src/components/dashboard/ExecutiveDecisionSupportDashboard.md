# Create Executive Decision Support Dashboard

```markdown
# Executive Decision Support Dashboard

## Purpose
The `ExecutiveDecisionSupportDashboard` component provides a comprehensive view of key performance indicators (KPIs), risk assessments, predictive insights, and strategic recommendations. It is designed to assist executives in making informed decisions through data visualization and analysis.

## Usage
To use the `ExecutiveDecisionSupportDashboard`, import it into your React application and include it in your component tree. Ensure that you have the necessary datasets available to populate the dashboard.

```tsx
import ExecutiveDecisionSupportDashboard from 'src/components/dashboard/ExecutiveDecisionSupportDashboard';

const App = () => {
    return (
        <div>
            <ExecutiveDecisionSupportDashboard />
        </div>
    );
};
```

## Parameters/Props
The component accepts the following props:

- **metrics**: `ExecutiveMetric[]`
  - An array of executive metrics to display, each including fields like `id`, `name`, `value`, `previousValue`, `unit`, `category`, `trend`, `confidence`, and `timestamp`.

- **riskAssessments**: `RiskAssessment[]`
  - An array of risk assessments, each including fields such as `id`, `category`, `riskLevel`, `score`, `impact`, `probability`, `description`, `mitigation`, `owner`, and `dueDate`.

- **predictiveInsights**: `PredictiveInsight[]`
  - An array of predictive insights, with properties including `id`, `metric`, `prediction`, `confidence`, `timeframe`, `factors`, and `scenario`.

- **strategicRecommendations**: `StrategicRecommendation[]`
  - An array of strategic recommendations composed of `id`, `title`, `description`, `priority`, `impact`, `effort`, `roi`, `category`, `aiGenerated`, and `timestamp`.

## Return Values
The `ExecutiveDecisionSupportDashboard` component does not return any value as it renders a view for user interaction. It integrates various charts and components to visualize the provided data arrays effectively.

## Examples
### Example Metric Data
```tsx
const metrics = [
    {
        id: "metric1",
        name: "Total Revenue",
        value: 120000,
        previousValue: 100000,
        unit: "$",
        category: "financial",
        trend: "up",
        confidence: 0.85,
        timestamp: "2023-10-01T00:00:00Z"
    },
    // Additional metrics...
];
```

### Example Risk Assessment Data
```tsx
const riskAssessments = [
    {
        id: "risk1",
        category: "Operational",
        riskLevel: "medium",
        score: 75,
        impact: 3,
        probability: 0.5,
        description: "Operational downtime risk",
        mitigation: "Implement robust backup systems",
        owner: "John Doe",
        dueDate: "2023-12-01"
    },
    // Additional risk assessments...
];
```

### Rendering the Dashboard
```tsx
<ExecutiveDecisionSupportDashboard
    metrics={metrics}
    riskAssessments={riskAssessments}
    predictiveInsights={predictiveInsights}
    strategicRecommendations={strategicRecommendations}
/>
```

This setup will enable the dashboard to render and visualize the supplied data correctly, providing valuable insights to decision-makers.
```