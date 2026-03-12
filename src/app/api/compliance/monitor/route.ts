```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schemas
const MonitoringRequestSchema = z.object({
  framework: z.enum(['gdpr', 'ccpa', 'sox', 'hipaa', 'pci_dss', 'iso27001', 'nist']),
  scope: z.array(z.string()).min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  realtime: z.boolean().default(true),
  notifications: z.object({
    email: z.array(z.string().email()).optional(),
    webhook: z.string().url().optional(),
    slack_channel: z.string().optional()
  }).optional()
});

const ActivityEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string().datetime(),
  source: z.string(),
  user_id: z.string(),
  activity_type: z.string(),
  data_involved: z.object({
    type: z.string(),
    classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
    location: z.string(),
    size: z.number().optional()
  }),
  metadata: z.record(z.any()).optional()
});

// Compliance frameworks configuration
const REGULATORY_FRAMEWORKS = {
  gdpr: {
    name: 'General Data Protection Regulation',
    rules: {
      data_retention: { max_days: 2555 }, // 7 years
      consent_required: ['personal_data', 'sensitive_data'],
      breach_notification: { hours: 72 },
      right_to_be_forgotten: true,
      data_portability: true
    },
    risk_weights: {
      personal_data_access: 0.8,
      cross_border_transfer: 0.9,
      automated_processing: 0.7,
      consent_withdrawal: 0.6
    }
  },
  ccpa: {
    name: 'California Consumer Privacy Act',
    rules: {
      disclosure_requirement: true,
      opt_out_right: true,
      deletion_right: true,
      non_discrimination: true
    },
    risk_weights: {
      personal_info_sale: 0.9,
      data_collection: 0.6,
      third_party_sharing: 0.8,
      consumer_request: 0.7
    }
  },
  sox: {
    name: 'Sarbanes-Oxley Act',
    rules: {
      financial_controls: true,
      audit_trail_required: true,
      executive_certification: true,
      whistleblower_protection: true
    },
    risk_weights: {
      financial_reporting: 0.95,
      internal_controls: 0.8,
      audit_interference: 0.9,
      document_destruction: 0.85
    }
  }
};

class ComplianceEngine {
  private supabase;
  private violations: Map<string, any> = new Map();
  private activeMonitors: Set<string> = new Set();

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async startMonitoring(framework: string, scope: string[], config: any): Promise<string> {
    const monitorId = crypto.randomUUID();
    
    // Create monitoring session
    const { error: sessionError } = await this.supabase
      .from('compliance_monitoring_sessions')
      .insert({
        monitor_id: monitorId,
        framework,
        scope,
        config,
        status: 'active',
        created_at: new Date().toISOString()
      });

    if (sessionError) throw sessionError;

    // Set up real-time subscription for activities
    if (config.realtime) {
      await this.setupRealtimeMonitoring(monitorId, framework, scope);
    }

    this.activeMonitors.add(monitorId);
    return monitorId;
  }

  private async setupRealtimeMonitoring(monitorId: string, framework: string, scope: string[]) {
    const channel = this.supabase
      .channel(`compliance_${monitorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `scope=in.(${scope.join(',')})`
        },
        (payload: any) => {
          this.processActivityEvent(monitorId, framework, payload.new);
        }
      )
      .subscribe();

    return channel;
  }

  async processActivityEvent(monitorId: string, framework: string, event: any): Promise<void> {
    const frameworkConfig = REGULATORY_FRAMEWORKS[framework as keyof typeof REGULATORY_FRAMEWORKS];
    if (!frameworkConfig) return;

    // Classify and assess risk
    const riskScore = this.calculateRiskScore(event, frameworkConfig);
    const violations = await this.detectViolations(event, frameworkConfig);

    if (violations.length > 0 || riskScore > 0.7) {
      await this.handleComplianceEvent(monitorId, {
        event,
        framework,
        risk_score: riskScore,
        violations,
        timestamp: new Date().toISOString()
      });
    }

    // Update audit trail
    await this.updateAuditTrail(monitorId, event, riskScore, violations);
  }

  private calculateRiskScore(event: any, frameworkConfig: any): number {
    let score = 0;
    const weights = frameworkConfig.risk_weights;

    // Check activity type risk
    for (const [riskType, weight] of Object.entries(weights)) {
      if (event.activity_type?.includes(riskType) || 
          event.data_involved?.type?.includes(riskType)) {
        score = Math.max(score, weight as number);
      }
    }

    // Adjust based on data classification
    const classificationMultiplier = {
      'public': 0.1,
      'internal': 0.3,
      'confidential': 0.7,
      'restricted': 1.0
    };

    const classification = event.data_involved?.classification || 'internal';
    score *= classificationMultiplier[classification as keyof typeof classificationMultiplier];

    return Math.min(score, 1.0);
  }

  private async detectViolations(event: any, frameworkConfig: any): Promise<any[]> {
    const violations = [];
    const rules = frameworkConfig.rules;

    // Check consent requirements
    if (rules.consent_required && 
        rules.consent_required.includes(event.data_involved?.type) &&
        !event.metadata?.consent_given) {
      violations.push({
        type: 'missing_consent',
        severity: 'high',
        rule: 'consent_required',
        description: 'Activity performed without required consent'
      });
    }

    // Check data retention limits
    if (rules.data_retention && event.metadata?.data_age) {
      const dataAgeMs = Date.now() - new Date(event.metadata.data_creation).getTime();
      const dataAgeDays = dataAgeMs / (1000 * 60 * 60 * 24);
      
      if (dataAgeDays > rules.data_retention.max_days) {
        violations.push({
          type: 'retention_violation',
          severity: 'medium',
          rule: 'data_retention',
          description: `Data retained beyond ${rules.data_retention.max_days} days limit`
        });
      }
    }

    // Check cross-border transfers (GDPR)
    if (rules.data_portability && 
        event.activity_type === 'data_transfer' &&
        event.metadata?.destination_country &&
        !this.isAdequateCountry(event.metadata.destination_country)) {
      violations.push({
        type: 'inadequate_transfer',
        severity: 'critical',
        rule: 'cross_border_transfer',
        description: 'Data transfer to country without adequate protection'
      });
    }

    return violations;
  }

  private isAdequateCountry(country: string): boolean {
    const adequateCountries = [
      'US', 'CA', 'GB', 'JP', 'AU', 'NZ', 'CH', 'IL', 'KR', 'AR', 'UY'
    ];
    return adequateCountries.includes(country);
  }

  private async handleComplianceEvent(monitorId: string, complianceEvent: any): Promise<void> {
    const eventId = crypto.randomUUID();
    
    // Store compliance event
    const { error } = await this.supabase
      .from('compliance_events')
      .insert({
        event_id: eventId,
        monitor_id: monitorId,
        ...complianceEvent,
        status: 'detected',
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    // Trigger automated remediation if applicable
    if (complianceEvent.violations.some((v: any) => v.severity === 'critical')) {
      await this.initiateRemediation(eventId, complianceEvent);
    }

    // Send notifications
    await this.sendComplianceNotifications(monitorId, complianceEvent);
  }

  private async initiateRemediation(eventId: string, complianceEvent: any): Promise<void> {
    const remediationActions = [];

    for (const violation of complianceEvent.violations) {
      switch (violation.type) {
        case 'inadequate_transfer':
          remediationActions.push({
            action: 'block_transfer',
            priority: 'immediate',
            description: 'Block data transfer to inadequate country'
          });
          break;
        case 'missing_consent':
          remediationActions.push({
            action: 'request_consent',
            priority: 'high',
            description: 'Request user consent for data processing'
          });
          break;
        case 'retention_violation':
          remediationActions.push({
            action: 'schedule_deletion',
            priority: 'medium',
            description: 'Schedule data deletion per retention policy'
          });
          break;
      }
    }

    await this.supabase
      .from('remediation_workflows')
      .insert({
        event_id: eventId,
        actions: remediationActions,
        status: 'pending',
        created_at: new Date().toISOString()
      });
  }

  private async updateAuditTrail(monitorId: string, event: any, riskScore: number, violations: any[]): Promise<void> {
    await this.supabase
      .from('compliance_audit_trail')
      .insert({
        monitor_id: monitorId,
        event_id: event.event_id,
        activity_type: event.activity_type,
        user_id: event.user_id,
        risk_score: riskScore,
        violations_count: violations.length,
        compliance_status: violations.length === 0 ? 'compliant' : 'non_compliant',
        created_at: new Date().toISOString()
      });
  }

  private async sendComplianceNotifications(monitorId: string, complianceEvent: any): Promise<void> {
    // Get notification config for this monitor
    const { data: monitor } = await this.supabase
      .from('compliance_monitoring_sessions')
      .select('config')
      .eq('monitor_id', monitorId)
      .single();

    if (!monitor?.config?.notifications) return;

    const notifications = monitor.config.notifications;
    const severity = Math.max(...complianceEvent.violations.map((v: any) => 
      v.severity === 'critical' ? 4 : v.severity === 'high' ? 3 : v.severity === 'medium' ? 2 : 1
    ));

    // Send webhook notification
    if (notifications.webhook) {
      try {
        await fetch(notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monitor_id: monitorId,
            event: complianceEvent,
            severity: severity >= 3 ? 'high' : 'medium'
          })
        });
      } catch (error) {
        console.error('Webhook notification failed:', error);
      }
    }

    // Store notification record
    await this.supabase
      .from('compliance_notifications')
      .insert({
        monitor_id: monitorId,
        event_id: complianceEvent.event?.event_id,
        notification_type: 'violation_detected',
        severity,
        sent_at: new Date().toISOString()
      });
  }

  async generateComplianceReport(monitorId: string, period: string): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period === 'week' ? 7 : period === 'month' ? 30 : 1));

    const { data: events } = await this.supabase
      .from('compliance_events')
      .select('*')
      .eq('monitor_id', monitorId)
      .gte('created_at', startDate.toISOString());

    const { data: auditTrail } = await this.supabase
      .from('compliance_audit_trail')
      .select('*')
      .eq('monitor_id', monitorId)
      .gte('created_at', startDate.toISOString());

    return {
      period,
      summary: {
        total_events: auditTrail?.length || 0,
        violations: events?.length || 0,
        compliance_rate: ((auditTrail?.length || 0) - (events?.length || 0)) / (auditTrail?.length || 1) * 100,
        avg_risk_score: auditTrail?.reduce((sum: number, item: any) => sum + item.risk_score, 0) / (auditTrail?.length || 1)
      },
      violations_by_type: this.groupViolationsByType(events || []),
      risk_trends: this.calculateRiskTrends(auditTrail || []),
      remediation_status: await this.getRemediationStatus(events?.map((e: any) => e.event_id) || [])
    };
  }

  private groupViolationsByType(events: any[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    events.forEach(event => {
      event.violations?.forEach((violation: any) => {
        groups[violation.type] = (groups[violation.type] || 0) + 1;
      });
    });

    return groups;
  }

  private calculateRiskTrends(auditTrail: any[]): any[] {
    const daily = auditTrail.reduce((acc: any, item: any) => {
      const date = item.created_at.split('T')[0];
      acc[date] = acc[date] || { date, risk_sum: 0, count: 0 };
      acc[date].risk_sum += item.risk_score;
      acc[date].count += 1;
      return acc;
    }, {});

    return Object.values(daily).map((day: any) => ({
      date: day.date,
      avg_risk_score: day.risk_sum / day.count
    }));
  }

  private async getRemediationStatus(eventIds: string[]): Promise<any> {
    if (eventIds.length === 0) return { pending: 0, completed: 0, failed: 0 };

    const { data } = await this.supabase
      .from('remediation_workflows')
      .select('status')
      .in('event_id', eventIds);

    return (data || []).reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, { pending: 0, completed: 0, failed: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();

    // Validate request based on endpoint
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'start_monitoring';

    switch (action) {
      case 'start_monitoring': {
        const validatedData = MonitoringRequestSchema.parse(body);
        const engine = new ComplianceEngine(supabase);
        
        const monitorId = await engine.startMonitoring(
          validatedData.framework,
          validatedData.scope,
          {
            priority: validatedData.priority,
            realtime: validatedData.realtime,
            notifications: validatedData.notifications
          }
        );

        return NextResponse.json({
          success: true,
          monitor_id: monitorId,
          framework: validatedData.framework,
          status: 'monitoring_started'
        });
      }

      case 'process_activity': {
        const validatedEvent = ActivityEventSchema.parse(body);
        const { monitor_id, framework } = body;
        
        if (!monitor_id || !framework) {
          return NextResponse.json(
            { error: 'monitor_id and framework are required' },
            { status: 400 }
          );
        }

        const engine = new ComplianceEngine(supabase);
        await engine.processActivityEvent(monitor_id, framework, validatedEvent);

        return NextResponse.json({
          success: true,
          event_id: validatedEvent.event_id,
          status: 'processed'
        });
      }

      case 'generate_report': {
        const { monitor_id, period = 'week' } = body;
        
        if (!monitor_id) {
          return NextResponse.json(
            { error: 'monitor_id is required' },
            { status: 400 }
          );
        }

        const engine = new ComplianceEngine(supabase);
        const report = await engine.generateComplianceReport(monitor_id, period);

        return NextResponse.json({
          success: true,
          report,
          generated_at: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Compliance monitoring error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    const monitorId = searchParams.get('monitor_id');
    const action = searchParams.get('action') || 'status';

    if (!monitorId) {
      return NextResponse.json(
        { error: 'monitor_id parameter is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'status': {
        const { data: session } = await supabase
          .from('compliance_monitoring_sessions')
          .select('*')
          .eq('monitor_id', monitorId)
          .single();

        if (!session) {
          return NextResponse.json(
            { error: 'Monitor session not found' },
            { status: 404 }
          );
        }

        const { data: recentEvents } = await supabase
          .from('compliance_events')
          .select('*')
          .eq('monitor_id', monitorId)
          .order('created_at', { ascending: false })
          .limit(10);

        return NextResponse.json({
          success: true,
          session,
          recent_events: recentEvents || [],
          last_updated: new Date().toISOString()
        });
      }

      case 'frameworks': {
        return NextResponse.json({
          success: true,
          frameworks: Object.entries(REGULATORY_FRAMEWORKS).map(([key, config]) => ({
            id: key,
            name: config.name,
            rules: Object.keys(config.rules),
            risk_categories: Object.keys(config.risk_weights)
          }))
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Compliance monitoring GET error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    const monitorId = searchParams.get('monitor_id');

    if (!monitorId) {
      return NextResponse.json(
        { error: 'monitor_id parameter is required' },
        { status: 400 }
      );
    }

    // Update monitoring session status to stopped
    const { error } = await supabase
      .from('compliance_monitoring_sessions')
      .update({ 
        status: 'stopped',
        stopped_at: new Date().toISOString()
      })
      .eq('monitor_id', monitorId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      monitor_id: monitorId,
      status: 'monitoring_stopped'
    });

  } catch (error) {
    console.error('Compliance monitoring DELETE error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```