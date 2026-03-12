# Generate CRM Integration API Suite

# CRM Integration API Suite Documentation

## Purpose
The CRM Integration API Suite facilitates integration with popular CRM systems such as Salesforce, HubSpot, and Microsoft Dynamics. It provides functionalities for managing contacts, leads, and opportunities, while utilizing external services like Supabase for database management, Redis for caching, and Pusher for real-time notifications.

## Usage
The API Suite is designed to be used within a Next.js application. After setting up the environment variables as specified, you can utilize the API methods for interacting with your chosen CRM provider. The API handles request validation and integrates necessary services for effective data management.

## Environment Variables
You need to configure the following environment variables for the application to run successfully:

- `SUPABASE_URL`: The URL for the Supabase service.
- `SUPABASE_SERVICE_KEY`: The service key for accessing Supabase.
- `REDIS_URL`: The connection URL for Redis.
- `PUSHER_APP_ID`: The application ID for Pusher.
- `PUSHER_KEY`: The key for Pusher.
- `PUSHER_SECRET`: The secret for Pusher.
- `PUSHER_CLUSTER`: The cluster for Pusher.
- `SENTRY_DSN`: Optional, the Data Source Name for Sentry error tracking.

## Parameters/Props
The APIs use several schemas to validate input data:

1. **CRMProviderSchema**: 
   - Type: `z.enum`
   - Values: `['salesforce', 'hubspot', 'dynamics']`
   
2. **ContactSchema**: 
   - **id**: `string` (required)
   - **firstName**: `string` (optional)
   - **lastName**: `string` (optional)
   - **email**: `string` (optional, must be a valid email)
   - **phone**: `string` (optional)
   - **company**: `string` (optional)
   - **customFields**: `record<any>` (optional)

3. **LeadSchema**: 
   - **id**: `string` (required)
   - **firstName**: `string` (optional)
   - **lastName**: `string` (optional)
   - **email**: `string` (optional, must be a valid email)
   - **company**: `string` (optional)
   - **status**: `string` (optional)
   - **source**: `string` (optional)
   - **customFields**: `record<any>` (optional)

4. **OpportunitySchema**:
   - **id**: `string` (required)
   - **name**: `string` (required)
   - **amount**: `number` (optional)
   - **stage**: `string` (optional)
   - **probability**: `number` (optional, must be between 0-100)
   - **closeDate**: `string` (optional)

## Return Values
The API methods return a Promise that resolves to the result of the operation, whether it is a success notification, data retrieval from the database, or an error message.

## Examples
```javascript
import { CRMProviderSchema, ContactSchema } from './integrations/crm';

const provider = 'salesforce'; // or 'hubspot' or 'dynamics'
const contact = {
  id: '12345',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '555-1234',
};

// Validate CRM provider
CRMProviderSchema.parse(provider);

// Validate contact
ContactSchema.parse(contact);

// Use contact with CRM API
// api.createContact(provider, contact).then(response => {
//   console.log('Contact created:', response);
// });
```

This documentation provides a structured overview of the capabilities and requirements of the CRM Integration API Suite, enabling easy integration and usage within your applications.