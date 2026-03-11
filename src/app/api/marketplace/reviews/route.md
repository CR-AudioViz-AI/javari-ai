# Build Marketplace Review Aggregation API

# Marketplace Review Aggregation API

## Purpose

The Marketplace Review Aggregation API is designed to facilitate the creation, retrieval, and management of product reviews in a marketplace setting. It integrates with various services such as Supabase for database operations, OpenAI for content analysis, AWS S3 for file storage, and Redis for caching mechanisms to ensure efficient data handling and retrieval.

## Usage

To use this API, make HTTP requests to the designated endpoints for creating or retrieving reviews. Ensure the appropriate authentication and authorization mechanisms are in place as defined in the security layer. The API is primarily leveraged in web applications to manage user-generated content efficiently.

## Parameters/Props

### Request Body Parameters for Create Review Endpoint

- **vendorId** (string, required): UUID of the vendor providing the product.
- **productId** (string, optional): UUID of the product being reviewed.
- **userId** (string, required): UUID of the user submitting the review.
- **title** (string, required): Title of the review; must be between 1 and 200 characters.
- **content** (string, required): The content of the review; must be between 10 and 5000 characters.
- **ratings** (object, required): Object containing the following rating fields:
  - **overall** (number, required): Overall rating score (1-5).
  - **quality** (number, required): Quality rating score (1-5).
  - **communication** (number, required): Communication rating score (1-5).
  - **shipping** (number, required): Shipping rating score (1-5).

### Environment Variables

The following environment variables must be set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Return Values

### Successful Response

Upon successfully creating a review, the API returns:

- **Status**: `201 Created`
- **Body**: A JSON object containing the newly created review details including `reviewId`, `createdAt`, and the submitted ratings.

### Error Responses

In case of errors (e.g., validation errors, missing parameters), the API will return:

- **Status**: `400 Bad Request`
- **Body**: A JSON object with an error message indicating what went wrong.

## Examples

### Creating a Review

```bash
POST /api/marketplace/reviews
Content-Type: application/json

{
  "vendorId": "b1e86b67-a4f3-456e-84f5-299c9d0cc807",
  "productId": "c2d96d34-1a76-4c5e-b9c1-dc3c2d978bf6",
  "userId": "f4e96c09-d1e9-4012-a476-259b8acd717c",
  "title": "Great Product!",
  "content": "This product exceeded my expectations. Highly recommend!",
  "ratings": {
    "overall": 5,
    "quality": 5,
    "communication": 4,
    "shipping": 5
  }
}
```

### Successful Response

```json
{
  "reviewId": "c3d97d34-1a76-4c5e-b9c1-dc3c2d978c78",
  "createdAt": "2023-10-01T12:00:00Z",
  "ratings": {
    "overall": 5,
    "quality": 5,
    "communication": 4,
    "shipping": 5
  }
}
```

### Error Response Example

```json
{
  "error": "Validation failed: title must be at least 1 character long."
}
``` 

This documentation provides an overview of the API's functionality, expected input/output, and examples, allowing developers to seamlessly integrate the Review Aggregation capabilities into their applications.