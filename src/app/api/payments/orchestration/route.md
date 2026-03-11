# Build Payment Method Orchestration API

# Payment Method Orchestration API Documentation

## Purpose
The Payment Method Orchestration API facilitates the routing and processing of payment attempts using various payment methods. It aids users in selecting the best available payment method based on predefined user preferences, geographical factors, processing time, and associated fees.

## Usage
To utilize this API, send requests to the endpoint configured within the application. The API accepts orchestration requests for payment attempts and can handle retry requests upon failure.

### HTTP Methods
- **POST** `/api/payments/orchestration` - To initiate a payment orchestration request.
- **POST** `/api/payments/orchestration/retry` - To retry a previously failed payment attempt.

## Parameters / Props

### Orchestration Request
- **amount**: `(number)` The total amount for the payment, must be positive.
- **currency**: `(string)` The currency code (3 characters) for the transaction.
- **country**: `(string)` The 2-character country code where the payment is being made.
- **user_id**: `(string, optional)` The ID of the user making the payment, for personalized method preferences.
- **payment_context**: `(object)` An object containing:
  - **type**: `(string)` The type of transaction, can be `subscription`, `one_time`, or `refund`.
  - **urgency**: `(string)` Indicates the transaction urgency - `low`, `medium`, or `high`.
  - **risk_level**: `(string)` The perceived level of risk - `low`, `medium`, or `high`.
- **preferences**: `(object, optional)` An object that may contain:
  - **exclude_methods**: `(array)` An array of payment method IDs to exclude from the selection.
  - **max_processing_time**: `(number)` Maximum allowable processing time in seconds.
  - **max_fees_percentage**: `(number)` Maximum fees percentage willing to accept.

### Retry Request
- **original_attempt_id**: `(string)` The ID of the original payment attempt.
- **failure_reason**: `(string)` The reason why the original attempt failed.
- **retry_count**: `(number)` The current count of retries, must be at least 0.

## Return Values
The API returns a JSON object containing the results of the orchestration or retry processes:
- **For Orchestration**:
  - **primary_method**: Details of the selected primary payment method.
  - **fallback_methods**: An array of methods to use if the primary fails.
  - **reasoning**: An object with scores explaining the routing decision.
  
- **For Retry**:
  - **status**: `(string)` Indicates whether the retry was successful or failed.
  - **reason**: Detailed feedback on the retry process.

## Examples

### Example Request for Payment Orchestration
```json
POST /api/payments/orchestration
{
    "amount": 100.00,
    "currency": "USD",
    "country": "US",
    "user_id": "user_abc123",
    "payment_context": {
        "type": "one_time",
        "urgency": "high",
        "risk_level": "medium"
    },
    "preferences": {
        "exclude_methods": ["method_x"],
        "max_processing_time": 300,
        "max_fees_percentage": 5
    }
}
```

### Example Response for Payment Orchestration
```json
{
    "primary_method": {
        "id": "method_y",
        "provider": "PayPal",
        "type": "wallet",
        "supported_countries": ["US", "CA"],
        "fees": {
            "fixed": 0,
            "percentage": 2.5,
            "currency": "USD"
        },
        "processing_time": 5,
        "enabled": true
    },
    "fallback_methods": [
        {
            "id": "method_z",
            "provider": "Stripe",
            "type": "card",
            "enabled": true
        }
    ],
    "reasoning": {
        "geography_score": 10,
        "cost_score": 9,
        "success_rate_score": 8,
        "user_preference_score": 7,
        "final_score": 34
    }
}
``` 

This documentation serves as a comprehensive guide to utilize the Payment Method Orchestration API effectively.