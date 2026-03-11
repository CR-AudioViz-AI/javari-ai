# Build Agent Review Moderation API

# Agent Review Moderation API

## Purpose
The Agent Review Moderation API is designed to evaluate user-submitted reviews for agents, providing moderation results based on content analysis and user metrics. It ensures that reviews adhere to quality standards while considering factors like toxicity, authenticity, and sentiment.

## Usage
This API can be integrated into applications that require moderation of user-generated content. It employs machine learning and data analysis to provide a detailed review status, ensuring that only appropriate content is published.

### Endpoint
```
POST /api/agents/reviews/moderate
```

### Request
The API expects a JSON payload with the following properties:

## Parameters/Props

### Request Body (JSON)
- **reviewId** (string, required): The unique identifier for the review. Must be a valid UUID.
- **agentId** (string, required): The unique identifier of the agent the review is about. Must be a valid UUID.
- **userId** (string, required): The unique identifier of the user who submitted the review. Must be a valid UUID.
- **content** (string, required): The content of the review (1 to 5000 characters).
- **rating** (number, required): The rating associated with the review (1 to 5).
- **metadata** (object, optional): Additional information about the review submission.
  - **userAgent** (string, optional): The user agent string of the user's device.
  - **ipAddress** (string, optional): The IP address of the user.
  - **timestamp** (string, optional): The submission timestamp.

### Response
The API responds with a JSON object containing the moderation result.

#### Response Body (JSON)
- **reviewId** (string): The ID of the reviewed content.
- **status** (string): Status of the moderation (`approved`, `flagged`, `rejected`, `pending`).
- **confidence** (number): Confidence score of the moderation decision (0-100).
- **flags** (array of strings): List of flags detected during moderation.
- **trustScoreImpact** (number): Impact on the agent's trust score from this review.
- **reasoning** (string): Explanation of the moderation decision.
- **requiresManualReview** (boolean): Indicates if a human moderator should review the submission.

## Examples

### Successful Request
```json
POST /api/agents/reviews/moderate
{
  "reviewId": "c0287e1e-5e0a-403d-a6e2-6fad9f4b4fa3",
  "agentId": "f6f6c999-bf77-4f84-a307-4ac9095eca0a",
  "userId": "91677d64-4c6d-46d5-82b6-4bb5c04b4877",
  "content": "This agent was fantastic! Highly recommend.",
  "rating": 5,
  "metadata": {
    "userAgent": "Mozilla/5.0",
    "ipAddress": "192.0.2.1",
    "timestamp": "2023-10-01T12:00:00Z"
  }
}
```

### Sample Response
```json
{
  "reviewId": "c0287e1e-5e0a-403d-a6e2-6fad9f4b4fa3",
  "status": "approved",
  "confidence": 95.7,
  "flags": [],
  "trustScoreImpact": 2,
  "reasoning": "Positive sentiment with no flags detected.",
  "requiresManualReview": false
}
```

## Limitations
- The maximum content length is 5000 characters. 
- Ensure the API key is validated before access.
- The API is rate-limited to prevent abuse; implement appropriate error handling.