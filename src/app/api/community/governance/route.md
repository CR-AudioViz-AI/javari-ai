# Build Community Voting and Consensus API

```markdown
# Community Voting and Consensus API

## Purpose
The Community Voting and Consensus API is designed to facilitate the governance of community proposals through a voting mechanism. It allows users to create proposals, submit votes, and manage delegation, ensuring transparency and participation in community decision-making.

## Usage
The API provides endpoints to:
1. **Create Proposals:** Users can submit governance proposals for community voting.
2. **Vote on Proposals:** Registered users can cast their votes on existing proposals.
3. **Delegate Voting Power:** Users can delegate their voting power to other users.

## Parameters/Props

### Proposal Creation
**Endpoint:** `/api/community/governance/proposals`

**Request Body:**
- `title`: (string) A title for the proposal (10 to 200 characters).
- `description`: (string) A detailed description of the proposal (50 to 5000 characters).
- `category`: (enum) The category of the proposal (options: `feature`, `policy`, `budget`, `technical`, `community`).
- `executionData`: (object) Execution details:
  - `type`: (enum) Type of execution (options: `parameter_change`, `fund_allocation`, `feature_toggle`, `policy_update`).
  - `payload`: (object) Optional key-value data for execution.
  - `requiresManualExecution`: (boolean) Whether manual execution is required (default: false).
- `votingPeriod`: (number) Duration of the voting in hours (1 day to 1 week).
- `quorumThreshold`: (number) Minimum required proportion of voters (0.1 to 1.0).
- `passingThreshold`: (number) Minimum proportion of votes required for the proposal to pass (0.5 to 1.0).

### Vote Submission
**Endpoint:** `/api/community/governance/votes`

**Request Body:**
- `proposalId`: (string) UUID of the proposal being voted on.
- `vote`: (enum) Vote option (options: `yes`, `no`, `abstain`).
- `weight`: (number) Optional voting weight.
- `reason`: (string) Optional reason for the vote (max 1000 characters).

### Delegation
**Endpoint:** `/api/community/governance/delegate`

**Request Body:**
- `delegateId`: (string) UUID of the user to whom voting power is delegated.
- `scope`: (enum) Scope of delegation (options: `all`, `category`; default: `all`).
- `category`: (string) Optional category for delegation.
- `expiresAt`: (string) Optional expiration date/time for the delegation (ISO 8601 datetime).

## Return Values
- **Proposal Creation:** Returns the created proposal object, including its ID and status.
- **Vote Submission:** Returns the submission status and any relevant metrics.
- **Delegation:** Returns the status of the delegation setup.

## Examples

### Creating a Proposal
```json
{
  "title": "Improve Community Engagement",
  "description": "A proposal to implement new strategies for increasing community involvement.",
  "category": "community",
  "executionData": {
    "type": "policy_update",
    "payload": {
      "strategy": "monthly meetings"
    },
    "requiresManualExecution": false
  },
  "votingPeriod": 48,
  "quorumThreshold": 0.3,
  "passingThreshold": 0.7
}
```

### Submitting a Vote
```json
{
  "proposalId": "be3a5c4b-19e9-407c-9cde-b2c6f50f9935",
  "vote": "yes",
  "weight": 1,
  "reason": "I believe this will benefit our community greatly."
}
```

### Delegating Voting Power
```json
{
  "delegateId": "a10c154c-5aef-4111-8c29-1f68e0c61a72",
  "scope": "all",
  "expiresAt": "2023-12-31T23:59:59Z"
}
```
```