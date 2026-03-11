# Deploy Enterprise API Rate Limiting Service

# Enterprise Rate Limiting Service Documentation

## Purpose
The `EnterpriseRateLimiter` service is designed to manage API rate limits for enterprise applications effectively. It leverages various algorithms and quota management strategies to control the request flow and ensure fair usage among clients while collecting usage metrics.

## Usage
To utilize the `EnterpriseRateLimiter`, instantiate it with the necessary components, including a Redis client for storage, quota managers, and algorithms for rate limiting. Use the service's methods to enforce and monitor rate limits on API requests.

### Example
```typescript
import { EnterpriseRateLimiter } from '../../src/services/rate-limiting/EnterpriseRateLimiter';
import Redis from 'ioredis';

const redisClient = new Redis();
const enterpriseRateLimiter = new EnterpriseRateLimiter(redisClient);

// Example of using the rate limiter
enterpriseRateLimiter.limitRequest(clientId, apiEndpoint)
  .then(result => {
    if (result.allowed) {
      // Process the request
    } else {
      // Handle rate limit exceeded
    }
  });
```

## Parameters/Props
The primary components that can be injected into `EnterpriseRateLimiter` include:

- **`redisClient`** (Redis.Redis): A Redis client instance to handle rate limit storage.
- **`quotaManager`** (TierBasedQuotaManager): Manages user tier-based quotas.
- **`tokenBucket`** (TokenBucketAlgorithm): Implements the token bucket rate limiting algorithm.
- **`leakyBucket`** (LeakyBucketAlgorithm): Implements the leaky bucket rate limiting algorithm.
- **`fairQueue`** (FairQueueManager): Manages fair queuing of requests.
- **`burstHandler`** (BurstCapacityHandler): Handles burst requests beyond the normal rate limits.
- **`usageMetrics`** (UsageMetricsCollector): Gathers metrics on API usage for analysis and reporting.

## Return Values
The `limitRequest` method returns a promise that resolves to an object containing:
- **`allowed`** (boolean): Indicates whether the request is allowed based on current rate limits.
- **`retryAfter`** (number | null): Optional, specifies how long in seconds to wait before retrying if the request is limited.

### Example Return Value
```json
{
  "allowed": false,
  "retryAfter": 30
}
```

## Testing
The service includes unit tests implemented with Jest, ensuring that it behaves as expected under various scenarios. Mocking imports helps isolate the service functionality.

### Example Test Case
```typescript
describe('EnterpriseRateLimiter Tests', () => {
  it('should allow request when under limit', async () => {
    const result = await enterpriseRateLimiter.limitRequest(clientId, apiEndpoint);
    expect(result.allowed).toBe(true);
  });

  it('should deny request when limit exceeded', async () => {
    // Simulate exceeding the rate limit
    const result = await enterpriseRateLimiter.limitRequest(clientId, apiEndpoint);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

This documentation provides a concise overview of the `EnterpriseRateLimiter` service, its parameters, usage, and testing details, enabling developers to integrate and use the service effectively in API rate limiting scenarios.