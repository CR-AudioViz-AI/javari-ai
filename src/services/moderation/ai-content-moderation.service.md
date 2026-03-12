# Create AI Content Moderation Service

# AI Content Moderation Service

## Purpose

The AI Content Moderation Service is designed to provide automated content moderation using AI models to detect harmful content, spam, and policy violations. It supports automated escalation workflows and integrates human review processes to ensure quality control.

## Usage

To use the AI Content Moderation Service, instantiate the moderation service and call its methods to submit content for moderation. The service processes the content and provides detailed moderation results, including the need for human review and escalation actions.

## Parameters/Props

### ModerationRequest

The service takes a `ModerationRequest` object as input, which contains the following properties:

- `contentId` (string): Unique identifier for the content.
- `contentType` ('post' | 'comment' | 'message'): Type of content being moderated.
- `content` (string): The actual content to moderate.
- `authorId` (string): Identifier of the content author.
- `metadata` (Record<string, any>, optional): Additional information relevant to the content.
- `priority` ('low' | 'medium' | 'high', optional): Priority level for moderation.

### ModerationResult

The response from the moderation process is encapsulated in a `ModerationResult` object, which includes:

- `id` (string): Unique identifier for the moderation result.
- `contentId` (string): Identifier of the content being moderated.
- `contentType` ('post' | 'comment' | 'message'): Type of content.
- `status` ('pending' | 'approved' | 'rejected' | 'escalated'): Current moderation status.
- `overallScore` (number): Overall moderation score.
- `confidence` (number): Confidence level of positive detection.
- `violations` (ViolationDetail[]): Details of detected violations.
- `aiModelResults` (AIModelResult[]): Results from different AI models used.
- `action` (ModerationAction): Required action based on moderation results.
- `reviewRequired` (boolean): Flag indicating if human review is needed.
- `escalationLevel` (EscalationLevel): Level of escalation required.
- `processedAt` (Date): Timestamp when processing was completed.
- `reviewedAt` (Date, optional): Timestamp when the review was completed.
- `reviewerId` (string, optional): ID of the reviewer.
- `reviewerNotes` (string, optional): Notes from the reviewer.

## Return Values

The service returns a `Promise<ModerationResult>` containing the detailed result of the moderation process, including detected violations and next steps for escalation or review.

## Examples

```typescript
import { AIContentModerationService, ModerationRequest } from './src/services/moderation/ai-content-moderation.service';

const moderationService = new AIContentModerationService();

const request: ModerationRequest = {
    contentId: '12345',
    contentType: 'post',
    content: 'This is a harmful message.',
    authorId: 'user_67890',
    priority: 'high'
};

moderationService.moderateContent(request)
    .then((result) => {
        console.log('Moderation Result:', result);
    })
    .catch((error) => {
        console.error('Moderation Failed:', error);
    });
```

This example demonstrates how to instantiate the `AIContentModerationService`, create a moderation request, and handle the moderation response.