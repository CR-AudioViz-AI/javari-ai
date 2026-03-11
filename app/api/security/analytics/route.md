# Create Security Event Analytics API

# Security Event Analytics API Documentation

## Purpose
The Security Event Analytics API provides a framework for analyzing security events, calculating risk scores, detecting anomalies, and classifying threats within a specified time range. It supports real-time, batch, and historical analyses, incorporating machine learning insights and defined security patterns.

## Usage
This API can be integrated into web applications for monitoring and managing security events, enabling proactive responses to potential threats by analyzing data through various lenses.

### Endpoint
This API is exposed via a specific route defined in your application. Make sure to configure appropriate request handling for the API endpoint.

## Parameters/Props

### `AnalyticsRequest`
- **events** (optional): An array of `SecurityEvent` objects to be analyzed.
- **timeRange** (optional): Specify the `start` and `end` timestamps for the analysis.
- **filters** (optional): 
  - **event_types**: Array of types of events to filter.
  - **severity**: Array of severity levels to filter.
  - **source_ips**: Array of IP addresses to filter by.
  - **user_ids**: Array of user IDs to filter by.
- **analysis_type**: (required) Type of analysis to perform (`real_time`, `batch`, or `historical`).
- **include_ml_analysis** (optional): Boolean flag to include machine learning analyses.
- **include_patterns** (optional): Boolean flag to include security patterns in the analysis.
- **include_predictions** (optional): Boolean flag to include risk predictions.

### `AnalyticsResponse`
- **summary**: Overview statistics of the analyzed events.
  - **total_events**: Total number of events processed.
  - **unique_sources**: Number of unique source IP addresses.
  - **high_risk_events**: Number of identified high-risk events.
  - **anomalies_detected**: Number of anomalies found during analysis.
- **risk_score**: Calculated `RiskScore` object indicating overall risk and contributing factors.
- **anomalies**: Array of detected security events with associated `AnomalyScore`.
- **threats**: Array of classified threats associated with each event.
- **patterns**: Detected security patterns based on the input events.
- **alerts**: Array of alerts generated based on the findings, including level and messages.
- **predictions** (optional): Future risk predictions, such as predicted risk score for the next hour.

## Return Values
When a valid `AnalyticsRequest` is processed, the API returns an `AnalyticsResponse` encapsulating all pertinent data regarding the analyzed security events, summaries, risks, anomalies, classifications, and alerts generated during the analysis.

## Examples

### Example Request
```json
{
  "events": [
    {
      "id": "event1",
      "timestamp": "2023-10-01T10:00:00Z",
      "event_type": "login_failed",
      "source_ip": "192.168.1.1",
      "action": "failed_login",
      "resource": "user_account",
      "status": "failed",
      "metadata": {},
      "severity": "high"
    }
  ],
  "timeRange": {
    "start": "2023-09-30T00:00:00Z",
    "end": "2023-10-01T23:59:59Z"
  },
  "filters": {
    "event_types": ["login_failed"],
    "severity": ["high"]
  },
  "analysis_type": "historical",
  "include_ml_analysis": true,
  "include_patterns": true,
  "include_predictions": true
}
```

### Example Response
```json
{
  "summary": {
    "total_events": 5,
    "unique_sources": 3,
    "high_risk_events": 2,
    "anomalies_detected": 1
  },
  "risk_score": {
    "overall": 85,
    "components": {
      "frequency": 40,
      "severity": 70,
      "anomaly": 90,
      "pattern": 60
    },
    "trend": "increasing"
  },
  "anomalies": [],
  "threats": [],
  "patterns": [],
  "alerts": [
    {
      "id": "alert1",
      "level": "warning",
      "message": "Multiple failed login attempts detected.",
      "events": ["event1"],
      "timestamp": "2023-10-01T10:05:00Z"
    }
  ],
  "predictions": {
    "next_hour_risk": 90
  }
}
``` 

This documentation provides essential information to effectively utilize the Security Event Analytics API for real-time security monitoring and threat detection.