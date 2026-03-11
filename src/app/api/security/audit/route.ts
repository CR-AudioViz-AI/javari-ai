import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { Redis } from '@upstash/redis';

// Types
interface AuditEvent {
  id?: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  user_id?: string;
  session_id?: string;
  ip_address: string;
  user_agent?: string;
  resource?: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: Record<string, any>;
  timestamp: string;
  signature?: string;
  hash_chain?: string;
}

interface AlertRule {
  id: string;
  name: string;
  event_type: string;
  severity_threshold: string;
  conditions: Record<string, any>;
  actions: AlertAction[];
  enabled: boolean;
  rate_limit: number;
}

interface AlertAction {
  type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS';
  target: string;
  template?: string;
}

interface AuditQuery {
  event_types?: string[];
  severity?: string[];
  user_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string[];
  limit?: number;
  offset?: number;
  verify_integrity?: boolean;
}

// Security Event Classifications
const SECURITY_EVENT_TYPES = {
  AUTHENTICATION: ['login', 'logout', 'password_change', 'mfa_setup', 'account_locked'],
  AUTHORIZATION: ['permission_denied', 'role_changed', 'access_granted', 'privilege_escalation'],
  DATA_ACCESS: ['data_export', 'sensitive_data_access', 'bulk_download', 'unauthorized_query'],
  SYSTEM: ['config_change', 'service_start', 'service_stop', 'maintenance_mode'],
  SECURITY: ['intrusion_attempt', 'malware_detected', 'vulnerability_scan', 'suspicious_activity']
};

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

// Core Audit Service
class AuditEventLogger {
  private secretKey: string;
  
  constructor() {
    this.secretKey = process.env.AUDIT_SIGNATURE_SECRET!;
  }

  private generateSignature(event: AuditEvent): string {
    const payload = JSON.stringify({
      event_type: event.event_type,
      timestamp: event.timestamp,
      user_id: event.user_id,
      action: event.action,
      details: event.details
    });
    
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');
  }

  private async getLastHashChain(): Promise<string> {
    const { data } = await supabase
      .from('audit_logs')
      .select('hash_chain')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.hash_chain || '0';
  }

  private generateHashChain(event: AuditEvent, previousHash: string): string {
    const eventString = JSON.stringify(event) + previousHash;
    return crypto.createHash('sha256').update(eventString).digest('hex');
  }

  async logEvent(event: AuditEvent): Promise<string> {
    try {
      // Add timestamp if not provided
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }

      // Generate cryptographic signature
      event.signature = this.generateSignature(event);

      // Generate hash chain for tamper detection
      const previousHash = await this.getLastHashChain();
      event.hash_chain = this.generateHashChain(event, previousHash);

      // Store in database with RLS protection
      const { data, error } = await supabase
        .from('audit_logs')
        .insert([event])
        .select('id')
        .single();

      if (error) throw error;

      // Cache for real-time processing
      await redis.lpush('audit_events_stream', JSON.stringify(event));
      await redis.expire('audit_events_stream', 3600); // 1 hour retention

      return data.id;
    } catch (error) {
      console.error('Audit logging failed:', error);
      throw new Error('Failed to log audit event');
    }
  }
}

// Tamper-Proof Storage Verifier
class IntegrityVerifier {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.AUDIT_SIGNATURE_SECRET!;
  }

  async verifyEventIntegrity(event: AuditEvent): Promise<boolean> {
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify({
        event_type: event.event_type,
        timestamp: event.timestamp,
        user_id: event.user_id,
        action: event.action,
        details: event.details
      }))
      .digest('hex');

    return event.signature === expectedSignature;
  }

  async verifyHashChain(events: AuditEvent[]): Promise<boolean> {
    if (events.length === 0) return true;

    let previousHash = '0';
    
    for (const event of events) {
      const expectedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(event) + previousHash)
        .digest('hex');
      
      if (event.hash_chain !== expectedHash) {
        return false;
      }
      
      previousHash = event.hash_chain!;
    }

    return true;
  }
}

// Alert Rule Engine
class AlertRuleEngine {
  async evaluateEvent(event: AuditEvent): Promise<void> {
    try {
      // Get active alert rules
      const { data: rules } = await supabase
        .from('audit_alert_rules')
        .select('*')
        .eq('enabled', true);

      if (!rules) return;

      for (const rule of rules) {
        if (await this.matchesRule(event, rule)) {
          await this.triggerAlert(event, rule);
        }
      }
    } catch (error) {
      console.error('Alert evaluation failed:', error);
    }
  }

  private async matchesRule(event: AuditEvent, rule: AlertRule): Promise<boolean> {
    // Check rate limiting
    const rateLimitKey = `alert_rate_limit:${rule.id}`;
    const currentCount = await redis.incr(rateLimitKey);
    
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 3600); // 1 hour window
    }
    
    if (currentCount > rule.rate_limit) {
      return false;
    }

    // Check event type match
    if (rule.event_type !== '*' && rule.event_type !== event.event_type) {
      return false;
    }

    // Check severity threshold
    const severityLevels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    if (severityLevels[event.severity] < severityLevels[rule.severity_threshold as keyof typeof severityLevels]) {
      return false;
    }

    // Check custom conditions
    return this.evaluateConditions(event, rule.conditions);
  }

  private evaluateConditions(event: AuditEvent, conditions: Record<string, any>): boolean {
    for (const [field, condition] of Object.entries(conditions)) {
      const eventValue = this.getNestedValue(event, field);
      
      if (!this.evaluateCondition(eventValue, condition)) {
        return false;
      }
    }
    
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object') {
      if (condition.$eq !== undefined) return value === condition.$eq;
      if (condition.$ne !== undefined) return value !== condition.$ne;
      if (condition.$in !== undefined) return condition.$in.includes(value);
      if (condition.$regex !== undefined) return new RegExp(condition.$regex).test(value);
    }
    
    return value === condition;
  }

  private async triggerAlert(event: AuditEvent, rule: AlertRule): Promise<void> {
    for (const action of rule.actions) {
      await this.executeAction(event, rule, action);
    }
  }

  private async executeAction(event: AuditEvent, rule: AlertRule, action: AlertAction): Promise<void> {
    const alertData = {
      rule_name: rule.name,
      event,
      timestamp: new Date().toISOString()
    };

    try {
      switch (action.type) {
        case 'WEBHOOK':
          await fetch(action.target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertData)
          });
          break;

        case 'SLACK':
          await this.sendSlackAlert(action.target, alertData);
          break;

        case 'EMAIL':
          await this.sendEmailAlert(action.target, alertData);
          break;

        default:
          console.warn(`Unsupported alert action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Alert action failed: ${action.type}`, error);
    }
  }

  private async sendSlackAlert(webhook: string, data: any): Promise<void> {
    const message = {
      text: `🚨 Security Alert: ${data.rule_name}`,
      attachments: [{
        color: data.event.severity === 'CRITICAL' ? 'danger' : 'warning',
        fields: [
          { title: 'Event Type', value: data.event.event_type, short: true },
          { title: 'Severity', value: data.event.severity, short: true },
          { title: 'User', value: data.event.user_id || 'Unknown', short: true },
          { title: 'Action', value: data.event.action, short: true }
        ],
        ts: Math.floor(new Date(data.timestamp).getTime() / 1000)
      }]
    };

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }

  private async sendEmailAlert(email: string, data: any): Promise<void> {
    // Implementation would depend on your email service
    console.log(`Email alert would be sent to ${email}:`, data);
  }
}

// Audit Query Service
class AuditQueryService {
  private verifier: IntegrityVerifier;

  constructor() {
    this.verifier = new IntegrityVerifier();
  }

  async queryAuditLogs(query: AuditQuery, userId: string): Promise<{
    events: AuditEvent[];
    total: number;
    integrity_verified?: boolean;
  }> {
    try {
      let supabaseQuery = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (query.event_types?.length) {
        supabaseQuery = supabaseQuery.in('event_type', query.event_types);
      }

      if (query.severity?.length) {
        supabaseQuery = supabaseQuery.in('severity', query.severity);
      }

      if (query.user_id) {
        supabaseQuery = supabaseQuery.eq('user_id', query.user_id);
      }

      if (query.status?.length) {
        supabaseQuery = supabaseQuery.in('status', query.status);
      }

      if (query.date_from) {
        supabaseQuery = supabaseQuery.gte('timestamp', query.date_from);
      }

      if (query.date_to) {
        supabaseQuery = supabaseQuery.lte('timestamp', query.date_to);
      }

      // Apply pagination
      const limit = Math.min(query.limit || 100, 1000);
      const offset = query.offset || 0;

      supabaseQuery = supabaseQuery
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: events, error, count } = await supabaseQuery;

      if (error) throw error;

      let integrityVerified: boolean | undefined;

      // Verify integrity if requested
      if (query.verify_integrity && events?.length) {
        integrityVerified = await this.verifier.verifyHashChain(events);
      }

      return {
        events: events || [],
        total: count || 0,
        integrity_verified: integrityVerified
      };
    } catch (error) {
      console.error('Audit query failed:', error);
      throw new Error('Failed to query audit logs');
    }
  }
}

// Initialize services
const auditLogger = new AuditEventLogger();
const alertEngine = new AlertRuleEngine();
const queryService = new AuditQueryService();
const verifier = new IntegrityVerifier();

// Utility functions
function getClientIP(request: NextRequest): string {
  const headersList = headers();
  return headersList.get('x-forwarded-for')?.split(',')[0] ||
         headersList.get('x-real-ip') ||
         request.ip ||
         'unknown';
}

async function validateApiKey(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id || null;
  } catch {
    return null;
  }
}

function validateAuditEvent(event: any): event is AuditEvent {
  return (
    typeof event.event_type === 'string' &&
    typeof event.action === 'string' &&
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(event.severity) &&
    ['SUCCESS', 'FAILURE', 'WARNING'].includes(event.status) &&
    typeof event.details === 'object'
  );
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const userId = await validateApiKey(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!validateAuditEvent(body)) {
      return NextResponse.json({ error: 'Invalid audit event format' }, { status: 400 });
    }

    // Enrich event with request metadata
    const enrichedEvent: AuditEvent = {
      ...body,
      user_id: body.user_id || userId,
      ip_address: getClientIP(request),
      user_agent: request.headers.get('user-agent') || undefined,
      timestamp: body.timestamp || new Date().toISOString()
    };

    // Log the event
    const eventId = await auditLogger.logEvent(enrichedEvent);

    // Evaluate for alerts (async, don't block response)
    alertEngine.evaluateEvent(enrichedEvent).catch(console.error);

    return NextResponse.json({ 
      success: true, 
      event_id: eventId,
      timestamp: enrichedEvent.timestamp
    });
  } catch (error) {
    console.error('Audit POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await validateApiKey(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    const query: AuditQuery = {
      event_types: searchParams.get('event_types')?.split(','),
      severity: searchParams.get('severity')?.split(','),
      user_id: searchParams.get('user_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      status: searchParams.get('status')?.split(','),
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
      verify_integrity: searchParams.get('verify_integrity') === 'true'
    };

    const result = await queryService.queryAuditLogs(query, userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Audit GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await validateApiKey(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'verify_integrity': {
        const { event_ids } = params;
        
        if (!Array.isArray(event_ids)) {
          return NextResponse.json({ error: 'event_ids must be an array' }, { status: 400 });
        }

        const { data: events } = await supabase
          .from('audit_logs')
          .select('*')
          .in('id', event_ids)
          .order('timestamp', { ascending: true });

        if (!events) {
          return NextResponse.json({ error: 'Events not found' }, { status: 404 });
        }

        const integrityResults = await Promise.all(
          events.map(async (event) => ({
            event_id: event.id,
            signature_valid: await verifier.verifyEventIntegrity(event),
            timestamp: event.timestamp
          }))
        );

        const chainValid = await verifier.verifyHashChain(events);

        return NextResponse.json({
          individual_integrity: integrityResults,
          chain_integrity: chainValid,
          verified_at: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Audit PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}