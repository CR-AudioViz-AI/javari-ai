# Create Community Member Matching Service

# Community Matching Service

## Purpose
The Community Matching Service is designed to facilitate the matching of community members based on their profiles, collaboration preferences, and availability. It enables members to find suitable partners for collaboration, mentorship, skill exchange, or networking by processing tailored match requests.

## Usage
To use the Community Matching Service, create instances of the required profiles and call the relevant matching functions with defined parameters.

### Installation
Ensure you have installed the necessary dependencies:
```bash
npm install @supabase/supabase-js ioredis openai
```

## Parameters/Props

### Interfaces

#### `MemberProfile`
- `id: string`: Unique identifier for the member.
- `name: string`: Member's name.
- `bio: string`: Brief description about the member.
- `skills: string[]`: List of skills possessed by the member.
- `interests: string[]`: List of interests.
- `experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'`: Member's level of experience.
- `collaboration_preferences: CollaborationPreferences`: Preferences for collaboration.
- `availability: AvailabilityProfile`: Availability details.
- `location?: string`: (Optional) Member's location.
- `timezone?: string`: (Optional) Member's timezone.
- `created_at: Date`: Date the member joined.
- `last_active: Date`: Last active date of the member.

#### `CollaborationPreferences`
- `project_types: string[]`: Types of projects interested in.
- `communication_style: 'direct' | 'collaborative' | 'supportive'`: Preferred communication style.
- `time_commitment: 'casual' | 'regular' | 'intensive'`: Time commitment level.
- `remote_preference: 'remote_only' | 'hybrid' | 'in_person' | 'flexible'`: Preferred remote work setting.
- `mentoring_interest: 'mentor' | 'mentee' | 'peer' | 'none'`: Interest in mentoring roles.

#### `AvailabilityProfile`
- `days_available: string[]`: Days available for collaboration.
- `hours_per_week: number`: Total number of hours available per week.
- `preferred_time_slots: string[]`: Preferred time slots for collaboration.
- `timezone: string`: Timezone of the member.

#### `MatchRequest`
- `requester_id: string`: ID of the member initiating the match request.
- `match_type: 'collaboration' | 'mentorship' | 'skill_exchange' | 'networking'`: Type of match being requested.
- `specific_skills?: string[]`: (Optional) Specific skills requested for the match.
- `specific_interests?: string[]`: (Optional) Specific interests requested for the match.
- `project_context?: string`: (Optional) Context for the project.
- `urgency: 'low' | 'medium' | 'high'`: Urgency level of the match request.
- `max_matches: number`: Maximum number of matches to return.
- `filters?: MatchFilters`: (Optional) Criteria for filtering matches.

#### `MatchFilters`
- `experience_levels?: string[]`: (Optional) Filter for experience levels.
- `locations?: string[]`: (Optional) Filter for specific locations.
- `availability_overlap_min?: number`: (Optional) Minimum hours of availability overlap required.
- `exclude_member_ids?: string[]`: (Optional) Member IDs to exclude from results.
- `include_only_active_since?: Date`: (Optional) Filter for member activity cutoff.

### Return Values
- `MemberMatch`: Object representing a successful member match, including details about the member, match score, compatibility scores, reasoning, collaboration potential, and confidence level.

## Examples

### Example of Creating a Match Request
```typescript
const matchRequest: MatchRequest = {
  requester_id: '123',
  match_type: 'collaboration',
  specific_skills: ['JavaScript', 'React'],
  urgency: 'high',
  max_matches: 5,
};
```

### Example of a Member Profile
```typescript
const memberProfile: MemberProfile = {
  id: '456',
  name: 'Jane Doe',
  bio: 'Full-stack developer with a love for open-source.',
  skills: ['JavaScript', 'Node.js', 'Python'],
  interests: ['AI', 'Web Development'],
  experience_level: 'advanced',
  collaboration_preferences: {
    project_types: ['web_app', 'mobile_app'],
    communication_style: 'collaborative',
    time_commitment: 'regular',
    remote_preference: 'remote_only',
    mentoring_interest: 'mentor',
  },
  availability: {
    days_available: ['Monday', 'Wednesday', 'Friday'],
    hours_per_week: 10,
    preferred_time_slots: ['9-11 AM', '2-4 PM