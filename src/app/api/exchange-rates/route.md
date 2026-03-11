# Implement Real-Time Currency Exchange API

# Real-Time Currency Exchange API Documentation

## Purpose
The Real-Time Currency Exchange API facilitates fetching and converting currency exchange rates in real-time. It supports multiple currency providers and allows users to hedge against potential volatility.

## Usage
This API can be utilized in various applications that require currency exchange information—such as financial dashboards, trading platforms, and conversion tools.

### Endpoint
- `GET /api/exchange-rates`

## Parameters/Props
### Query Parameters
The API accepts the following query parameters:

1. **from** (string, required)
   - Currency code from which the conversion is made (e.g., 'USD').
   - Must be an uppercase string between 3 to 10 characters long.

2. **to** (string, required)
   - Currency code to which the conversion is made (e.g., 'EUR').
   - Must be an uppercase string between 3 to 10 characters long.

3. **amount** (number, optional)
   - The amount of currency to convert.
   - Must be a positive number, with a maximum value of 1,000,000. Defaults to 1.

4. **provider** (string, optional)
   - The source for exchange rates. Options:
     - 'auto' (default): Automatically select the best provider.
     - 'exchangerate-api'
     - 'coingecko'
     - 'fixer'

5. **hedge** (boolean, optional)
   - Whether to apply a hedging strategy. Defaults to false.

### Rate Limiting
The API implements rate limiting to ensure fair usage. Ensure to handle potential rate limit errors in your application.

## Return Values
The API returns an object that contains:
- **convertedAmount** (number): The converted currency amount.
- **exchangeRate** (number): The rate used for conversion.
- **provider** (string): The name of the provider used for fetching rates.
- **timestamp** (Date): The time when the rate was fetched.
- **hedgingStrategy** (HedgingStrategy, optional): Contains additional information if hedging is applied.

### HedgingStrategy Object
- **recommendedRate** (number): Suggested rate for hedging.
- **confidence** (number): Confidence level in the suggested rate.
- **volatility** (number): Measure of rate volatility.
- **recommendations** (string[]): List of recommendations.

## Examples

### Basic Conversion
```http
GET /api/exchange-rates?from=USD&to=EUR&amount=100
```
**Response:**
```json
{
  "convertedAmount": 85,
  "exchangeRate": 0.85,
  "provider": "exchangerate-api",
  "timestamp": "2023-10-01T12:00:00Z"
}
```

### Conversion with Hedge
```http
GET /api/exchange-rates?from=GBP&to=JPY&amount=150&hedge=true
```
**Response:**
```json
{
  "convertedAmount": 21000,
  "exchangeRate": 140.0,
  "provider": "coingecko",
  "timestamp": "2023-10-01T12:00:00Z",
  "hedgingStrategy": {
    "recommendedRate": 139.5,
    "confidence": 0.8,
    "volatility": 0.02,
    "recommendations": ["Consider hedging"]
  }
}
```

### Fetching Available Currency Pairs
```http
GET /api/exchange-rates/pairs?type=fiat&limit=10
```
**Response:**
```json
{
  "pairs": ["USD-EUR", "GBP-JPY", "AUD-NZD"]
}
```

This API is designed to be robust and flexible, catering to a variety of currency conversion needs. Ensure to validate input parameters and handle any errors that may arise during requests.