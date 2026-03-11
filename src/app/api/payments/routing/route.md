# Build Intelligent Payment Routing API

```markdown
# Intelligent Payment Routing API

## Purpose
The Intelligent Payment Routing API is designed to intelligently route payment requests to the most suitable payment processor based on various metrics such as success rate, fees, geographical constraints, and payment method support. This API can improve transaction success rates and reduce costs for online merchants.

## Usage
Make a POST request to the API endpoint with the required parameters. The API will return the most appropriate payment processor based on the specified routing criteria.

### Endpoint
```
POST /api/payments/routing/route
```

## Parameters/Props
The request body must conform to the following schema defined using Zod:

- `amount` (number): The transaction amount (must be positive).
- `currency` (string): The currency code (3 characters).
- `payment_method` (string): The method of payment (e.g., card, digital wallet).
- `customer_country` (string, optional): The country of the customer (2 characters).
- `customer_ip` (string, optional): The IP address of the customer.
- `merchant_id` (string): The UUID of the merchant.
- `priority` (enum, optional): Routing priority - can be 'cost', 'speed', or 'reliability' (defaults to 'reliability').
- `excluded_processors` (array, optional): List of processor IDs to exclude from routing (defaults to an empty array).

### Validation Schema
```typescript
const routingRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  payment_method: z.string(),
  customer_country: z.string().length(2).optional(),
  customer_ip: z.string().optional(),
  merchant_id: z.string().uuid(),
  priority: z.enum(['cost', 'speed', 'reliability']).default('reliability'),
  excluded_processors: z.array(z.string()).optional().default([]),
});
```

## Return Values
Upon successful routing, the API returns a JSON response containing:
- `processor_id` (string): The ID of the selected payment processor.
- `name` (string): The name of the selected payment processor.
- `routing_details` (object): Additional information related to the routing decision (e.g., fees, success rate).

In case of an error, the API will return a relevant error message indicating what went wrong.

## Examples

### Example Request
```json
POST /api/payments/routing/route
{
  "amount": 100,
  "currency": "USD",
  "payment_method": "credit_card",
  "customer_country": "US",
  "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
  "priority": "cost",
  "excluded_processors": ["processor123", "processor456"]
}
```

### Example Response
```json
{
  "processor_id": "processor789",
  "name": "Stripe",
  "routing_details": {
    "base_fee_percentage": 2.9,
    "fixed_fee_cents": 30,
    "success_rate": 98,
    "avg_processing_time_ms": 150
  }
}
```

## Notes
- Ensure that the Supabase and Redis services are configured and accessible to the API.
- The response may vary depending on the health and status of the available payment processors.
```