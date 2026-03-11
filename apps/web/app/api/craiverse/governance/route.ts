```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyMessage } from 'ethers';
import crypto from 'crypto';

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validation schemas
const ProposalSchema = z.object({
  community_id: z.string().uuid(),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  type: z.enum(['policy', 'budget', 'membership', 'technical', 'constitutional']),
  governance_model: z.enum(['direct', 'delegated', 'reputation_weighted', 'token_weighted']),
  voting_duration: z.number().min(24).max(2160), // 1 day to 90 days in hours
  quorum_threshold: z.number().min(0.1).max(1.0),
  approval_threshold: z.number().min(0.5).max(1.0),
  content_hash: z.string().regex(/^Qm[a-zA-Z0-9]{44}$/), // IPFS hash format
  proposer_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string()
});

const VoteSchema = z.object({
  proposal_id: z.string().uuid(),
  voter_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  choice: z.enum(['for', 'against', 'abstain']),
  voting_power: z.number().positive().optional(),
  reason: z.string().max(1000).optional(),
  signature: z.string(),
  timestamp: z.number()
});

const DelegationSchema = z.object({
  community_id: z.string().uuid(),
  delegator_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  delegate_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  delegation_type: z.enum(['full', 'topic_specific']),
  topics: z.array(z.string()).optional(),
  expiry_date: z.string().datetime().optional(),
  signature: z.string()
});

// Governance models configuration
const GOVERNANCE_MODELS = {
  direct: {
    name: 'Direct Democracy',
    votingPowerCalculation: 'equal',
    quorumRequired: true,
    delegationAllowed: false
  },
  delegated: {
    name: 'Delegated Democracy',
    votingPowerCalculation: 'delegated',
    quorumRequired: true,
    delegationAllowed: true
  },
  reputation_weighted: {
    name: 'Reputation Weighted',
    votingPowerCalculation: 'reputation',
    quorumRequired: true,
    delegationAllowed: false
  },
  token_weighted: {
    name: 'Token Weighted',
    votingPowerCalculation: 'token',
    quorumRequired: false,
    delegationAllowed: true
  }
};

// Utility functions
async function verifySignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

async function calculateVotingPower(
  address: string, 
  communityId: string, 
  governanceModel: string
): Promise<number> {
  const { data: member } = await supabase
    .from('community_members')
    .select('reputation_score, token_balance, delegation_received')
    .eq('wallet_address', address)
    .eq('community_id', communityId)
    .single();

  if (!member) return 0;

  switch (governanceModel) {
    case 'direct':
      return 1;
    case 'reputation_weighted':
      return Math.max(1, Math.floor(member.reputation_score / 100));
    case 'token_weighted':
      return member.token_balance || 0;
    case 'delegated':
      return 1 + (member.delegation_received || 0);
    default:
      return 1;
  }
}

async function calculateQuorum(proposalId: string): Promise<{ current: number; required: number; met: boolean }> {
  const { data: proposal } = await supabase
    .from('governance_proposals')
    .select('community_id, quorum_threshold, governance_model')
    .eq('id', proposalId)
    .single();

  if (!proposal) throw new Error('Proposal not found');

  const { data: totalMembers } = await supabase
    .from('community_members')
    .select('wallet_address')
    .eq('community_id', proposal.community_id);

  const { data: votes } = await supabase
    .from('governance_votes')
    .select('voter_address', 'voting_power')
    .eq('proposal_id', proposalId);

  const uniqueVoters = new Set(votes?.map(v => v.voter_address) || []);
  const totalVotingPower = votes?.reduce((sum, vote) => sum + (vote.voting_power || 1), 0) || 0;
  
  const currentParticipation = proposal.governance_model === 'token_weighted' 
    ? totalVotingPower 
    : uniqueVoters.size;
  
  const totalPossible = proposal.governance_model === 'token_weighted'
    ? await getTotalTokenSupply(proposal.community_id)
    : totalMembers?.length || 0;

  const requiredQuorum = Math.ceil(totalPossible * proposal.quorum_threshold);
  
  return {
    current: currentParticipation,
    required: requiredQuorum,
    met: currentParticipation >= requiredQuorum
  };
}

async function getTotalTokenSupply(communityId: string): Promise<number> {
  const { data } = await supabase
    .from('community_members')
    .select('token_balance')
    .eq('community_id', communityId);
  
  return data?.reduce((sum, member) => sum + (member.token_balance || 0), 0) || 0;
}

async function validateProposal(proposal: any, communityId: string): Promise<string[]> {
  const errors: string[] = [];
  
  // Check if proposer is a community member
  const { data: member } = await supabase
    .from('community_members')
    .select('reputation_score, is_active')
    .eq('wallet_address', proposal.proposer_address)
    .eq('community_id', communityId)
    .single();

  if (!member) {
    errors.push('Proposer is not a community member');
  } else if (!member.is_active) {
    errors.push('Proposer account is inactive');
  } else if (member.reputation_score < 100) {
    errors.push('Proposer does not meet minimum reputation requirement');
  }

  // Check for duplicate active proposals
  const { data: existingProposals } = await supabase
    .from('governance_proposals')
    .select('id')
    .eq('community_id', communityId)
    .eq('title', proposal.title)
    .eq('status', 'active');

  if (existingProposals && existingProposals.length > 0) {
    errors.push('A proposal with this title is already active');
  }

  return errors;
}

// POST - Submit proposal or cast vote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = new URL(request.url).searchParams.get('action');

    switch (action) {
      case 'proposal': {
        const validatedData = ProposalSchema.parse(body);
        
        // Verify signature
        const message = `Submit proposal: ${validatedData.title} for community ${validatedData.community_id}`;
        const isValidSignature = await verifySignature(
          message,
          validatedData.signature,
          validatedData.proposer_address
        );

        if (!isValidSignature) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        // Validate proposal
        const validationErrors = await validateProposal(validatedData, validatedData.community_id);
        if (validationErrors.length > 0) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationErrors },
            { status: 400 }
          );
        }

        // Create proposal
        const proposalData = {
          ...validatedData,
          id: crypto.randomUUID(),
          status: 'active',
          created_at: new Date().toISOString(),
          voting_ends_at: new Date(Date.now() + validatedData.voting_duration * 60 * 60 * 1000).toISOString(),
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
          total_voting_power: 0
        };

        const { data: proposal, error } = await supabase
          .from('governance_proposals')
          .insert(proposalData)
          .select()
          .single();

        if (error) {
          return NextResponse.json(
            { error: 'Failed to create proposal' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          proposal,
          governance_model: GOVERNANCE_MODELS[validatedData.governance_model]
        });
      }

      case 'vote': {
        const validatedData = VoteSchema.parse(body);
        
        // Verify signature
        const message = `Vote ${validatedData.choice} on proposal ${validatedData.proposal_id} at ${validatedData.timestamp}`;
        const isValidSignature = await verifySignature(
          message,
          validatedData.signature,
          validatedData.voter_address
        );

        if (!isValidSignature) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        // Check if proposal exists and is active
        const { data: proposal } = await supabase
          .from('governance_proposals')
          .select('*')
          .eq('id', validatedData.proposal_id)
          .single();

        if (!proposal) {
          return NextResponse.json(
            { error: 'Proposal not found' },
            { status: 404 }
          );
        }

        if (proposal.status !== 'active' || new Date() > new Date(proposal.voting_ends_at)) {
          return NextResponse.json(
            { error: 'Voting period has ended' },
            { status: 400 }
          );
        }

        // Check if user already voted
        const { data: existingVote } = await supabase
          .from('governance_votes')
          .select('id')
          .eq('proposal_id', validatedData.proposal_id)
          .eq('voter_address', validatedData.voter_address)
          .single();

        if (existingVote) {
          return NextResponse.json(
            { error: 'User has already voted on this proposal' },
            { status: 400 }
          );
        }

        // Calculate voting power
        const votingPower = await calculateVotingPower(
          validatedData.voter_address,
          proposal.community_id,
          proposal.governance_model
        );

        if (votingPower === 0) {
          return NextResponse.json(
            { error: 'User has no voting power in this community' },
            { status: 403 }
          );
        }

        // Record vote
        const voteData = {
          ...validatedData,
          voting_power: votingPower,
          created_at: new Date().toISOString()
        };

        const { error: voteError } = await supabase
          .from('governance_votes')
          .insert(voteData);

        if (voteError) {
          return NextResponse.json(
            { error: 'Failed to record vote' },
            { status: 500 }
          );
        }

        // Update proposal vote counts
        const updateField = `votes_${validatedData.choice}`;
        const { error: updateError } = await supabase
          .from('governance_proposals')
          .update({
            [updateField]: proposal[updateField] + votingPower,
            total_voting_power: proposal.total_voting_power + votingPower
          })
          .eq('id', validatedData.proposal_id);

        if (updateError) {
          console.error('Failed to update proposal counts:', updateError);
        }

        return NextResponse.json({
          success: true,
          voting_power: votingPower,
          current_results: {
            for: proposal.votes_for + (validatedData.choice === 'for' ? votingPower : 0),
            against: proposal.votes_against + (validatedData.choice === 'against' ? votingPower : 0),
            abstain: proposal.votes_abstain + (validatedData.choice === 'abstain' ? votingPower : 0)
          }
        });
      }

      case 'delegate': {
        const validatedData = DelegationSchema.parse(body);
        
        // Verify signature
        const message = `Delegate voting power to ${validatedData.delegate_address} in community ${validatedData.community_id}`;
        const isValidSignature = await verifySignature(
          message,
          validatedData.signature,
          validatedData.delegator_address
        );

        if (!isValidSignature) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        // Prevent self-delegation
        if (validatedData.delegator_address === validatedData.delegate_address) {
          return NextResponse.json(
            { error: 'Cannot delegate to yourself' },
            { status: 400 }
          );
        }

        // Remove existing delegation
        await supabase
          .from('voting_delegations')
          .delete()
          .eq('delegator_address', validatedData.delegator_address)
          .eq('community_id', validatedData.community_id);

        // Create new delegation
        const { error } = await supabase
          .from('voting_delegations')
          .insert({
            ...validatedData,
            created_at: new Date().toISOString(),
            is_active: true
          });

        if (error) {
          return NextResponse.json(
            { error: 'Failed to create delegation' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Voting power delegated successfully'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Governance API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Retrieve proposals, votes, or delegation info
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const communityId = url.searchParams.get('community_id');
    const proposalId = url.searchParams.get('proposal_id');
    const address = url.searchParams.get('address');
    const type = url.searchParams.get('type') || 'proposals';

    switch (type) {
      case 'proposals': {
        if (!communityId) {
          return NextResponse.json(
            { error: 'Community ID required' },
            { status: 400 }
          );
        }

        const { data: proposals, error } = await supabase
          .from('governance_proposals')
          .select(`
            *,
            governance_votes(count)
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false });

        if (error) {
          return NextResponse.json(
            { error: 'Failed to fetch proposals' },
            { status: 500 }
          );
        }

        // Calculate quorum status for each proposal
        const proposalsWithQuorum = await Promise.all(
          proposals.map(async (proposal) => {
            const quorum = await calculateQuorum(proposal.id);
            return {
              ...proposal,
              quorum_status: quorum,
              governance_config: GOVERNANCE_MODELS[proposal.governance_model]
            };
          })
        );

        return NextResponse.json({
          proposals: proposalsWithQuorum,
          total: proposals.length
        });
      }

      case 'votes': {
        if (!proposalId) {
          return NextResponse.json(
            { error: 'Proposal ID required' },
            { status: 400 }
          );
        }

        const { data: votes, error } = await supabase
          .from('governance_votes')
          .select('*')
          .eq('proposal_id', proposalId)
          .order('created_at', { ascending: false });

        if (error) {
          return NextResponse.json(
            { error: 'Failed to fetch votes' },
            { status: 500 }
          );
        }

        const quorum = await calculateQuorum(proposalId);

        return NextResponse.json({
          votes,
          quorum_status: quorum,
          summary: {
            total_votes: votes.length,
            total_voting_power: votes.reduce((sum, vote) => sum + vote.voting_power, 0),
            by_choice: {
              for: votes.filter(v => v.choice === 'for').length,
              against: votes.filter(v => v.choice === 'against').length,
              abstain: votes.filter(v => v.choice === 'abstain').length
            }
          }
        });
      }

      case 'delegations': {
        if (!communityId || !address) {
          return NextResponse.json(
            { error: 'Community ID and address required' },
            { status: 400 }
          );
        }

        const { data: delegations, error } = await supabase
          .from('voting_delegations')
          .select('*')
          .eq('community_id', communityId)
          .or(`delegator_address.eq.${address},delegate_address.eq.${address}`)
          .eq('is_active', true);

        if (error) {
          return NextResponse.json(
            { error: 'Failed to fetch delegations' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          delegations_given: delegations.filter(d => d.delegator_address === address),
          delegations_received: delegations.filter(d => d.delegate_address === address),
          total_received_power: delegations
            .filter(d => d.delegate_address === address)
            .length
        });
      }

      case 'governance_models': {
        return NextResponse.json({
          models: GOVERNANCE_MODELS,
          available_actions: ['proposal', 'vote', 'delegate']
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Governance GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update proposal status or implement policies
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const action = new URL(request.url).searchParams.get('action');

    switch (action) {
      case 'finalize_proposal': {
        const { proposal_id, executor_address, signature } = body;

        if (!proposal_id || !executor_address || !signature) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        // Verify executor has admin privileges
        const message = `Finalize proposal ${proposal_id}`;
        const isValidSignature = await verifySignature(message, signature, executor_address);
        
        if (!isValidSignature) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        const { data: proposal } = await supabase
          .from('governance_proposals')
          .select('*')
          .eq('id', proposal_id)
          .single();

        if (!proposal) {
          return NextResponse.json(
            { error: 'Proposal not found' },
            { status: 404 }
          );
        }

        // Check if voting period has ended
        if (new Date() < new Date(proposal.voting_ends_at)) {
          return NextResponse.json(
            { error: 'Voting period has not ended' },
            { status: 400 }
          );
        }

        // Calculate final results
        const quorum = await calculateQuorum(proposal_id);
        const totalVotes = proposal.votes_for + proposal.votes_against + proposal.votes_abstain;
        const approvalRate = totalVotes > 0 ? proposal.votes_for / totalVotes : 0;
        
        const passed = quorum.met && approvalRate >= proposal.approval_threshold;
        const status = passed ? 'passed' : 'failed';

        // Update proposal status
        const { error } = await supabase
          .from('governance_proposals')
          .update({
            status,
            finalized_at: new Date().toISOString(),
            final_quorum: quorum.current,
            final_approval_rate: approvalRate
          })
          .eq('id', proposal_id);

        if (error) {
          return NextResponse.json(
            { error: 'Failed to finalize proposal' },
            { status: 500 }
          );
        }

        // If passed, create policy implementation record
        if (passed) {
          await supabase
            .from('policy_implementations')
            .insert({
              proposal_id,
              community_id: proposal.community_id,
              status: 'pending',
              created_at: new Date().toISOString()
            });
        }

        return