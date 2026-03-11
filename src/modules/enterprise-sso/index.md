# Implement Enterprise SSO Identity Provider

# CR AudioViz Enterprise SSO Identity Provider

## Purpose
The CR AudioViz Enterprise Single Sign-On (SSO) Identity Provider module implements a comprehensive SSO system supporting SAML 2.0, OAuth 2.0, and OpenID Connect protocols. It allows for secure user authentication across various services within an enterprise.

## Usage
To utilize the Enterprise SSO Identity Provider, import the module in your application and initialize configurations for the desired authentication protocol (SAML, OAuth2, or OIDC). Ensure to set up metadata according to the requirements of the selected protocol.

```typescript
import { SSOConfiguration, SSOMetadata } from 'src/modules/enterprise-sso';
const ssoConfig: SSOConfiguration = {
    id: 'unique-id',
    tenantId: 'tenant-uuid',
    name: 'Example SSO Provider',
    protocol: 'SAML',
    enabled: true,
    metadata: {
        saml: {
            entityId: 'example.com',
            ssoUrl: 'https://sso.example.com/saml',
            x509Certificate: 'certificate-data',
            signRequests: true,
            encryptAssertions: false,
            nameIdFormat: 'emailAddress',
            attributeMapping: {
                email: 'Email',
                firstName: 'FirstName',
                lastName: 'LastName'
            }
        }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
};
```

## Parameters/Props

### `SSOConfiguration`
- `id`: Unique identifier for the SSO configuration (UUID).
- `tenantId`: Identifier for the tenant utilizing the SSO (UUID).
- `name`: Descriptive name of the SSO provider.
- `protocol`: Protocol type (`'SAML'`, `'OAuth2'`, `'OIDC'`).
- `enabled`: Boolean indicating if the SSO provider is active.
- `metadata`: Metadata object containing specific configuration for the selected protocol (`SSOMetadata`).
- `createdAt`: Timestamp of when the configuration was created.
- `updatedAt`: Timestamp of the last update to the configuration.

### `SSOMetadata`
- `saml`: Configuration specific to SAML if protocol is selected.
- `oauth`: Configuration specific to OAuth2 if protocol is selected.
- `oidc`: Configuration specific to OIDC if protocol is selected.

### `SSOSession`
- `id`: Unique identifier for the SSO session.
- `userId`: Identifier for the user in the session.
- `tenantId`: Identifier for the tenant associated with the session.
- `providerId`: Identifier for the SSO provider.
- `protocol`: Protocol used for the session.
- `accessToken`: Optional access token for authenticated user.
- `refreshToken`: Optional refresh token for obtaining new access tokens.
- `idToken`: Optional ID token containing user details.
- `expiresAt`: Date when the session expires.
- `attributes`: Additional user attributes.
- `createdAt`: Timestamp of when the session was created.

### `SSOUser`
- `id`: Unique identifier for the user.
- `externalId`: Identifier mapped from the external identity provider.
- `email`: User's email address.
- `firstName`: User's first name (optional).
- `lastName`: User's last name (optional).
- `displayName`: User's display name (optional).
- `roles`: Array of roles assigned to the user.
- `groups`: Array of groups the user belongs to.
- `tenantId`: Identifier for the tenant associated with the user.
- `providerId`: Identifier for the SSO provider.
- `attributes`: Additional attributes related to the user.
- `lastLogin`: Timestamp of the user's last login.
- `isActive`: Boolean indicating if the user's account is active.

## Return Values
The module does not return values directly but provides interfaces and utilities to manage SSO configurations, sessions, and user data.

## Examples
### Create a new SSO User
```typescript
const newUser: SSOUser = {
    id: 'user-id',
    externalId: 'external-user-id',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John D.',
    roles: ['user'],
    groups: ['group1'],
    tenantId: 'tenant-id',
    providerId: 'provider-id',
    attributes: { lastPurchase: '2023-01-01' },
    lastLogin: new Date(),
    isActive: true,
};
```

### Initialize a new session
```typescript
const session: SSOSession = {
    id: 'session-id',
    userId: 'user-id',
    tenantId: 'tenant-id',
    providerId: 'provider-id',
    protocol: 'OAuth2',
    accessToken