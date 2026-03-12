# Implement Dynamic Subscription Tier API

```markdown
# Dynamic Subscription Tier API

## Purpose
The Dynamic Subscription Tier API provides functionalities to create, update, retrieve, and manage subscription tiers for a service utilizing Stripe for payment processing. It allows for detailed configuration of tiers including pricing, usage limits, features, and billing intervals.

## Usage
The API can be accessed via HTTP requests to the `/api/subscriptions/tiers` endpoint. Supported methods include:
- `POST` to create a new subscription tier
- `PUT` to update an existing subscription tier
- `GET` to retrieve subscription tiers

## Parameters/Props

### Request Body for Create/Update Tier
- `name` (string, required): Name of the subscription tier (1-100 characters).
- `description` (string, optional): Description of the tier (maximum 500 characters).
- `base_price` (number, required): The base price of the tier (must be >= 0).
- `usage_limits` (object, required): Defines usage limits including:
  - `audio_minutes` (number, required): Allowed audio minutes (must be >= 0).
  - `visualizations` (number, required): Number of visualizations allowed (must be >= 0).
  - `exports` (number, required): Number of exports allowed (must be >= 0).
  - `api_calls` (number, required): Number of API calls allowed (must be >= 0).
- `overage_pricing` (object, required): Defines overage pricing including:
  - `audio_minutes`, `visualizations`, `exports`, `api_calls` (all must be >= 0).
- `features` (array of strings, required): Features included in the tier.
- `auto_upgrade_threshold` (number, optional): Automatic upgrade threshold (0-100).
- `billing_interval` (enum, required): Billing interval, options: 'month', 'year'.
- `priority` (number, optional): Importance of the tier (default: 0).
- `is_active` (boolean, optional): Status of the tier, default: true.
- `stripe_price_id` (string, optional): The Stripe price ID associated with the tier.

### Query Parameters for GET Tier
- `include_inactive` (string, optional): Whether to include inactive tiers ('true' or 'false').
- `billing_interval` (enum, optional): Filter by billing interval ('month' or 'year').
- `limit` (number, optional): Number of results to return (default: 50).
- `offset` (number, optional): Number of results to skip (default: 0).

## Return Values
The API will return a JSON response containing the created or updated tier details or a list of tiers based on the query parameters. Success responses will typically include a 2xx HTTP status code, while errors will return an appropriate error status code with a message.

## Examples

### Creating a Subscription Tier
```http
POST /api/subscriptions/tiers
Content-Type: application/json

{
  "name": "Pro Tier",
  "description": "Access to advanced features",
  "base_price": 25.00,
  "usage_limits": {
    "audio_minutes": 500,
    "visualizations": 50,
    "exports": 10,
    "api_calls": 1000
  },
  "overage_pricing": {
    "audio_minutes": 0.05,
    "visualizations": 0.10,
    "exports": 0.50,
    "api_calls": 0.01
  },
  "features": ["High Quality Audio", "Extended Visualizations"],
  "billing_interval": "month"
}
```

### Retrieving Subscription Tiers
```http
GET /api/subscriptions/tiers?include_inactive=false&limit=10&offset=0
```

### Updating a Subscription Tier
```http
PUT /api/subscriptions/tiers/{tier_id}
Content-Type: application/json

{
  "description": "Updated description for Pro Tier",
  "base_price": 30.00
}
```
```