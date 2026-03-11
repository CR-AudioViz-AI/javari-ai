# Build Decentralized Community Voting System

# DecentralizedVotingSystem Component Documentation

## Purpose
The `DecentralizedVotingSystem` component provides a framework for creating and managing a decentralized community voting system. It allows users to propose, vote on, and track proposals using blockchain technology and IPFS for decentralized storage.

## Usage
To utilize the `DecentralizedVotingSystem`, import it in your React application and render it within your component tree. Ensure that your environment includes the required libraries, such as `@supabase/supabase-js`, `ethers`, and `ipfs-http-client`.

```tsx
import DecentralizedVotingSystem from 'src/modules/community/voting/DecentralizedVotingSystem';

const App = () => {
  return (
    <div>
      <DecentralizedVotingSystem />
    </div>
  );
};
```

## Parameters/Props
The `DecentralizedVotingSystem` accepts the following props:
- **onProposalCreated**: Callback function invoked when a new proposal is created.
- **onVoteRecorded**: Callback function invoked when a user votes on a proposal.
- **governanceToken**: Configuration object for the governance token used in voting.

Example of governance token object:
```tsx
const governanceToken = {
  id: "token123",
  address: "0xYourTokenAddress",
  symbol: "TOKEN",
  name: "Voting Token",
  decimals: 18,
  totalSupply: 1000000,
  stakingMultiplier: 2,
};
```

## Return Values
The `DecentralizedVotingSystem` component does not return values but renders UI elements representing proposals, voting statuses, and voting results. The component manages internal state related to voting and proposals and invokes provided callbacks to inform parent components of actions taken.

## Examples
Here’s a simple example of how to integrate the `DecentralizedVotingSystem` into a parent component.

```tsx
const handleProposalCreated = (newProposal) => {
  console.log("New Proposal Created:", newProposal);
};

const handleVoteRecorded = (voteDetails) => {
  console.log("Vote Recorded:", voteDetails);
};

const App = () => {
  const governanceToken = {
    id: "token123",
    address: "0xYourTokenAddress",
    symbol: "TOKEN",
    name: "Voting Token",
    decimals: 18,
    totalSupply: 1000000,
    stakingMultiplier: 2,
  };

  return (
    <DecentralizedVotingSystem 
      onProposalCreated={handleProposalCreated} 
      onVoteRecorded={handleVoteRecorded} 
      governanceToken={governanceToken} 
    />
  );
};
```

## Conclusion
The `DecentralizedVotingSystem` component facilitates an interactive and decentralized approach to community voting, integrating blockchain capabilities with user-friendly React components. Make sure to adapt the component's props and callback functions to fit your specific application needs.