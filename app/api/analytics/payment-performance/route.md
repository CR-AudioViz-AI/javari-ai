# Build Payment Performance Analytics API

# Payment Performance Analytics API Documentation

## Purpose
The Payment Performance Analytics API provides an endpoint to analyze payment transaction data based on various filters such as date range, regions, payment methods, and granularity. It returns metrics related to payment performance, giving insights into success rates, transaction counts, revenue, and processing times.

## Usage
This API is typically used in applications that require monitoring of payment performance, enabling businesses to analyze transaction data and make informed decisions based on the collected metrics.

## Endpoint
The API can be accessed through a defined route: 
```
POST /api/analytics/payment-performance
```

## Parameters/Props
The API accepts a JSON body with the following optional parameters:

- **startDate**: (string) The start date for filtering transactions in `YYYY-MM-DD` format.
- **endDate**: (string) The end date for filtering transactions in `YYYY-MM-DD` format.
- **regions**: (string) Comma-separated list of regions to filter the data.
- **paymentMethods**: (string) Comma-separated list of payment methods to filter the transactions.
- **granularity**: (enum) Level of detail for grouping transactions. Options: `hour`, `day`, `week`, `month`. Defaults to `day`.
- **includeRevenue**: (boolean) Indicator to include total revenue in the response. Defaults to `true`.
- **includeProcessingTimes**: (boolean) Indicator to include processing times in the response. Defaults to `true`.

## Return Values
The API returns a response in JSON format with the following structure:

```json
{
  "overall_metrics": { 
    //... Aggregated payment metrics 
  },
  "regional_breakdown": [ 
    //... Breakdown by region 
  ],
  "payment_method_breakdown": [ 
    //... Breakdown by payment method 
  ],
  "time_series": [ 
    //... Time series data with metrics 
  ],
  "metadata": { 
    //... Metadata regarding the query 
  }
}
```

### Response Types
- **PaymentMetrics**: Contains metrics such as success rate, total transactions, average processing time, etc.
- **RegionalMetrics**: Extends PaymentMetrics with region and country code.
- **PaymentMethodMetrics**: Extends PaymentMetrics with payment method details.
- **TimeSeriesData**: Contains timestamp and corresponding metrics for time-based analysis.
- **PaymentAnalyticsResponse**: Comprehensive response object encapsulating all data.

## Examples

### Example Request
```json
POST /api/analytics/payment-performance
{
  "startDate": "2023-01-01",
  "endDate": "2023-01-31",
  "regions": "NA,EU",
  "paymentMethods": "credit_card,paypal",
  "granularity": "day"
}
```

### Example Response
```json
{
  "overall_metrics": {
    "success_rate": 95.3,
    "total_transactions": 1000,
    "successful_transactions": 950,
    "failed_transactions": 50,
    "average_processing_time": 2.5,
    "median_processing_time": 2.0,
    "total_revenue": 150000,
    "average_transaction_value": 150
  },
  "regional_breakdown": [
    {
      "region": "NA",
      "country_code": "US",
      "success_rate": 96.0,
      //... additional metrics
    }
  ],
  "payment_method_breakdown": [
    {
      "payment_method": "credit_card",
      "method_type": "card",
      "total_transactions": 600,
      //... additional metrics
    }
  ],
  "time_series": [
    {
      "timestamp": "2023-01-01",
      "metrics": {
        "success_rate": 97.0,
        //... additional metrics
      }
    }
  ],
  "metadata": {
    "date_range": {
      "start": "2023-01-01",
      "end": "2023-01-31"
    },
    "total_records": 1000,
    "cache_hit": true,
    "generated_at": "2023-02-01T00:00:00Z"
  }
}
```

This API allows users to comprehensively analyze payment performance data, facilitating better decision-making and strategic enhancements in payment processing.