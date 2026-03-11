```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { rateLimit } from '@/lib/utils/rate-limiter';
import { validateApiKey } from '@/lib/auth/api-key-validator';
import { sanitizeInput } from '@/lib/utils/input-sanitizer';

// Types
interface ModerationRequest {
  content: string;
  type: 'text' | 'image' | 'audio' | 'video';
  metadata?: {
    userId?: string;
    contentId?: string;
    context?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
}

interface ModerationResult {
  id: string;
  status: 'approved' | 'rejected' | 'pending_review' | 'flagged';
  confidence: number;
  violations: Array<{
    category: string;
    severity: number;
    description: string;
  }>;
  actionRequired: boolean;
  reviewRequired: boolean;
  estimatedReviewTime?: number;
}

interface PolicyViolation {
  category: 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'adult_content' | 'copyright' | 'misinformation';
  severity: number;
  confidence: number;
  details: string;
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Content Analyzer Class
class ContentAnalyzer {
  async analyzeText(content: string): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    try {
      // OpenAI Moderation
      const moderation = await openai.moderations.create({
        input: content,
      });

      const result = moderation.results[0];
      if (result.flagged) {
        Object.entries(result.categories).forEach(([category, flagged]) => {
          if (flagged) {
            const score = result.category_scores[category as keyof typeof result.category_scores];
            violations.push({
              category: this.mapOpenAICategory(category),
              severity: score > 0.8 ? 3 : score > 0.5 ? 2 : 1,
              confidence: score,
              details: `OpenAI flagged: ${category}`,
            });
          }
        });
      }

      // Perspective API (toxicity detection)
      const perspectiveScore = await this.getPerspectiveScore(content);
      if (perspectiveScore > 0.7) {
        violations.push({
          category: 'harassment',
          severity: perspectiveScore > 0.9 ? 3 : 2,
          confidence: perspectiveScore,
          details: 'High toxicity detected by Perspective API',
        });
      }

      // Custom spam detection
      const spamScore = await this.detectSpam(content);
      if (spamScore > 0.6) {
        violations.push({
          category: 'spam',
          severity: spamScore > 0.8 ? 2 : 1,
          confidence: spamScore,
          details: 'Spam patterns detected',
        });
      }

    } catch (error) {
      console.error('Content analysis error:', error);
      throw new Error('Failed to analyze content');
    }

    return violations;
  }

  private mapOpenAICategory(category: string): PolicyViolation['category'] {
    const mapping: Record<string, PolicyViolation['category']> = {
      'hate': 'hate_speech',
      'harassment': 'harassment',
      'violence': 'violence',
      'sexual': 'adult_content',
      'self-harm': 'violence',
    };
    return mapping[category] || 'harassment';
  }

  private async getPerspectiveScore(text: string): Promise<number> {
    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${process.env.PERSPECTIVE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestedAttributes: { TOXICITY: {} },
            comment: { text },
            languages: ['en'],
          }),
        }
      );

      const data = await response.json();
      return data.attributeScores?.TOXICITY?.summaryScore?.value || 0;
    } catch {
      return 0;
    }
  }

  private async detectSpam(content: string): Promise<number> {
    let score = 0;
    
    // URL count
    const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    score += Math.min(urlCount * 0.2, 0.4);

    // Repeated characters
    if (/(.)\1{3,}/.test(content)) score += 0.2;

    // Excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.5) score += 0.3;

    // Common spam phrases
    const spamPhrases = ['click here', 'free money', 'guaranteed', 'act now', 'limited time'];
    const spamMatches = spamPhrases.filter(phrase => 
      content.toLowerCase().includes(phrase)
    ).length;
    score += spamMatches * 0.15;

    return Math.min(score, 1);
  }
}

// Policy Engine Class
class PolicyEngine {
  evaluateViolations(violations: PolicyViolation[]): {
    action: 'approve' | 'reject' | 'review';
    confidence: number;
    requiresHumanReview: boolean;
  } {
    if (violations.length === 0) {
      return { action: 'approve', confidence: 1.0, requiresHumanReview: false };
    }

    const maxSeverity = Math.max(...violations.map(v => v.severity));
    const avgConfidence = violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length;

    // Auto-reject for high severity violations with high confidence
    if (maxSeverity >= 3 && avgConfidence >= 0.9) {
      return { action: 'reject', confidence: avgConfidence, requiresHumanReview: false };
    }

    // Auto-approve for low severity violations with high confidence
    if (maxSeverity <= 1 && avgConfidence >= 0.8) {
      return { action: 'approve', confidence: avgConfidence, requiresHumanReview: false };
    }

    // Everything else goes to human review
    return { action: 'review', confidence: avgConfidence, requiresHumanReview: true };
  }
}

// Human Review Queue Manager
class HumanReviewQueue {
  async addToQueue(contentId: string, violations: PolicyViolation[], priority: string = 'medium'): Promise<void> {
    const estimatedTime = this.calculateEstimatedReviewTime(priority as any);

    await supabase
      .from('moderation_queue')
      .insert({
        content_id: contentId,
        violations: violations,
        priority,
        status: 'pending',
        created_at: new Date().toISOString(),
        estimated_review_time: estimatedTime,
      });

    // Notify reviewers via Supabase Realtime
    await supabase
      .from('reviewer_notifications')
      .insert({
        message: `New ${priority} priority content requires review`,
        content_id: contentId,
        created_at: new Date().toISOString(),
      });
  }

  private calculateEstimatedReviewTime(priority: 'low' | 'medium' | 'high' | 'urgent'): number {
    const queueTimes = { urgent: 15, high: 60, medium: 240, low: 1440 }; // minutes
    return queueTimes[priority];
  }
}

// Main API Handler
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResult = await rateLimit(identifier, 100, 3600); // 100 requests per hour
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // API key validation
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    const { valid, userId } = await validateApiKey(apiKey);
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json() as ModerationRequest;
    
    if (!body.content || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: content, type' },
        { status: 400 }
      );
    }

    // Sanitize input
    const sanitizedContent = sanitizeInput(body.content);
    if (sanitizedContent.length === 0) {
      return NextResponse.json(
        { error: 'Content is empty after sanitization' },
        { status: 400 }
      );
    }

    if (sanitizedContent.length > 50000) {
      return NextResponse.json(
        { error: 'Content too large (max 50KB)' },
        { status: 413 }
      );
    }

    // Generate unique ID for this moderation request
    const moderationId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store initial request
    await supabase
      .from('moderation_requests')
      .insert({
        id: moderationId,
        user_id: userId,
        content: sanitizedContent,
        content_type: body.type,
        metadata: body.metadata || {},
        status: 'processing',
        created_at: new Date().toISOString(),
      });

    // Initialize analyzers
    const contentAnalyzer = new ContentAnalyzer();
    const policyEngine = new PolicyEngine();
    const reviewQueue = new HumanReviewQueue();

    let violations: PolicyViolation[] = [];

    // Analyze based on content type
    switch (body.type) {
      case 'text':
        violations = await contentAnalyzer.analyzeText(sanitizedContent);
        break;
      case 'image':
      case 'audio':
      case 'video':
        // For now, return pending review for media content
        violations = [{
          category: 'adult_content',
          severity: 1,
          confidence: 0.5,
          details: 'Media content requires manual review',
        }];
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported content type' },
          { status: 400 }
        );
    }

    // Evaluate policy violations
    const policyDecision = policyEngine.evaluateViolations(violations);

    let status: ModerationResult['status'];
    let actionRequired = false;
    let reviewRequired = false;
    let estimatedReviewTime: number | undefined;

    switch (policyDecision.action) {
      case 'approve':
        status = 'approved';
        break;
      case 'reject':
        status = 'rejected';
        actionRequired = true;
        break;
      case 'review':
        status = 'pending_review';
        reviewRequired = true;
        await reviewQueue.addToQueue(
          moderationId,
          violations,
          body.metadata?.priority || 'medium'
        );
        estimatedReviewTime = reviewQueue['calculateEstimatedReviewTime'](
          body.metadata?.priority as any || 'medium'
        );
        break;
    }

    // Update request with results
    await supabase
      .from('moderation_requests')
      .update({
        status,
        violations,
        confidence: policyDecision.confidence,
        action_required: actionRequired,
        review_required: reviewRequired,
        estimated_review_time: estimatedReviewTime,
        processed_at: new Date().toISOString(),
      })
      .eq('id', moderationId);

    // Create audit log
    await supabase
      .from('moderation_audit_log')
      .insert({
        moderation_id: moderationId,
        user_id: userId,
        action: `moderation_${status}`,
        details: {
          violations_count: violations.length,
          confidence: policyDecision.confidence,
          automated: !reviewRequired,
        },
        created_at: new Date().toISOString(),
      });

    const result: ModerationResult = {
      id: moderationId,
      status,
      confidence: policyDecision.confidence,
      violations: violations.map(v => ({
        category: v.category,
        severity: v.severity,
        description: v.details,
      })),
      actionRequired,
      reviewRequired,
      estimatedReviewTime,
    };

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Moderation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? String(error) : 'Moderation service temporarily unavailable'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // API key validation
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    const { valid, userId } = await validateApiKey(apiKey);
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const moderationId = searchParams.get('id');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('moderation_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (moderationId) {
      query = query.eq('id', moderationId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data,
      pagination: {
        limit,
        offset,
        hasMore: data?.length === limit,
      },
    });

  } catch (error) {
    console.error('Moderation GET error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch moderation requests' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // API key validation (admin only for appeals)
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    const { valid, userId, role } = await validateApiKey(apiKey);
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { moderationId, action, reason } = body;

    if (!moderationId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: moderationId, action' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['approve', 'reject', 'appeal'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Check if user can perform this action
    const { data: request_data } = await supabase
      .from('moderation_requests')
      .select('user_id, status')
      .eq('id', moderationId)
      .single();

    if (!request_data) {
      return NextResponse.json(
        { error: 'Moderation request not found' },
        { status: 404 }
      );
    }

    // Users can only appeal their own requests
    if (action === 'appeal' && request_data.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Only reviewers/admins can approve/reject
    if (['approve', 'reject'].includes(action) && role !== 'admin' && role !== 'reviewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    let newStatus;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'appeal':
        newStatus = 'pending_review';
        break;
    }

    // Update moderation request
    await supabase
      .from('moderation_requests')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        reviewer_notes: reason,
      })
      .eq('id', moderationId);

    // Log the action
    await supabase
      .from('moderation_audit_log')
      .insert({
        moderation_id: moderationId,
        user_id: userId,
        action: `manual_${action}`,
        details: { reason },
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      moderationId,
      newStatus,
      action,
    });

  } catch (error) {
    console.error('Moderation PATCH error:', error);
    
    return NextResponse.json(
      { error: 'Failed to update moderation request' },
      { status: 500 }
    );
  }
}
```