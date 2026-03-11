# Create Dynamic Pricing API for Creator Services

# Dynamic Pricing API for Creator Services

## Purpose
The Dynamic Pricing API provides endpoints to calculate optimal pricing for creator services, conduct A/B testing for price variations, and update test data based on performance. This API leverages demand forecasting, competitive analysis, and performance metrics to suggest dynamic pricing that maximizes revenue.

## Usage
This API can be used to:
- Calculate the optimal price for a specific service provided by a creator.
- Conduct A/B tests on various pricing strategies to identify the most effective price points.
- Update A/B test results with conversion data for better decision-making.

## Parameters/Props

### Endpoints
1. **Calculate Optimal Price**
   - **Method**: `POST /api/creator/pricing/dynamic/calculate`
   - **Request Body**:
     - `serviceId` (string): UUID of the service.
     - `creatorId` (string): UUID of the creator.
     - `basePrice` (number): The initial price point (must be positive).
     - `forceRecalculation` (boolean, optional): Forces recalculation regardless of caching.

2. **Create A/B Test**
   - **Method**: `POST /api/creator/pricing/dynamic/ab-test`
   - **Request Body**:
     - `serviceId` (string): UUID of the service.
     - `creatorId` (string): UUID of the creator.
     - `priceVariants` (array of numbers): Array of positive price points (min 2, max 5).
     - `testName` (string): Name of the A/B test (1-100 characters).
     - `duration` (number): Duration in days (1-30).
     - `trafficSplit` (array of numbers): Percentage split among price variants (between 0 and 100).

3. **Update A/B Test**
   - **Method**: `PATCH /api/creator/pricing/dynamic/updateTest`
   - **Request Body**:
     - `testId` (string): UUID of the A/B test.
     - `conversionData` (object):
       - `variant` (number): Index of the price variant.
       - `conversions` (number): Number of conversions.
       - `impressions` (number): Number of impressions.
       - `revenue` (number): Total revenue generated.

## Return Values
- **Calculate Optimal Price**: Returns an object containing:
  - `suggestedPrice` (number): The calculated optimal price.
  - `confidence` (number): Confidence level of the suggested price (0-1).
  - `factors` (object): Breakdown of contributing factors (demand score, competition score, performance score).

- **Create A/B Test**: Returns the test ID of the created A/B test.

- **Update A/B Test**: Returns a confirmation of update success.

## Examples

### Calculate Optimal Price
```json
POST /api/creator/pricing/dynamic/calculate
{
  "serviceId": "abcd-1234-efgh-5678",
  "creatorId": "ijkl-9101-mnop-1121",
  "basePrice": 100,
  "forceRecalculation": true
}
```
Response:
```json
{
  "suggestedPrice": 120,
  "confidence": 0.85,
  "factors": {
    "demandScore": 0.7,
    "competitionScore": 0.5,
    "performanceScore": 0.8
  }
}
```

### Create A/B Test
```json
POST /api/creator/pricing/dynamic/ab-test
{
  "serviceId": "abcd-1234-efgh-5678",
  "creatorId": "ijkl-9101-mnop-1121",
  "priceVariants": [100, 120, 140],
  "testName": "Summer Sale Test",
  "duration": 14,
  "trafficSplit": [50, 30, 20]
}
```
Response:
```json
{
  "testId": "xyzz-9876-qrst-5432"
}
```

### Update A/B Test
```json
PATCH /api/creator/pricing/dynamic/updateTest
{
  "testId": "xyzz-9876-qrst-5432",
  "conversionData": {
    "variant": 1,
    "conversions": 150,
    "impressions": 1000,
    "revenue": 18000
  }
}
```
Response:
```json
{
  "status": "success",
  "message": "Test updated successfully"
}
```