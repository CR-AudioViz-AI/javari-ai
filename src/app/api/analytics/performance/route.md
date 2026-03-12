# Create Real-Time Performance Analytics API

# Real-Time Performance Analytics API

## Purpose
The Real-Time Performance Analytics API provides endpoints for recording and querying performance metrics in real-time. It aims to enhance application monitoring by allowing developers to analyze system performance, detect bottlenecks, and ensure health status reporting.

## Usage
To use the Performance Analytics API, send HTTP requests to the available endpoints for submitting performance metrics or querying aggregated performance data.

### Endpoints
- **POST /api/analytics/performance/metrics**: Submit performance metrics.
- **GET /api/analytics/performance/query**: Retrieve performance metrics based on predefined filters and parameters.

## Parameters/Props

### Performance Metrics Submission (POST /api/analytics/performance/metrics)
- **type** (`string`): Type of performance metric (`page_load`, `api_response`, `database_query`, `user_interaction`, `system_resource`).
- **name** (`string`): Descriptive name of the metric (1-100 characters).
- **value** (`number`): The measured value, must be a positive number.
- **unit** (`string`): Measurement unit (`ms`, `bytes`, `percent`, `count`).
- **timestamp** (`number`, optional): Timestamp of the metric (in milliseconds since epoch).
- **metadata** (`object`, optional): Additional data as key-value pairs.
- **user_id** (`string`, optional): Unique identifier for the user (UUID format).
- **session_id** (`string`, optional): Unique session identifier (UUID format).
- **url** (`string`, optional): URL associated with the metric (valid URL format).

### Performance Metrics Query (GET /api/analytics/performance/query)
- **timeframe** (`string`, default: `24h`): Time period for data aggregation (`1h`, `24h`, `7d`, `30d`).
- **metrics** (`array`, optional): List of specific metrics to query.
- **aggregation** (`string`, default: `avg`): Aggregation method to apply (`avg`, `min`, `max`, `p95`, `p99`).
- **interval** (`string`, default: `5m`): Time interval for data aggregation (`1m`, `5m`, `15m`, `1h`).
- **filters** (`object`, optional): Optional filtering criteria:
  - **type** (`string`): Filter by type of metric.
  - **url** (`string`): Filter by specific URL.
  - **user_id** (`string`): Filter by user ID (UUID format).

## Return Values
- The performance metrics submission endpoint returns a success status or error message based on processing.
- The metrics query endpoint returns an aggregation of performance metrics based on the provided filters and parameters, including the requested statistical data.

## Examples

### Submitting a Performance Metric
```json
POST /api/analytics/performance/metrics
{
  "type": "page_load",
  "name": "Homepage Load Time",
  "value": 250,
  "unit": "ms",
  "timestamp": 1637005800000,
  "metadata": {
    "browser": "Chrome",
    "version": "92"
  },
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "550e8400-e29b-41d4-a716-446655440001",
  "url": "https://example.com"
}
```

### Querying Performance Metrics
```json
GET /api/analytics/performance/query?timeframe=24h&aggregation=avg&interval=5m&metrics=page_load&filters[type]=page_load
```

This documentation provides a clear overview of how to use the Real-Time Performance Analytics API for effective performance monitoring and analysis.