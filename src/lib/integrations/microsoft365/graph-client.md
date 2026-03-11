# Create Microsoft 365 Integration API

# Microsoft 365 Integration API Documentation

## Purpose
The Microsoft 365 Integration API allows you to authenticate and interact with Microsoft Graph services such as Teams, SharePoint, and Office applications. It provides a unified way to handle requests and responses to the Microsoft Graph API and uses Microsoft Authentication Library (MSAL) for secure access.

## Usage
This API is designed to be consumed within a Next.js application. It allows requests for various actions against the Microsoft 365 ecosystem, leveraging a supabase client for data management and rate limiting utilities for performance enhancement.

### Import
```typescript
import { GraphClient } from 'src/lib/integrations/microsoft365/graph-client';
```

## Parameters/Props

### Environment Variables
To properly initialize, the following environment variables must be set:
- `MICROSOFT_CLIENT_ID`: Your Microsoft application's client ID.
- `MICROSOFT_CLIENT_SECRET`: Your Microsoft application's client secret.
- `MICROSOFT_TENANT_ID`: Your Microsoft Azure tenant ID.
- `SUPABASE_URL`: The URL of your Supabase instance.
- `SUPABASE_ANON_KEY`: The anonymous key for your Supabase instance.

### Graph Request Schema
Requests to the API should adhere to the following structure:
```typescript
{
  action: 'auth' | 'teams' | 'sharepoint' | 'office' | 'webhook' | 'permissions',
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint?: string,
  data?: any,
  userId?: string,
  scopes?: string[]
}
```

## Return Values
The methods in this API return promises with the following outcomes:
- **getAccessToken**: Resolves to a string representing the access token needed for authenticating requests.
- **Error Handling**: If the operation fails (e.g., due to invalid credentials, expired token), a relevant error message will be returned.

## Examples

### Initialize Graph Client
```typescript
const graphClient = GraphClient.getInstance();
```

### Get Access Token
```typescript
const userId = 'user@example.com';
const scopes = ['User.Read', 'Mail.Read'];

try {
  const accessToken = await graphClient.getAccessToken(userId, scopes);
  console.log('Access Token:', accessToken);
} catch (error) {
  console.error('Error retrieving access token:', error);
}
```

### Make a Request
After acquiring an access token, you can make requests to the Microsoft Graph API using the appropriate method and endpoint.
```typescript
const graphRequest = {
  action: 'teams',
  method: 'GET',
  endpoint: '/me/joinedTeams',
  userId: userId,
  scopes: ['Group.Read.All']
};

try {
  const response = await graphClient.makeRequest(graphRequest);
  console.log('Teams Response:', response);
} catch (error) {
  console.error('Error making graph request:', error);
}
```

Ensure the required permissions are granted for the actions you intend to perform in Microsoft 365.