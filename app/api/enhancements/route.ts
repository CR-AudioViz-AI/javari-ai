// =============================================================================
// JAVARI AI - ENHANCEMENT REQUESTS API
// =============================================================================
// Complete enhancement management with AI analysis & implementation planning
// Production Ready - Sunday, December 14, 2025
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============ TYPES ============

interface EnhancementCreate {
  title: string;
  description: string;
  use_case?: string;
  expected_benefit?: string;
  category: string;
  priority?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

interface AIAnalysis {
  implementation_plan: string;
  estimated_effort: string;
  complexity: string;
  potential_impacts: {
    positive: string[];
    negative: string[];
    risks: string[];
  };
  dependencies: string[];
  recommendations: string;
  feasibility_score: number;
  priority_recommendation: string;
}

// ============ AI ANALYSIS ENGINE ============

async function analyzeEnhancement(enhancement: any): Promise<AIAnalysis> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are Javari, an AI assistant specialized in analyzing software enhancement requests for the CR AudioViz AI platform. 

The platform includes:
- Javari AI (main AI assistant with chat, tools, autonomous features)
- 60+ creative tools (logo studio, ebook creator, music builder, etc.)
- 1,200+ games
- Admin dashboards and analytics
- Stripe/PayPal payment integration
- Supabase database backend
- Vercel deployment infrastructure

Analyze enhancement requests thoroughly and provide actionable implementation plans.

Respond with JSON only in this exact format:
{
  "implementation_plan": "Detailed step-by-step plan with specific technical details",
  "estimated_effort": "X hours/days/weeks with breakdown",
  "complexity": "trivial|simple|moderate|complex|very_complex",
  "potential_impacts": {
    "positive": ["List of benefits"],
    "negative": ["List of potential downsides"],
    "risks": ["List of risks and how to mitigate"]
  },
  "dependencies": ["List of required dependencies, APIs, or prerequisites"],
  "recommendations": "Your professional recommendation including alternatives",
  "feasibility_score": 0-100,
  "priority_recommendation": "critical|high|medium|low with reasoning"
}`,
      messages: [{
        role: 'user',
        content: `Analyze this enhancement request:

Title: ${enhancement.title}
Category: ${enhancement.category}
Current Priority: ${enhancement.priority}

Description:
${enhancement.description}

Use Case:
${enhancement.use_case || 'Not specified'}

Expected Benefit:
${enhancement.expected_benefit || 'Not specified'}

Provide a comprehensive analysis with implementation plan.`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        implementation_plan: analysis.implementation_plan || 'Analysis pending',
        estimated_effort: analysis.estimated_effort || 'To be determined',
        complexity: analysis.complexity || 'moderate',
        potential_impacts: analysis.potential_impacts || { positive: [], negative: [], risks: [] },
        dependencies: analysis.dependencies || [],
        recommendations: analysis.recommendations || 'Further analysis required',
        feasibility_score: analysis.feasibility_score || 50,
        priority_recommendation: analysis.priority_recommendation || 'medium'
      };
    }
    
    throw new Error('Could not parse AI response');
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      implementation_plan: 'AI analysis could not be completed. Manual review required.',
      estimated_effort: 'To be determined by technical team',
      complexity: 'moderate',
      potential_impacts: {
        positive: ['Potential improvements pending analysis'],
        negative: ['Unknown until further review'],
        risks: ['Requires manual assessment']
      },
      dependencies: ['Manual review required'],
      recommendations: 'This enhancement request requires manual review by the technical team.',
      feasibility_score: 50,
      priority_recommendation: 'medium'
    };
  }
}

// ============ POST - Create Enhancement ============

export async function POST(request: NextRequest) {
  try {
    const body: EnhancementCreate = await request.json();
    
    // Validate required fields
    if (!body.title || !body.description || !body.category) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, description, category'
      }, { status: 400 });
    }
    
    // Create the enhancement request
    const { data: enhancement, error: createError } = await supabase
      .from('enhancement_requests')
      .insert({
        title: body.title,
        description: body.description,
        use_case: body.use_case,
        expected_benefit: body.expected_benefit,
        category: body.category,
        priority: body.priority || 'medium',
        user_id: body.user_id,
        user_email: body.user_email,
        user_name: body.user_name,
        status: 'submitted'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    
    // Log activity
    await supabase.from('enhancement_activity').insert({
      enhancement_id: enhancement.id,
      action: 'enhancement_submitted',
      actor_type: 'user',
      actor_id: body.user_id,
      actor_name: body.user_name || 'Anonymous',
      new_value: { status: 'submitted' }
    });
    
    // Add initial system comment
    await supabase.from('enhancement_comments').insert({
      enhancement_id: enhancement.id,
      author_type: 'system',
      author_name: 'System',
      content: `Enhancement request ${enhancement.request_number} submitted. Javari is analyzing your request and will provide an implementation writeup shortly.`
    });
    
    // Start AI analysis (async)
    const analysisPromise = (async () => {
      // Update status
      await supabase
        .from('enhancement_requests')
        .update({ status: 'under_review' })
        .eq('id', enhancement.id);
      
      // Log analysis start
      await supabase.from('enhancement_activity').insert({
        enhancement_id: enhancement.id,
        action: 'ai_analysis_started',
        actor_type: 'bot',
        actor_name: 'Javari AI'
      });
      
      // Run AI analysis
      const analysis = await analyzeEnhancement(enhancement);
      
      // Update enhancement with analysis
      await supabase
        .from('enhancement_requests')
        .update({
          status: 'analysis_complete',
          ai_analysis: analysis.potential_impacts,
          ai_implementation_plan: analysis.implementation_plan,
          ai_estimated_effort: analysis.estimated_effort,
          ai_estimated_complexity: analysis.complexity,
          ai_potential_impacts: analysis.potential_impacts,
          ai_dependencies: analysis.dependencies,
          ai_risks: analysis.potential_impacts.risks,
          ai_recommendations: analysis.recommendations,
          ai_analysis_timestamp: new Date().toISOString(),
          approval_status: 'pending'
        })
        .eq('id', enhancement.id);
      
      // Add analysis comment
      const analysisComment = `## 🤖 Javari AI Analysis Complete

### Implementation Plan
${analysis.implementation_plan}

### Estimated Effort
**${analysis.estimated_effort}**

### Complexity Assessment
**${analysis.complexity.toUpperCase()}** (Feasibility Score: ${analysis.feasibility_score}/100)

### Potential Impacts

**✅ Positive:**
${analysis.potential_impacts.positive.map(p => `- ${p}`).join('\n')}

**⚠️ Considerations:**
${analysis.potential_impacts.negative.map(n => `- ${n}`).join('\n')}

**🔴 Risks:**
${analysis.potential_impacts.risks.map(r => `- ${r}`).join('\n')}

### Dependencies
${analysis.dependencies.map(d => `- ${d}`).join('\n')}

### Recommendation
${analysis.recommendations}

### Priority Recommendation
**${analysis.priority_recommendation.toUpperCase()}**

---
*This analysis is awaiting admin approval before implementation begins.*`;

      await supabase.from('enhancement_comments').insert({
        enhancement_id: enhancement.id,
        author_type: 'bot',
        author_name: 'Javari AI',
        content: analysisComment
      });
      
      // Log analysis complete
      await supabase.from('enhancement_activity').insert({
        enhancement_id: enhancement.id,
        action: 'ai_analysis_completed',
        actor_type: 'bot',
        actor_name: 'Javari AI',
        new_value: { 
          complexity: analysis.complexity,
          feasibility_score: analysis.feasibility_score,
          priority_recommendation: analysis.priority_recommendation
        }
      });
    })();
    
    // Don't wait for analysis to complete
    analysisPromise.catch(console.error);
    
    return NextResponse.json({
      success: true,
      enhancement: {
        id: enhancement.id,
        request_number: enhancement.request_number,
        status: 'submitted',
        message: 'Enhancement request submitted. Javari AI is analyzing your request and will provide a detailed implementation writeup.'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Create enhancement error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create enhancement'
    }, { status: 500 });
  }
}

// ============ GET - List/Get Enhancements ============

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const request_number = searchParams.get('request_number');
    const user_id = searchParams.get('user_id');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const approval_status = searchParams.get('approval_status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort_by = searchParams.get('sort_by') || 'created_at';
    const include_comments = searchParams.get('include_comments') === 'true';
    
    // Get single enhancement
    if (id || request_number) {
      let query = supabase
        .from('enhancement_requests')
        .select('*');
      
      if (id) query = query.eq('id', id);
      if (request_number) query = query.eq('request_number', request_number);
      
      const { data: enhancement, error } = await query.single();
      
      if (error) {
        return NextResponse.json({ success: false, error: 'Enhancement not found' }, { status: 404 });
      }
      
      // Increment view count
      await supabase
        .from('enhancement_requests')
        .update({ view_count: (enhancement.view_count || 0) + 1 })
        .eq('id', enhancement.id);
      
      // Get comments if requested
      let comments = [];
      if (include_comments) {
        const { data } = await supabase
          .from('enhancement_comments')
          .select('*')
          .eq('enhancement_id', enhancement.id)
          .order('created_at', { ascending: true });
        comments = data || [];
      }
      
      // Get activity
      const { data: activity } = await supabase
        .from('enhancement_activity')
        .select('*')
        .eq('enhancement_id', enhancement.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      // Get vote count by current user if user_id provided
      let userVote = null;
      if (user_id) {
        const { data: vote } = await supabase
          .from('enhancement_votes')
          .select('vote_type')
          .eq('enhancement_id', enhancement.id)
          .eq('user_id', user_id)
          .single();
        userVote = vote?.vote_type;
      }
      
      return NextResponse.json({
        success: true,
        enhancement: {
          ...enhancement,
          view_count: (enhancement.view_count || 0) + 1
        },
        comments,
        activity: activity || [],
        user_vote: userVote
      });
    }
    
    // List enhancements
    let query = supabase
      .from('enhancement_requests')
      .select('*', { count: 'exact' });
    
    if (user_id) query = query.eq('user_id', user_id);
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (approval_status) query = query.eq('approval_status', approval_status);
    
    // Sort options
    if (sort_by === 'upvotes') {
      query = query.order('upvotes', { ascending: false });
    } else if (sort_by === 'views') {
      query = query.order('view_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    
    const { data: enhancements, error, count } = await query
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Get stats
    const { data: allEnhancements } = await supabase
      .from('enhancement_requests')
      .select('status, category, approval_status, upvotes');
    
    const stats = {
      total: allEnhancements?.length || 0,
      byStatus: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byApproval: {} as Record<string, number>,
      totalUpvotes: 0
    };
    
    (allEnhancements || []).forEach(e => {
      stats.byStatus[e.status] = (stats.byStatus[e.status] || 0) + 1;
      stats.byCategory[e.category] = (stats.byCategory[e.category] || 0) + 1;
      if (e.approval_status) {
        stats.byApproval[e.approval_status] = (stats.byApproval[e.approval_status] || 0) + 1;
      }
      stats.totalUpvotes += e.upvotes || 0;
    });
    
    return NextResponse.json({
      success: true,
      enhancements,
      total: count,
      limit,
      offset,
      stats
    });
    
  } catch (error) {
    console.error('Get enhancements error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get enhancements'
    }, { status: 500 });
  }
}

// ============ PATCH - Update Enhancement (Admin) ============

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, request_number, action, ...updates } = body;
    
    if (!id && !request_number) {
      return NextResponse.json({
        success: false,
        error: 'Missing enhancement id or request_number'
      }, { status: 400 });
    }
    
    // Get existing enhancement
    let query = supabase.from('enhancement_requests').select('*');
    if (id) query = query.eq('id', id);
    if (request_number) query = query.eq('request_number', request_number);
    
    const { data: existing, error: getError } = await query.single();
    if (getError || !existing) {
      return NextResponse.json({ success: false, error: 'Enhancement not found' }, { status: 404 });
    }
    
    // Handle special actions
    if (action === 'approve') {
      updates.approval_status = 'approved';
      updates.approved_by = body.approved_by || 'Admin';
      updates.approved_at = new Date().toISOString();
      updates.status = 'approved';
      
      // Add approval comment
      await supabase.from('enhancement_comments').insert({
        enhancement_id: existing.id,
        author_type: 'admin',
        author_name: body.approved_by || 'Admin',
        content: `✅ **Enhancement Approved**\n\n${body.review_notes || 'This enhancement has been approved for implementation.'}\n\nEstimated delivery: ${body.estimated_delivery || 'TBD'}`
      });
    } else if (action === 'reject') {
      updates.approval_status = 'rejected';
      updates.rejection_reason = body.rejection_reason;
      updates.reviewed_by = body.reviewed_by || 'Admin';
      updates.reviewed_at = new Date().toISOString();
      updates.status = 'rejected';
      
      // Add rejection comment
      await supabase.from('enhancement_comments').insert({
        enhancement_id: existing.id,
        author_type: 'admin',
        author_name: body.reviewed_by || 'Admin',
        content: `❌ **Enhancement Not Approved**\n\n${body.rejection_reason || 'This enhancement has been declined at this time.'}`
      });
    } else if (action === 'request_info') {
      updates.approval_status = 'needs_more_info';
      updates.status = 'under_review';
      
      // Add request for info comment
      await supabase.from('enhancement_comments').insert({
        enhancement_id: existing.id,
        author_type: 'admin',
        author_name: body.reviewed_by || 'Admin',
        content: `❓ **More Information Needed**\n\n${body.review_notes || 'Please provide additional details about this enhancement request.'}`
      });
    }
    
    // Update enhancement
    const { data: enhancement, error: updateError } = await supabase
      .from('enhancement_requests')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Log activity
    await supabase.from('enhancement_activity').insert({
      enhancement_id: existing.id,
      action: action || 'updated',
      actor_type: body.actor_type || 'admin',
      actor_id: body.actor_id,
      actor_name: body.actor_name || body.approved_by || body.reviewed_by || 'Admin',
      old_value: { status: existing.status, approval_status: existing.approval_status },
      new_value: { status: updates.status, approval_status: updates.approval_status }
    });
    
    return NextResponse.json({
      success: true,
      enhancement
    });
    
  } catch (error) {
    console.error('Update enhancement error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update enhancement'
    }, { status: 500 });
  }
}

// ============ PUT - Vote or Comment ============

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { enhancement_id, request_number, action } = body;
    
    // Get enhancement ID
    let enhancementId = enhancement_id;
    if (!enhancementId && request_number) {
      const { data: enhancement } = await supabase
        .from('enhancement_requests')
        .select('id')
        .eq('request_number', request_number)
        .single();
      enhancementId = enhancement?.id;
    }
    
    if (!enhancementId) {
      return NextResponse.json({ success: false, error: 'Enhancement not found' }, { status: 404 });
    }
    
    // Handle vote
    if (action === 'vote') {
      const { user_id, vote_type } = body;
      
      if (!user_id) {
        return NextResponse.json({ success: false, error: 'User ID required for voting' }, { status: 400 });
      }
      
      // Check for existing vote
      const { data: existingVote } = await supabase
        .from('enhancement_votes')
        .select('*')
        .eq('enhancement_id', enhancementId)
        .eq('user_id', user_id)
        .single();
      
      if (existingVote) {
        if (existingVote.vote_type === vote_type) {
          // Remove vote (toggle off)
          await supabase
            .from('enhancement_votes')
            .delete()
            .eq('id', existingVote.id);
          
          // Update counts
          const increment = vote_type === 'up' ? -1 : 0;
          const decrement = vote_type === 'down' ? -1 : 0;
          
          await supabase.rpc('increment_enhancement_votes', {
            p_enhancement_id: enhancementId,
            p_upvote_change: increment,
            p_downvote_change: decrement
          }).catch(() => {
            // Manual update if function doesn't exist
            supabase
              .from('enhancement_requests')
              .update({
                upvotes: supabase.rpc('greatest', { a: 0, b: `upvotes + ${increment}` }),
                downvotes: supabase.rpc('greatest', { a: 0, b: `downvotes + ${decrement}` })
              })
              .eq('id', enhancementId);
          });
          
          return NextResponse.json({ success: true, action: 'vote_removed' });
        } else {
          // Change vote
          await supabase
            .from('enhancement_votes')
            .update({ vote_type })
            .eq('id', existingVote.id);
          
          // Update both counts
          const { data: enhancement } = await supabase
            .from('enhancement_requests')
            .select('upvotes, downvotes')
            .eq('id', enhancementId)
            .single();
          
          if (vote_type === 'up') {
            await supabase
              .from('enhancement_requests')
              .update({
                upvotes: (enhancement?.upvotes || 0) + 1,
                downvotes: Math.max(0, (enhancement?.downvotes || 0) - 1)
              })
              .eq('id', enhancementId);
          } else {
            await supabase
              .from('enhancement_requests')
              .update({
                upvotes: Math.max(0, (enhancement?.upvotes || 0) - 1),
                downvotes: (enhancement?.downvotes || 0) + 1
              })
              .eq('id', enhancementId);
          }
          
          return NextResponse.json({ success: true, action: 'vote_changed', vote_type });
        }
      } else {
        // New vote
        await supabase.from('enhancement_votes').insert({
          enhancement_id: enhancementId,
          user_id,
          vote_type
        });
        
        // Update count
        const { data: enhancement } = await supabase
          .from('enhancement_requests')
          .select('upvotes, downvotes')
          .eq('id', enhancementId)
          .single();
        
        if (vote_type === 'up') {
          await supabase
            .from('enhancement_requests')
            .update({ upvotes: (enhancement?.upvotes || 0) + 1 })
            .eq('id', enhancementId);
        } else {
          await supabase
            .from('enhancement_requests')
            .update({ downvotes: (enhancement?.downvotes || 0) + 1 })
            .eq('id', enhancementId);
        }
        
        return NextResponse.json({ success: true, action: 'vote_added', vote_type });
      }
    }
    
    // Handle comment
    if (action === 'comment') {
      const { content, author_type, author_id, author_name, is_internal } = body;
      
      if (!content) {
        return NextResponse.json({ success: false, error: 'Comment content required' }, { status: 400 });
      }
      
      const { data: comment, error } = await supabase
        .from('enhancement_comments')
        .insert({
          enhancement_id: enhancementId,
          author_type: author_type || 'user',
          author_id,
          author_name: author_name || 'User',
          content,
          is_internal: is_internal || false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update comment count
      await supabase.rpc('increment_comment_count', { p_enhancement_id: enhancementId }).catch(() => {
        // Manual update if function doesn't exist
        supabase
          .from('enhancement_requests')
          .select('comment_count')
          .eq('id', enhancementId)
          .single()
          .then(({ data }) => {
            supabase
              .from('enhancement_requests')
              .update({ comment_count: (data?.comment_count || 0) + 1 })
              .eq('id', enhancementId);
          });
      });
      
      // Log activity
      await supabase.from('enhancement_activity').insert({
        enhancement_id: enhancementId,
        action: 'comment_added',
        actor_type: author_type || 'user',
        actor_id,
        actor_name: author_name || 'User'
      });
      
      return NextResponse.json({ success: true, comment });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('Enhancement action error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Action failed'
    }, { status: 500 });
  }
}
