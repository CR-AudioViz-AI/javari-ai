# Generate Infrastructure-as-Code API

```markdown
# Infrastructure-as-Code API Documentation

## Purpose
The `Infrastructure-as-Code API` provides an endpoint to generate infrastructure templates for various cloud providers using Terraform or Kubernetes, validate cloud provider limits, and estimate resource costs.

## Usage
This API can be integrated into applications needing to automate the generation of infrastructure templates based on user-defined resources and configurations. It ensures compliance with provider-specific limitations and offers cost estimation.

## Parameters/Props
The API accepts the following parameters in the request body:

- **provider**: `string` (required) - The target cloud provider (e.g., AWS, Azure, GCP).
- **resources**: `object` (required) - Resource specifications (e.g., instance types, storage sizes).
- **templateType**: `string` (optional) - The type of template to generate, either "terraform" or "kubernetes".
- **userId**: `string` (optional) - The ID of the user making the request, for tracking and limiting purposes.

### Rate Limiting
Requests to the API are subject to rate limiting to prevent abuse, configured in the `rate-limit` library.

## Return Values
The API returns a JSON object with the following properties:
- **status**: `string` - Indicates if the operation was successful or failed.
- **data**: `object` - Contains the generated infrastructure template and cost estimates if applicable.
  - **template**: `string` - The generated infrastructure code (Terraform or Kubernetes).
  - **cost**: `object` - Estimated costs for resources.
    - **monthlyCost**: `number` - Monthly cost estimate.
    - **yearlyCost**: `number` - Yearly cost estimate.
- **error**: `string` (optional) - Description of an error if the operation failed.

## Examples

### Example Request
```json
POST /api/infrastructure/generate
{
  "provider": "AWS",
  "resources": {
    "instanceType": "t2.micro",
    "storage": "20GB"
  },
  "templateType": "terraform",
  "userId": "12345"
}
```

### Example Successful Response
```json
{
  "status": "success",
  "data": {
    "template": "resource \"aws_instance\" \"example\" {...}",
    "cost": {
      "monthlyCost": 15.00,
      "yearlyCost": 180.00
    }
  }
}
```

### Example Error Response
```json
{
  "status": "error",
  "error": "Cloud provider validation failed"
}
```

## Note
Ensure that all environment variables (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `CLOUD_VALIDATOR_API_URL`, and others) are correctly set for the API to function properly. Rate limiting may apply based on user ID.
```