/**
 * Javari AI - Overview API
 * Returns system-wide status for all autonomous operations
 * 
 * Created: November 4, 2025 - 7:45 PM EST
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, toNumber, isArray, safeGet } from '@/lib/typescript-helpers';

export async function GET(request: Request) {
  return await safeAsync(
    async () => {
      const supabase = createClient();
      
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !isDefined(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get self-healing stats
      const { data: healingEvents } = await supabase
        .from('javari_healing_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const healingArray = isArray(healingEvents) ? healingEvents : [];
      const healingTotal = healingArray.length;
      const healingSuccessful = healingArray.filter(e => 
        safeGet(e, 'fix_applied', false) && safeGet(e, 'fix_result.success', false)
      ).length;
      const healingLastRun = safeGet(healingArray, '0.created_at', new Date().toISOString());

      // Get learning stats
      const { data: learnings } = await supabase
        .from('javari_self_answers')
        .select('confidence_score, source');

      const learningArray = isArray(learnings) ? learnings : [];
      const learningTotal = learningArray.length;
      const learningSum = learningArray.reduce((sum, l) => sum + toNumber(safeGet(l, 'confidence_score', 0), 0), 0);
      const learningAvgConfidence = learningTotal > 0 ? learningSum / learningTotal : 0;
      const learningSources = new Set(learningArray.map(l => safeGet(l, 'source', 'unknown'))).size;

      // Get GitHub stats (from recent healing events)
      const autoCommits = healingArray.filter(e => isDefined(safeGet(e, 'fix_result.commit_sha'))).length;
      const commitEvent = healingArray.find(e => isDefined(safeGet(e, 'fix_result.commit_sha')));
      const lastCommit = safeGet(commitEvent, 'created_at', new Date().toISOString());

      // Get deployment stats (from recent healing events)
      const deployments = healingArray.filter(e => isDefined(safeGet(e, 'deployment_id'))).length;
      const deploymentSuccess = healingArray.filter(e => 
        isDefined(safeGet(e, 'deployment_id')) && safeGet(e, 'fix_result.success', false)
      ).length;
      const deployEvent = healingArray.find(e => isDefined(safeGet(e, 'deployment_id')));
      const lastDeployment = safeGet(deployEvent, 'created_at', new Date().toISOString());

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
            autoCommits,
            lastCommit
          }
        }
      });
    },
    { file: 'admin/javari/overview/route.ts', function: 'GET' },
    NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { success: false, error: 'Unexpected error' },
    { status: 500 }
  );
}
