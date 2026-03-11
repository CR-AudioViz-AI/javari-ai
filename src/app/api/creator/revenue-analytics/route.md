# Build Creator Revenue Analytics API

# Creator Revenue Analytics API

## Purpose
The Creator Revenue Analytics API provides endpoints for analyzing revenue data, segmenting customers, and making predictions using machine learning. It leverages Supabase for data storage and Redis for caching to deliver insights on creator revenue metrics, customer behavior, and future revenue trends.

## Usage
To access the API, utilize a Next.js server route defined in `src/app/api/creator/revenue-analytics/route.ts`. The API accepts various query parameters for analytics, segmentation, and prediction tasks.

### Base URL
```
/api/creator/revenue-analytics
```

## Parameters/Props

### Analytics Query Parameters
- **period** (string, optional): The time period for analytics. Options: `'7d'`, `'30d'`, `'90d'`, `'1y'`. Default: `'30d'`.
- **format** (string, optional): The output format of the data. Options: `'chart'`, `'table'`, `'summary'`. Default: `'chart'`.
- **metrics** (array, optional): Metrics to retrieve. Options: `'revenue'`, `'transactions'`, `'customers'`, `'avg_order'`.
- **timezone** (string, optional): The timezone to apply. Default: `'UTC'`.

### Segmentation Query Parameters
- **method** (string, optional): The segmentation method. Options: `'value'`, `'frequency'`, `'recency'`, `'rfm'`. Default: `'rfm'`.
- **segments** (number, optional): Number of segments (between 2 to 10). Default: `5`.

### Prediction Query Parameters
- **horizon** (string, optional): The prediction horizon. Options: `'30d'`, `'60d'`, `'90d'`, `'180d'`. Default: `'90d'`.
- **confidence** (number, optional): Confidence level for predictions (0.8 to 0.99). Default: `0.95`.
- **include_scenarios** (boolean, optional): Whether to include predicted scenarios. Default: `false`.

### Export Parameters
- **format** (string, required): Format for export. Options: `'csv'`, `'pdf'`, `'xlsx'`.
- **data_type** (string, required): Type of data to export. Options: `'analytics'`, `'segments'`, `'predictions'`, `'all'`.
- **period** (string, optional): Specific period for the export.

## Return Values
The API returns structured data based on the request. Example return types include:
- **Revenue Data Points**: `{ date: string, revenue: number, transactions: number, customers: number, avg_order_value: number }`
- **Customer Segments**: `{ segment_id: string, name: string, customer_count: number, revenue_contribution: number, avg_lifetime_value: number, characteristics: Record<string, any> }`
- **Prediction Results**: `{ horizon: string, predicted_revenue: number, confidence_interval: { lower: number, upper: number }, trend: 'increasing' | 'decreasing' | 'stable', scenarios?: { pessimistic: number, optimistic: number } }`

## Examples

### Get Revenue Analytics
```http
GET /api/creator/revenue-analytics?period=30d&format=chart&metrics=revenue,transactions
```

### Segment Customers
```http
GET /api/creator/revenue-analytics/segment?method=rfm&segments=5
```

### Get Revenue Predictions
```http
GET /api/creator/revenue-analytics/prediction?horizon=90d&confidence=0.95
```

### Export Data
```http
POST /api/creator/revenue-analytics/export
Body: { format: 'csv', data_type: 'analytics', period: '30d' }
```

For further usage, ensure to authenticate requests via environment variables as per the required configurations.