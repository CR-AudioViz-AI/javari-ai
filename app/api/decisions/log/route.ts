// =============================================================================
// JAVARI DECISION JOURNAL API
// =============================================================================
// Phase 1 of JAVARI_TOP_AI_PATH - Decision tracking for learning
// Implements: POST /api/decisions/log + GET /api/decisions/log
// Created: January 8, 2026 - 11:15 AM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// INITIALIZATION
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

interface DecisionLogRequest {
  related_item_id?: string | null;
  decision: string;
  adopted: boolean;
  rationale: string;
  links?: string[];
  category?: string;
  impact_level?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
}

interface Decision {
  id: string;
  related_item_id: string | null;
  decision: string;
  adopted: boolean;
  rationale: string;
  links: string[];
  category: string | null;
  impact_level: string;
  context: Record<string, unknown>;
  created_at: string;
  outcome?: string | null;
  outcome_recorded_at?: string | null;
}

// =============================================================================
// POST /api/decisions/log - Log a decision
// =============================================================================

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  try {
    const body: DecisionLogRequest = await request.json();
    
    // ==========================================================================
    // VALIDATION
    // ==========================================================================
    
    if (!body.decision || body.decision.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Field "decision" is required and cannot be empty',
        timestamp
      }, { status: 400 });
    }
    
    if (!body.rationale || body.rationale.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Field "rationale" is required - explain why this decision was made',
        timestamp
      }, { status: 400 });
    }
    
    if (typeof body.adopted !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Field "adopted" must be a boolean (true/false)',
        timestamp
      }, { status: 400 });
    }
    
    // Validate impact level if provided
    const validImpactLevels = ['low', 'medium', 'high', 'critical'];
    const impactLevel = body.impact_level || 'medium';
    if (!validImpactLevels.includes(impactLevel)) {
      return NextResponse.json({
        success: false,
        error: `Invalid impact_level. Must be one of: ${validImpactLevels.join(', ')}`,
        timestamp
      }, { status: 400 });
    }
    
    // ==========================================================================
    // INSERT DECISION
    // ==========================================================================
    
    const { data: inserted, error: insertError } = await supabase
      .from('javari_decisions')
      .insert({
        related_item_id: body.related_item_id || null,
        decision: body.decision.trim(),
        adopted: body.adopted,
        rationale: body.rationale.trim(),
        links: body.links || [],
        category: body.category || null,
        impact_level: impactLevel,
        context: body.context || {},
        created_at: timestamp
      })
      .select('id')
      .single();
    
    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Database error: ${insertError.message}`,
        timestamp
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      id: inserted.id,
      message: 'Decision logged successfully',
      timestamp
    }, { status: 201 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: `Failed to log decision: ${errorMessage}`,
      timestamp
    }, { status: 500 });
  }
}

// =============================================================================
// GET /api/decisions/log - Retrieve decisions
// =============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const category = searchParams.get('category');
    const adopted = searchParams.get('adopted');
    const impactLevel = searchParams.get('impact_level');
    const relatedItemId = searchParams.get('related_item_id');
    
    // Build query
    let dbQuery = supabase
      .from('javari_decisions')
      .select('*');
    
    if (category) {
      dbQuery = dbQuery.eq('category', category);
    }
    
    if (adopted !== null && adopted !== undefined) {
      dbQuery = dbQuery.eq('adopted', adopted === 'true');
    }
    
    if (impactLevel) {
      dbQuery = dbQuery.eq('impact_level', impactLevel);
    }
    
    if (relatedItemId) {
      dbQuery = dbQuery.eq('related_item_id', relatedItemId);
    }
    
    const { data: decisions, error: queryError } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (queryError) {
      return NextResponse.json({
        success: false,
        error: `Query failed: ${queryError.message}`,
        timestamp
      }, { status: 500 });
    }
    
    // Calculate statistics
    const stats = {
      total: decisions?.length || 0,
      adopted: decisions?.filter(d => d.adopted).length || 0,
      rejected: decisions?.filter(d => !d.adopted).length || 0,
      by_impact: {
        critical: decisions?.filter(d => d.impact_level === 'critical').length || 0,
        high: decisions?.filter(d => d.impact_level === 'high').length || 0,
        medium: decisions?.filter(d => d.impact_level === 'medium').length || 0,
        low: decisions?.filter(d => d.impact_level === 'low').length || 0
      }
    };
    
    return NextResponse.json({
      success: true,
      count: decisions?.length || 0,
      stats,
      decisions: decisions || [],
      timestamp
    }, { status: 200 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: `Failed to retrieve decisions: ${errorMessage}`,
      timestamp
    }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/decisions/log - Record outcome of a decision
// =============================================================================

export async function PATCH(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'Field "id" is required to update a decision',
        timestamp
      }, { status: 400 });
    }
    
    if (!body.outcome || body.outcome.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Field "outcome" is required - describe what happened',
        timestamp
      }, { status: 400 });
    }
    
    const { data: updated, error: updateError } = await supabase
      .from('javari_decisions')
      .update({
        outcome: body.outcome.trim(),
        outcome_recorded_at: timestamp
      })
      .eq('id', body.id)
      .select('id')
      .single();
    
    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Update failed: ${updateError.message}`,
        timestamp
      }, { status: 500 });
    }
    
    if (!updated) {
      return NextResponse.json({
        success: false,
        error: `Decision with id "${body.id}" not found`,
        timestamp
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      id: updated.id,
      message: 'Decision outcome recorded',
      timestamp
    }, { status: 200 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: `Failed to update decision: ${errorMessage}`,
      timestamp
    }, { status: 500 });
  }
}
