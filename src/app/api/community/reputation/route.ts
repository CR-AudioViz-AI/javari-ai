```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';

// Validation schemas
const calculateReputationSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['post_created', 'comment_added', 'helpful_vote', 'best_answer', 'content_liked', 'mentor_session']),
  metadata: z.object({
    contentId: z.string().optional(),
    votes: z.number().optional(),
    engagement: z.number().optional(),
    quality: z.number().min(1).max(5).optional()
  }).optional()
});

const flagGamingSchema = z.object({
  userId: z.string().uuid(),
  suspiciousActivity: z.enum(['vote_manipulation', 'spam_posting', 'sockpuppet_accounts', 'artificial_engagement']),
  evidence: z.string().min(10).max(1000),
  reporterId: z.string().uuid()
});

const recalculateSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  timeframe: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d')
});

// Reputation scoring algorithms
class ReputationScoreCalculator {
  private static readonly WEIGHTS = {
    post_quality: 0.25,
    community_help: 0.30,
    engagement: 0.20,
    expertise: 0.15,
    consistency: 0.10
  };

  static calculateScore(contributions: any[], interactions: any[]): number {
    const qualityScore = this.calculateQualityScore(contributions);
    const helpfulnessScore = this.calculateHelpfulnessScore(interactions);
    const engagementScore = this.calculateEngagementScore(interactions);
    const expertiseScore = this.calculateExpertiseScore(contributions);
    const consistencyScore = this.calculateConsistencyScore(contributions);

    return Math.round(
      qualityScore * this.WEIGHTS.post_quality +
      helpfulnessScore * this.WEIGHTS.community_help +
      engagementScore * this.WEIGHTS.engagement +
      expertiseScore * this.WEIGHTS.expertise +
      consistencyScore * this.WEIGHTS.consistency
    );
  }

  private static calculateQualityScore(contributions: any[]): number {
    if (!contributions.length) return 0;
    
    const avgRating = contributions.reduce((sum, c) => sum + (c.quality_rating || 3), 0) / contributions.length;
    const lengthBonus = Math.min(contributions.filter(c => c.content_length > 200).length * 5, 50);
    
    return Math.min((avgRating * 20) + lengthBonus, 100);
  }

  private static calculateHelpfulnessScore(interactions: any[]): number {
    const helpfulVotes = interactions.filter(i => i.type === 'helpful_vote').length;
    const bestAnswers = interactions.filter(i => i.type === 'best_answer').length;
    const mentorSessions = interactions.filter(i => i.type === 'mentor_session').length;
    
    return Math.min(helpfulVotes * 2 + bestAnswers * 10 + mentorSessions * 5, 100);
  }

  private static calculateEngagementScore(interactions: any[]): number {
    const likes = interactions.filter(i => i.type === 'like').length;
    const comments = interactions.filter(i => i.type === 'comment').length;
    const shares = interactions.filter(i => i.type === 'share').length;
    
    return Math.min(likes + comments * 2 + shares * 3, 100);
  }

  private static calculateExpertiseScore(contributions: any[]): number {
    const expertiseTags = contributions.flatMap(c => c.tags || []);
    const tagCounts = expertiseTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxTagCount = Math.max(...Object.values(tagCounts), 0);
    return Math.min(maxTagCount * 5, 100);
  }

  private static calculateConsistencyScore(contributions: any[]): number {
    if (contributions.length < 7) return contributions.length * 10;
    
    const daysActive = new Set(
      contributions.map(c => new Date(c.created_at).toDateString())
    ).size;
    
    return Math.min(daysActive * 2, 100);
  }
}

class AntiGamingDetector {
  static async detectSuspiciousActivity(userId: string, supabase: any): Promise<string[]> {
    const warnings: string[] = [];
    
    // Check for vote manipulation
    const { data: voteActivity } = await supabase
      .from('community_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'vote')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (voteActivity && voteActivity.length > 50) {
      warnings.push('Excessive voting activity detected');
    }
    
    // Check for rapid posting
    const { data: posts } = await supabase
      .from('user_contributions')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (posts && posts.length > 10) {
      warnings.push('Rapid posting detected');
    }
    
    // Check for self-voting patterns
    const { data: selfInteractions } = await supabase
      .from('community_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('target_user_id', userId);
    
    if (selfInteractions && selfInteractions.length > 5) {
      warnings.push('Self-interaction pattern detected');
    }
    
    return warnings;
  }
}

class ReputationBadgeGenerator {
  private static readonly BADGES = {
    'Helpful Community Member': { threshold: 100, type: 'helpfulness' },
    'Quality Contributor': { threshold: 150, type: 'quality' },
    'Community Expert': { threshold: 250, type: 'expertise' },
    'Mentor': { threshold: 300, type: 'mentoring' },
    'Community Leader': { threshold: 500, type: 'leadership' }
  };

  static generateBadges(score: number, interactions: any[]): string[] {
    const badges: string[] = [];
    
    Object.entries(this.BADGES).forEach(([badge, criteria]) => {
      if (score >= criteria.threshold) {
        badges.push(badge);
      }
    });
    
    // Special badges based on interactions
    const mentorSessions = interactions.filter(i => i.type === 'mentor_session').length;
    if (mentorSessions >= 10) {
      badges.push('Active Mentor');
    }
    
    return badges;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const { success } = await ratelimit.limit(`reputation:${user.id}`);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'calculate') {
      const body = await request.json();
      const { userId, action: actionType, metadata } = calculateReputationSchema.parse(body);

      // Verify user can update reputation (admin or self)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin' && userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Get user contributions and interactions
      const { data: contributions } = await supabase
        .from('user_contributions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      const { data: interactions } = await supabase
        .from('community_interactions')
        .select('*')
        .eq('target_user_id', userId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      // Check for gaming
      const suspiciousActivity = await AntiGamingDetector.detectSuspiciousActivity(userId, supabase);
      
      if (suspiciousActivity.length > 0) {
        await supabase
          .from('reputation_flags')
          .insert({
            user_id: userId,
            flags: suspiciousActivity,
            detected_at: new Date().toISOString(),
            auto_detected: true
          });
      }

      // Calculate reputation score
      const reputationScore = ReputationScoreCalculator.calculateScore(
        contributions || [],
        interactions || []
      );

      // Apply penalties for suspicious activity
      const finalScore = Math.max(0, reputationScore - (suspiciousActivity.length * 25));

      // Generate badges
      const badges = ReputationBadgeGenerator.generateBadges(finalScore, interactions || []);

      // Update reputation score
      const { error: updateError } = await supabase
        .from('reputation_scores')
        .upsert({
          user_id: userId,
          score: finalScore,
          badges,
          last_calculated: new Date().toISOString(),
          calculation_metadata: {
            contributions_count: contributions?.length || 0,
            interactions_count: interactions?.length || 0,
            flags: suspiciousActivity,
            action_type: actionType,
            metadata
          }
        });

      if (updateError) {
        console.error('Database error:', updateError);
        return NextResponse.json({ error: 'Failed to update reputation' }, { status: 500 });
      }

      // Track reputation change
      await supabase
        .from('reputation_history')
        .insert({
          user_id: userId,
          score_change: finalScore,
          action_type: actionType,
          created_at: new Date().toISOString(),
          metadata
        });

      return NextResponse.json({
        success: true,
        data: {
          userId,
          reputationScore: finalScore,
          badges,
          warnings: suspiciousActivity
        }
      });
    }

    if (action === 'flag-gaming') {
      const body = await request.json();
      const { userId: targetUserId, suspiciousActivity, evidence, reporterId } = flagGamingSchema.parse(body);

      // Verify reporter is not the same as target
      if (targetUserId === reporterId) {
        return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
      }

      const { error: flagError } = await supabase
        .from('reputation_flags')
        .insert({
          user_id: targetUserId,
          reporter_id: reporterId,
          flag_type: suspiciousActivity,
          evidence,
          flagged_at: new Date().toISOString(),
          auto_detected: false,
          status: 'pending'
        });

      if (flagError) {
        console.error('Flag creation error:', flagError);
        return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Gaming report submitted for review'
      });
    }

    if (action === 'recalculate') {
      // Admin only
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const body = await request.json();
      const { userIds, timeframe } = recalculateSchema.parse(body);

      // Get timeframe in milliseconds
      const timeframeMs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        'all': 365 * 24 * 60 * 60 * 1000
      }[timeframe];

      const cutoffDate = new Date(Date.now() - timeframeMs).toISOString();

      // Get users to recalculate
      let query = supabase
        .from('profiles')
        .select('id');

      if (userIds) {
        query = query.in('id', userIds);
      }

      const { data: users } = await query;
      
      if (!users) {
        return NextResponse.json({ error: 'No users found' }, { status: 404 });
      }

      const results = [];
      
      for (const targetUser of users) {
        try {
          // Get contributions and interactions
          const { data: contributions } = await supabase
            .from('user_contributions')
            .select('*')
            .eq('user_id', targetUser.id)
            .gte('created_at', cutoffDate);

          const { data: interactions } = await supabase
            .from('community_interactions')
            .select('*')
            .eq('target_user_id', targetUser.id)
            .gte('created_at', cutoffDate);

          const reputationScore = ReputationScoreCalculator.calculateScore(
            contributions || [],
            interactions || []
          );

          const badges = ReputationBadgeGenerator.generateBadges(reputationScore, interactions || []);

          await supabase
            .from('reputation_scores')
            .upsert({
              user_id: targetUser.id,
              score: reputationScore,
              badges,
              last_calculated: new Date().toISOString(),
              calculation_metadata: {
                recalculation: true,
                timeframe,
                contributions_count: contributions?.length || 0,
                interactions_count: interactions?.length || 0
              }
            });

          results.push({
            userId: targetUser.id,
            newScore: reputationScore,
            badges: badges.length
          });
        } catch (error) {
          console.error(`Error recalculating for user ${targetUser.id}:`, error);
          results.push({
            userId: targetUser.id,
            error: 'Calculation failed'
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          processed: results.length,
          results,
          timeframe
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Reputation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');

    if (action === 'leaderboard') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const timeframe = url.searchParams.get('timeframe') || '30d';

      const { data: leaderboard } = await supabase
        .from('reputation_scores')
        .select(`
          *,
          profiles(username, avatar_url, display_name)
        `)
        .order('score', { ascending: false })
        .limit(limit);

      return NextResponse.json({
        success: true,
        data: {
          leaderboard: leaderboard?.map(entry => ({
            userId: entry.user_id,
            username: entry.profiles?.username,
            displayName: entry.profiles?.display_name,
            avatarUrl: entry.profiles?.avatar_url,
            score: entry.score,
            badges: entry.badges,
            lastCalculated: entry.last_calculated
          })) || [],
          timeframe,
          total: leaderboard?.length || 0
        }
      });
    }

    if (action === 'metrics') {
      const { data: metrics } = await supabase
        .from('reputation_scores')
        .select('score');

      const scores = metrics?.map(m => m.score) || [];
      const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const maxScore = Math.max(...scores, 0);
      const minScore = Math.min(...scores, 0);

      const { data: flags } = await supabase
        .from('reputation_flags')
        .select('flag_type')
        .eq('status', 'pending');

      return NextResponse.json({
        success: true,
        data: {
          totalUsers: scores.length,
          averageScore: Math.round(avgScore),
          maxScore,
          minScore,
          pendingFlags: flags?.length || 0,
          flagTypes: flags?.reduce((acc, flag) => {
            acc[flag.flag_type] = (acc[flag.flag_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {}
        }
      });
    }

    if (userId) {
      // Get specific user reputation
      const { data: reputation } = await supabase
        .from('reputation_scores')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!reputation) {
        return NextResponse.json({ error: 'Reputation not found' }, { status: 404 });
      }

      // Get reputation history
      const { data: history } = await supabase
        .from('reputation_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      return NextResponse.json({
        success: true,
        data: {
          userId,
          currentScore: reputation.score,
          badges: reputation.badges,
          lastCalculated: reputation.last_calculated,
          calculationMetadata: reputation.calculation_metadata,
          history: history || []
        }
      });
    }

    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });

  } catch (error) {
    console.error('Reputation GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```