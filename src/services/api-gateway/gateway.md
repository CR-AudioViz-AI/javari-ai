# Deploy Enterprise API Gateway

# Enterprise API Gateway Documentation

## Purpose
The Enterprise API Gateway serves as a routing and management layer for backend services, providing features such as rate limiting, JWT authentication, circuit breaking, and monitoring. It enables better scalability, security, and reliability for microservice architectures by handling incoming requests and directing them to the appropriate service with customizable configurations.

## Usage
To deploy the Enterprise API Gateway, ensure the following steps are followed:

1. **Install Dependencies**:
   Ensure you have the required dependencies in your project:
   - `express`
   - `http-proxy-middleware`
   - `rate-limiter-flexible`
   - `ioredis`
   - `jsonwebtoken`
   - `prom-client`
   - `opossum`
   - `winston`

2. **Configure Gateway**: Define the configuration by providing necessary parameters in accordance with the `GatewayConfig` interface.

3. **Set up Routes**: Create the Express router and define proxy middleware for upstream services.

4. **Start the Server**: Launch the Express application with the configured routes.

## Parameters/Props

### GatewayConfig
- **redis**: Configuration object for Redis.
  - `host`: Redis host string.
  - `port`: Redis port number.
  - `password`: Optional Redis password.
  - `db`: Database number.
  - `cluster`: Optional boolean indicating if Redis is clustered.
  - `nodes`: Optional array of nodes for clustered Redis setup.

- **auth**: JWT authentication settings.
  - `secretKey`: Secret used for signing JWT tokens.
  - `issuer`: Issuer claim for JWT.
  - `audience`: Audience claim for JWT.
  - `algorithm`: Algorithm used for signing, e.g., `HS256`.
  - `expirationTolerance`: Time tolerance for expiration checks.

- **rateLimit**: Configuration for rate limiting.
  - `windowMs`: Time window in milliseconds for requesting limits.
  - `maxRequests`: Maximum number of requests allowed in the time window.
  - `keyGenerator`: Optional function generating unique keys for rate limiting.
  - `skipSuccessfulRequests`: Optional boolean to skip successful requests in limits.

- **circuitBreaker**: Configuration for circuit breaker behavior.
  - `timeout`: Timeout in milliseconds for failing calls.
  - `errorThresholdPercentage`: Percentage of errors to trigger circuit breaker.
  - `resetTimeout`: Timeout in milliseconds to reset the circuit breaker.
  - `volumeThreshold`: Minimum request volume to calculate errors.

- **monitoring**: Settings for observability.
  - `enablePrometheus`: Boolean to enable Prometheus metrics.
  - `enableHealthCheck`: Boolean to enable health checks for upstream services.
  - `requestTimeout`: Timeout for incoming requests.

- **upstreams**: Record of upstream service configurations.
  - **UpstreamConfig**: Contains the configuration for each service:
    - `target`: URL of the upstream service.
    - `pathRewrite`: Optional rules for rewriting request paths.
    - `healthCheck`: Optional health check endpoint.
    - `authRequired`: Boolean indicating if authentication is required.
    - `rateLimit`: Optional specific rate limit configuration for the service.
    - `circuitBreaker`: Optional specific circuit breaker settings for the service.

## Return Values
The API Gateway is an Express middleware that returns an instance of an Express Router for handling requests, configured with proxy middleware based on the provided configurations. Successful responses will proxy requests to the respective upstream services, while errors will be handled by middleware for various failures (rate limit exceeded, circuit breaker tripped, etc.).

## Examples

```typescript
import express from 'express';
import { GatewayConfig } from './src/services/api-gateway/gateway';

const app = express();

const gatewayConfig: GatewayConfig = {
  redis: { host: 'localhost', port: 6379, db: 0 },
  auth: {
    secretKey: 'your_secret_key',
    issuer: 'your_issuer',
    audience: 'your_audience',
    algorithm: 'HS256',
    expirationTolerance: 300
  },
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100
  },
  circuitBreaker: {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    volumeThreshold: 5
  },
  monitoring: {
    enablePrometheus: true,
    enableHealthCheck: true,
    requestTimeout: 20000
  },
  upstreams: {
    serviceA: {
      target: 'http://localhost:3000',
      authRequired: true
    }
  }
};

// Additional middleware setup and route definitions...

app.listen(8080, () => {
  console.log('API Gateway running on port 8080');
});
```

This example illustrates the basic configuration and inst