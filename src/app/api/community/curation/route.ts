```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import rateLimit from '@/lib/middleware/rate-limit';
import { verifyAuth } from '@/lib/auth/verify';
import { CurationEngine } from '@/lib/community/curation-engine';
import { QualityScorer } from '@/lib/community/quality-scorer';
import { CollaborativeFilter } from '@/lib/community/collaborative-filter';
import { ModerationWorkflows } from '@/lib/community/moderation-workflows';
import { ContentAnalyzer } from '@/lib/community/content-analyzer';
import { CommunityQueries } from '@/lib/supabase/community-queries';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// Input validation schemas
const submitContentSchema = z.object({
  title: z.string().min(5).max(200).trim(),
  description: z.string().min(10).max(2000).trim(),
  content_type: z.enum(['audio', 'preset', 'tutorial', 'template']),
  content_url: z.string().url(),
  tags: z.array(z.string().max(50)).max(10),
  category_id: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

const moderationSchema = z.object({
  content_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'flag', 'request_changes']),
  reason: z.string().max(500).optional(),
  feedback: z.string().max(1000).optional(),
});

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'flagged']).optional(),
  content_type: z.enum(['audio', 'preset', 'tutorial', 'template']).optional(),
  category_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'quality_score', 'popularity']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Initialize services
const curationEngine = new CurationEngine();
const qualityScorer = new QualityScorer();
const collaborativeFilter = new CollaborativeFilter();
const moderationWorkflows = new ModerationWorkflows();
const contentAnalyzer = new ContentAnalyzer();
const communityQueries = new CommunityQueries();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 content submissions per window
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const authResult = await verifyAuth(supabase);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = submitContentSchema.parse(body);

    // Check user permissions and reputation
    const userProfile = await communityQueries.getUserProfile(authResult.user.id);
    if (!userProfile || userProfile.reputation_score < -50) {
      return NextResponse.json(
        { error: 'Insufficient permissions to submit content' },
        { status: 403 }
      );
    }

    // Check for duplicate content
    const duplicateCheck = await communityQueries.checkDuplicateContent(
      validatedData.content_url,
      authResult.user.id
    );

    if (duplicateCheck.exists) {
      return NextResponse.json(
        { error: 'Duplicate content detected' },
        { status: 409 }
      );
    }

    // Content analysis pipeline
    const analysisResult = await contentAnalyzer.analyzeContent({
      title: validatedData.title,
      description: validatedData.description,
      content_url: validatedData.content_url,
      content_type: validatedData.content_type,
      metadata: validatedData.metadata,
    });

    if (!analysisResult.safe) {
      return NextResponse.json(
        { 
          error: 'Content flagged for safety concerns',
          details: analysisResult.safety_issues 
        },
        { status: 400 }
      );
    }

    // AI Quality Scoring
    const qualityScore = await qualityScorer.scoreContent({
      title: validatedData.title,
      description: validatedData.description,
      content_type: validatedData.content_type,
      tags: validatedData.tags,
      analysis_result: analysisResult,
      user_reputation: userProfile.reputation_score,
    });

    // Create content record
    const contentData = {
      user_id: authResult.user.id,
      title: validatedData.title,
      description: validatedData.description,
      content_type: validatedData.content_type,
      content_url: validatedData.content_url,
      tags: validatedData.tags,
      category_id: validatedData.category_id,
      metadata: validatedData.metadata,
      quality_score: qualityScore.overall_score,
      analysis_data: analysisResult,
      status: qualityScore.overall_score >= 7.0 ? 'approved' : 'pending',
    };

    const createdContent = await communityQueries.createContent(contentData);

    // Store quality score details
    await communityQueries.storeQualityScore(createdContent.id, {
      overall_score: qualityScore.overall_score,
      technical_quality: qualityScore.technical_quality,
      creativity: qualityScore.creativity,
      originality: qualityScore.originality,
      usefulness: qualityScore.usefulness,
      presentation: qualityScore.presentation,
      scoring_version: qualityScore.version,
      confidence: qualityScore.confidence,
    });

    // Apply collaborative filtering
    const filterResult = await collaborativeFilter.processNewContent({
      content_id: createdContent.id,
      user_id: authResult.user.id,
      content_type: validatedData.content_type,
      tags: validatedData.tags,
      quality_score: qualityScore.overall_score,
    });

    // Add to moderation queue if needed
    if (contentData.status === 'pending' || qualityScore.needs_human_review) {
      await moderationWorkflows.addToQueue({
        content_id: createdContent.id,
        priority: qualityScore.overall_score < 5.0 ? 'high' : 'normal',
        flags: analysisResult.flags || [],
        auto_flagged: qualityScore.overall_score < 3.0,
      });
    }

    // Cache results
    const cacheKey = `content:${createdContent.id}`;
    await redis.setex(cacheKey, 3600, JSON.stringify({
      ...createdContent,
      quality_score: qualityScore,
      filter_result: filterResult,
    }));

    // Update user statistics
    await communityQueries.updateUserStats(authResult.user.id, {
      content_submitted: 1,
      last_submission: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      content: {
        id: createdContent.id,
        status: createdContent.status,
        quality_score: qualityScore.overall_score,
        estimated_review_time: contentData.status === 'pending' ? '2-4 hours' : null,
      },
      recommendations: filterResult.recommendations,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Content submission error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for queries
    const rateLimitResult = await rateLimit(request, {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const authResult = await verifyAuth(supabase);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = querySchema.parse(queryParams);

    // Check if user has moderation permissions for queue requests
    const userProfile = await communityQueries.getUserProfile(authResult.user.id);
    const isModerator = userProfile?.role === 'moderator' || userProfile?.role === 'admin';

    // Build cache key
    const cacheKey = `curation:query:${Buffer.from(JSON.stringify(validatedQuery)).toString('base64')}`;
    
    // Try to get from cache first
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(JSON.parse(cachedResult));
    }

    // Query database
    const queryOptions = {
      ...validatedQuery,
      user_id: validatedQuery.user_id || (validatedQuery.status === 'pending' && !isModerator ? authResult.user.id : undefined),
      include_moderation_data: isModerator,
    };

    const result = await communityQueries.queryCuratedContent(queryOptions);

    // Apply collaborative filtering for recommendations
    if (!validatedQuery.user_id && validatedQuery.status !== 'pending') {
      const recommendations = await collaborativeFilter.getRecommendations({
        user_id: authResult.user.id,
        content_type: validatedQuery.content_type,
        category_id: validatedQuery.category_id,
        limit: 10,
      });

      result.recommendations = recommendations;
    }

    // Enhance with quality score insights for moderators
    if (isModerator && validatedQuery.status === 'pending') {
      for (const content of result.data) {
        const qualityInsights = await qualityScorer.getScoreInsights(content.id);
        content.quality_insights = qualityInsights;
      }
    }

    // Cache results (shorter cache for moderation queue)
    const cacheTime = validatedQuery.status === 'pending' ? 300 : 1800; // 5min for pending, 30min for others
    await redis.setex(cacheKey, cacheTime, JSON.stringify(result));

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Content query error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
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
    // Rate limiting for moderation actions
    const rateLimitResult = await rateLimit(request, {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 50, // 50 moderation actions per window
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const authResult = await verifyAuth(supabase);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check moderation permissions
    const userProfile = await communityQueries.getUserProfile(authResult.user.id);
    const isModerator = userProfile?.role === 'moderator' || userProfile?.role === 'admin';

    if (!isModerator) {
      return NextResponse.json(
        { error: 'Insufficient permissions for moderation actions' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = moderationSchema.parse(body);

    // Get content details
    const content = await communityQueries.getContentById(validatedData.content_id);
    if (!content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    // Execute moderation workflow
    const moderationResult = await moderationWorkflows.processModerationAction({
      content_id: validatedData.content_id,
      moderator_id: authResult.user.id,
      action: validatedData.action,
      reason: validatedData.reason,
      feedback: validatedData.feedback,
      content_data: content,
    });

    // Update content status
    await communityQueries.updateContentStatus(validatedData.content_id, {
      status: moderationResult.new_status,
      moderated_by: authResult.user.id,
      moderated_at: new Date().toISOString(),
      moderation_reason: validatedData.reason,
      moderation_feedback: validatedData.feedback,
    });

    // Update user reputation based on moderation result
    if (moderationResult.reputation_impact) {
      await communityQueries.updateUserReputation(
        content.user_id,
        moderationResult.reputation_impact
      );
    }

    // Remove from moderation queue
    await moderationWorkflows.removeFromQueue(validatedData.content_id);

    // Invalidate relevant caches
    await redis.del(`content:${validatedData.content_id}`);
    
    // Clear query caches that might include this content
    const cachePattern = 'curation:query:*';
    const cacheKeys = await redis.keys(cachePattern);
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }

    // Notify content creator if needed
    if (validatedData.action === 'reject' && validatedData.feedback) {
      await moderationWorkflows.notifyContentCreator({
        user_id: content.user_id,
        content_id: validatedData.content_id,
        action: validatedData.action,
        feedback: validatedData.feedback,
      });
    }

    // Log moderation action for audit trail
    await communityQueries.logModerationAction({
      content_id: validatedData.content_id,
      moderator_id: authResult.user.id,
      action: validatedData.action,
      reason: validatedData.reason,
      metadata: {
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      moderation_result: {
        content_id: validatedData.content_id,
        new_status: moderationResult.new_status,
        action_taken: validatedData.action,
        reputation_impact: moderationResult.reputation_impact,
      },
    });

  } catch (error: any) {
    console.error('Moderation action error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const authResult = await verifyAuth(supabase);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('id');

    if (!contentId) {
      return NextResponse.json(
        { error: 'Content ID required' },
        { status: 400 }
      );
    }

    // Get content and verify ownership or admin permissions
    const content = await communityQueries.getContentById(contentId);
    if (!content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    const userProfile = await communityQueries.getUserProfile(authResult.user.id);
    const canDelete = content.user_id === authResult.user.id || 
                     userProfile?.role === 'admin' ||
                     userProfile?.role === 'moderator';

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete content' },
        { status: 403 }
      );
    }

    // Soft delete content
    await communityQueries.deleteContent(contentId, authResult.user.id);

    // Clear caches
    await redis.del(`content:${contentId}`);
    const cacheKeys = await redis.keys('curation:query:*');
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }

    return NextResponse.json({
      success: true,
      message: 'Content deleted successfully',
    });

  } catch (error: any) {
    console.error('Content deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```