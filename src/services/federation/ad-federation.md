# Deploy Active Directory Federation Microservice

```markdown
# Active Directory Federation Microservice

## Purpose
The Active Directory Federation Microservice provides SAML and OpenID Connect (OIDC) federation capabilities, enabling single sign-on (SSO) and automated user provisioning for enterprise customers integrating with Active Directory.

## Usage
This service is designed for enterprise applications requiring authentication and user management through Active Directory. It supports SSO, user synchronization, and provisioning.

### Importing the Service
```typescript
import { ADFederationService } from 'src/services/federation/ad-federation';
```

### Constructor
```typescript
const adFederationService = new ADFederationService(config);
```

## Parameters/Props

### ADFederationConfig
The constructor accepts a configuration object of type `ADFederationConfig` containing the following properties:

- **supabaseUrl**: `string` - The URL of the Supabase instance.
- **supabaseServiceKey**: `string` - The service key for accessing the Supabase instance.
- **tenantId**: `string` - The Azure AD tenant ID.
- **clientId**: `string` - The client ID for the application registered with Azure AD.
- **clientSecret**: `string` - The client secret for the application registered with Azure AD.
- **redirectUri**: `string` - The redirect URI for OIDC callbacks.
- **graphApiUrl**: `string` *(optional)* - The Microsoft Graph API URL; defaults to `https://graph.microsoft.com/v1.0`.
- **syncInterval**: `number` *(optional)* - The interval for user synchronization in milliseconds; defaults to 300000 (5 minutes).
- **maxRetries**: `number` *(optional)* - Maximum number of retry attempts for failed operations; defaults to 3.

## Return Values
Upon instantiation, the `ADFederationService` enables handling of authentication flows, user provisioning, and synchronization using various private properties:
- **supabase**: Instance of `SupabaseClient` for database interactions.
- **logger**: Instance of `Logger` for logging activities.
- **cache**: Instance of `CacheService` for caching operations.
- **audit**: Instance of `AuditService` for logging audit trails.
- **oidcClient**: Optional instance of `Client` for OIDC flows.
- **samlProvider**: Optional instance of `samlify.ServiceProvider` for SAML interactions.
- **graphClient**: Optional instance of `GraphAPIClient` for interactions with Microsoft Graph.
- **syncTimer**: Optional NodeJS timeout for managing synchronization.

## Examples

### Example Configuration and Initialization
```typescript
const config: ADFederationConfig = {
  supabaseUrl: 'https://your-supabase-url',
  supabaseServiceKey: 'your-service-key',
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app/callback',
};

const adFederationService = new ADFederationService(config);
```

### Initiating Authentication Flow
Once initialized, methods for handling authentication, user provisioning, and synchronization can be employed as needed (specific methods to be provided by the implementation).

## Conclusion
The `ADFederationService` is a powerful tool for integrating Active Directory with enterprise applications, facilitating secure authentication and user management through established standards.
```