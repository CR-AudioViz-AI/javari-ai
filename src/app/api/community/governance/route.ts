import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { validateAuth } from '@/lib/auth';
import { z } from 'zod';
import { createHash } from 'crypto';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const CreateProposalSchema = z.object({
  title: z.string().min(10).max(200).trim(),
  description: z.string().min(50).max(5000).trim(),
  category: z.enum(['feature', 'policy', 'budget', 'technical', 'community']),
  executionData: z.object({
    type: z.enum(['parameter_change', 'fund_allocation', 'feature_toggle', 'policy_update']),
    payload: z.record(z.unknown()).optional(),
    requiresManualExecution: z.boolean().default(false)
  }),
  votingPeriod: z.number().min(24).max(168), // Hours: 1 day to 1 week
  quorumThreshold: z.number().min(0.1).max(1.0),
  passingThreshold: z.number().min(0.5).max(1.0)
});

const VoteSubmissionSchema = z.object({
  proposalId: z.string().uuid(),
  vote: z.enum(['yes', 'no', 'abstain']),
  weight: z.number().min(0).optional(),
  reason: z.string().max(1000).optional()
});

const DelegationSchema = z.object({
  delegateId: z.string().uuid(),
  scope: z.enum(['all', 'category']).default('all'),
  category: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

// Types
interface ProposalMetrics {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  totalWeight: number;
  yesWeight: number;
  noWeight: number;
  abstainWeight: number;
  participationRate: number;
  consensusScore: number;
  quorumMet: boolean;
  passing: boolean;
}

interface FraudDetectionResult {
  suspicious: boolean;
  reasons: string[];
  riskScore: number;
  allowVote: boolean;
}

class GovernanceManager {
  private async getUserVotingPower(userId: string): Promise<number> {
    try {
      // Get user's base voting power (could be based on tokens, reputation, etc.)
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('voting_power, reputation_score, tokens_held')
        .eq('id', userId)
        .single();

      if (error || !userProfile) return 0;

      // Calculate weighted voting power
      const baseWeight = userProfile.voting_power || 1;
      const reputationBonus = Math.min(userProfile.reputation_score / 1000, 0.5);
      const tokenBonus = Math.min(userProfile.tokens_held / 10000, 1.0);

      return Math.max(1, baseWeight + reputationBonus + tokenBonus);
    } catch (error) {
      console.error('Error calculating voting power:', error);
      return 1; // Default voting power
    }
  }

  private async detectVotingFraud(
    userId: string,
    proposalId: string,
    ipAddress: string
  ): Promise<FraudDetectionResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // Check for duplicate votes
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', userId)
        .eq('proposal_id', proposalId)
        .single();

      if (existingVote) {
        reasons.push('Duplicate vote attempt');
        riskScore += 50;
      }

      // Check IP-based voting patterns
      const { data: recentVotes } = await supabase
        .from('votes')
        .select('user_id, created_at')
        .eq('ip_address', ipAddress)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (recentVotes && recentVotes.length > 10) {
        reasons.push('Suspicious IP voting pattern');
        riskScore += 30;
      }

      // Check account age and activity
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('created_at, last_active')
        .eq('id', userId)
        .single();

      if (userProfile) {
        const accountAge = Date.now() - new Date(userProfile.created_at).getTime();
        const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

        if (daysSinceCreation < 7) {
          reasons.push('New account');
          riskScore += 20;
        }

        const daysSinceActive = userProfile.last_active 
          ? (Date.now() - new Date(userProfile.last_active).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;

        if (daysSinceActive > 30) {
          reasons.push('Dormant account suddenly active');
          riskScore += 15;
        }
      }

      return {
        suspicious: riskScore > 50,
        reasons,
        riskScore,
        allowVote: riskScore < 80
      };
    } catch (error) {
      console.error('Error in fraud detection:', error);
      return {
        suspicious: false,
        reasons: [],
        riskScore: 0,
        allowVote: true
      };
    }
  }

  private async calculateConsensus(proposalId: string): Promise<ProposalMetrics> {
    try {
      const { data: votes, error } = await supabase
        .from('votes')
        .select(`
          vote,
          weight,
          user_id,
          user_profiles!inner(voting_power)
        `)
        .eq('proposal_id', proposalId);

      if (error || !votes) {
        throw new Error('Failed to fetch votes');
      }

      let totalVotes = 0;
      let yesVotes = 0;
      let noVotes = 0;
      let abstainVotes = 0;
      let totalWeight = 0;
      let yesWeight = 0;
      let noWeight = 0;
      let abstainWeight = 0;

      votes.forEach(vote => {
        const weight = vote.weight || 1;
        totalVotes += 1;
        totalWeight += weight;

        switch (vote.vote) {
          case 'yes':
            yesVotes += 1;
            yesWeight += weight;
            break;
          case 'no':
            noVotes += 1;
            noWeight += weight;
            break;
          case 'abstain':
            abstainVotes += 1;
            abstainWeight += weight;
            break;
        }
      });

      // Get proposal details for thresholds
      const { data: proposal } = await supabase
        .from('proposals')
        .select('quorum_threshold, passing_threshold')
        .eq('id', proposalId)
        .single();

      const quorumThreshold = proposal?.quorum_threshold || 0.1;
      const passingThreshold = proposal?.passing_threshold || 0.5;

      // Get total eligible voters for participation rate
      const { count: totalEligibleVoters } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gt('voting_power', 0);

      const participationRate = totalEligibleVoters ? totalVotes / totalEligibleVoters : 0;
      const quorumMet = participationRate >= quorumThreshold;
      
      // Calculate consensus score (0-1, higher = more consensus)
      const totalNonAbstain = yesWeight + noWeight;
      const consensusScore = totalNonAbstain > 0 
        ? 1 - (Math.abs(yesWeight - noWeight) / totalNonAbstain) 
        : 0;

      const passing = quorumMet && totalNonAbstain > 0 && (yesWeight / totalNonAbstain) >= passingThreshold;

      return {
        totalVotes,
        yesVotes,
        noVotes,
        abstainVotes,
        totalWeight,
        yesWeight,
        noWeight,
        abstainWeight,
        participationRate,
        consensusScore,
        quorumMet,
        passing
      };
    } catch (error) {
      console.error('Error calculating consensus:', error);
      throw error;
    }
  }

  private async executeProposal(proposalId: string): Promise<boolean> {
    try {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('execution_data, title')
        .eq('id', proposalId)
        .single();

      if (!proposal?.execution_data) {
        return false;
      }

      const { type, payload, requiresManualExecution } = proposal.execution_data;

      if (requiresManualExecution) {
        // Log for manual execution
        await supabase.from('execution_queue').insert({
          proposal_id: proposalId,
          execution_type: type,
          payload,
          status: 'pending_manual',
          created_at: new Date().toISOString()
        });
        return true;
      }

      // Automated execution based on type
      switch (type) {
        case 'parameter_change':
          await this.executeParameterChange(payload);
          break;
        case 'feature_toggle':
          await this.executeFeatureToggle(payload);
          break;
        case 'fund_allocation':
          await this.executeFundAllocation(payload);
          break;
        default:
          throw new Error(`Unknown execution type: ${type}`);
      }

      // Update proposal status
      await supabase
        .from('proposals')
        .update({ 
          status: 'executed',
          executed_at: new Date().toISOString()
        })
        .eq('id', proposalId);

      return true;
    } catch (error) {
      console.error('Error executing proposal:', error);
      
      await supabase
        .from('proposals')
        .update({ 
          status: 'execution_failed',
          execution_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', proposalId);

      return false;
    }
  }

  private async executeParameterChange(payload: any): Promise<void> {
    // Implementation for parameter changes
    await supabase.from('system_parameters').upsert(payload);
  }

  private async executeFeatureToggle(payload: any): Promise<void> {
    // Implementation for feature toggles
    await supabase.from('feature_flags').upsert({
      flag_name: payload.feature,
      enabled: payload.enabled,
      updated_at: new Date().toISOString()
    });
  }

  private async executeFundAllocation(payload: any): Promise<void> {
    // Implementation for fund allocation
    await supabase.from('fund_allocations').insert({
      recipient: payload.recipient,
      amount: payload.amount,
      purpose: payload.purpose,
      allocated_at: new Date().toISOString(),
      status: 'approved'
    });
  }
}

const governanceManager = new GovernanceManager();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const proposalId = searchParams.get('proposalId');
    
    // Rate limiting
    const identifier = request.ip || 'anonymous';
    const { success, remaining } = await rateLimit({
      key: `governance-${identifier}`,
      limit: 100,
      window: 60000 // 1 minute
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', remaining },
        { status: 429 }
      );
    }

    switch (action) {
      case 'proposals': {
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const category = searchParams.get('category');
        const status = searchParams.get('status');
        const offset = (page - 1) * limit;

        let query = supabase
          .from('proposals')
          .select(`
            *,
            user_profiles!inner(username, avatar_url),
            votes(count)
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (category) {
          query = query.eq('category', category);
        }
        if (status) {
          query = query.eq('status', status);
        }

        const { data: proposals, error, count } = await query;

        if (error) throw error;

        return NextResponse.json({
          proposals,
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit)
          }
        });
      }

      case 'consensus': {
        if (!proposalId) {
          return NextResponse.json(
            { error: 'Proposal ID required' },
            { status: 400 }
          );
        }

        const metrics = await governanceManager['calculateConsensus'](proposalId);
        return NextResponse.json({ consensus: metrics });
      }

      case 'votes': {
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID required' },
            { status: 400 }
          );
        }

        const { data: votes, error } = await supabase
          .from('votes')
          .select(`
            *,
            proposals!inner(title, category, status)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ votes });
      }

      case 'analytics': {
        // Governance analytics
        const { data: proposalStats } = await supabase
          .from('proposals')
          .select('status, category, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        const { data: voteStats } = await supabase
          .from('votes')
          .select('vote, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        return NextResponse.json({
          analytics: {
            proposalStats: proposalStats || [],
            voteStats: voteStats || [],
            generatedAt: new Date().toISOString()
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GET /api/community/governance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAuth(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const { success, remaining } = await rateLimit({
      key: `governance-post-${user.id}`,
      limit: 10,
      window: 60000
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', remaining },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'proposal': {
        const validatedData = CreateProposalSchema.parse(body);
        
        const proposalId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + validatedData.votingPeriod * 60 * 60 * 1000);

        const { data: proposal, error } = await supabase
          .from('proposals')
          .insert({
            id: proposalId,
            title: validatedData.title,
            description: validatedData.description,
            category: validatedData.category,
            execution_data: validatedData.executionData,
            author_id: user.id,
            voting_period_hours: validatedData.votingPeriod,
            quorum_threshold: validatedData.quorumThreshold,
            passing_threshold: validatedData.passingThreshold,
            status: 'active',
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        // Log audit trail
        await supabase.from('governance_audit_log').insert({
          action: 'proposal_created',
          user_id: user.id,
          proposal_id: proposalId,
          details: { title: validatedData.title },
          ip_address: request.ip,
          created_at: new Date().toISOString()
        });

        return NextResponse.json({ proposal }, { status: 201 });
      }

      case 'vote': {
        const validatedData = VoteSubmissionSchema.parse(body);
        const ipAddress = request.ip || 'unknown';

        // Fraud detection
        const fraudCheck = await governanceManager['detectVotingFraud'](
          user.id,
          validatedData.proposalId,
          ipAddress
        );

        if (!fraudCheck.allowVote) {
          await supabase.from('governance_audit_log').insert({
            action: 'vote_blocked',
            user_id: user.id,
            proposal_id: validatedData.proposalId,
            details: { 
              reasons: fraudCheck.reasons,
              riskScore: fraudCheck.riskScore
            },
            ip_address: ipAddress,
            created_at: new Date().toISOString()
          });

          return NextResponse.json(
            { error: 'Vote blocked due to suspicious activity', reasons: fraudCheck.reasons },
            { status: 403 }
          );
        }

        // Check if proposal is still active
        const { data: proposal } = await supabase
          .from('proposals')
          .select('status, expires_at')
          .eq('id', validatedData.proposalId)
          .single();

        if (!proposal || proposal.status !== 'active') {
          return NextResponse.json(
            { error: 'Proposal is not active for voting' },
            { status: 400 }
          );
        }

        if (new Date() > new Date(proposal.expires_at)) {
          return NextResponse.json(
            { error: 'Voting period has expired' },
            { status: 400 }
          );
        }

        // Get user's voting power
        const votingPower = await governanceManager['getUserVotingPower'](user.id);

        // Submit vote
        const { data: vote, error } = await supabase
          .from('votes')
          .upsert({
            user_id: user.id,
            proposal_id: validatedData.proposalId,
            vote: validatedData.vote,
            weight: validatedData.weight || votingPower,
            reason: validatedData.reason,
            ip_address: ipAddress,
            fraud_score: fraudCheck.riskScore,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        // Log audit trail
        await supabase.from('governance_audit_log').insert({
          action: 'vote_submitted',
          user_id: user.id,
          proposal_id: validatedData.proposalId,
          details: { 
            vote: validatedData.vote,
            weight: votingPower,
            fraudScore: fraudCheck.riskScore
          },
          ip_address: ipAddress,
          created_at: new Date().toISOString()
        });

        return NextResponse.json({ vote }, { status: 201 });
      }

      case 'delegate': {
        const validatedData = DelegationSchema.parse(body);

        const { data: delegation, error } = await supabase
          .from('vote_delegations')
          .upsert({
            delegator_id: user.id,
            delegate_id: validatedData.delegateId,
            scope: validatedData.scope,
            category: validatedData.category,
            expires_at: validatedData.expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from('governance_audit_log').insert({
          action: 'delegation_created',
          user_id: user.id,
          details: { 
            delegate_id: validatedData.delegateId,
            scope: validatedData.scope
          },
          ip_address: request.ip,
          created_at: new Date().toISOString()
        });

        return NextResponse.json({ delegation }, { status: 201 });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('POST /api/community/governance error:', error);
    
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

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAuth(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: