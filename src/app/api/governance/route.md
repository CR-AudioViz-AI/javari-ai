# Build Community Voting and Governance API

```markdown
# Community Voting and Governance API

The Community Voting and Governance API provides functionality for creating proposals, voting on those proposals, and managing governance discussions within a community. It is built using Next.js and Supabase, providing a backend service to manage proposals, voting, and comments.

## Purpose

This API enables communities to engage in governance by allowing members to propose changes, vote, and discuss various governance-related topics. It supports features such as proposal creation, voting mechanisms, and debate comments.

## Usage

The API exposes endpoints that allow users to create proposals, submit votes, and add comments related to proposals. It employs rate limiting and integrates with audit logging and notification services. It is designed to handle complex governance processes in decentralized communities.

## Parameters / Props

### Create Proposal

- `title` (string): The title of the proposal (min 10, max 200 characters).
- `description` (string): A detailed description of the proposal (min 50, max 5000 characters).
- `type` (enum): Type of proposal - one of `feature_request`, `policy_change`, `technical_upgrade`, `budget_allocation`.
- `category` (string): The category of the proposal (min 3, max 50 characters).
- `duration_hours` (number): Duration of the proposal in hours (min 24, max 720).
- `quorum_threshold` (number): The minimum voting threshold from 0.1 to 1 (10% to 100%).
- `execution_params` (optional): A record of execution parameters.
- `tags` (optional): An array of tags (max 10).

### Vote

- `proposal_id` (string): UUID of the proposal being voted on.
- `vote_type` (enum): Type of vote - one of `for`, `against`, or `abstain`.
- `voting_power` (number, optional): Amount of voting power to use (positive value).
- `delegate_to` (string, optional): UUID of the delegate user.
- `is_quadratic` (boolean): Whether to apply quadratic voting (default false).
- `comment` (string, optional): Comment on the vote (max 500 characters).

### Debate Comment

- `proposal_id` (string): UUID of the proposal to which the comment relates.
- `parent_comment_id` (string, optional): UUID of the parent comment (for threaded comments).
- `content` (string): Content of the comment (min 10, max 2000 characters).
- `stance` (enum, optional): The stance on the proposal - one of `for`, `against`, or `neutral`.

## Return Values

The API typically returns JSON objects containing the results of the operations, including success and error messages as necessary. Additionally, created entities (e.g., proposals, votes, comments) will return their IDs and relevant metadata.

## Examples

### Creating a Proposal

```json
POST /api/governance/proposals
{
  "title": "New Feature Proposal",
  "description": "This proposal is to add new feature X...",
  "type": "feature_request",
  "category": "Product Enhancements",
  "duration_hours": 72,
  "quorum_threshold": 0.5,
  "tags": ["feature", "enhancement"]
}
```

### Voting on a Proposal

```json
POST /api/governance/votes
{
  "proposal_id": "example-uuid-1234",
  "vote_type": "for",
  "voting_power": 10,
  "delegate_to": "example-delegate-uuid-5678",
  "is_quadratic": true,
  "comment": "I support this proposal."
}
```

### Adding a Debate Comment

```json
POST /api/governance/comments
{
  "proposal_id": "example-uuid-1234",
  "content": "I believe this proposal will greatly enhance our system.",
  "stance": "for"
}
```

This API forms a comprehensive governance solution, ensuring structured community participation in decision-making processes.
```