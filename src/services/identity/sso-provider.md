# Build Enterprise SSO Identity Provider Service

```markdown
# Enterprise SSO Identity Provider Service Documentation

## Purpose
The Enterprise SSO Identity Provider Service is designed to facilitate single sign-on (SSO) capabilities across various identity providers, implementing multiple SSO protocols such as SAML2, OAuth2, and OpenID Connect (OIDC). It supports multi-factor authentication (MFA) and integrates with multiple identity sources.

## Usage
To utilize the SSO Identity Provider Service, you need to instantiate and configure the service with the desired protocol and identity provider type. The service handles user authentication, session management, and MFA.

### Example Initialization
```typescript
import { SSOProvider, SSOProtocol, IdentityProviderType } from './src/services/identity/sso-provider';

const ssoProvider = new SSOProvider({
  protocol: SSOProtocol.OIDC,
  identityProvider: IdentityProviderType.ACTIVE_DIRECTORY,
});
```

## Parameters/Props
### SSOProvider Configuration
- `protocol` (**SSOProtocol**): The SSO protocol to be used (e.g., `SSOProtocol.SAML2`, `SSOProtocol.OIDC`).
- `identityProvider` (**IdentityProviderType**): The identity provider type (e.g., `IdentityProviderType.ACTIVE_DIRECTORY`, `IdentityProviderType.OKTA`).

### UserIdentity Interface
- `id` (**string**): Unique identifier of the user.
- `username` (**string**): Username of the user.
- `email` (**string**): Email address of the user.
- `displayName` (**string**): Display name of the user.
- `firstName` (**string**): (Optional) First name of the user.
- `lastName` (**string**): (Optional) Last name of the user.
- `groups` (**Array<string>**): List of groups the user belongs to.
- `attributes` (**Record<string, any>**): Additional user attributes.
- `provider` (**IdentityProviderType**): Specifies the identity provider used.
- `lastLogin` (**Date**): (Optional) Timestamp of the last login.
- `mfaEnabled` (**boolean**): Indicates if MFA is enabled.
- `mfaDevices` (**Array<MFADevice>**): List of configured MFA devices.

### MFADevice Interface
- `id` (**string**): Unique identifier for the MFA device.
- `type` (**MFAType**): Type of MFA (e.g., `MFAType.TOTP`, `MFAType.SMS`).
- `name` (**string**): Name of the MFA device.
- `secret` (**string**): (Optional) Secret key for TOTP devices.
- `phoneNumber` (**string**): (Optional) Phone number for SMS.
- `email` (**string**): (Optional) Email for email verification.
- `verified` (**boolean**): Indicates if the device is verified.
- `createdAt` (**Date**): Timestamp when the device was created.

## Return Values
The service provides various return values based on the methods invoked, including:
- Successful authentication response (e.g., access tokens for OAuth2).
- User identity information encapsulated in the `UserIdentity` interface.
- Session information through the `SessionInfo` interface.

## Examples
### Authenticate User with OAuth2
```typescript
const userCredentials = { username: 'user@example.com', password: 'password123' };
ssoProvider.authenticate(userCredentials)
  .then(user => console.log('Authenticated user:', user))
  .catch(error => console.error('Authentication failed:', error));
```

### Request MFA for User
```typescript
ssoProvider.requestMFA('user@example.com')
  .then(mfaDevice => console.log('MFA device configured:', mfaDevice))
  .catch(error => console.error('MFA request failed:', error));
```

This documentation provides an overview of setting up and utilizing the SSO Identity Provider Service effectively.
```