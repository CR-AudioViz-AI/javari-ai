# Build Global CDN Orchestration API

# Global CDN Orchestration API Documentation

## Purpose
The Global CDN Orchestration API is designed to manage Content Delivery Network (CDN) operations efficiently, allowing for actions such as routing, uploading, invalidating caches, optimizing content, and gathering analytics. This API integrates with a Supabase backend for data storage and utilizes Redis for caching.

## Usage
This API endpoint processes HTTP requests related to CDN operations. The requests should contain a valid JSON payload conforming to the specified schema. The API validates incoming requests and performs the designated operations based on the requested action.

## Parameters/Props

### Request Body Schema
The request must adhere to the following schema defined using the Zod library:

```typescript
const contentRequestSchema = z.object({
  action: z.enum(['route', 'upload', 'invalidate', 'optimize', 'analytics']),
  content: z.object({
    url: z.string().url().optional(),
    type: z.enum(['image', 'video', 'audio', 'document', 'static']).optional(),
    size: z.number().positive().optional(),
    metadata: z.record(z.any()).optional()
  }).optional(),
  geographic: z.object({
    region: z.string().optional(),
    country: z.string().optional(),
    clientIp: z.string().ip().optional()
  }).optional(),
  optimization: z.object({
    quality: z.number().min(1).max(100).optional(),
    format: z.string().optional(),
    compression: z.enum(['lossless', 'lossy', 'auto']).optional()
  }).optional(),
  cacheControl: z.object({
    ttl: z.number().positive().optional(),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional()
  }).optional()
});
```

### Actions
The `action` parameter defines the operation to be executed:
- `route`: Manage routing of content.
- `upload`: Upload content to the CDN.
- `invalidate`: Invalidate cached content.
- `optimize`: Optimize content delivery.
- `analytics`: Retrieve analytics data.

## Return Values
The API returns a JSON response indicating the result of the requested action. The structure typically follows:

```typescript
interface ProviderResponse {
  provider: string;
  url: string;
  latency: number;
  success: boolean;
  error?: string;
}
```

- `provider`: Name of the CDN provider.
- `url`: The URL where the content is accessible.
- `latency`: The measured latency of the operation.
- `success`: A boolean indicating the success of the operation.
- `error`: An optional field that includes error message if the operation failed.

## Examples

### Example Request
```json
POST /api/cdn-orchestration
{
  "action": "upload",
  "content": {
    "url": "https://example.com/image.jpg",
    "type": "image",
    "size": 256000,
    "metadata": {
      "description": "Example image"
    }
  },
  "geographic": {
    "region": "us-west",
    "country": "US",
    "clientIp": "192.168.1.1"
  },
  "optimization": {
    "quality": 80,
    "format": "jpeg",
    "compression": "lossy"
  },
  "cacheControl": {
    "ttl": 3600,
    "tags": ["image", "upload"],
    "priority": "high"
  }
}
```

### Example Response
```json
{
  "provider": "CDNProvider1",
  "url": "https://cdn.example.com/image.jpg",
  "latency": 150,
  "success": true
}
```

This documentation provides an overview of the Global CDN Orchestration API, enabling users to effectively interact with various CDN services through well-defined operations while ensuring the integrity and performance of the CDN infrastructure.