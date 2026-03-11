# Create AI-Powered Content Moderation Service

# AI-Powered Content Moderation Service

## Purpose
The AI-Powered Content Moderation Service provides a comprehensive solution for moderating user-generated content across multiple modalities (text, image, video, audio). It employs a hybrid approach that utilizes AI for initial analysis, coupled with a human review process for escalated cases, ensuring a robust and scalable moderation framework.

## Usage
To use the Moderation Service, instantiate the class with required configuration parameters. Call the `moderateContent` method with a moderation request to analyze and moderate content according to established policies.

## Parameters/Props

### Constructor Parameters
- `supabaseUrl` (string): URL for the Supabase instance.
- `supabaseKey` (string): Service key for Supabase.
- `openaiApiKey` (string): API key for OpenAI services.
- `azureContentModeratorKey` (string): Access key for Azure Content Moderator services.

#### Example
```typescript
const moderationService = new ModerationService({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  azureContentModeratorKey: process.env.AZURE_CONTENT_MODERATOR_KEY!
});
```

### Method Parameters
#### `moderateContent`
- `contentId` (string): Unique identifier for the content being moderated.
- `contentType` (ContentType): The type of content (text, image, video, audio).
- `content` (string): The actual user-generated content to moderate.
- `authorId` (string): Identifier of the content author.
- `communityId` (string): Identifier of the community where the content was posted.

### Return Values
- Returns a `Promise<ModerationResult>` containing the result of the moderation process, which includes decisions made by the AI, any escalation actions taken, and insights derived from the content analysis.

## Examples
### Moderating Content
```typescript
const result = await moderationService.moderateContent({
  contentId: 'content-123',
  contentType: 'text',
  content: 'User generated content...',
  authorId: 'user-456',
  communityId: 'community-789'
});
console.log(result);
```

### Results
The result may include various fields like:
- `isApproved`: Boolean indicating if content passed moderation.
- `reason`: Reason for rejection if applicable.
- `escalationRequired`: Flag indicating if human review or escalation is necessary.
- `metrics`: Comprehensive metrics related to moderation performance.

## Features
- Multi-modal AI content analysis for diverse content types.
- Customizable policy rule engine for configurable thresholds.
- Intelligent management of escalations to human reviewers.
- Appeals processing to handle disputes regarding moderation decisions.
- Real-time queue management for reviewers.
- Detailed audit logging and moderation metrics for compliance and analysis.