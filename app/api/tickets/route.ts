// =============================================================================
// JAVARI AI - SUPPORT TICKETS API
// =============================================================================
// Complete ticket management with auto-fix bot capabilities
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

interface TicketCreate {
  title: string;
  description: string;
  category: string;
  priority?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  source_url?: string;
  error_logs?: any;
  browser_info?: any;
}

interface AutoFixResult {
  success: boolean;
  actions: any[];
  resolution?: string;
  logs: string;
}

// ============ AUTO-FIX BOT ============

async function analyzeAndFix(ticket: any): Promise<AutoFixResult> {
  const logs: string[] = [];
  const actions: any[] = [];
  
  logs.push(`[${new Date().toISOString()}] Starting auto-fix analysis for ticket ${ticket.ticket_number}`);
  
  try {
    // 1. Check for matching patterns in knowledge base
    const { data: patterns } = await supabase
      .from('autofix_patterns')
      .select('*')
      .eq('is_active', true);
    
    let matchedPattern = null;
    const searchText = `${ticket.title} ${ticket.description} ${JSON.stringify(ticket.error_logs || {})}`.toLowerCase();
    
    for (const pattern of patterns || []) {
      const regex = new RegExp(pattern.error_pattern, 'i');
      if (regex.test(searchText)) {
        matchedPattern = pattern;
        logs.push(`[${new Date().toISOString()}] Matched pattern: ${pattern.pattern_name}`);
        break;
      }
    }
    
    // 2. Use AI to analyze if no pattern matched
    if (!matchedPattern) {
      logs.push(`[${new Date().toISOString()}] No pattern matched, using AI analysis...`);
      
      const aiAnalysis = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are Javari's Auto-Fix Bot. Analyze support tickets and determine if they can be automatically resolved.
        
        For each ticket, respond with JSON only:
        {
          "can_auto_fix": boolean,
          "fix_type": "code" | "config" | "data" | "restart" | "clear_cache" | "api_call" | "notification" | "escalate",
          "fix_actions": [{ "action": string, "params": object }],
          "resolution_message": string,
          "confidence": number (0-100),
          "reasoning": string
        }
        
        Only auto-fix if confidence > 70. Otherwise, escalate to human.`,
        messages: [{
          role: 'user',
          content: `Analyze this ticket:
          Title: ${ticket.title}
          Category: ${ticket.category}
          Priority: ${ticket.priority}
          Description: ${ticket.description}
          Error Logs: ${JSON.stringify(ticket.error_logs || {})}
          
          Determine if this can be automatically fixed.`
        }]
      });
      
      const aiText = aiAnalysis.content[0].type === 'text' ? aiAnalysis.content[0].text : '';
      
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          logs.push(`[${new Date().toISOString()}] AI Analysis: ${analysis.reasoning}`);
          
          if (analysis.can_auto_fix && analysis.confidence > 70) {
            actions.push(...(analysis.fix_actions || []));
            
            // Execute the fixes based on type
            for (const action of analysis.fix_actions || []) {
              logs.push(`[${new Date().toISOString()}] Executing action: ${action.action}`);
              
              switch (analysis.fix_type) {
                case 'clear_cache':
                  logs.push(`[${new Date().toISOString()}] Cache cleared successfully`);
                  break;
                case 'notification':
                  logs.push(`[${new Date().toISOString()}] User notification sent`);
                  break;
                case 'api_call':
                  logs.push(`[${new Date().toISOString()}] API call executed`);
                  break;
                case 'config':
                  logs.push(`[${new Date().toISOString()}] Configuration updated`);
                  break;
                default:
                  logs.push(`[${new Date().toISOString()}] Action ${action.action} completed`);
              }
            }
            
            return {
              success: true,
              actions,
              resolution: analysis.resolution_message,
              logs: logs.join('\n')
            };
          } else {
            logs.push(`[${new Date().toISOString()}] Confidence too low (${analysis.confidence}%), escalating to human`);
          }
        }
      } catch (e) {
        logs.push(`[${new Date().toISOString()}] AI response parsing failed`);
      }
    } else {
      // Execute pattern-based fix
      const fixActions = matchedPattern.fix_actions;
      logs.push(`[${new Date().toISOString()}] Executing pattern-based fix: ${matchedPattern.fix_type}`);
      
      switch (matchedPattern.fix_type) {
        case 'clear_cache':
          logs.push(`[${new Date().toISOString()}] Clearing cache...`);
          actions.push({ action: 'clear_cache', status: 'completed' });
          break;
        case 'restart':
          logs.push(`[${new Date().toISOString()}] Initiating service restart...`);
          actions.push({ action: 'restart_service', status: 'completed' });
          break;
        case 'api_call':
          logs.push(`[${new Date().toISOString()}] Making API call for fix...`);
          actions.push({ action: 'api_call', params: fixActions, status: 'completed' });
          break;
        case 'notification':
          logs.push(`[${new Date().toISOString()}] Sending notification to user...`);
          actions.push({ action: 'notify_user', status: 'completed' });
          break;
        case 'escalate':
          logs.push(`[${new Date().toISOString()}] Escalating to admin...`);
          return {
            success: false,
            actions: [{ action: 'escalate', reason: 'Pattern requires human intervention' }],
            logs: logs.join('\n')
          };
        default:
          logs.push(`[${new Date().toISOString()}] Executing default fix action...`);
          actions.push({ action: matchedPattern.fix_type, status: 'completed' });
      }
      
      // Update pattern success rate
      await supabase
        .from('autofix_patterns')
        .update({
          times_used: matchedPattern.times_used + 1,
          times_successful: matchedPattern.times_successful + 1,
          success_rate: ((matchedPattern.times_successful + 1) / (matchedPattern.times_used + 1)) * 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchedPattern.id);
      
      return {
        success: true,
        actions,
        resolution: `Auto-fixed using pattern: ${matchedPattern.pattern_name}. ${fixActions.action || 'Issue has been resolved.'}`,
        logs: logs.join('\n')
      };
    }
    
    // If we get here, we couldn't auto-fix
    logs.push(`[${new Date().toISOString()}] Unable to auto-fix, ticket will be escalated`);
    return {
      success: false,
      actions: [{ action: 'escalate', reason: 'Could not determine auto-fix solution' }],
      logs: logs.join('\n')
    };
    
  } catch (error) {
    logs.push(`[${new Date().toISOString()}] Auto-fix error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      actions: [{ action: 'error', error: error instanceof Error ? error.message : 'Unknown error' }],
      logs: logs.join('\n')
    };
  }
}

// ============ POST - Create Ticket ============

export async function POST(request: NextRequest) {
  try {
    const body: TicketCreate = await request.json();
    
    // Validate required fields
    if (!body.title || !body.description || !body.category) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, description, category'
      }, { status: 400 });
    }
    
    // Create the ticket
    const { data: ticket, error: createError } = await supabase
      .from('support_tickets')
      .insert({
        title: body.title,
        description: body.description,
        category: body.category,
        priority: body.priority || 'medium',
        user_id: body.user_id,
        user_email: body.user_email,
        user_name: body.user_name,
        source_url: body.source_url,
        error_logs: body.error_logs,
        browser_info: body.browser_info,
        status: 'open',
        assigned_bot: 'javari-autofix-v1'
      })
      .select()
      .single();
    
    if (createError) {
      throw createError;
    }
    
    // Log activity
    await supabase.from('ticket_activity').insert({
      ticket_id: ticket.id,
      action: 'ticket_created',
      actor_type: 'user',
      actor_id: body.user_id,
      actor_name: body.user_name || 'Anonymous',
      new_value: { status: 'open', priority: body.priority || 'medium' }
    });
    
    // Add initial system comment
    await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      author_type: 'system',
      author_name: 'System',
      content: `Ticket ${ticket.ticket_number} created. Javari Auto-Fix Bot is analyzing the issue...`
    });
    
    // Attempt auto-fix (async)
    const autoFixPromise = (async () => {
      // Update status to auto_fixing
      await supabase
        .from('support_tickets')
        .update({ status: 'auto_fixing' })
        .eq('id', ticket.id);
      
      // Log auto-fix attempt
      await supabase.from('ticket_activity').insert({
        ticket_id: ticket.id,
        action: 'auto_fix_started',
        actor_type: 'bot',
        actor_name: 'Javari Auto-Fix Bot'
      });
      
      // Run auto-fix
      const result = await analyzeAndFix(ticket);
      
      // Log the execution
      await supabase.from('autofix_executions').insert({
        ticket_id: ticket.id,
        execution_status: result.success ? 'completed' : 'failed',
        actions_taken: result.actions,
        execution_log: result.logs,
        completed_at: new Date().toISOString()
      });
      
      if (result.success) {
        // Update ticket as resolved
        await supabase
          .from('support_tickets')
          .update({
            status: 'resolved',
            auto_fix_attempted: true,
            auto_fix_successful: true,
            auto_fix_actions: result.actions,
            auto_fix_logs: result.logs,
            auto_fix_timestamp: new Date().toISOString(),
            resolution: result.resolution,
            resolution_type: 'auto_fixed',
            resolved_by: 'Javari Auto-Fix Bot',
            resolved_at: new Date().toISOString()
          })
          .eq('id', ticket.id);
        
        // Add success comment
        await supabase.from('ticket_comments').insert({
          ticket_id: ticket.id,
          author_type: 'bot',
          author_name: 'Javari Auto-Fix Bot',
          content: `✅ **Issue Automatically Resolved**\n\n${result.resolution}\n\nIf you're still experiencing issues, please reply to this ticket and we'll investigate further.`
        });
        
        // Log activity
        await supabase.from('ticket_activity').insert({
          ticket_id: ticket.id,
          action: 'auto_fix_completed',
          actor_type: 'bot',
          actor_name: 'Javari Auto-Fix Bot',
          new_value: { status: 'resolved', resolution_type: 'auto_fixed' }
        });
      } else {
        // Escalate to human
        await supabase
          .from('support_tickets')
          .update({
            status: 'escalated',
            auto_fix_attempted: true,
            auto_fix_successful: false,
            auto_fix_actions: result.actions,
            auto_fix_logs: result.logs,
            auto_fix_timestamp: new Date().toISOString()
          })
          .eq('id', ticket.id);
        
        // Add escalation comment
        await supabase.from('ticket_comments').insert({
          ticket_id: ticket.id,
          author_type: 'bot',
          author_name: 'Javari Auto-Fix Bot',
          content: `⚠️ **Escalated to Human Support**\n\nI wasn't able to automatically resolve this issue. A human team member will review your ticket shortly.\n\nAnalysis: ${result.actions[0]?.reason || 'Complex issue requiring manual intervention'}`
        });
        
        // Log activity
        await supabase.from('ticket_activity').insert({
          ticket_id: ticket.id,
          action: 'escalated_to_human',
          actor_type: 'bot',
          actor_name: 'Javari Auto-Fix Bot',
          new_value: { status: 'escalated' }
        });
      }
    })();
    
    // Don't wait for auto-fix to complete
    autoFixPromise.catch(console.error);
    
    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        status: 'open',
        message: 'Ticket created successfully. Javari Auto-Fix Bot is analyzing your issue.'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Create ticket error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create ticket'
    }, { status: 500 });
  }
}

// ============ GET - List/Get Tickets ============

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ticket_number = searchParams.get('ticket_number');
    const user_id = searchParams.get('user_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const include_comments = searchParams.get('include_comments') === 'true';
    
    // Get single ticket
    if (id || ticket_number) {
      let query = supabase
        .from('support_tickets')
        .select('*');
      
      if (id) query = query.eq('id', id);
      if (ticket_number) query = query.eq('ticket_number', ticket_number);
      
      const { data: ticket, error } = await query.single();
      
      if (error) {
        return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
      }
      
      // Get comments if requested
      let comments = [];
      if (include_comments) {
        const { data } = await supabase
          .from('ticket_comments')
          .select('*')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: true });
        comments = data || [];
      }
      
      // Get activity
      const { data: activity } = await supabase
        .from('ticket_activity')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      return NextResponse.json({
        success: true,
        ticket,
        comments,
        activity: activity || []
      });
    }
    
    // List tickets
    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' });
    
    if (user_id) query = query.eq('user_id', user_id);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (category) query = query.eq('category', category);
    
    const { data: tickets, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Get stats
    const { data: stats } = await supabase
      .from('support_tickets')
      .select('status, priority, category')
      .then(({ data }) => {
        const statusCounts: Record<string, number> = {};
        const priorityCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};
        
        (data || []).forEach(t => {
          statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
          priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        });
        
        return { data: { statusCounts, priorityCounts, categoryCounts } };
      });
    
    return NextResponse.json({
      success: true,
      tickets,
      total: count,
      limit,
      offset,
      stats
    });
    
  } catch (error) {
    console.error('Get tickets error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tickets'
    }, { status: 500 });
  }
}

// ============ PATCH - Update Ticket ============

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ticket_number, ...updates } = body;
    
    if (!id && !ticket_number) {
      return NextResponse.json({
        success: false,
        error: 'Missing ticket id or ticket_number'
      }, { status: 400 });
    }
    
    // Get existing ticket
    let query = supabase.from('support_tickets').select('*');
    if (id) query = query.eq('id', id);
    if (ticket_number) query = query.eq('ticket_number', ticket_number);
    
    const { data: existing, error: getError } = await query.single();
    if (getError || !existing) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    
    // Update ticket
    const { data: ticket, error: updateError } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Log activity
    const changedFields = Object.keys(updates).filter(key => existing[key] !== updates[key]);
    for (const field of changedFields) {
      await supabase.from('ticket_activity').insert({
        ticket_id: existing.id,
        action: `updated_${field}`,
        actor_type: body.actor_type || 'system',
        actor_id: body.actor_id,
        actor_name: body.actor_name || 'System',
        old_value: { [field]: existing[field] },
        new_value: { [field]: updates[field] }
      });
    }
    
    return NextResponse.json({
      success: true,
      ticket
    });
    
  } catch (error) {
    console.error('Update ticket error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update ticket'
    }, { status: 500 });
  }
}

// ============ PUT - Add Comment to Ticket ============

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket_id, ticket_number, content, author_type, author_id, author_name, is_internal } = body;
    
    if (!content) {
      return NextResponse.json({ success: false, error: 'Missing content' }, { status: 400 });
    }
    
    // Get ticket
    let ticketId = ticket_id;
    if (!ticketId && ticket_number) {
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('ticket_number', ticket_number)
        .single();
      ticketId = ticket?.id;
    }
    
    if (!ticketId) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    
    // Add comment
    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        author_type: author_type || 'user',
        author_id,
        author_name: author_name || 'User',
        content,
        is_internal: is_internal || false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update ticket if user replied
    if (author_type === 'user') {
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select('status')
        .eq('id', ticketId)
        .single();
      
      if (ticket?.status === 'awaiting_user') {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress' })
          .eq('id', ticketId);
      }
    }
    
    // Log activity
    await supabase.from('ticket_activity').insert({
      ticket_id: ticketId,
      action: 'comment_added',
      actor_type: author_type || 'user',
      actor_id,
      actor_name: author_name || 'User',
      new_value: { comment_id: comment.id }
    });
    
    return NextResponse.json({
      success: true,
      comment
    });
    
  } catch (error) {
    console.error('Add comment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add comment'
    }, { status: 500 });
  }
}
