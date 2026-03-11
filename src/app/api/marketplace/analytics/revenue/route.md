# Build Marketplace Revenue Analytics API

# Marketplace Revenue Analytics API Documentation

## Purpose
The Marketplace Revenue Analytics API provides endpoints to analyze revenue metrics for a marketplace. It allows users to retrieve detailed revenue data, including gross and net revenue, commission breakdowns, revenue streams, and forecasting based on historical data.

## Usage
Import the API module and utilize its endpoints in your server-side code to fetch or update revenue-related analytics. It requires an active Supabase authentication session to ensure secure access to revenue data.

## Parameters/Props

### Query Parameters
- **startDate** (string, optional): Start date for revenue analysis in YYYY-MM-DD format.
- **endDate** (string, optional): End date for revenue analysis in YYYY-MM-DD format.
- **period** (enum, optional): Time period for analysis. Defaults to 'month'. Options: `['day', 'week', 'month', 'quarter', 'year']`.
- **streams** (string, optional): Comma-separated list of revenue stream IDs to include in the analysis.
- **metrics** (string, optional): Comma-separated list of desired metrics to calculate.
- **forecast** (boolean, optional): Whether to include revenue forecasting. Defaults to `false`.
- **granularity** (enum, optional): Time granularity of the results. Defaults to 'daily'. Options: `['hourly', 'daily', 'weekly', 'monthly']`.

### Body Parameters (for updates)
- **transactionId** (string): Unique identifier for the transaction.
- **amount** (number, positive): The amount of revenue to report.
- **currency** (string, length 3): Currency code (ISO 4217 format).
- **type** (enum): Type of revenue event. Options: `['subscription', 'transaction', 'commission', 'refund', 'chargeback']`.
- **vendorId** (string, optional): Identifier for the vendor associated with the transaction.
- **metadata** (object, optional): Additional metadata related to the transaction.

## Return Values
### Successful Responses
- Returns an object containing the requested revenue metrics, streams, and forecasting data, including:
  - **RevenueMetrics**: Total and detailed revenue stats.
  - **CommissionBreakdown**: Breakdown of commissions and platform fees.
  - **RevenueStream[]**: List of identified revenue streams.
  - **ForecastData**: Projections based on historical trends.

### Error Responses
- Returns error messages with appropriate status codes for invalid inputs or processing issues.

## Examples

### Fetching Revenue Data
```javascript
const response = await fetch('/api/marketplace/analytics/revenue?startDate=2023-01-01&endDate=2023-12-31&period=month&forecast=true');
const revenueData = await response.json();
console.log(revenueData);
```

### Updating a Revenue Transaction
```javascript
const updateResponse = await fetch('/api/marketplace/analytics/revenue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    transactionId: 'trxn_123456',
    amount: 100.00,
    currency: 'USD',
    type: 'transaction',
    vendorId: 'vendor_abc'
  })
});
const updateResult = await updateResponse.json();
console.log(updateResult);
```

## Note
Make sure to handle authentication properly and manage errors effectively in your application to ensure seamless data retrieval and updates.