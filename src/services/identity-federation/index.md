# Implement Enterprise Identity Federation Service

# Enterprise Identity Federation Service

## Purpose
The Enterprise Identity Federation Service provides Single Sign-On (SSO) integration across multiple identity providers, enabling authentication via SAML, OAuth 2.0, and OpenID Connect protocols. This service simplifies user management and enhances security by federating identities across different platforms.

## Usage
To utilize the Enterprise Identity Federation Service, instantiate the necessary entities and utilize the provided interfaces for managing identity providers, authentication processes, and federated user information.

## Parameters / Props

### IdentityProvider
Represents a configured identity provider.
- `id` (string): Unique identifier for the provider.
- `name` (string): Name of the identity provider.
- `type` (enum): Type of identity provider (`active-directory`, `okta`, `azure-ad`).
- `protocol` (enum): Authentication protocol used (`saml`, `oauth2`, `oidc`).
- `config` (Record<string, any>): Configuration parameters specific to the provider.
- `enabled` (boolean): Indicates if the provider is active.
- `tenantId` (string, optional): Optional tenant ID.
- `createdAt` (Date): Timestamp of creation.
- `updatedAt` (Date): Timestamp of last update.

### FederatedUser
Represents a user federated through an identity provider.
- `id` (string): Unique identifier for the user.
- `providerId` (string): ID of the identity provider.
- `providerUserId` (string): User ID from the provider.
- `email` (string): User's email address.
- `firstName` (string, optional): User's first name.
- `lastName` (string, optional): User's last name.
- `displayName` (string, optional): User's display name.
- `groups` (string[], optional): User's group memberships.
- `attributes` (Record<string, any>): Other user attributes.
- `lastLoginAt` (Date, optional): Timestamp of the last login.
- `createdAt` (Date): Timestamp of creation.
- `updatedAt` (Date): Timestamp of last update.

### AuthenticationRequest
Parameters for initiating an authentication request.
- `providerId` (string): ID of the identity provider.
- `redirectUrl` (string): URL to redirect after authentication.
- `tenantId` (string, optional): Optional tenant ID.
- `state` (string, optional): Optional state parameter for request validation.
- `scopes` (string[], optional): Scopes to request.

### AuthenticationResult
The result of an authentication attempt.
- `success` (boolean): Indicates if authentication was successful.
- `user` (FederatedUser, optional): Authenticated user details.
- `accessToken` (string, optional): OAuth access token.
- `refreshToken` (string, optional): OAuth refresh token.
- `expiresIn` (number, optional): Token expiration time in seconds.
- `error` (string, optional): Error message if authentication fails.
- `redirectUrl` (string, optional): URL to redirect to after authentication.

### ProviderConfig
Base configuration for authentication providers that includes:
- `clientId` (string): Client identifier for the provider.
- `clientSecret` (string): Client secret for the provider.
- `callbackUrl` (string): Redirect URI after authentication (required).

## Examples

```typescript
// Example of creating an IdentityProvider
const provider: IdentityProvider = {
    id: '1',
    name: 'Okta',
    type: 'okta',
    protocol: 'oidc',
    config: { /* configuration details */ },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

// Example of an AuthenticationRequest
const authRequest: AuthenticationRequest = {
    providerId: '1',
    redirectUrl: 'https://example.com/callback',
    state: 'random-state-string',
    scopes: ['openid', 'profile'],
};

// Simulating an authentication process
const result: AuthenticationResult = {
    success: true,
    user: {
        id: 'user-123',
        providerId: '1',
        providerUserId: 'provider-user-456',
        email: 'user@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    accessToken: 'some-access-token',
    expiresIn: 3600,
};
``` 

This documentation serves as a concise reference for using the Enterprise Identity Federation Service, outlining key components, their configurations, and examples of implementation.