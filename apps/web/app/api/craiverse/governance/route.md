# Generate Decentralized Governance Protocol API

```markdown
# Decentralized Governance Protocol API

## Purpose
The Decentralized Governance Protocol API facilitates the creation and management of governance proposals, voting mechanisms, and delegation of authority within decentralized communities. It ensures secure and structured interactions among participants based on predefined governance models.

## Usage
Integrate this API into your Next.js application to manage decentralized governance processes efficiently. Use the provided endpoints to submit proposals, cast votes, and assign delegation of voting power. Ensure environment variables for Supabase are configured for database access.

## Parameters/Props

### Proposal Parameters
- `community_id` (string): The UUID of the community submitting the proposal.
- `title` (string): A descriptive title for the proposal (5 to 200 characters).
- `description` (string): Detailed explanation of the proposal (20 to 5000 characters).
- `type` (enum): Type of proposal, options include 'policy', 'budget', 'membership', 'technical', 'constitutional'.
- `governance_model` (enum): Governance model, options are 'direct', 'delegated', 'reputation_weighted', 'token_weighted'.
- `voting_duration` (number): Duration for voting in hours (24 to 2160 hours).
- `quorum_threshold` (number): Minimum participation required (0.1 to 1.0).
- `approval_threshold` (number): Minimum approval required for passing (0.5 to 1.0).
- `content_hash` (string): IPFS hash of the proposal content, must match regex `/^Qm[a-zA-Z0-9]{44}$/`.
- `proposer_address` (string): Ethereum address of the proposer, must match regex `/^0x[a-fA-F0-9]{40}$/`.
- `signature` (string): Digital signature proving the proposal's authenticity.

### Vote Parameters
- `proposal_id` (string): The UUID of the proposal being voted on.
- `voter_address` (string): Ethereum address of the voter, must match regex `/^0x[a-fA-F0-9]{40}$/`.
- `choice` (enum): Vote choices; options are 'for', 'against', 'abstain'.
- `voting_power` (number, optional): The amount of voting power being used.
- `reason` (string, optional): Reason for the vote, limited to 1000 characters.
- `signature` (string): Digital signature of the voting action.
- `timestamp` (number): Unix timestamp when the vote was cast.

### Delegation Parameters
- `community_id` (string): The UUID of the community for delegation.
- `delegator_address` (string): Ethereum address of the delegator, must match regex `/^0x[a-fA-F0-9]{40}$/`.
- `delegate_address` (string): Ethereum address of the delegate, must match regex `/^0x[a-fA-F0-9]{40}$/`.
- `delegation_type` (enum): Type of delegation; options are 'full', 'topic_specific'.
- `topics` (array of strings, optional): Specific topics for topic-specific delegation.
- `expiry_date` (string, optional): The date and time when the delegation expires, in ISO 8601 format.
- `signature` (string): Digital signature authenticating the delegation.

## Return Values
The API returns standardized responses for proposal submission, voting, and delegation actions, validating the input and ensuring compliance with the established schemas. A successful request will typically yield a confirmation object or an error object detailing issues with the input.

## Examples

### Submit a Proposal
```javascript
const proposal = {
  community_id: "123e4567-e89b-12d3-a456-426614174000",
  title: "Increase Budget for Community Initiatives",
  description: "Proposal to allocate additional funds for community projects.",
  type: "budget",
  governance_model: "token_weighted",
  voting_duration: 48,
  quorum_threshold: 0.5,
  approval_threshold: 0.7,
  content_hash: "Qm...xyz123",
  proposer_address: "0x1234567890abcdef1234567890abcdef12345678",
  signature: "0xabcdef..."
};
```

### Cast a Vote
```javascript
const vote = {
  proposal_id: "123e4567-e89b-12d3-a456-426614174000",
  voter_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  choice: "for",
  voting_power: 10,
  reason: "Support for the proposal",
  signature: "0x123456...",
  timestamp: Date.now()
};
```

### Delegate Voting Power
```javascript
const delegation = {
  community_id: "123e4567