# Build Creator Analytics Dashboard API

```markdown
# Creator Analytics Dashboard API

## Purpose
The Creator Analytics Dashboard API provides insights into the performance and engagement metrics of content creators. It enables the retrieval of analytics data such as earnings, audience demographics, engagement metrics, predictions, and trends over specified periods. This API is designed for use in applications that require monitoring and assessment of creator content.

## Usage
This API can be used to fetch analytics data based on various criteria, allowing the retrieval of comprehensive statistics for creators' content. The API is built using Next.js and Supabase for database management, and it utilizes Redis for caching requests.

## Parameters/Props
The API accepts the following query parameters in the request:

- `period` (optional): Defines the time range for the analytics data. Accepted values:
  - `7d` (7 days)
  - `30d` (30 days)
  - `90d` (90 days)
  - `1y` (1 year)
  - `all` (all time)
  
- `metric` (optional): Specifies the type of metric to retrieve. Accepted values:
  - `earnings`
  - `engagement`
  - `audience`
  - `predictions`
  - `trends`
  
- `contentType` (optional): Filters the data by content type. Accepted values:
  - `audio`
  - `video`
  - `podcast`
  - `all`
  
- `startDate` (optional): The starting date for the analytics data (in YYYY-MM-DD format).
- `endDate` (optional): The ending date for the analytics data (in YYYY-MM-DD format).

## Return Values
The API returns a JSON object structured as follows:

```json
{
  "earnings": EarningsData,
  "engagement": EngagementData,
  "audience": AudienceData,
  "predictions": PredictionData,
  "trends": TrendData,
  "metadata": {
    "period": string,
    "lastUpdated": string,
    "totalDataPoints": number
  }
}
```

### Data Structures
- **EarningsData**: Contains total revenue, growth rate, and breakdown by type (subscriptions, tips, etc.).
- **EngagementData**: Includes total views, likes, comments, shares, and average engagement rates.
- **AudienceData**: Displays follower count, demographics, and behavior patterns.
- **PredictionData**: Offers revenue predictions for the next month and growth forecasts.
- **TrendsData**: Displays historical trends based on the specified metrics.

## Examples

### Example Request
```http
GET /api/creator/analytics?period=30d&metric=engagement&contentType=video
```

### Example Response
```json
{
  "earnings": {
    "total": 5000,
    "growth": 10,
    "breakdown": {
      "subscriptions": 2000,
      "tips": 1500,
      "commissions": 1000,
      "advertisements": 1500
    },
    "dailyRevenue": [{ "date": "2023-09-01", "amount": 200 }, ...],
    "topEarningContent": [{ "contentId": "abc123", "title": "Viral Video", "revenue": 1500, "views": 50000 }]
  },
  "engagement": { ... },
  "audience": { ... },
  "predictions": { ... },
  "trends": { ... },
  "metadata": {
    "period": "30d",
    "lastUpdated": "2023-09-30T12:00:00Z",
    "totalDataPoints": 50
  }
}
```
```