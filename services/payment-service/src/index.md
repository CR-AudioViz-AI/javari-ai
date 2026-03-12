# Deploy Multi-Currency Payment Service

# Multi-Currency Payment Service Documentation

## Purpose
The Multi-Currency Payment Service is a containerized microservice designed to handle payment transactions in various currencies. It offers features such as automatic currency conversion, support for regional payment methods, and secure transaction processing, making it suitable for businesses seeking to operate globally.

## Usage
To deploy the service, ensure that all dependencies are installed and configured properly. You can run the service using Node.js. The service will start listening on the specified port for incoming payment requests.

## Parameters / Props

### ServiceDependencies
- `supabase`: Instance of Supabase client for database operations.
- `redis`: Redis client for caching and session management.
- `stripe`: Instance of Stripe for payment processing.
- `logger`: Logger instance for logging purposes.

### PaymentServiceConfig
- `port`: Number representing the server port to listen on.
- `nodeEnv`: String indicating the current Node.js environment (e.g., development, production).
- `corsOrigins`: Array of allowed origins for CORS.
- `rateLimiting`: Configuration object for request rate limiting
  - `windowMs`: Time frame in milliseconds for rate limiting.
  - `maxRequests`: Maximum number of requests allowed within the timeframe.

## Return Values
The Payment Service does not return values directly, but it sets up an Express application that handles incoming HTTP requests related to payment processing. 

## Examples

### Initialization
To initialize and run the Multi-Currency Payment Service, use the following code:

```typescript
import { PaymentService } from './path/to/services/payment-service/src/index';

const config: PaymentServiceConfig = {
  port: 3000,
  nodeEnv: 'development',
  corsOrigins: ['http://your-frontend-domain.com'],
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // limit each IP to 100 requests per windowMs
  },
};

const service = new PaymentService(config);
service.start(); // A method that starts the Express application
```

### Handling Payments
Once the service is running, you can send HTTP POST requests to the `/payments` endpoint to process a payment:

```bash
curl -X POST http://localhost:3000/payments \
-H "Content-Type: application/json" \
-d '{
  "amount": 1000,
  "currency": "USD",
  "paymentMethodId": "pm_card_visa"
}'
```

This request should trigger the payment processing logic, and the service will manage the transaction, logging the results and responding as configured (e.g., success or failure message).

## Conclusion
The Multi-Currency Payment Service provides a robust solution for businesses looking to manage payment transactions efficiently across different currencies while ensuring security and compliance. Configure the service according to your business needs and integrate it with your existing applications for seamless payment processing.