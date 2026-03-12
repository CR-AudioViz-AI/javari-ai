# Build Community Reputation Scoring Engine

# Community Reputation Scoring Engine

## Purpose
The Community Reputation Scoring Engine is designed to calculate and manage user reputation within a community environment. It utilizes various events that contribute to a user’s score to promote positive interactions and discourage negative behavior.

## Usage
To utilize the ReputationEngine, import the event types, badge types, and necessary interfaces as needed. The engine tracks user activities and calculates their reputation score based on predefined criteria and events.

```typescript
import { ReputationEngine, ReputationEventType, BadgeType } from '@/modules/community/reputation/ReputationEngine';
```

## Parameters / Props

### ReputationEventType
Enumeration of event types that impact user reputation:
- `POST_CREATED`
- `COMMENT_CREATED`
- `UPVOTE_RECEIVED`
- `DOWNVOTE_RECEIVED`
- `ANSWER_ACCEPTED`
- `HELPFUL_VOTE`
- `REPORT_VALIDATED`
- `MODERATION_ACTION`
- `BADGE_EARNED`
- `STREAK_BONUS`
- `COMMUNITY_CONTRIBUTION`
- `SPAM_DETECTED`
- `ABUSE_REPORTED`

### BadgeType
Enumeration of badge types that users can earn:
- `NEWCOMER`
- `CONTRIBUTOR`
- `HELPFUL`
- `EXPERT`
- `MENTOR`
- `MODERATOR`
- `INFLUENCER`
- `PIONEER`
- `STREAK_MASTER`
- `COMMUNITY_HERO`

### ReputationLevel
Interface defining a user's reputation level:
- `level: number` - The numeric level of reputation.
- `title: string` - The name of the reputation level.
- `minScore: number` - Minimum score for the level.
- `maxScore: number` - Maximum score for the level.
- `privileges: string[]` - List of privileges associated with the level.
- `color: string` - Color code representing the level.

### ReputationMetrics
Interface summarizing user reputation metrics:
- `totalScore: number`
- `contributionScore: number`
- `helpfulnessScore: number`
- `engagementScore: number`
- `influenceScore: number`
- `reliabilityScore: number`
- `currentLevel: number`
- `badgeCount: number`
- `streakDays: number`
- `lastActivity: Date`
- `antiGamingFlags: number`
- `penaltyPoints: number`

### ReputationEvent
Interface for recording reputation-related events:
- `id: string` - Unique identifier for the event.
- `userId: string` - Identifier of the user associated with the event.
- `eventType: ReputationEventType` - The type of reputation event.
- `points: number` - Points awarded or deducted based on the event.
- `metadata: Record<string, any>` - Additional information regarding the event.
- `sourceId?: string` - Optional source identifier.
- `sourceType?: string` - Optional source type.
- `timestamp: Date` - When the event occurred.

## Return Values
The engine calculates and provides the cumulative reputation score and metrics based on the user activities tracked via the events. 

## Examples

### Creating a Reputation Event
```typescript
const event: ReputationEvent = {
  id: 'event_123',
  userId: 'user_456',
  eventType: ReputationEventType.UPVOTE_RECEIVED,
  points: 10,
  metadata: { postId: 'post_789' },
  timestamp: new Date(),
};
```

### Retrieving Reputation Metrics
```typescript
const metrics: ReputationMetrics = {
  totalScore: 100,
  contributionScore: 40,
  helpfulnessScore: 30,
  engagementScore: 20,
  influenceScore: 5,
  reliabilityScore: 5,
  currentLevel: 2,
  badgeCount: 3,
  streakDays: 7,
  lastActivity: new Date(),
  antiGamingFlags: 0,
  penaltyPoints: 2,
};
```

This documentation serves as a concise guide for integrating and utilizing the Community Reputation Scoring Engine.