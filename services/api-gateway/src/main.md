# Deploy Enterprise API Gateway Microservice

# CR AudioViz AI - Enterprise API Gateway Microservice

## Purpose

The Enterprise API Gateway Microservice serves as the main entry point for managing API requests with built-in features such as authentication, rate limiting, monitoring, policy enforcement, and service routing. This gateway acts as an interface between clients and backend services, enhancing security and performance.

## Usage

To deploy the API Gateway Microservice, start the application by executing:

```bash
npm run start
```

Ensure that the necessary environment variables and configurations are set before starting the service.

## Parameters/Props

The API Gateway is configured using a schema defined with `zod`. Below are the configuration parameters:

- **port**: `number`
  - Default: `8080`
  - The port on which the API Gateway listens for incoming requests.

- **environment**: `enum`
  - Default: `'development'`
  - Specifies the operating environment (development, staging, production).

- **cors**: `object`
  - **origins**: `array<string>`
    - Default: `['*']`
    - Allowed origins for CORS requests.
  - **credentials**: `boolean`
    - Default: `true`
    - Indicates if credentials should be allowed in CORS requests.

- **supabase**: `object`
  - **url**: `string`
    - The Supabase service URL.
  - **anonKey**: `string`
    - The anonymized key for Supabase.
  - **serviceKey**: `string`
    - The service key for Supabase.

- **redis**: `object`
  - **host**: `string`
    - Default: `'localhost'`
    - Redis server host.
  - **port**: `number`
    - Default: `6379`
    - Redis server port.
  - **password**: `string | optional`
    - Redis authentication password.
  - **db**: `number`
    - Default: `0`
    - Redis database number.

- **monitoring**: `object`
  - **enabled**: `boolean`
    - Default: `true`
    - Enables or disables monitoring.
  - **metricsPath**: `string`
    - Default: `'/metrics'`
    - Path for Prometheus metrics.
  - **collectDefaultMetrics**: `boolean`
    - Default: `true`
    - Collects default metrics for monitoring.

- **rateLimit**: `object`
  - **windowMs**: `number`
    - Default: `900000` (15 minutes)
    - Time window for rate limiting.
  - **maxRequests**: `number`
    - Default: `1000`
    - Maximum number of requests allowed within the time window.
  - **skipSuccessfulRequests**: `boolean`
    - Default: `false`
    - Ignores successful requests when adhering to rate limits.

- **services**: `record`
  - Defines service configurations for proxying requests, including targets, path rewrites, and origin changes.

## Return Values

The microservice will return responses to API requests based on the configured services, applying middleware functionalities such as authentication checks, rate limiting, and more.

## Examples

Here’s an example configuration for the API Gateway:

```json
{
  "port": 3000,
  "environment": "production",
  "cors": {
    "origins": ["https://example.com"],
    "credentials": true
  },
  "supabase": {
    "url": "https://your-supabase-url",
    "anonKey": "your-anon-key",
    "serviceKey": "your-service-key"
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  },
  "monitoring": {
    "enabled": true,
    "metricsPath": "/metrics"
  },
  "rateLimit": {
    "windowMs": 60000,
    "maxRequests": 100
  },
  "services": {
    "service1": {
      "target": "http://example-service.com",
      "pathRewrite": {
        "^/service1": ""
      },
      "changeOrigin": true
    }
  }
}
```

This configuration sets up a production environment with specific CORS options and service proxy settings to route requests through the gateway.