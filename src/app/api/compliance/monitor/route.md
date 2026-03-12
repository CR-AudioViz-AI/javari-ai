# Create Regulatory Compliance Monitoring API

# Regulatory Compliance Monitoring API

## Purpose
The Regulatory Compliance Monitoring API facilitates compliance monitoring for various regulatory frameworks. It allows organizations to track compliance activities, evaluate risks, and receive alerts as per defined parameters.

## Usage
This API is designed for use in applications needing to monitor compliance with regulations like GDPR, CCPA, and more. It accepts compliance monitoring requests and records activity events.

### Endpoint
`POST /api/compliance/monitor`

## Parameters / Props

### Monitoring Request Body
The body of the request must adhere to the `MonitoringRequestSchema` which includes:

- `framework` (string): Compliance framework to monitor. Options are: 
  - 'gdpr'
  - 'ccpa'
  - 'sox'
  - 'hipaa'
  - 'pci_dss'
  - 'iso27001'
  - 'nist'

- `scope` (array of strings): List of items to monitor. Must contain at least one element.
  
- `priority` (string, optional): Priority level of monitoring. Defaults to 'medium'. Options are:
  - 'low'
  - 'medium'
  - 'high'
  - 'critical'

- `realtime` (boolean, optional): Whether to process in real-time. Defaults to `true`.

- `notifications` (object, optional): Notification preferences.
  - `email` (array of strings): List of email addresses for notifications (must be valid emails).
  - `webhook` (string): URL for webhook notifications (must be a valid URL).
  - `slack_channel` (string): Slack channel for notifications.

### Activity Event Structure
The following schema defines the input for activity events using `ActivityEventSchema`:

- `event_id` (string): Unique identifier for the event.
- `timestamp` (string): DateTime of the event.
- `source` (string): Source of the activity (e.g., application, user).
- `user_id` (string): ID of the user responsible for the activity.
- `activity_type` (string): Type of activity (e.g., access, update).
- `data_involved` (object): Details of data involved:
  - `type` (string): Data type.
  - `classification` (string): Classification status. Options are:
    - 'public'
    - 'internal'
    - 'confidential'
    - 'restricted'
  - `location` (string): Data storage location.
  - `size` (number, optional): Size of the data involved.
- `metadata` (object, optional): Additional information related to the event.

## Return Values
Upon successful request, the API returns a response indicating the creation of the compliance monitoring configuration along with a unique identifier for tracking purposes. In case of an error, the API returns appropriate error messages detailing the issue.

## Examples

### Example Request
```json
{
  "framework": "gdpr",
  "scope": ["user_data", "transaction_records"],
  "priority": "high",
  "realtime": true,
  "notifications": {
    "email": ["admin@example.com"],
    "webhook": "https://example.com/webhook",
    "slack_channel": "#compliance-alerts"
  }
}
```

### Example Response
```json
{
  "status": "success",
  "monitoring_id": "abc123",
  "message": "Compliance monitoring configuration created successfully."
}
```

### Error Handling Example
```json
{
  "status": "error",
  "message": "Invalid framework provided. Please use one of the predefined frameworks."
}
``` 

This documentation provides all necessary information for developers to integrate the Regulatory Compliance Monitoring API effectively into their applications.