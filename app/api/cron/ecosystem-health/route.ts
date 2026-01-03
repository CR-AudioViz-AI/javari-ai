/**
 * JAVARI AI - ECOSYSTEM HEALTH CRON
 * 
 * 24x7x365 autonomous monitoring of the entire Javari ecosystem.
 * 
 * Runs every 5 minutes to:
 * 1. Check health of all 50+ projects
 * 2. Detect and auto-rollback failed deployments
 * 3. Send alerts for critical issues
 * 4. Log all activities for learning
 * 
 * Endpoint: GET /api/cron/ecosystem-health
 * 
 * Created: January 3, 2026
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

// Critical projects that need extra attention
const CRITICAL_PROJECTS = [
  'javari-ai',
  'javari-cards', 
  'javari-market',
  'javari-invoice',
  'javari-scraper',
  'javariverse-hub',
];

interface ProjectStatus {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'building';
  lastDeployment?: {
    id: string;
    state: string;
    createdAt: number;
    commitMessage?: string;
  };
  healthCheck?: {
    available: boolean;
    responseTime?: number;
  };
  actions: string[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const supabase = createClient();
  
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Ecosystem Health] Starting 24x7x365 health check...');

  const results: {
    timestamp: string;
    duration_ms: number;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      down: number;
      building: number;
    };
    projects: ProjectStatus[];
    alerts_sent: number;
    rollbacks_performed: number;
    actions_taken: string[];
  } = {
    timestamp: new Date().toISOString(),
    duration_ms: 0,
    summary: { total: 0, healthy: 0, degraded: 0, down: 0, building: 0 },
    projects: [],
    alerts_sent: 0,
    rollbacks_performed: 0,
    actions_taken: [],
  };

  try {
    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken || !teamId) {
      throw new Error('Missing Vercel credentials');
    }

    // Fetch all projects
    const projectsResponse = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100`,
      {
        headers: { Authorization: `Bearer ${vercelToken}` },
      }
    );

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }

    const { projects } = await projectsResponse.json();
    results.summary.total = projects.length;

    // Check each project
    for (const project of projects) {
      const status: ProjectStatus = {
        id: project.id,
        name: project.name,
        status: 'healthy',
        actions: [],
      };

      try {
        // Get latest deployment
        const deploymentsResponse = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${project.id}&teamId=${teamId}&limit=5&target=production`,
          {
            headers: { Authorization: `Bearer ${vercelToken}` },
          }
        );

        if (deploymentsResponse.ok) {
          const { deployments } = await deploymentsResponse.json();
          const latest = deployments[0];

          if (latest) {
            status.lastDeployment = {
              id: latest.id,
              state: latest.state,
              createdAt: latest.created,
              commitMessage: latest.meta?.githubCommitMessage,
            };

            if (latest.state === 'ERROR') {
              status.status = 'down';
              
              // Find last good deployment for potential rollback
              const lastGood = deployments.find((d: any) => d.state === 'READY');
              
              if (lastGood && CRITICAL_PROJECTS.includes(project.name)) {
                // AUTO-ROLLBACK for critical projects
                console.log(`[Ecosystem Health] 🔄 Auto-rolling back ${project.name}...`);
                
                try {
                  const rollbackResponse = await fetch(
                    `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
                    {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${vercelToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        name: project.name,
                        deploymentId: lastGood.id,
                        target: 'production',
                      }),
                    }
                  );

                  if (rollbackResponse.ok) {
                    const rollback = await rollbackResponse.json();
                    status.actions.push(`Rolled back to ${lastGood.id}`);
                    results.rollbacks_performed++;
                    results.actions_taken.push(
                      `Rolled back ${project.name} from ${latest.id} to ${lastGood.id}`
                    );

                    // Log rollback to database
                    await supabase.from('javari_healing_history').insert({
                      error_type: 'deployment_failure',
                      error_message: `Deployment ${latest.id} failed`,
                      detection_method: 'ecosystem_health_cron',
                      fix_attempted: true,
                      fix_applied: true,
                      fix_result: {
                        action: 'rollback',
                        from: latest.id,
                        to: lastGood.id,
                        new_deployment: rollback.id,
                      },
                      confidence_score: 100,
                      project_name: project.name,
                      created_at: new Date().toISOString(),
                    });
                  }
                } catch (rollbackError) {
                  console.error(`[Ecosystem Health] Rollback failed for ${project.name}:`, rollbackError);
                  status.actions.push('Rollback attempted but failed');
                }
              }
            } else if (latest.state === 'BUILDING') {
              status.status = 'building';
            } else if (latest.state === 'READY') {
              status.status = 'healthy';
            }
          }
        }

        // Health endpoint check for critical projects
        if (CRITICAL_PROJECTS.includes(project.name)) {
          try {
            const healthUrl = `https://${project.name}.vercel.app/api/health`;
            const healthStart = Date.now();
            
            const healthResponse = await fetch(healthUrl, {
              signal: AbortSignal.timeout(10000),
            });

            status.healthCheck = {
              available: healthResponse.ok,
              responseTime: Date.now() - healthStart,
            };

            if (!healthResponse.ok && status.status === 'healthy') {
              status.status = 'degraded';
            }
          } catch (healthError) {
            status.healthCheck = { available: false };
            if (status.status === 'healthy') {
              status.status = 'degraded';
            }
          }
        }
      } catch (projectError) {
        console.error(`[Ecosystem Health] Error checking ${project.name}:`, projectError);
        status.status = 'degraded';
      }

      // Update summary counts
      results.summary[status.status]++;
      results.projects.push(status);
    }

    // Send alerts for critical issues
    const downProjects = results.projects.filter(p => p.status === 'down');
    const criticalDown = downProjects.filter(p => CRITICAL_PROJECTS.includes(p.name));

    if (criticalDown.length > 0) {
      // Log alert
      for (const project of criticalDown) {
        await supabase.from('javari_alerts').insert({
          alert_id: `ALERT-${Date.now()}-${project.name}`,
          severity: 'critical',
          title: `Critical Project Down: ${project.name}`,
          message: `Project ${project.name} deployment is in ERROR state`,
          source: 'ecosystem_health_cron',
          project_name: project.name,
          created_at: new Date().toISOString(),
          acknowledged: false,
        });
        results.alerts_sent++;
      }
      
      results.actions_taken.push(
        `Sent ${criticalDown.length} critical alerts for: ${criticalDown.map(p => p.name).join(', ')}`
      );
    }

    // Log health check run
    await supabase.from('javari_ecosystem_health').insert({
      timestamp: results.timestamp,
      total_projects: results.summary.total,
      healthy: results.summary.healthy,
      degraded: results.summary.degraded,
      down: results.summary.down,
      building: results.summary.building,
      alerts_sent: results.alerts_sent,
      rollbacks_performed: results.rollbacks_performed,
      duration_ms: Date.now() - startTime,
    });

  } catch (error) {
    console.error('[Ecosystem Health] Critical error:', error);
    
    // Log error
    await supabase.from('javari_alerts').insert({
      alert_id: `ALERT-${Date.now()}-ecosystem-error`,
      severity: 'critical',
      title: 'Ecosystem Health Check Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      source: 'ecosystem_health_cron',
      created_at: new Date().toISOString(),
      acknowledged: false,
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }

  results.duration_ms = Date.now() - startTime;

  console.log(`[Ecosystem Health] Complete: ${results.summary.healthy}/${results.summary.total} healthy, ${results.rollbacks_performed} rollbacks, ${results.alerts_sent} alerts`);

  return NextResponse.json({
    success: true,
    ...results,
  });
}

// Allow manual trigger
export async function POST(request: NextRequest) {
  // Re-use GET handler for manual triggers
  return GET(request);
}
