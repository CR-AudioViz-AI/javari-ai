# Implement Global Traffic Distribution API

# Global Traffic Distribution API

## Purpose
The Global Traffic Distribution API is designed to dynamically route client requests to the most efficient server based on a variety of factors including server performance metrics, client preferences, and geographical location. This helps ensure optimal latency and load management across a distributed infrastructure.

## Usage
This API endpoint processes incoming requests and returns routing decisions based on specified user preferences and server metrics. It can be integrated into applications that require efficient handling of user requests across multiple servers or services.

### Endpoint
- **HTTP Method:** POST
- **URL:** `/api/traffic-distribution`

## Parameters / Props
The API expects a JSON payload with the following structure:

### Request Body Schema
- `clientIp` (string, optional): The IP address of the client making the request.
- `userAgent` (string, optional): The User-Agent string identifying the client's browser/device.
- `acceptLanguage` (string, optional): The Accept-Language HTTP header value from the client.
- `userId` (string, optional): The unique identifier for the user, if applicable.
- `serviceType` (string, optional): The type of service being requested, one of `['api', 'cdn', 'websocket', 'streaming']`. Defaults to `'api'`.
- `priority` (string, optional): The priority of the request, one of `['low', 'normal', 'high', 'critical']`. Defaults to `'normal'`.
- `preferences` (object, optional): User-defined routing preferences, includes:
  - `region` (string, optional): Preferred geographic region.
  - `latencyThreshold` (number, optional): Maximum acceptable latency in milliseconds (0-5000).
  - `preferredProviders` (array of strings, optional): List of preferred service providers.

### Response Body Schema
On a successful request, the API returns a response that includes:
- `selectedServer` (ServerNode): The server selected for routing.
- `routingReason` (string): Reason for the server selection.
- `alternativeServers` (array of ServerNode): Backup servers that could be used.
- `estimatedLatency` (number): Estimated latency for the selected server.
- `loadBalancingWeight` (number): Weight used for load balancing decisions.
- `cacheTtl` (number): Time-to-live for the caching layer.

## Return Values
- **Status Codes:**
  - `200 OK`: Successful routing decision made.
  - `400 Bad Request`: Input validation failed.
  - `500 Internal Server Error`: An error occurred during processing.

## Examples

### Request Example
```json
{
  "clientIp": "192.168.1.1",
  "userAgent": "Mozilla/5.0",
  "acceptLanguage": "en-US",
  "userId": "user123",
  "serviceType": "api",
  "priority": "high",
  "preferences": {
    "region": "us-west",
    "latencyThreshold": 200,
    "preferredProviders": ["providerA", "providerB"]
  }
}
```

### Response Example
```json
{
  "selectedServer": {
    "id": "server1",
    "region": "us-west",
    "provider": "providerA",
    "endpoint": "https://server1.example.com",
    "capacity": 1000,
    "currentLoad": 300,
    "healthScore": 95,
    "latency": 150,
    "lastHealthCheck": "2023-10-12T12:00:00Z",
    "status": "active",
    "coordinates": {
      "lat": 37.7749,
      "lng": -122.4194
    }
  },
  "routingReason": "Best latency for user preference.",
  "alternativeServers": [],
  "estimatedLatency": 150,
  "loadBalancingWeight": 5,
  "cacheTtl": 3600
}
```