/**
 * Javari AI Auto-Healing System
 * Monitors builds, detects errors, and automatically attempts fixes
 * 
 * @route /api/javari/auto-heal
 * @version 1.0.0
 * @last-updated 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

type IncidentType = 'build_failure' | 'runtime_error' | 'performance_degradation' | 'security_issue';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type Status = 'detected' | 'analyzing' | 'fixing' | 'resolved' | 'needs_human';

interface CreateIncidentRequest {
  incidentType: IncidentType;
  severity: Severity;
  description: string;
  projectId?: string;
  affectedComponent?: string;
  errorStack?: string;
  buildLogs?: string;
  detectedBy?: string;
  detectionMethod?: string;
}

interface AutoFixResult {
  success: boolean;
  fixDescription?: string;
  codeDiff?: string;
  reasoning?: string;
  confidence?: number;
  error?: string;
}

/**
 * Analyze error and generate fix using AI
 */
async function analyzeAndFix(
  errorStack: string,
  buildLogs?: string,
  affectedComponent?: string
): Promise<AutoFixResult> {
  try {
    const prompt = `You are an expert debugging AI. Analyze this error and provide a fix.

ERROR DETAILS:
${errorStack}

${buildLogs ? `BUILD LOGS:\n${buildLogs.slice(0, 5000)}` : ''}

${affectedComponent ? `AFFECTED COMPONENT:\n${affectedComponent}` : ''}

TASK:
1. Identify the root cause of the error
2. Provide a specific fix (code changes, configuration updates, etc.)
3. Rate your confidence in this fix (0-100)
4. Explain the reasoning

Respond in JSON format:
{
  "rootCause": "Brief explanation of the root cause",
  "fixDescription": "Clear description of what needs to be fixed",
  "suggestedCode": "The corrected code or configuration",
  "reasoning": "Why this fix should work",
  "confidence": 85,
  "preventionTips": "How to prevent this in the future"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert debugging AI that analyzes errors and provides fixes. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    const analysis = JSON.parse(content);

    return {
      success: true,
      fixDescription: analysis.fixDescription,
      codeDiff: analysis.suggestedCode,
      reasoning: analysis.reasoning,
      confidence: analysis.confidence,
    };
  } catch (error: unknown) {
    logError('Auto-fix analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    };
  }
}

/**
 * POST /api/javari/auto-heal
 * Create a new auto-healing incident
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateIncidentRequest = await request.json();
    const {
      incidentType,
      severity,
      description,
      projectId,
      affectedComponent,
      errorStack,
      buildLogs,
      detectedBy = 'automatic',
      detectionMethod = 'build_monitor',
    } = body;

    // Validate input
    if (!incidentType || !severity || !description) {
      return NextResponse.json(
        { error: 'incidentType, severity, and description are required' },
        { status: 400 }
      );
    }

    // Check if AI auto-fix should be attempted
    const shouldAutoFix = severity !== 'low' && errorStack;

    let fixResult: AutoFixResult | null = null;
    let status: Status = 'detected';

    // Attempt auto-fix if appropriate
    if (shouldAutoFix && errorStack) {
      status = 'analyzing';
      fixResult = await analyzeAndFix(errorStack, buildLogs, affectedComponent);

      if (fixResult.success && fixResult.confidence && fixResult.confidence >= 70) {
        status = 'fixing';
      } else {
        status = 'needs_human';
      }
    }

    // Create incident record
    const { data: incident, error: dbError } = await supabase
      .from('javari_auto_healing_incidents')
      .insert({
        incident_type: incidentType,
        severity: severity,
        description: description,
        detected_by: detectedBy,
        detection_method: detectionMethod,
        project_id: projectId || null,
        affected_component: affectedComponent,
        error_stack: errorStack,
        auto_fix_attempted: !!fixResult,
        auto_fix_successful: fixResult?.success,
        fix_description: fixResult?.fixDescription,
        fix_code_diff: fixResult?.codeDiff,
        status: status,
        detection_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create incident record' },
        { status: 500 }
      );
    }

    // Calculate time to resolve if already resolved
    let timeToResolve = null;
    if (status === 'resolved' || (fixResult?.success && fixResult.confidence && fixResult.confidence >= 90)) {
      timeToResolve = 0; // Immediate resolution
      
      // Update incident to resolved
      await supabase
        .from('javari_auto_healing_incidents')
        .update({
          status: 'resolved',
          resolution_time: new Date().toISOString(),
          time_to_resolve_minutes: 0,
        })
        .eq('id', incident.id);
    }

    return NextResponse.json({
      incident: {
        id: incident.id,
        status: status,
        severity: severity,
        autoFixAttempted: !!fixResult,
        autoFixSuccessful: fixResult?.success,
      },
      fix: fixResult || undefined,
      timeToResolve: timeToResolve,
    });
  } catch (error: unknown) {
    logError('Auto-heal error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create auto-healing incident',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/auto-heal
 * List auto-healing incidents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('javari_auto_healing_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: incidents, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total: incidents?.length || 0,
      resolved: incidents?.filter(i => i.status === 'resolved').length || 0,
      needsHuman: incidents?.filter(i => i.status === 'needs_human').length || 0,
      autoFixSuccessRate: incidents && incidents.length > 0
        ? (incidents.filter(i => i.auto_fix_successful).length / incidents.length * 100).toFixed(1)
        : '0',
    };

    return NextResponse.json({
      incidents: incidents || [],
      stats: stats,
    });
  } catch (error: unknown) {
    logError('Get incidents error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch incidents',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/javari/auto-heal/:id
 * Update incident status or mark as resolved
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('id');

    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, actionTaken } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;

      if (status === 'resolved') {
        updateData.resolution_time = new Date().toISOString();

        // Calculate time to resolve
        const { data: incident } = await supabase
          .from('javari_auto_healing_incidents')
          .select('detection_time')
          .eq('id', incidentId)
          .single();

        if (incident) {
          const detectionTime = new Date(incident.detection_time);
          const resolutionTime = new Date();
          const minutesToResolve = Math.round(
            (resolutionTime.getTime() - detectionTime.getTime()) / 60000
          );
          updateData.time_to_resolve_minutes = minutesToResolve;
        }
      }
    }

    const { data, error } = await supabase
      .from('javari_auto_healing_incidents')
      .update(updateData)
      .eq('id', incidentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      incident: data,
    });
  } catch (error: unknown) {
    logError('Update incident error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update incident',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
