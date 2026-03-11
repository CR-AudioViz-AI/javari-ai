# Launch Skill-Based User Matching Service

# Skill-Based User Matching Service

## Purpose
The Skill-Based User Matching Service is a machine learning-powered microservice that connects community members based on their complementary skills, shared interests, and collaborative potential. It provides real-time semantic matching, recommendations, and adapts based on user feedback to improve connections between users.

## Usage
To utilize the Skill Matching Service, instantiate it with the required configuration parameters and call its methods to match users or seek recommendations based on user skill profiles.

### Instantiation
```typescript
const skillMatchingService = new SkillMatchingService({
    supabaseUrl: 'your-supabase-url',
    supabaseServiceKey: 'your-supabase-service-key',
    openaiApiKey: 'your-openai-api-key',
    redisUrl: 'your-redis-url',
    matchingConfig: {
        maxMatches: 10,
        minConfidenceScore: 0.6
    }
});
```

## Parameters/Props
### Constructor Parameters
- **supabaseUrl**: `string` - The URL of the Supabase instance.
- **supabaseServiceKey**: `string` - The service key for accessing Supabase.
- **openaiApiKey**: `string` - The API key for OpenAI services.
- **redisUrl**: `string` - The Redis server URL for caching.
- **matchingConfig**: `Partial<MatchingConfig>` - Optional configuration for matching behaviors:
  - **maxMatches**: `number` - Maximum number of matches to return (default: 10).
  - **minConfidenceScore**: `number` - Minimum confidence score for a match (default: 0.6).
  - **skillWeightDecay**: `number` - Weight decay of skills over time (default: 0.8).
  - **interestWeight**: `number` - Weight assigned to user interests (default: 0.3).
  - **availabilityWeight**: `number` - Weight assigned to user availability (default: 0.2).
  - **cacheExpiry**: `number` - Duration for cache expiry in seconds (default: 3600).
  - **realtimeEnabled**: `boolean` - Indicates if real-time updates are enabled (default: true).

## Return Values
The service returns results based on its methods including matched user profiles and recommendations which include a compatibility score derived from various metrics, including skills, interests, and availability.

## Examples

### Match Users
```typescript
const userSkillProfile: UserSkillProfile = {
    userId: 'user123',
    skills: ['JavaScript', 'React', 'Node.js'],
    interests: ['web development', 'open source'],
    availability: 'part-time',
};

const matchRequest: MatchRequest = {
    userProfile: userSkillProfile,
};

const matchResult: MatchResult = await skillMatchingService.matchUsers(matchRequest);
console.log(matchResult);
```

### Get Recommendations
```typescript
const recommendations = await skillMatchingService.getRecommendations('user123');
console.log(recommendations);
```

### Provide Feedback
```typescript
const feedback: MatchFeedback = {
    userId: 'user123',
    matchId: 'match456',
    rating: 4, // from 1 to 5
};

await skillMatchingService.sendFeedback(feedback);
```

This documentation provides a high-level overview of the Skill-Based User Matching Service, its purpose, usage, parameters for initialization, and example code snippets for common operations.