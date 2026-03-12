# Build Enterprise SSO Integration API

# Enterprise SSO Integration API Documentation

## Purpose
The Enterprise SSO Integration API facilitates Single Sign-On (SSO) functionalities within applications, allowing users to authenticate through various identity providers (IdPs) using protocols like SAML, OAuth, and OIDC. This API provides endpoints to initiate SSO authentication and handle responses.

## Usage
This API is built as a part of a Next.js application and interacts with Supabase for session management and Redis for caching. The integration can handle various SSO providers configured within the application's domain.

## Endpoints

### 1. Initiate SSO
Initiates the SSO process by redirecting the user to the appropriate IdP based on the provided `provider_id`.

#### Request
- **Method**: POST
- **Endpoint**: `/api/sso/initiate`

#### Parameters
- `provider_id` (string, required): Unique identifier of the SSO provider (UUID format).
- `relay_state` (string, optional): An opaque value that is returned back to the client upon completion of authentication.
- `domain_hint` (string, optional): A hint for the identity provider to specify the domain of the user.

#### Return Value
- **200**: Redirects the user to the IdP’s SSO endpoint.
- **4xx/5xx**: Appropriate error response indicating the cause of failure.

### 2. SSO Callback
Handles the response from the SSO provider after authentication is completed.

#### Request
- **Method**: POST
- **Endpoint**: `/api/sso/callback`

#### Parameters
- `provider_id` (string, required): Unique identifier of the SSO provider (UUID format).
- `code` (string, optional): Authorization code for OAuth/OIDC.
- `state` (string, optional): State parameter to maintain state between the request and callback.
- `saml_response` (string, optional): SAML response from the IdP.

#### Return Value
- **200**: Success response with session information.
- **4xx/5xx**: Error response detailing the authentication failure.

## Data Structures

### SSOProvider
Represents an SSO provider configuration.
```typescript
interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth' | 'oidc';
  config: SAMLConfig | OAuthConfig | OIDCConfig;
  enabled: boolean;
  domain_mapping: string[];
  role_mappings: RoleMapping[];
}
```

### SSOSession
Represents a user's SSO session.
```typescript
interface SSOSession {
  session_id: string;
  user_id: string;
  provider_id: string;
  created_at: string;
  expires_at: string;
  metadata: Record<string, any>;
}
```

### AuditLog
Logs SSO events for tracking.
```typescript
interface AuditLog {
  event_type: string;
  user_id?: string;
  provider_id: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message?: string;
  metadata: Record<string, any>;
}
```

## Examples

### Initiate SSO Example
```javascript
fetch('/api/sso/initiate', {
  method: 'POST',
  body: JSON.stringify({ provider_id: '123e4567-e89b-12d3-a456-426614174000' }),
  headers: { 'Content-Type': 'application/json' }
});
```

### SSO Callback Example
```javascript
fetch('/api/sso/callback', {
  method: 'POST',
  body: JSON.stringify({ provider_id: '123e4567-e89b-12d3-a456-426614174000', code: 'auth_code_here' }),
  headers: { 'Content-Type': 'application/json' }
});
```

This documentation outlines the core functionalities and structures of the SSO Integration API, enabling developers to implement and customize SSO features in their applications.