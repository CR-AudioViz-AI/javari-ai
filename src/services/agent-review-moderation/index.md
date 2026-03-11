# Deploy Agent Review Moderation Service

# Agent Review Moderation Service

## Purpose
The Agent Review Moderation Service provides automated moderation for marketplace reviews using AI analysis and facilitates human escalation when necessary. It performs sentiment analysis and toxicity detection on reviews to ensure they meet community guidelines.

## Usage
To utilize the Agent Review Moderation Service, you need to instantiate the service and provide it with review content for moderation. The service will return the moderation results, indicating the review's status, sentiment, and toxicity levels.

## Parameters/Props

### ReviewContent Interface
The contents of the review to be moderated.

- `id`: *string* - Unique identifier for the review.
- `agentId`: *string* - Identifier for the agent associated with this review.
- `userId`: *string* - Identifier for the user who submitted the review.
- `rating`: *number* - Rating given by the user (expected range: 1 to 5).
- `title`: *string* - Title of the review.
- `content`: *string* - The body of the review.
- `createdAt`: *Date* - Timestamp of when the review was created.
- `metadata`: *Record<string, any>* (optional) - Additional metadata for the review.

### ModerationResult Interface
The result of the moderation process.

- `reviewId`: *string* - Unique identifier for the moderated review.
- `status`: *ModerationStatus* - Final moderation status of the review (pending, approved, rejected, escalated, requires_human_review).
- `sentiment`: *SentimentAnalysis* - Analysis of the review's sentiment.
- `toxicity`: *ToxicityDetection* - Assessment of the review's toxicity.
- `riskScore`: *number* - Risk score indicating the severity (0 to 1).
- `autoDecision`: *boolean* - Indicates if the decision was made automatically.
- `reasons`: *string[]* - List of reasons for the moderation decision.
- `moderatedAt`: *Date* - Timestamp of when the moderation was conducted.
- `moderatorId`: *string* (optional) - ID of the human moderator, if applicable.
- `escalationReason`: *string* (optional) - Reason for escalation if the review was escalated.

### ModerationStatus Enum
Defines the status of the moderation:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `ESCALATED`
- `REQUIRES_HUMAN_REVIEW`

### ToxicitySeverity Enum
Defines the severity levels of toxicity:

- `LOW`
- `MEDIUM`
- `HIGH`
- `SEVERE`

## Return Values
The service returns a `ModerationResult` object that contains the results of the moderation process, detailing the review's status, sentiment, toxicity, and other relevant information.

## Examples

### Example of Moderating a Review
```typescript
const review: ReviewContent = {
  id: "1",
  agentId: "agent_001",
  userId: "user_123",
  rating: 4,
  title: "Great service!",
  content: "I had a fantastic experience with the agent.",
  createdAt: new Date(),
};

const moderationResult: ModerationResult = await moderateReview(review);
console.log(moderationResult);
```

### Example of a Moderation Result
```json
{
  "reviewId": "1",
  "status": "approved",
  "sentiment": {
    "score": 0.8,
    "magnitude": 0.9,
    "label": "positive",
    "confidence": 0.95,
    "keywords": ["fantastic", "great"]
  },
  "toxicity": {
    "isToxic": false,
    "severity": "low",
    "confidence": 0.98,
    "categories": [],
    "flaggedPhrases": []
  },
  "riskScore": 0.1,
  "autoDecision": true,
  "reasons": [],
  "moderatedAt": "2023-10-04T10:00:00Z"
}
```