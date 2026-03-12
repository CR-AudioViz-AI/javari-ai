# Create Revenue Forecasting Widget

# Revenue Forecasting Widget

## Purpose
The `RevenueForecastingWidget` is a React component that visualizes revenue forecasts using charts and provides key metrics for analysis. It allows users to select different timeframes for revenue predictions and displays actual, predicted, and confidence intervals for revenue data.

## Usage
To use the `RevenueForecastingWidget`, import it into your desired React component and pass the required props to customize its behavior.

### Example
```tsx
import RevenueForecastingWidget from 'src/components/dashboard/widgets/RevenueForecastingWidget';

const Dashboard = () => {
  const handleForecastUpdate = (metrics) => {
    console.log(metrics);
  };

  return (
    <RevenueForecastingWidget
      creatorId="user123"
      timeframe="90d"
      showConfidenceInterval={true}
      showSeasonality={false}
      onForecastUpdate={handleForecastUpdate}
    />
  );
};
```

## Parameters/Props
| Prop                     | Type                                | Default    | Description                                                                 |
|--------------------------|-------------------------------------|------------|-----------------------------------------------------------------------------|
| `creatorId`              | `string`                            | `undefined`| Optional ID of the creator/user for logging or tracking purposes.          |
| `className`              | `string`                            | `undefined`| Optional additional class name for styling the component.                  |
| `timeframe`              | `'30d' | '90d' | '180d' | '365d'` | `'30d'`    | Specifies the timeframe for the forecast data display.                    |
| `showConfidenceInterval`  | `boolean`                         | `false`   | Determines whether to display the confidence interval in the charts.       |
| `showSeasonality`        | `boolean`                          | `false`   | Determines if seasonal impacts should be shown in the forecast.            |
| `onForecastUpdate`       | `(metrics: ForecastMetrics) => void` | `undefined`| Callback function triggered when the forecast data is updated.             |

## Return Values
The `RevenueForecastingWidget` does not return values directly like traditional functions. Instead, it visually renders charts and information based on the forecast data it fetches, and invokes the `onForecastUpdate` callback with forecast metrics whenever updates occur.

## Forecast Metrics
The `ForecastMetrics` object provided to the `onForecastUpdate` callback contains the following properties:
- `current_revenue`: `number` - The current actual revenue.
- `predicted_next_month`: `number` - The predicted revenue for the upcoming month.
- `growth_rate`: `number` - The percentage growth rate compared to previous periods.
- `confidence_score`: `number` - The confidence level of the forecast (0-100).
- `seasonal_impact`: `number` - The impact of seasonality on revenue.
- `trend_strength`: `'strong_up' | 'moderate_up' | 'stable' | 'moderate_down' | 'strong_down'` - Describes the strength of revenue trends.

## Dependencies
Ensure you have the following libraries installed:
- `react`
- `recharts`
- `date-fns`
- Component UI libraries used in the widget, such as `@/components/ui/card`, `@/components/ui/select`, etc.

The `RevenueForecastingWidget` can be easily integrated into your application's dashboard, providing valuable insights into revenue trends and aiding in strategic planning.