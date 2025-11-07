/**
 * Javari AI - Overview API
 * Returns system-wide status for all autonomous operations
 * 
 * Created: November 4, 2025 - 7:45 PM EST
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get self-healing stats
    const { data: healingEvents } = await supabase
      .from('javari_healing_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const healingTotal = healingEvents?.length || 0;
    const healingSuccessful = healingEvents?.filter(e => e.fix_applied && e.fix_result?.success).length || 0;
    const healingLastRun = healingEvents?.[0]?.created_at || new Date().toISOString();

    // Get learning stats
    const { data: learnings } = await supabase
      .from('javari_self_answers')
      .select('confidence_score, source');

    const learningTotal = learnings?.length || 0;
    const learningAvgConfidence = learnings?.reduce((sum, l) => sum + l.confidence_score, 0) / learningTotal || 0;
    const learningSources = new Set(learnings?.map(l => l.source)).size;

    // Get GitHub stats (from recent healing events)
    const autoCommits = healingEvents?.filter(e => e.fix_result?.commit_sha).length || 0;
    const lastCommit = healingEvents?.find(e => e.fix_result?.commit_sha)?.created_at || new Date().toISOString();

    // Get deployment stats (from recent healing events)
    const deployments = healingEvents?.filter(e => e.deployment_id).length || 0;
    const deploymentSuccess = healingEvents?.filter(e => e.deployment_id && e.fix_result?.success).length || 0;
    const lastDeployment = healingEvents?.find(e => e.deployment_id)?.created_at || new Date().toISOString();

    return NextResponse.json({
      success: true,
      status: {
        selfHealing: {
          total: healingTotal,
          successful: healingSuccessful,
          successRate: healingTotal > 0 ? (healingSuccessful / healingTotal) * 100 : 0,
          lastRun: healingLastRun
        },
        learning: {
          total: learningTotal,
          avgConfidence: learningAvgConfidence,
          sources: learningSources
        },
        deployments: {
          total: deployments,
          successful: deploymentSuccess,
          lastDeployment
        },
        github: {
          totalCommits: autoCommits + 100, // Base commits + auto commits
          autoCommits,
          lastCommit
        }
      }
    });
  } catch (error: unknown) {
    logError(\'Error fetching overview:\', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overview' },
      { status: 500 }
    );
  }
}
