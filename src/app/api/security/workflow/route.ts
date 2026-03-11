```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ratelimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';
import { encrypt, decrypt } from '@/lib/encryption';
import Redis from 'ioredis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

// Environment validation
const ENV_SCHEMA = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  ELASTICSEARCH_URL: z.string().url(),
  SOAR_API_URL: z.string().url(),
  SOAR_API_KEY: z.string().min(1),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  TEAMS_WEBHOOK_URL: z.string().url().optional(),
});

const env = ENV_SCHEMA.parse(process.env);

// Initialize clients
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(env.REDIS_URL);
const elasticsearch = new ElasticsearchClient({ node: env.ELASTICSEARCH_URL });

// Request validation schemas
const IncidentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  source: z.string().min(1).max(100),
  sourceData: z.record(z.any()).optional(),
  assignee: z.string().uuid().optional(),
  tags: z.array(z.string()).max(10).optional(),
});

const EvidenceSchema = z.object({
  incidentId: z.string().uuid(),
  type: z.enum(['log', 'network', 'file', 'memory', 'registry', 'process']),
  source: z.string().min(1).max(100),
  data: z.record(z.any()),
  hash: z.string().min(1).max(128),
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

const RemediationSchema = z.object({
  incidentId: z.string().uuid(),
  actions: z.array(z.object({
    type: z.enum(['isolate', 'block', 'quarantine', 'disable', 'reset', 'notify']),
    target: z.string().min(1).max(200),
    parameters: z.record(z.any()).optional(),
    priority: z.number().min(1).max(10).default(5),
  })).min(1).max(20),
  approvalRequired: z.boolean().default(false),
  approver: z.string().uuid().optional(),
});

const SoarSyncSchema = z.object({
  incidentIds: z.array(z.string().uuid()).max(100).optional(),
  syncType: z.enum(['full', 'incremental', 'incident-only']).default('incremental'),
  direction: z.enum(['push', 'pull', 'bidirectional']).default('bidirectional'),
});

interface WorkflowState {
  id: string;
  incidentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  currentStep: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata: Record<string, any>;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'classification' | 'evidence' | 'remediation' | 'notification' | 'soar_sync';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

class SecurityWorkflowService {
  async createIncidentWorkflow(incidentData: z.infer<typeof IncidentSchema>): Promise<WorkflowState> {
    try {
      // Create incident record
      const { data: incident, error: incidentError } = await supabase
        .from('security_incidents')
        .insert([{
          title: incidentData.title,
          description: incidentData.description,
          severity: incidentData.severity,
          source: incidentData.source,
          source_data: encrypt(JSON.stringify(incidentData.sourceData || {})),
          assignee_id: incidentData.assignee,
          tags: incidentData.tags || [],
          status: 'open',
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (incidentError) throw incidentError;

      // Create workflow
      const workflowId = crypto.randomUUID();
      const workflow: WorkflowState = {
        id: workflowId,
        incidentId: incident.id,
        status: 'pending',
        steps: [
          {
            id: crypto.randomUUID(),
            name: 'Incident Classification',
            type: 'classification',
            status: 'pending',
            input: { incident: incidentData },
          },
          {
            id: crypto.randomUUID(),
            name: 'Evidence Collection',
            type: 'evidence',
            status: 'pending',
            input: { incidentId: incident.id },
          },
          {
            id: crypto.randomUUID(),
            name: 'SOAR Synchronization',
            type: 'soar_sync',
            status: 'pending',
            input: { incidentId: incident.id, syncType: 'incident-only' },
          },
        ],
        currentStep: 0,
        startedAt: new Date().toISOString(),
        metadata: {
          priority: this.calculatePriority(incidentData.severity),
          estimatedDuration: this.estimateWorkflowDuration(incidentData),
        },
      };

      // Store workflow state
      await this.storeWorkflowState(workflow);

      // Queue workflow execution
      await redis.lpush('security:workflow:queue', JSON.stringify({
        workflowId: workflow.id,
        priority: workflow.metadata.priority,
        createdAt: workflow.startedAt,
      }));

      return workflow;
    } catch (error) {
      logger.error('Failed to create incident workflow:', error);
      throw new Error('Failed to create incident workflow');
    }
  }

  async collectEvidence(evidenceData: z.infer<typeof EvidenceSchema>): Promise<string> {
    try {
      // Verify incident exists
      const { data: incident, error: incidentError } = await supabase
        .from('security_incidents')
        .select('id, status')
        .eq('id', evidenceData.incidentId)
        .single();

      if (incidentError || !incident) {
        throw new Error('Incident not found');
      }

      // Store evidence in database
      const { data: evidence, error: evidenceError } = await supabase
        .from('security_evidence')
        .insert([{
          incident_id: evidenceData.incidentId,
          type: evidenceData.type,
          source: evidenceData.source,
          data: encrypt(JSON.stringify(evidenceData.data)),
          hash: evidenceData.hash,
          timestamp: evidenceData.timestamp,
          metadata: evidenceData.metadata || {},
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (evidenceError) throw evidenceError;

      // Index evidence in Elasticsearch
      await elasticsearch.index({
        index: 'security-evidence',
        id: evidence.id,
        body: {
          incident_id: evidenceData.incidentId,
          type: evidenceData.type,
          source: evidenceData.source,
          hash: evidenceData.hash,
          timestamp: evidenceData.timestamp,
          metadata: evidenceData.metadata,
          indexed_at: new Date().toISOString(),
          // Store searchable fields without encryption
          searchable_content: this.extractSearchableContent(evidenceData.data),
        },
      });

      // Update workflow if exists
      await this.updateWorkflowStep(evidenceData.incidentId, 'evidence', {
        evidenceId: evidence.id,
        evidenceType: evidenceData.type,
        evidenceHash: evidenceData.hash,
      });

      return evidence.id;
    } catch (error) {
      logger.error('Failed to collect evidence:', error);
      throw new Error('Failed to collect evidence');
    }
  }

  async executeRemediation(remediationData: z.infer<typeof RemediationSchema>): Promise<string[]> {
    try {
      const executionId = crypto.randomUUID();
      const results: string[] = [];

      // Verify incident exists
      const { data: incident } = await supabase
        .from('security_incidents')
        .select('id, severity, status')
        .eq('id', remediationData.incidentId)
        .single();

      if (!incident) {
        throw new Error('Incident not found');
      }

      // Check if approval is required
      if (remediationData.approvalRequired && !remediationData.approver) {
        throw new Error('Approval required but no approver specified');
      }

      // Sort actions by priority
      const sortedActions = remediationData.actions.sort((a, b) => b.priority - a.priority);

      for (const action of sortedActions) {
        try {
          const actionResult = await this.executeRemediationAction(action, incident);
          results.push(actionResult.id);

          // Store action result
          await supabase.from('security_remediation_actions').insert([{
            incident_id: remediationData.incidentId,
            execution_id: executionId,
            type: action.type,
            target: action.target,
            parameters: action.parameters || {},
            status: actionResult.status,
            result: actionResult.result,
            executed_at: new Date().toISOString(),
          }]);
        } catch (actionError) {
          logger.error(`Failed to execute remediation action ${action.type}:`, actionError);
          
          await supabase.from('security_remediation_actions').insert([{
            incident_id: remediationData.incidentId,
            execution_id: executionId,
            type: action.type,
            target: action.target,
            parameters: action.parameters || {},
            status: 'failed',
            error: actionError instanceof Error ? actionError.message : 'Unknown error',
            executed_at: new Date().toISOString(),
          }]);
        }
      }

      // Send notifications
      await this.sendRemediationNotification(incident, remediationData.actions, results);

      return results;
    } catch (error) {
      logger.error('Failed to execute remediation:', error);
      throw new Error('Failed to execute remediation');
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowState | null> {
    try {
      const workflowData = await redis.get(`workflow:${workflowId}`);
      return workflowData ? JSON.parse(workflowData) : null;
    } catch (error) {
      logger.error('Failed to get workflow status:', error);
      return null;
    }
  }

  async syncWithSOAR(syncData: z.infer<typeof SoarSyncSchema>): Promise<{ syncId: string; status: string }> {
    try {
      const syncId = crypto.randomUUID();
      
      // Get incidents to sync
      let incidents;
      if (syncData.incidentIds?.length) {
        const { data } = await supabase
          .from('security_incidents')
          .select('*')
          .in('id', syncData.incidentIds);
        incidents = data || [];
      } else {
        const { data } = await supabase
          .from('security_incidents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        incidents = data || [];
      }

      // Process sync based on direction
      const syncResults = await this.processSoarSync(incidents, syncData.direction);

      // Store sync record
      await supabase.from('soar_sync_logs').insert([{
        sync_id: syncId,
        sync_type: syncData.syncType,
        direction: syncData.direction,
        incident_count: incidents.length,
        status: 'completed',
        results: syncResults,
        synced_at: new Date().toISOString(),
      }]);

      return { syncId, status: 'completed' };
    } catch (error) {
      logger.error('Failed to sync with SOAR:', error);
      throw new Error('Failed to sync with SOAR platform');
    }
  }

  private async storeWorkflowState(workflow: WorkflowState): Promise<void> {
    await redis.setex(`workflow:${workflow.id}`, 86400, JSON.stringify(workflow));
    
    await supabase.from('security_workflows').insert([{
      id: workflow.id,
      incident_id: workflow.incidentId,
      status: workflow.status,
      steps: workflow.steps,
      current_step: workflow.currentStep,
      started_at: workflow.startedAt,
      metadata: workflow.metadata,
    }]);
  }

  private async updateWorkflowStep(incidentId: string, stepType: string, output: Record<string, any>): Promise<void> {
    const workflowKey = await redis.get(`incident:${incidentId}:workflow`);
    if (!workflowKey) return;

    const workflow: WorkflowState = JSON.parse(await redis.get(workflowKey) || '{}');
    const step = workflow.steps.find(s => s.type === stepType);
    
    if (step) {
      step.status = 'completed';
      step.output = output;
      step.completedAt = new Date().toISOString();
      
      await this.storeWorkflowState(workflow);
    }
  }

  private calculatePriority(severity: string): number {
    const priorityMap = { low: 1, medium: 3, high: 7, critical: 10 };
    return priorityMap[severity as keyof typeof priorityMap] || 5;
  }

  private estimateWorkflowDuration(incidentData: any): number {
    // Base duration in minutes
    let duration = 30;
    
    if (incidentData.severity === 'critical') duration *= 0.5;
    if (incidentData.severity === 'high') duration *= 0.7;
    if (incidentData.sourceData) duration += 15;
    
    return Math.round(duration);
  }

  private extractSearchableContent(data: Record<string, any>): string {
    return Object.values(data)
      .filter(value => typeof value === 'string')
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async executeRemediationAction(action: any, incident: any): Promise<{ id: string; status: string; result: any }> {
    const actionId = crypto.randomUUID();
    
    // Simulate action execution (replace with actual implementation)
    switch (action.type) {
      case 'isolate':
        return {
          id: actionId,
          status: 'completed',
          result: { isolated: true, target: action.target }
        };
      case 'block':
        return {
          id: actionId,
          status: 'completed',
          result: { blocked: true, target: action.target }
        };
      default:
        return {
          id: actionId,
          status: 'completed',
          result: { action: action.type, target: action.target }
        };
    }
  }

  private async sendRemediationNotification(incident: any, actions: any[], results: string[]): Promise<void> {
    const message = {
      text: `🔒 Security Remediation Executed\n\nIncident: ${incident.title}\nSeverity: ${incident.severity}\nActions: ${actions.length}\nResults: ${results.length} successful`,
    };

    if (env.SLACK_WEBHOOK_URL) {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    }
  }

  private async processSoarSync(incidents: any[], direction: string): Promise<Record<string, any>> {
    // Implement SOAR platform API calls
    const headers = {
      'Authorization': `Bearer ${env.SOAR_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const results = {
      pushed: 0,
      pulled: 0,
      errors: [] as string[],
    };

    try {
      if (direction === 'push' || direction === 'bidirectional') {
        for (const incident of incidents) {
          const response = await fetch(`${env.SOAR_API_URL}/incidents`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              title: incident.title,
              description: incident.description,
              severity: incident.severity,
              source: 'CR AudioViz AI',
              external_id: incident.id,
            }),
          });

          if (response.ok) {
            results.pushed++;
          } else {
            results.errors.push(`Failed to push incident ${incident.id}`);
          }
        }
      }

      if (direction === 'pull' || direction === 'bidirectional') {
        const response = await fetch(`${env.SOAR_API_URL}/incidents`, {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const soarIncidents = await response.json();
          results.pulled = soarIncidents.length;
        }
      }
    } catch (error) {
      results.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    }

    return results;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const service = new SecurityWorkflowService();

    // Route to specific endpoints
    if (pathname.endsWith('/incident')) {
      const body = await request.json();
      const validatedData = IncidentSchema.parse(body);
      const workflow = await service.createIncidentWorkflow(validatedData);
      
      return NextResponse.json({ workflow }, { status: 201 });
    }

    if (pathname.endsWith('/evidence')) {
      const body = await request.json();
      const validatedData = EvidenceSchema.parse(body);
      const evidenceId = await service.collectEvidence(validatedData);
      
      return NextResponse.json({ evidenceId }, { status: 201 });
    }

    if (pathname.endsWith('/remediate')) {
      const body = await request.json();
      const validatedData = RemediationSchema.parse(body);
      const actionIds = await service.executeRemediation(validatedData);
      
      return NextResponse.json({ actionIds }, { status: 200 });
    }

    if (pathname.includes('/soar/sync')) {
      const body = await request.json();
      const validatedData = SoarSyncSchema.parse(body);
      const syncResult = await service.syncWithSOAR(validatedData);
      
      return NextResponse.json(syncResult, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );

  } catch (error) {
    logger.error('Security workflow API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const service = new SecurityWorkflowService();

    // Extract workflow ID from path
    const workflowIdMatch = pathname.match(/\/workflow\/([^\/]+)\/status/);
    if (workflowIdMatch) {
      const workflowId = workflowIdMatch[1];
      const workflow = await service.getWorkflowStatus(workflowId);
      
      if (!workflow) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ workflow }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );

  } catch (error) {
    logger.error('Security workflow API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```