# Create Community Reputation Scoring API

# Community Reputation Scoring API

## Purpose
The Community Reputation Scoring API provides functionalities to calculate, flag suspicious activities, and recalculate reputation scores for users based on their contributions and interactions in a community. It utilizes algorithms that weigh different aspects of community involvement to derive an overall reputation score.

## Usage
The API supports the following endpoints:

1. **Calculate Reputation**: Compute a user's reputation based on actions they have performed.
2. **Flag Suspicious Activity**: Report potential abuses affecting community reputation.
3. **Recalculate Reputation**: Recompute reputation scores for a set of users based on a specified timeframe.

### Example Endpoints:
- `POST /api/community/reputation/calculate`
- `POST /api/community/reputation/flag`
- `POST /api/community/reputation/recalculate`

## Parameters/Props

### Calculate Reputation
```json
{
  "userId": "string (uuid)",
  "action": "enum ['post_created', 'comment_added', 'helpful_vote', 'best_answer', 'content_liked', 'mentor_session']",
  "metadata": {
    "contentId": "string (optional)",
    "votes": "number (optional)",
    "engagement": "number (optional)",
    "quality": "number (optional, min: 1, max: 5)"
  }
}
```

### Flag Suspicious Activity
```json
{
  "userId": "string (uuid)",
  "suspiciousActivity": "enum ['vote_manipulation', 'spam_posting', 'sockpuppet_accounts', 'artificial_engagement']",
  "evidence": "string (min: 10, max: 1000)",
  "reporterId": "string (uuid)"
}
```

### Recalculate Reputation
```json
{
  "userIds": ["string (uuid)", "optional"],
  "timeframe": "enum ['24h', '7d', '30d', '90d', 'all'] (default: '30d')"
}
```

## Return Values
- **Calculate Reputation**: 
  - Returns the calculated reputation score as a number.
  
- **Flag Suspicious Activity**: 
  - Returns a confirmation message or status indicating the success of the flagging action.

- **Recalculate Reputation**: 
  - Returns an updated list of reputation scores for the specified users.

## Examples

### Example 1: Calculate Reputation
```json
POST /api/community/reputation/calculate

{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "action": "post_created",
  "metadata": {
    "quality": 4,
    "votes": 10
  }
}
```

### Example 2: Flag Suspicious Activity
```json
POST /api/community/reputation/flag

{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "suspiciousActivity": "spam_posting",
  "evidence": "This post contains multiple links to unrelated content.",
  "reporterId": "987e6543-e21b-12d3-a456-426614174001"
}
```

### Example 3: Recalculate Reputation
```json
POST /api/community/reputation/recalculate

{
  "userIds": ["123e4567-e89b-12d3-a456-426614174000"],
  "timeframe": "7d"
}
```

This documentation outlines the core functionalities and structure of the Community Reputation Scoring API, aimed at enhancing community integrity through effective reputation management.