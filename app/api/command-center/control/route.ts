/**
 * app/api/command-center/control/route.ts
 * Command Center Control Endpoint
 * Created: 2026-02-22 02:42 ET
 * 
 * Executes control actions on the autonomy system:
 * - start_cycle: Run STAGE 0-4 once
 * - pause_autonomy: Disable autonomous cycles
 * - resume_autonomy: Enable autonomous cycles
 * - kill_switch_on: Emergency stop
 * - kill_switch_off: Resume after emergency
 * - step: Run only STAGE 0 (roadmap engine)
 * - run_task: Execute single task with canonical context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/platform-secrets';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ControlRequest {
  action: 'start_cycle' | 'pause_autonomy' | 'resume_autonomy' | 'kill_switch_on' | 'kill_switch_off' | 'step' | 'run_task';
  taskId?: string;
  metadata?: Record<string, any>;
}

interface ControlResponse {
  success: boolean;
  action: string;
  timestamp: string;
  result?: any;
  error?: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body: ControlRequest = await req.json();
    const { action, taskId, metadata = {} } = body;

    // Validate action
    const validActions = ['start_cycle', 'pause_autonomy', 'resume_autonomy', 'kill_switch_on', 'kill_switch_off', 'step', 'run_task'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action', code: 'INVALID_ACTION', validActions },
        { status: 400 }
      );
    }

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log control event
    await supabase.rpc('log_control_event', {
      p_action: action,
      p_metadata: metadata,
      p_actor: 'command_center_api',
    });

    let result: any = {};

    switch (action) {
      case 'start_cycle': {
        // Trigger autonomous cycle manually
        // This would invoke the autonomy cycle endpoint
        const cycleUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/autonomy/cycle`;
        
        try {
          const cycleRes = await fetch(cycleUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ trigger: 'manual' }),
          });

          if (cycleRes.ok) {
            result = { triggered: true, message: 'Cycle started successfully' };
          } else {
            result = { triggered: false, error: await cycleRes.text() };
          }
        } catch (error) {
          result = { triggered: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'pause_autonomy': {
        // This would require updating Vercel environment variable
        // For now, log the intent
        result = {
          message: 'Pause requested - requires Vercel env var update: AUTONOMOUS_CORE_ENABLED=false',
          action_required: 'Update environment variable and redeploy',
        };
        break;
      }

      case 'resume_autonomy': {
        result = {
          message: 'Resume requested - requires Vercel env var update: AUTONOMOUS_CORE_ENABLED=true',
          action_required: 'Update environment variable and redeploy',
        };
        break;
      }

      case 'kill_switch_on': {
        result = {
          message: 'Kill switch activated - requires Vercel env var update: AUTONOMOUS_CORE_KILL_SWITCH=true',
          action_required: 'Update environment variable immediately',
          severity: 'CRITICAL',
        };
        break;
      }

      case 'kill_switch_off': {
        result = {
          message: 'Kill switch deactivated - requires Vercel env var update: AUTONOMOUS_CORE_KILL_SWITCH=false',
          action_required: 'Update environment variable and redeploy',
        };
        break;
      }

      case 'step': {
        // Run only STAGE 0 (roadmap engine)
        const roadmapUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/autonomy/roadmap`;
        
        try {
          const roadmapRes = await fetch(roadmapUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'step' }),
          });

          if (roadmapRes.ok) {
            const data = await roadmapRes.json();
            result = { executed: true, ...data };
          } else {
            result = { executed: false, error: await roadmapRes.text() };
          }
        } catch (error) {
          result = { executed: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'run_task': {
        if (!taskId) {
          return NextResponse.json(
            { error: 'taskId required for run_task action', code: 'MISSING_TASK_ID' },
            { status: 400 }
          );
        }

        // Execute single task with full canonical context
        const taskUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/autonomy/task/${taskId}`;
        
        try {
          const taskRes = await fetch(taskUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ metadata }),
          });

          if (taskRes.ok) {
            const data = await taskRes.json();
            result = { executed: true, taskId, ...data };
          } else {
            result = { executed: false, taskId, error: await taskRes.text() };
          }
        } catch (error) {
          result = { executed: false, taskId, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Unimplemented action', code: 'NOT_IMPLEMENTED' },
          { status: 501 }
        );
    }

    const duration = Date.now() - startTime;

    const response: ControlResponse = {
      success: true,
      action,
      timestamp: new Date().toISOString(),
      result,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Control] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
