```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit-logger'
import { sendGovernanceNotification } from '@/lib/notifications'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const createProposalSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  type: z.enum(['feature_request', 'policy_change', 'technical_upgrade', 'budget_allocation']),
  category: z.string().min(3).max(50),
  duration_hours: z.number().min(24).max(720), // 1 day to 30 days
  quorum_threshold: z.number().min(0.1).max(1), // 10% to 100%
  execution_params: z.record(z.any()).optional(),
  tags: z.array(z.string()).max(10).optional()
})

const voteSchema = z.object({
  proposal_id: z.string().uuid(),
  vote_type: z.enum(['for', 'against', 'abstain']),
  voting_power: z.number().positive().optional(),
  delegate_to: z.string().uuid().optional(),
  is_quadratic: z.boolean().default(false),
  comment: z.string().max(500).optional()
})

const debateCommentSchema = z.object({
  proposal_id: z.string().uuid(),
  parent_comment_id: z.string().uuid().optional(),
  content: z.string().min(10).max(2000),
  stance: z.enum(['for', 'against', 'neutral']).optional()
})

// Types
interface GovernanceUser {
  id: string
  reputation_score: number
  token_stake: number
  voting_power: number
  is_verified: boolean
  delegation_count: number
}

interface Proposal {
  id: string
  creator_id: string
  title: string
  description: string
  type: string
  status: 'draft' | 'active' | 'executed' | 'rejected' | 'expired'
  votes_for: number
  votes_against: number
  votes_abstain: number
  total_voting_power: number
  quorum_threshold: number
  created_at: string
  expires_at: string
}

interface Vote {
  id: string
  proposal_id: string
  voter_id: string
  vote_type: string
  voting_power: number
  delegated_power: number
  is_quadratic: boolean
  created_at: string
}

class GovernanceValidator {
  static async validateUserCanVote(userId: string, proposalId: string): Promise<boolean> {
    const { data: existingVote } = await supabase
      .from('governance_votes')
      .select('id')
      .eq('voter_id', userId)
      .eq('proposal_id', proposalId)
      .single()

    return !existingVote
  }

  static async validateProposalActive(proposalId: string): Promise<boolean> {
    const { data: proposal } = await supabase
      .from('governance_proposals')
      .select('status, expires_at')
      .eq('id', proposalId)
      .single()

    if (!proposal) return false
    return proposal.status === 'active' && new Date(proposal.expires_at) > new Date()
  }

  static validateQuorum(proposal: Proposal, totalEligiblePower: number): boolean {
    const participationRate = proposal.total_voting_power / totalEligiblePower
    return participationRate >= proposal.quorum_threshold
  }
}

class WeightCalculator {
  static calculateVotingWeight(user: GovernanceUser, isQuadratic: boolean = false): number {
    const baseWeight = user.reputation_score * 0.3 + user.token_stake * 0.7
    const verificationMultiplier = user.is_verified ? 1.2 : 1.0
    const delegationBonus = Math.min(user.delegation_count * 0.1, 0.5)
    
    let weight = baseWeight * verificationMultiplier * (1 + delegationBonus)
    
    if (isQuadratic) {
      weight = Math.sqrt(weight)
    }
    
    return Math.max(weight, 1) // Minimum weight of 1
  }

  static async calculateDelegatedPower(userId: string): Promise<number> {
    const { data: delegations } = await supabase
      .from('governance_delegations')
      .select(`
        delegator_id,
        governance_users!inner(reputation_score, token_stake, is_verified)
      `)
      .eq('delegate_id', userId)
      .eq('is_active', true)

    if (!delegations) return 0

    return delegations.reduce((total, delegation) => {
      const user = delegation.governance_users as GovernanceUser
      return total + this.calculateVotingWeight(user)
    }, 0)
  }
}

class VotingEngine {
  static async submitVote(vote: z.infer<typeof voteSchema>, userId: string): Promise<Vote> {
    // Get user voting power
    const { data: user } = await supabase
      .from('governance_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!user) throw new Error('User not found')

    const votingPower = WeightCalculator.calculateVotingWeight(user, vote.is_quadratic)
    const delegatedPower = await WeightCalculator.calculateDelegatedPower(userId)
    const totalPower = votingPower + delegatedPower

    // Record the vote
    const { data: newVote, error } = await supabase
      .from('governance_votes')
      .insert({
        proposal_id: vote.proposal_id,
        voter_id: userId,
        vote_type: vote.vote_type,
        voting_power: votingPower,
        delegated_power: delegatedPower,
        is_quadratic: vote.is_quadratic,
        comment: vote.comment,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to record vote: ${error.message}`)

    // Update proposal vote counts
    await this.updateProposalTally(vote.proposal_id, vote.vote_type, totalPower)

    return newVote
  }

  private static async updateProposalTally(proposalId: string, voteType: string, power: number) {
    const column = voteType === 'for' ? 'votes_for' : 
                  voteType === 'against' ? 'votes_against' : 'votes_abstain'
    
    await supabase.rpc('increment_vote_count', {
      proposal_id: proposalId,
      vote_column: column,
      power_amount: power
    })
  }
}

class QuorumTracker {
  static async checkAndExecuteProposal(proposalId: string): Promise<void> {
    const { data: proposal } = await supabase
      .from('governance_proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (!proposal) return

    const { data: totalPower } = await supabase
      .from('governance_users')
      .select('reputation_score, token_stake, is_verified')

    if (!totalPower) return

    const totalEligiblePower = totalPower.reduce((sum, user) => 
      sum + WeightCalculator.calculateVotingWeight(user), 0
    )

    if (GovernanceValidator.validateQuorum(proposal, totalEligiblePower)) {
      if (proposal.votes_for > proposal.votes_against) {
        await this.executeProposal(proposal)
      } else {
        await this.rejectProposal(proposalId)
      }
    }
  }

  private static async executeProposal(proposal: Proposal): Promise<void> {
    await supabase
      .from('governance_proposals')
      .update({ 
        status: 'executed',
        executed_at: new Date().toISOString()
      })
      .eq('id', proposal.id)

    // Trigger execution logic based on proposal type
    await this.triggerExecution(proposal)
    
    await sendGovernanceNotification({
      type: 'proposal_executed',
      proposal_id: proposal.id,
      title: proposal.title
    })
  }

  private static async rejectProposal(proposalId: string): Promise<void> {
    await supabase
      .from('governance_proposals')
      .update({ status: 'rejected' })
      .eq('id', proposalId)

    await sendGovernanceNotification({
      type: 'proposal_rejected',
      proposal_id: proposalId
    })
  }

  private static async triggerExecution(proposal: Proposal): Promise<void> {
    // Implementation would depend on proposal type
    switch (proposal.type) {
      case 'feature_request':
        // Add to development backlog
        break
      case 'policy_change':
        // Update platform policies
        break
      case 'technical_upgrade':
        // Schedule technical implementation
        break
      case 'budget_allocation':
        // Process budget allocation
        break
    }
  }
}

class DebateManager {
  static async addComment(
    comment: z.infer<typeof debateCommentSchema>, 
    userId: string
  ): Promise<any> {
    // Validate proposal exists and is active
    const isActive = await GovernanceValidator.validateProposalActive(comment.proposal_id)
    if (!isActive) {
      throw new Error('Proposal is not active for debate')
    }

    // Content moderation check
    const moderationResult = await this.moderateContent(comment.content)
    if (!moderationResult.approved) {
      throw new Error('Comment violates community guidelines')
    }

    const { data: newComment, error } = await supabase
      .from('governance_comments')
      .insert({
        proposal_id: comment.proposal_id,
        parent_comment_id: comment.parent_comment_id,
        author_id: userId,
        content: comment.content,
        stance: comment.stance,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to add comment: ${error.message}`)

    return newComment
  }

  private static async moderateContent(content: string): Promise<{approved: boolean, reason?: string}> {
    // Simple content moderation - in production, use AI moderation service
    const bannedWords = ['spam', 'scam', 'hack']
    const hasBannedWords = bannedWords.some(word => content.toLowerCase().includes(word))
    
    return {
      approved: !hasBannedWords,
      reason: hasBannedWords ? 'Contains banned words' : undefined
    }
  }
}

// GET - Retrieve governance data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const proposalId = searchParams.get('proposal_id')
    const status = searchParams.get('status') || 'active'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Apply rate limiting
    await rateLimit(request, { max: 100, window: 60000 })

    switch (type) {
      case 'proposals':
        const { data: proposals, error: proposalsError } = await supabase
          .from('governance_proposals')
          .select(`
            *,
            governance_users!inner(username, reputation_score),
            governance_votes(count)
          `)
          .eq('status', status)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (proposalsError) throw proposalsError

        return NextResponse.json({ proposals })

      case 'proposal':
        if (!proposalId) {
          return NextResponse.json(
            { error: 'Proposal ID required' },
            { status: 400 }
          )
        }

        const { data: proposal, error: proposalError } = await supabase
          .from('governance_proposals')
          .select(`
            *,
            governance_users!inner(username, reputation_score),
            governance_votes(*),
            governance_comments(
              *,
              governance_users!inner(username)
            )
          `)
          .eq('id', proposalId)
          .single()

        if (proposalError) throw proposalError

        return NextResponse.json({ proposal })

      case 'user_votes':
        const userId = searchParams.get('user_id')
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID required' },
            { status: 400 }
          )
        }

        const { data: userVotes, error: votesError } = await supabase
          .from('governance_votes')
          .select(`
            *,
            governance_proposals!inner(title, status)
          `)
          .eq('voter_id', userId)
          .order('created_at', { ascending: false })

        if (votesError) throw votesError

        return NextResponse.json({ votes: userVotes })

      default:
        return NextResponse.json(
          { error: 'Invalid request type' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    await auditLog({
      action: 'governance_get_error',
      error: error.message,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create proposals, submit votes, add comments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    // Apply rate limiting
    await rateLimit(request, { max: 50, window: 60000 })

    // Extract user ID from auth (implementation depends on auth system)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    switch (action) {
      case 'create_proposal':
        const proposalData = createProposalSchema.parse(data)
        
        const { data: newProposal, error: proposalError } = await supabase
          .from('governance_proposals')
          .insert({
            creator_id: userId,
            title: proposalData.title,
            description: proposalData.description,
            type: proposalData.type,
            category: proposalData.category,
            status: 'active',
            quorum_threshold: proposalData.quorum_threshold,
            execution_params: proposalData.execution_params,
            tags: proposalData.tags,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + proposalData.duration_hours * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single()

        if (proposalError) throw proposalError

        await auditLog({
          action: 'proposal_created',
          user_id: userId,
          proposal_id: newProposal.id,
          timestamp: new Date().toISOString()
        })

        await sendGovernanceNotification({
          type: 'new_proposal',
          proposal_id: newProposal.id,
          title: proposalData.title,
          creator_id: userId
        })

        return NextResponse.json({ proposal: newProposal })

      case 'submit_vote':
        const voteData = voteSchema.parse(data)
        
        // Validate user can vote and proposal is active
        const canVote = await GovernanceValidator.validateUserCanVote(userId, voteData.proposal_id)
        if (!canVote) {
          return NextResponse.json(
            { error: 'User has already voted on this proposal' },
            { status: 409 }
          )
        }

        const isActive = await GovernanceValidator.validateProposalActive(voteData.proposal_id)
        if (!isActive) {
          return NextResponse.json(
            { error: 'Proposal is not active for voting' },
            { status: 400 }
          )
        }

        const vote = await VotingEngine.submitVote(voteData, userId)

        await auditLog({
          action: 'vote_submitted',
          user_id: userId,
          proposal_id: voteData.proposal_id,
          vote_type: voteData.vote_type,
          timestamp: new Date().toISOString()
        })

        // Check if quorum reached
        await QuorumTracker.checkAndExecuteProposal(voteData.proposal_id)

        return NextResponse.json({ vote })

      case 'add_comment':
        const commentData = debateCommentSchema.parse(data)
        const comment = await DebateManager.addComment(commentData, userId)

        await auditLog({
          action: 'comment_added',
          user_id: userId,
          proposal_id: commentData.proposal_id,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json({ comment })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    await auditLog({
      action: 'governance_post_error',
      error: error.message,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update proposals or vote delegation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    await rateLimit(request, { max: 30, window: 60000 })

    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    switch (action) {
      case 'delegate_vote':
        const { delegate_to, proposal_id } = data

        const { data: delegation, error } = await supabase
          .from('governance_delegations')
          .upsert({
            delegator_id: userId,
            delegate_id: delegate_to,
            proposal_id: proposal_id,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error

        await auditLog({
          action: 'vote_delegated',
          user_id: userId,
          delegate_id: delegate_to,
          proposal_id: proposal_id,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json({ delegation })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    await auditLog({
      action: 'governance_put_error',
      error: error.message,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
```