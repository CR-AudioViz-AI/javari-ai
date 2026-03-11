# Create Creator Revenue Forecasting API

# Creator Revenue Forecasting API

## Purpose
The Creator Revenue Forecasting API provides functionality to forecast revenue for creators based on historical financial data and specified parameters. It utilizes various forecasting models, such as ARIMA and Prophet, and can include market trend analysis to improve predictions.

## Usage
To use the Creator Revenue Forecasting API, make a POST request to the `/api/creator/revenue/forecasting` endpoint with the required parameters in the request body. The API processes this information and returns predicted revenue forecasts.

## Request Parameters
The following parameters must be included in the request body:

- `creator_id` (string, UUID): The unique identifier for the creator.
- `forecast_periods` (array of strings, enum): An array specifying the time periods for which to forecast revenue. Options are `'3'`, `'6'`, or `'12'` (default: `['3', '6', '12']`).
- `confidence_level` (number): The desired confidence level for predictions, ranging from 0.8 to 0.99 (default: `0.95`).
- `include_market_trends` (boolean): Indicates whether to include market trend data in the forecasting (default: `true`).
- `model_type` (string, enum): Specifies the model to use for forecasting. Options are `'arima'`, `'prophet'`, or `'hybrid'` (default: `'hybrid'`).

## Return Values
The API returns a response containing the following fields in JSON format:

- `creator_id` (string): The creator's unique identifier.
- `forecasts` (array): A list of forecast results containing:
  - `period_months` (number): The forecast period in months.
  - `predicted_revenue` (number): The predicted revenue for the period.
  - `confidence_interval` (object): Lower and upper bounds of the confidence interval:
    - `lower` (number): Lower bound of the predicted revenue.
    - `upper` (number): Upper bound of the predicted revenue.
  - `growth_rate` (number): The estimated growth rate over the period.
  - `seasonality_factor` (number): The effect of seasonality on predictions.
  - `market_impact` (number): The quantified impact of market trends on revenue forecasts.
- `model_accuracy` (number): Assessment of the model's prediction accuracy.
- `last_updated` (string): Timestamp of the last update to the forecast.
- `data_quality_score` (number): Score indicating the quality of the input data.
- `recommendations` (array): Suggested actions based on forecast results.

## Examples

### Example Request
```json
{
  "creator_id": "d37a5324-87af-4f7b-a82c-947f4b709bc0",
  "forecast_periods": ["6"],
  "confidence_level": 0.95,
  "include_market_trends": true,
  "model_type": "hybrid"
}
```

### Example Response
```json
{
  "creator_id": "d37a5324-87af-4f7b-a82c-947f4b709bc0",
  "forecasts": [
    {
      "period_months": 6,
      "predicted_revenue": 2500,
      "confidence_interval": {
        "lower": 2300,
        "upper": 2700
      },
      "growth_rate": 0.05,
      "seasonality_factor": 1.2,
      "market_impact": 0.3
    }
  ],
  "model_accuracy": 0.92,
  "last_updated": "2023-10-01T12:00:00Z",
  "data_quality_score": 0.85,
  "recommendations": [
    "Consider increasing marketing efforts.",
    "Monitor market trends closely."
  ]
}
```