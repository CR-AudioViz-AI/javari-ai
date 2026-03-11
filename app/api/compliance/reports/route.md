# Build Automated Compliance Reporting API

# Automated Compliance Reporting API

## Purpose
The Automated Compliance Reporting API provides endpoints for generating and retrieving compliance reports based on specified legal standards, such as SOX, GDPR, and HIPAA. It enables organizations to automate their compliance reporting process, ensuring timely and accurate report generation and distribution.

## Usage
This API endpoint is designed to handle HTTP POST requests for creating compliance reports. It ensures that requests meet the defined validation criteria, applies rate limiting, and can deliver reports via download or email.

### Endpoint
- `POST /api/compliance/reports`

## Parameters/Props

The following parameters are required in the request body for generating a compliance report:

### Compliance Report Request Schema
```typescript
{
  reportType: 'SOX' | 'GDPR' | 'HIPAA' | 'COMBINED', // Type of report to generate
  dateRange: { 
    startDate: string, // Start date of the report in ISO format
    endDate: string    // End date of the report in ISO format
  },
  includeAuditTrail?: boolean, // Optional flag to include audit trail (default: true)
  format?: 'PDF' | 'JSON' | 'CSV', // Optional report format (default: 'PDF')
  deliveryMethod?: 'DOWNLOAD' | 'EMAIL', // Optional delivery method (default: 'DOWNLOAD')
  emailRecipients?: string[], // Optional list of email addresses for report delivery
  organizationId: string // UUID of the organization for which the report is generated
}
```

### Compliance Query Schema (for report retrieval)
```typescript
{
  page?: number, // Optional page number for pagination (default: 1)
  limit?: number, // Optional number of reports to return per page (default: 50, max: 999)
  reportType?: 'SOX' | 'GDPR' | 'HIPAA' | 'COMBINED', // Optional filter by report type
  status?: 'PENDING' | 'COMPLETED' | 'FAILED', // Optional filter by report status
  organizationId: string // UUID of the organization
}
```

## Return Values
Upon successful creation of a report, the API will respond with:
- A status message confirming the report generation (including report ID if applicable).
- If delivered via email, an acknowledgment of the email sent.

In case of validation errors, a descriptive error message will be returned indicating the validation failures.

## Examples

### Generating a Compliance Report
**Request:**
```http
POST /api/compliance/reports
Content-Type: application/json

{
  "reportType": "GDPR",
  "dateRange": {
    "startDate": "2023-01-01T00:00:00Z",
    "endDate": "2023-12-31T23:59:59Z"
  },
  "includeAuditTrail": true,
  "format": "PDF",
  "deliveryMethod": "EMAIL",
  "emailRecipients": ["example@domain.com"],
  "organizationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "GDPR report has been generated and sent to example@domain.com."
}
```

### Error Example
**Request with Invalid Email:**
```http
POST /api/compliance/reports
Content-Type: application/json

{
  "reportType": "SOX",
  "dateRange": {
    "startDate": "2023-01-01T00:00:00Z",
    "endDate": "2023-12-31T23:59:59Z"
  },
  "emailRecipients": ["invalid-email"],
  "organizationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "status": "error",
  "message": "Validation failed: emailRecipients contains an invalid email format."
}
```

This documentation describes the key features and usage of the Automated Compliance Reporting API, enabling developers to integrate compliance reporting capabilities effortlessly.