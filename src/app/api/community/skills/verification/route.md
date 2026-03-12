# Implement Community Skill Verification API

# Community Skill Verification API Documentation

## Purpose
The Community Skill Verification API facilitates the verification of skills within a community by enabling a variety of verification methods, including peer validation, portfolio assessments, automated tests, and combined approaches. This API ensures that members can substantiate their skills through documented evidence and evaluations.

## Usage
To use this API, you must send HTTP requests to the endpoint responsible for skill verification. The API requires specific environment variables be configured in your application.

### Environment Variables
Ensure the following environment variables are set:
- `SUPABASE_URL`: The URL for your Supabase instance.
- `SUPABASE_ANON_KEY`: The public API key for accessing Supabase.
- `WEB3_PROVIDER_URL`: The URL for your Web3 provider.
- `BLOCKCHAIN_PRIVATE_KEY`: The private key for blockchain operations.
- `GITHUB_API_TOKEN`: The token for accessing the GitHub API.
- `AI_ASSESSMENT_API_KEY`: The key for the AI assessment service.

## Parameters/Props

### `initiateVerification`
Initiate a verification request based on user-submitted skill and belonging memberships.

- **Parameters:**
  - `member_id` (string): UUID of the member requesting verification.
  - `skill_id` (string): UUID of the skill being verified.
  - `verification_type` (enum): Type of verification: `peer_validation`, `portfolio_assessment`, `automated_test`, `combined`.
  - `portfolio_links` (optional, array of strings): URLs to portfolio items for assessment.
  - `test_preferences` (optional, object): 
    - `difficulty_level` (enum): Level of the test: `beginner`, `intermediate`, `advanced`.
    - `test_duration_minutes` (number): Duration of the test (15-180 minutes).
  - `peer_validator_requirements` (optional, object):
    - `min_validators` (number): Minimum number of peer validators (3-10).
    - `required_skill_level` (enum): Skill level for validators: `beginner`, `intermediate`, `advanced`, `expert`.
    - `exclude_member_ids` (optional, array of strings): UUIDs of members to exclude from validation.

### `endorseSkill`
Allows members to endorse a skill verification.

- **Parameters:**
  - `verification_id` (string): UUID of the verification being endorsed.
  - `endorser_id` (string): UUID of the member providing the endorsement.
  - `endorsement_type` (enum): Type of endorsement: `peer_review`, `mentor_validation`, `project_collaboration`, `code_review`.
  - `confidence_score` (number): A score from 1 to 10 indicating confidence in the endorsement.
  - `comments` (optional, string): Additional comments (10-500 characters).
  - `evidence_links` (optional, array of strings): URLs for evidence related to the endorsement.

### `updateVerification`
Allows for updates to an existing verification request (details coming soon).

## Return Values
The API returns a structured response indicating the success or failure of the action taken, along with any relevant data related to the request such as verification status or endorsement results.

## Examples

### Initiate Verification Example
```javascript
const response = await fetch('/api/community/skills/verification/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    member_id: '123e4567-e89b-12d3-a456-426614174000',
    skill_id: '223e4567-e89b-12d3-a456-426614174001',
    verification_type: 'peer_validation',
    test_preferences: {
      difficulty_level: 'intermediate',
      test_duration_minutes: 30
    }
  }),
});
const data = await response.json();
```

### Endorse Skill Example
```javascript
const endorseResponse = await fetch('/api/community/skills/verification/endorse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    verification_id: '333e4567-e89b-12d3-a456-426614174002',
    endorser_id: '123e4567-e89b-12d3-a456-426614174003',
    endorsement_type: 'peer_review',
    confidence_score: 8,
    comments: 'The member demonstrated exceptional skills in the project.',
    evidence_links: ['http://example.com/evidence']
  }),
});
const endorseData = await endorseResponse.json();
``` 

This API allows for a robust method of verifying and endorsing the skills of community members, enhancing both trust and accountability within the ecosystem.