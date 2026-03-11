# Build Creator Subscription Analytics API

# Creator Subscription Analytics API

## Purpose

API endpoint for retrieving comprehensive subscription analytics for creators, including metrics, churn predictions, and subscriber segmentation analysis.

## Endpoints

### GET `/api/creators/analytics/subscriptions`

Retrieves subscription analytics data for a creator.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `creatorId` | string (UUID) | Yes | - | Creator's unique identifier |
| `timeRange` | enum | No | `30d` | Time period: `7d`, `30d`, `90d`, `1y` |
| `segment` | enum | No | `all` | Subscriber segment: `all`, `new`, `active`, `at_risk`, `churned` |
| `metrics` | array | No | `['revenue', 'churn', 'ltv']` | Metrics to include: `revenue`, `churn`, `ltv`, `growth`, `segments` |

### POST `/api/creators/analytics/subscriptions`

Forces refresh of subscription analytics data.

#### Request Body

```json
{
  "creatorId": "string (UUID)",
  "forceRefresh": boolean
}
```

## Response Structure

```typescript
{
  success: boolean;
  data: {
    metrics: SubscriptionMetrics;
    churnPredictions?: ChurnPrediction[];
    segmentAnalysis?: SegmentAnalysis[];
    timeSeriesData: Array<{
      date: string;
      subscribers: number;
      revenue: number;
      churn: number;
    }>;
  };
  cached: boolean;
  error?: string;
}
```

### SubscriptionMetrics

- `totalSubscribers`: Total subscriber count
- `activeSubscribers`: Currently active subscribers
- `newSubscribers`: New subscribers in time period
- `churnedSubscribers`: Churned subscribers in time period
- `churnRate`: Percentage churn rate
- `averageRevenue`: Average revenue per subscriber
- `totalRevenue`: Total revenue in period
- `lifetimeValue`: Customer lifetime value
- `growthRate`: Subscriber growth rate
- `retentionRate`: Subscriber retention rate

### ChurnPrediction

- `subscriberId`: Subscriber identifier
- `riskScore`: Risk score (0-100)
- `riskLevel`: Risk category
- `predictedChurnDate`: Predicted churn date
- `factors`: Contributing risk factors
- `confidence`: Prediction confidence level

## Examples

### Basic Analytics Request

```javascript
const response = await fetch('/api/creators/analytics/subscriptions?creatorId=123e4567-e89b-12d3-a456-426614174000&timeRange=30d');
const analytics = await response.json();
```

### Force Data Refresh

```javascript
const response = await fetch('/api/creators/analytics/subscriptions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    creatorId: '123e4567-e89b-12d3-a456-426614174000',
    forceRefresh: true
  })
});
```

## Features

- Redis caching for performance
- Stripe integration for payment data
- Machine learning-based churn prediction
- Subscriber segmentation analysis
- Time-series data for trending
- Authentication via Supabase