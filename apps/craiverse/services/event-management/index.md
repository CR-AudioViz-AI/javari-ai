# Deploy CRAIverse Event Management Service

# CRAIverse Event Management Service Documentation

## Purpose
The CRAIverse Event Management Service is a microservice designed to facilitate the management of virtual events, gatherings, and experiences within the CRAIverse ecosystem. It supports comprehensive event lifecycle management and provides real-time coordination capabilities.

## Usage
This service should be deployed in a Node.js environment. It utilizes Express for the HTTP server and Socket.IO for real-time communication. Ensure appropriate configurations are set for Supabase integration and apply necessary middleware for security and rate limiting.

### Starting the Service
To start the service, ensure the following prerequisites:
1. Node.js installed (v12 or higher).
2. Appropriate environment variables are set for configuration.

```bash
npm install
npm start
```

## Parameters/Props

### Configuration Parameters
The service accepts configuration options as follows:

- `port` (number): The port number on which the service listens.
- `supabaseUrl` (string): The URL for the Supabase backend.
- `supabaseKey` (string): The API key for authenticating with Supabase.
- `corsOrigins` (string[]): List of allowed CORS origins.
- `rateLimitWindow` (number): Time window in minutes for rate limiting.
- `rateLimitMax` (number): Maximum number of requests allowed in the rate limit window.
- `enableMetrics` (boolean): Flag to enable or disable metrics collection.
- `logLevel` ('debug' | 'info' | 'warn' | 'error'): Defines the log verbosity level.

### Middleware
- `EventAuth`: Middleware for authenticating event requests.
- `RateLimiter`: Middleware that applies rate limiting to incoming requests.

## Return Values
The service responses are structured as follows:

- **Success Responses**: Standardized JSON format indicating successful operations with relevant data fields.
- **Error Responses**: Detailed errors such as `EventServiceError`, `DatabaseError`, `ValidationError`, etc., providing context about the failure.
  
## Examples

### Basic Event Creation
```json
POST /events
{
  "name": "Virtual Concert",
  "date": "2023-12-01T19:00:00Z",
  "location": "Online",
  "description": "A virtual concert featuring popular bands."
}
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "eventId": "12345"
  }
}
```

### Invitation Sending
```json
POST /events/12345/invitations
{
  "emails": ["guest1@example.com", "guest2@example.com"]
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Invitations sent successfully."
}
```

### Fetching Event Details
```json
GET /events/12345
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "eventId": "12345",
    "name": "Virtual Concert",
    "date": "2023-12-01T19:00:00Z",
    "attendees": 150
  }
}
```

### Error Handling
```json
{
  "status": "error",
  "error": {
    "code": "NotFoundError",
    "message": "Event not found."
  }
}
```

This documentation provides an overview and example usage of the CRAIverse Event Management Service to facilitate the integration and operational elements necessary for deploying the service effectively.