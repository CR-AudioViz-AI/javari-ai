# Create Dynamic Payment Fee Optimization API

# Dynamic Payment Fee Optimization API

## Purpose
The Dynamic Payment Fee Optimization API is designed to optimize payment routes based on specified criteria, including cost, speed, and reliability. It evaluates various payment service providers to offer the most suitable route for a payment transaction, enhancing user experience and reducing transaction costs.

## Usage
This API can be integrated into payment processing applications where users need to select optimal payment routes based on dynamic transactional parameters.

### Endpoint
```
POST /api/payments/optimize
```

## Parameters/Props
The request must be a JSON object containing the following fields:

- **amount** (number): The transaction amount. Must be positive and not exceed 1,000,000.
- **currency** (string): The currency code in ISO 4217 format (3 uppercase letters).
- **destination** (string): The destination for the transaction. Must be between 2 and 50 characters long.
- **priority** (string, optional): The priority for optimization. Choices are 'cost', 'speed', or 'reliability'. Defaults to 'cost'.
- **metadata** (object, optional): Additional data relevant to the payment.
  - **paymentMethod** (string): The method of payment (optional).
  - **urgency** (string): The urgency of the payment, options are 'low', 'medium', or 'high' (optional).

### Example Request
```json
{
  "amount": 100.00,
  "currency": "USD",
  "destination": "US",
  "priority": "speed",
  "metadata": {
    "paymentMethod": "credit_card",
    "urgency": "high"
  }
}
```

## Return Values
The API returns a JSON object with the following structure:

- **primary** (RouteScore): The best optimized route.
- **fallbacks** (Array<RouteScore>): Additional suitable routes.
- **optimization** (Object):
  - **priority** (string): The optimization priority used.
  - **totalRoutes** (number): Total routes examined during optimization.
  - **cacheHit** (boolean): Indicates if the result was fetched from cache.
  - **optimizationTime** (number): Time taken to optimize in milliseconds.

### Example Response
```json
{
  "primary": {
    "providerId": "provider_1",
    "providerName": "Payment Provider Inc.",
    "estimatedFee": 2.50,
    "successRate": 98.5,
    "settlementTime": 1,
    "routeScore": 95,
    "factors": {
      "costScore": 90,
      "speedScore": 95,
      "reliabilityScore": 97
    }
  },
  "fallbacks": [
    {
      "providerId": "provider_2",
      "providerName": "Another Payment Service",
      "estimatedFee": 3.00,
      "successRate": 95.0,
      "settlementTime": 2,
      "routeScore": 90,
      "factors": {
        "costScore": 85,
        "speedScore": 88,
        "reliabilityScore": 90
      }
    }
  ],
  "optimization": {
    "priority": "speed",
    "totalRoutes": 5,
    "cacheHit": false,
    "optimizationTime": 150
  }
}
```

This API facilitates efficient financial transactions by providing solutions tailored to specific user needs, automatically selecting the best payment route based on real-time data.