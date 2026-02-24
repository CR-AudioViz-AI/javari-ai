/**
 * app/api/command-center/telemetry/route.ts
 * Command Center Telemetry Endpoint
 * Created: 2026-02-22 02:47 ET
 * 
 * Returns aggregated model usage metrics:
 * - Total tokens by model
 * - Latency distribution
 * - Error rates
 * - Retry counts
 * - Cost estimates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/platform-secrets';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cost estimates per 1M tokens (input/output average)
const MODEL_COSTS: Record<string, number> = {
  'claude-sonnet-4': 3.00,
  'gpt-4o': 2.50,
  'gemini-2.0-flash-exp': 0.15,
  'llama-3.1-70b': 0.60,
  'grok-beta': 5.00,
  'deepseek-chat': 0.14,
  'default': 1.00,
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'model'; // model | cycle | day

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('autonomy_model_usage')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch usage data: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        summary: {
          totalTokens: 0,
          totalCost: 0,
          avgLatency: 0,
          successRate: 100,
          totalRequests: 0,
        },
        byModel: {},
        byCycle: {},
        byDay: {},
      });
    }

    // Calculate summary
    const totalTokens = data.reduce((sum, u) => sum + (u.tokens_in || 0) + (u.tokens_out || 0), 0);
    const totalLatency = data.reduce((sum, u) => sum + (u.latency_ms || 0), 0);
    const successCount = data.filter(u => u.success).length;
    
    // Calculate cost
    const totalCost = data.reduce((sum, u) => {
      const tokens = (u.tokens_in || 0) + (u.tokens_out || 0);
      const costPer1M = MODEL_COSTS[u.model] || MODEL_COSTS.default;
      return sum + (tokens / 1_000_000) * costPer1M;
    }, 0);

    const summary = {
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(2)),
      avgLatency: Math.round(totalLatency / data.length),
      successRate: parseFloat(((successCount / data.length) * 100).toFixed(1)),
      totalRequests: data.length,
      errorCount: data.length - successCount,
      totalRetries: data.reduce((sum, u) => sum + (u.retries || 0), 0),
    };

    // Group by model
    const byModel: Record<string, any> = {};
    data.forEach(u => {
      if (!byModel[u.model]) {
        byModel[u.model] = {
          requests: 0,
          tokens: 0,
          cost: 0,
          avgLatency: 0,
          successRate: 0,
          errors: 0,
          retries: 0,
        };
      }
      
      const tokens = (u.tokens_in || 0) + (u.tokens_out || 0);
      const costPer1M = MODEL_COSTS[u.model] || MODEL_COSTS.default;
      
      byModel[u.model].requests++;
      byModel[u.model].tokens += tokens;
      byModel[u.model].cost += (tokens / 1_000_000) * costPer1M;
      byModel[u.model].avgLatency += u.latency_ms || 0;
      byModel[u.model].errors += u.success ? 0 : 1;
      byModel[u.model].retries += u.retries || 0;
    });

    // Finalize byModel calculations
    Object.keys(byModel).forEach(model => {
      byModel[model].avgLatency = Math.round(byModel[model].avgLatency / byModel[model].requests);
      byModel[model].successRate = parseFloat((((byModel[model].requests - byModel[model].errors) / byModel[model].requests) * 100).toFixed(1));
      byModel[model].cost = parseFloat(byModel[model].cost.toFixed(2));
    });

    // Group by cycle
    const byCycle: Record<string, any> = {};
    data.forEach(u => {
      if (!u.cycle_id) return;
      
      if (!byCycle[u.cycle_id]) {
        byCycle[u.cycle_id] = {
          requests: 0,
          tokens: 0,
          cost: 0,
          models: new Set(),
        };
      }
      
      const tokens = (u.tokens_in || 0) + (u.tokens_out || 0);
      const costPer1M = MODEL_COSTS[u.model] || MODEL_COSTS.default;
      
      byCycle[u.cycle_id].requests++;
      byCycle[u.cycle_id].tokens += tokens;
      byCycle[u.cycle_id].cost += (tokens / 1_000_000) * costPer1M;
      byCycle[u.cycle_id].models.add(u.model);
    });

    // Finalize byCycle
    Object.keys(byCycle).forEach(cycleId => {
      byCycle[cycleId].models = Array.from(byCycle[cycleId].models);
      byCycle[cycleId].cost = parseFloat(byCycle[cycleId].cost.toFixed(2));
    });

    // Group by day
    const byDay: Record<string, any> = {};
    data.forEach(u => {
      const day = u.created_at.split('T')[0]; // YYYY-MM-DD
      
      if (!byDay[day]) {
        byDay[day] = {
          requests: 0,
          tokens: 0,
          cost: 0,
        };
      }
      
      const tokens = (u.tokens_in || 0) + (u.tokens_out || 0);
      const costPer1M = MODEL_COSTS[u.model] || MODEL_COSTS.default;
      
      byDay[day].requests++;
      byDay[day].tokens += tokens;
      byDay[day].cost += (tokens / 1_000_000) * costPer1M;
    });

    // Finalize byDay
    Object.keys(byDay).forEach(day => {
      byDay[day].cost = parseFloat(byDay[day].cost.toFixed(2));
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      summary,
      byModel,
      byCycle,
      byDay,
      filters: { startDate, endDate },
    }, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Telemetry] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
