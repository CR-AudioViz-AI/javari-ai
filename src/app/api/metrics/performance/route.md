# Build Real-Time Performance Metrics API

# Real-Time Performance Metrics API Documentation

## Purpose
The Real-Time Performance Metrics API provides an interface to collect, retrieve, and analyze performance-related metrics from applications and services. It captures data such as response times, throughput, error rates, and resource utilization, allowing developers and operators to monitor application performance in real-time.

## Usage
This API can be integrated into applications running on the Next.js framework, leveraging Supabase for data storage and Redis for caching. It supports querying performance metrics for various time ranges and granularities, making it suitable for both short-term monitoring and historical analysis.

## Parameters/Props

### Query Parameters
The API accepts the following query parameters:

- **timeRange**: (optional) Defines the time range for retrieving metrics. Defaults to `1h`.
  - Options: `1m`, `5m`, `15m`, `1h`, `6h`, `24h`, `7d`, `30d`
  
- **granularity**: (optional) Defines the granularity of the returned metrics. Defaults to `1m`.
  - Options: `1s`, `10s`, `1m`, `5m`, `15m`, `1h`, `1d`
  
- **metricTypes**: (optional) Specifies the types of metrics to include in the response.
  
- **format**: (optional) Determines the response format. Defaults to `json`.
  - Options: `json`, `prometheus`
  
- **includeHistorical**: (optional) Indicates whether to include historical trends in the response. Defaults to `true`.
  
### Response Structure
The API returns a JSON object with the following structure:

- **timestamp**: The timestamp of the metrics collection.
- **responseTime**: Average, P95, P99, minimum, and maximum response times for requests.
- **throughput**: Requests per second and the total requests served.
- **errorRates**: Total errors and error rate breakdown by type.
- **resourceUtilization**: Metrics on CPU usage, memory, and disk utilization.
- **customMetrics**: Optional object for additional user-defined metrics.

### Errors
Common errors include invalid query parameters that do not match the defined options and internal server errors.

## Return Values
The API responds with a structure containing the requested performance metrics or an error message if the query fails.

## Examples

### Example 1: Basic Request
Retrieve performance metrics for the last hour with default settings.

```http
GET /api/metrics/performance?timeRange=1h&granularity=1m
```

### Example 2: Custom Granularity and Format
Get performance metrics over the last 24 hours with 10-second granularity in Prometheus format.

```http
GET /api/metrics/performance?timeRange=24h&granularity=10s&format=prometheus
```

### Example 3: Include Historical Trends
Request metrics over the last week while including historical trends.

```http
GET /api/metrics/performance?timeRange=7d&includeHistorical=true
```

This documentation provides a clear guideline for developers looking to implement and utilize the Real-Time Performance Metrics API in their applications.