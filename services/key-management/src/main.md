# Deploy Key Management Service

# Key Management Service (KMS) - Technical Documentation

## Purpose
The Key Management Service is a highly secure microservice designed to manage encryption keys, certificates, and secrets. It features integration with a hardware security module (HSM) and supports automatic key rotation for enhanced security.

## Usage
To deploy the Key Management Service, ensure that Node.js and the necessary dependencies are installed. Run the service using:

```bash
npm install
npm start
```

This will start the Express application on the specified port. The application supports CORS, security headers, compression, and rate limiting.

## Parameters/Props

### `AppConfig`
This interface defines the configuration for the application:
- `port` (number): The port on which the service will listen.
- `nodeEnv` (string): The environment mode (development/production).
- `serviceName` (string): The name of the service.
- `version` (string): The current version of the service.
- `supabaseUrl` (string): The Supabase database URL.
- `supabaseKey` (string): The Supabase API key.
- `hsmConfig` (HSMConfig): Configuration for the hardware security module.
- `logLevel` (string): Logging level (e.g., info, debug).
- `enableClustering` (boolean): Flag to enable clustering.
- `healthCheckInterval` (number): Interval for health check in seconds.
- `keyRotationInterval` (number): Interval for automatic key rotation in seconds.

### `HealthCheckResponse`
This interface is used for health checks:
- `status` ('healthy' | 'degraded' | 'unhealthy'): The health status of the service.
- `timestamp` (string): The current timestamp.
- `version` (string): The service version.
- `uptime` (number): The uptime of the service in seconds.
- `services` (object): Status of dependent services (e.g., HSM connection).

## Return Values
Upon successful startup, the service will return a message stating that it is running and listening on the specified port. Health check endpoints will return a JSON object conforming to the `HealthCheckResponse` interface.

## Examples

### Starting the Service
```bash
# Start the Key Management Service
npm start
```

### Accessing Health Check Endpoint
After starting the service, access the health check endpoint via:

```
GET http://localhost:<port>/health-check
```

#### Example Response
```json
{
  "status": "healthy",
  "timestamp": "2023-10-01T12:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "hsm": "connected"
  }
}
```

### Key Rotation
The service automatically handles key rotation based on the configured interval defined in the `AppConfig`.

### Error Handling
Errors encountered during operations will be logged using Winston and returned to the client in a consistent format.

--- 

For further customization or modifications, refer to the source files within the `services/key-management/` directory.