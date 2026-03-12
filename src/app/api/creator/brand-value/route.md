# Create Creator Brand Value API

```markdown
# Creator Brand Value API

## Purpose
The Creator Brand Value API calculates the brand value of a given creator based on engagement metrics, revenue streams, and market positioning. This API assists in evaluating the financial and market viability of content creators for potential partnerships and investments.

## Usage
This API can be accessed via an HTTP request using the Next.js framework. Users need to send a POST request to the specified endpoint with the appropriate request payload for brand value calculation.

### Endpoint
```
POST /api/creator/brand-value
```

## Parameters / Props

### Request Body
The API accepts a JSON payload with the following schemas:

**BrandValueRequestSchema**
- `creator_id` (string, required): The UUID of the creator whose brand value is to be calculated.
- `include_projections` (boolean, optional): If true, includes future projections in the response. Default is `false`.
- `time_period` (string, optional): The time frame for the analysis. Can be `30d`, `90d`, or `1y`. Default is `90d`.

### Response
Upon a successful request, the API returns a JSON object containing the calculated brand value and related metrics.

**BrandValueCalculation**
- `total_brand_value` (number): The overall calculated brand value.
- `engagement_score` (number): Score based on engagement metrics.
- `revenue_score` (number): Score based on revenue streams.
- `market_score` (number): Score based on market positioning.
- `growth_potential` (number): Estimated growth potential score.
- `risk_factors` (array<string>): List of identified risk factors.
- `valuation_breakdown` (object): Detailed breakdown of the valuation metrics.
  - `engagement_value` (number): Value derived from engagement metrics.
  - `revenue_multiple` (number): Multiplier used for revenue assessment.
  - `market_premium` (number): Premium value associated with market positioning.
  - `growth_multiplier` (number): Multiplier reflecting growth potential.
- `partnership_recommendations` (object): Recommendations for potential partnerships.
  - `ideal_deal_size` (number): Suggested deal size based on valuation.
  - `recommended_equity_stake` (number): Recommended equity stake for partnership.
  - `projected_roi` (number): Estimated return on investment.

## Examples

### Request Example
```json
POST /api/creator/brand-value
{
  "creator_id": "123e4567-e89b-12d3-a456-426614174000",
  "include_projections": true,
  "time_period": "90d"
}
```

### Response Example
```json
{
  "total_brand_value": 250000,
  "engagement_score": 75,
  "revenue_score": 80,
  "market_score": 70,
  "growth_potential": 85,
  "risk_factors": ["market saturation", "high competition"],
  "valuation_breakdown": {
    "engagement_value": 100000,
    "revenue_multiple": 2.5,
    "market_premium": 1.8,
    "growth_multiplier": 1.5
  },
  "partnership_recommendations": {
    "ideal_deal_size": 50000,
    "recommended_equity_stake": 10,
    "projected_roi": 3.2
  }
}
```

This documentation provides a comprehensive overview of the Creator Brand Value API, detailing the request structure and expected responses for efficient integration.
```