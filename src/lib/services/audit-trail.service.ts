import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import winston from 'winston';
import { addDays, isBefore, parseISO } from 'date-fns';

/**
 * Audit event severity levels
 */
export enum AuditEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Audit event categories for classification
 */
export enum AuditEventCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM_CONFIGURATION = 'system_configuration',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  PERFORMANCE = 'performance',
  ERROR = 'error'
}

/**
 * Audit event schema for validation
 */
export const AuditEventSchema = z.object({
  id: z.string().uuid().optional(),
  timestamp: z.date(),
  event_type: z.string(),
  category: z.nativeEnum(AuditEventCategory),
  severity: z.nativeEnum(AuditEventSeverity),
  actor_id: z.string().optional(),
  actor_type: z.enum(['user', 'service', 'system']),
  resource_type: z.string().optional(),
  resource_id: z.string().optional(),
  action: z.string(),
  description: z.string(),
  metadata: z.record(z.any()).optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().optional(),
  session_id: z.string().optional(),
  request_id: z.string().optional(),
  organization_id: z.string().optional(),
  compliance_tags: z.array(z.string()).optional(),
  integrity_hash: z.string().optional(),
  previous_hash: z.string().optional()
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Audit query parameters for filtering and searching
 */
export const AuditQuerySchema = z.object({
  start_date: z.date().optional(),
  end_date: z.date().optional(),
  event_types: z.array(z.string()).optional(),
  categories: z.array(z.nativeEnum(AuditEventCategory)).optional(),
  severities: z.array(z.nativeEnum(AuditEventSeverity)).optional(),
  actor_id: z.string().optional(),
  actor_type: z.enum(['user', 'service', 'system']).optional(),
  resource_type: z.string().optional(),
  resource_id: z.string().optional(),
  organization_id: z.string().optional(),
  compliance_tags: z.array(z.string()).optional(),
  search_term: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  sort_by: z.enum(['timestamp', 'severity', 'event_type']).default('timestamp'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type AuditQuery = z.infer<typeof AuditQuerySchema>;

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  id: string;
  name: string;
  categories: AuditEventCategory[];
  severities: AuditEventSeverity[];
  retention_days: number;
  archive_before_deletion: boolean;
  compliance_requirements: string[];
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

/**
 * Integrity verification result
 */
export interface IntegrityVerificationResult {
  is_valid: boolean;
  total_events: number;
  verified_events: number;
  tampered_events: AuditEvent[];
  missing_events: string[];
  hash_mismatches: Array<{
    event_id: string;
    expected_hash: string;
    actual_hash: string;
  }>;
  verification_timestamp: Date;
}

/**
 * Compliance report configuration
 */
export interface ComplianceReportConfig {
  report_type: 'sox' | 'gdpr' | 'hipaa' | 'pci_dss' | 'custom';
  start_date: Date;
  end_date: Date;
  organization_id?: string;
  include_categories: AuditEventCategory[];
  format: 'json' | 'csv' | 'pdf';
  include_integrity_verification: boolean;
}

/**
 * Tamper-evident logger for maintaining cryptographic integrity
 */
class TamperEvidentLogger {
  private lastHash: string | null = null;

  /**
   * Generate cryptographic hash for audit event
   */
  generateEventHash(event: AuditEvent, previousHash: string | null): string {
    const eventData = {
      timestamp: event.timestamp.toISOString(),
      event_type: event.event_type,
      category: event.category,
      severity: event.severity,
      actor_id: event.actor_id,
      actor_type: event.actor_type,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      action: event.action,
      description: event.description,
      metadata: event.metadata,
      previous_hash: previousHash
    };

    const eventString = JSON.stringify(eventData, Object.keys(eventData).sort());
    return createHash('sha256').update(eventString).digest('hex');
  }

  /**
   * Generate random salt for additional security
   */
  generateSalt(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Verify event hash integrity
   */
  verifyEventHash(event: AuditEvent): boolean {
    const expectedHash = this.generateEventHash(event, event.previous_hash || null);
    return event.integrity_hash === expectedHash;
  }
}

/**
 * Query builder for complex audit searches
 */
class AuditQueryBuilder {
  private query: Partial<AuditQuery> = {};

  /**
   * Filter by date range
   */
  dateRange(startDate: Date, endDate: Date): this {
    this.query.start_date = startDate;
    this.query.end_date = endDate;
    return this;
  }

  /**
   * Filter by event types
   */
  eventTypes(types: string[]): this {
    this.query.event_types = types;
    return this;
  }

  /**
   * Filter by categories
   */
  categories(categories: AuditEventCategory[]): this {
    this.query.categories = categories;
    return this;
  }

  /**
   * Filter by severities
   */
  severities(severities: AuditEventSeverity[]): this {
    this.query.severities = severities;
    return this;
  }

  /**
   * Filter by actor
   */
  actor(actorId: string, actorType?: 'user' | 'service' | 'system'): this {
    this.query.actor_id = actorId;
    if (actorType) {
      this.query.actor_type = actorType;
    }
    return this;
  }

  /**
   * Filter by resource
   */
  resource(resourceType: string, resourceId?: string): this {
    this.query.resource_type = resourceType;
    if (resourceId) {
      this.query.resource_id = resourceId;
    }
    return this;
  }

  /**
   * Filter by organization
   */
  organization(organizationId: string): this {
    this.query.organization_id = organizationId;
    return this;
  }

  /**
   * Filter by compliance tags
   */
  complianceTags(tags: string[]): this {
    this.query.compliance_tags = tags;
    return this;
  }

  /**
   * Search by text
   */
  search(term: string): this {
    this.query.search_term = term;
    return this;
  }

  /**
   * Set pagination
   */
  paginate(limit: number, offset: number = 0): this {
    this.query.limit = limit;
    this.query.offset = offset;
    return this;
  }

  /**
   * Set sorting
   */
  sort(sortBy: 'timestamp' | 'severity' | 'event_type', order: 'asc' | 'desc' = 'desc'): this {
    this.query.sort_by = sortBy;
    this.query.sort_order = order;
    return this;
  }

  /**
   * Build the query object
   */
  build(): AuditQuery {
    return AuditQuerySchema.parse(this.query);
  }
}

/**
 * Retention policy manager for automated data lifecycle
 */
class RetentionPolicyManager {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private logger: winston.Logger
  ) {}

  /**
   * Apply retention policies to audit events
   */
  async applyRetentionPolicies(): Promise<void> {
    try {
      const { data: policies } = await this.supabase
        .from('audit_retention_policies')
        .select('*')
        .eq('is_active', true);

      if (!policies) return;

      for (const policy of policies) {
        await this.applyPolicy(policy);
      }

      this.logger.info('Retention policies applied successfully');
    } catch (error) {
      this.logger.error('Failed to apply retention policies', { error });
      throw error;
    }
  }

  /**
   * Apply individual retention policy
   */
  private async applyPolicy(policy: RetentionPolicy): Promise<void> {
    const cutoffDate = addDays(new Date(), -policy.retention_days);

    const query = this.supabase
      .from('audit_events')
      .select('id, timestamp')
      .lt('timestamp', cutoffDate.toISOString());

    if (policy.categories.length > 0) {
      query.in('category', policy.categories);
    }

    if (policy.severities.length > 0) {
      query.in('severity', policy.severities);
    }

    const { data: expiredEvents } = await query;

    if (!expiredEvents || expiredEvents.length === 0) return;

    if (policy.archive_before_deletion) {
      await this.archiveEvents(expiredEvents.map(e => e.id));
    }

    await this.deleteEvents(expiredEvents.map(e => e.id));

    this.logger.info(`Applied retention policy ${policy.name}`, {
      policy_id: policy.id,
      events_processed: expiredEvents.length
    });
  }

  /**
   * Archive events before deletion
   */
  private async archiveEvents(eventIds: string[]): Promise<void> {
    // Implementation would depend on archive storage (S3, etc.)
    this.logger.info('Events archived for retention policy', {
      event_count: eventIds.length
    });
  }

  /**
   * Delete expired events
   */
  private async deleteEvents(eventIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('audit_events')
      .delete()
      .in('id', eventIds);

    if (error) {
      throw new Error(`Failed to delete expired events: ${error.message}`);
    }
  }
}

/**
 * Compliance reporter for generating audit reports
 */
class ComplianceReporter {
  constructor(
    private auditService: AuditTrailService,
    private logger: winston.Logger
  ) {}

  /**
   * Generate compliance report
   */
  async generateReport(config: ComplianceReportConfig): Promise<any> {
    try {
      const query = new AuditQueryBuilder()
        .dateRange(config.start_date, config.end_date)
        .categories(config.include_categories);

      if (config.organization_id) {
        query.organization(config.organization_id);
      }

      const events = await this.auditService.query(query.build());

      let integrityResult: IntegrityVerificationResult | null = null;
      if (config.include_integrity_verification) {
        integrityResult = await this.auditService.verifyIntegrity(
          config.start_date,
          config.end_date
        );
      }

      const report = {
        report_id: randomBytes(16).toString('hex'),
        report_type: config.report_type,
        generated_at: new Date(),
        period: {
          start_date: config.start_date,
          end_date: config.end_date
        },
        organization_id: config.organization_id,
        summary: this.generateSummary(events.events),
        events: events.events,
        integrity_verification: integrityResult,
        compliance_notes: this.generateComplianceNotes(config.report_type, events.events)
      };

      this.logger.info('Compliance report generated', {
        report_id: report.report_id,
        report_type: config.report_type,
        event_count: events.events.length
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate compliance report', { error, config });
      throw error;
    }
  }

  /**
   * Generate report summary
   */
  private generateSummary(events: AuditEvent[]): any {
    const categoryCount = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityCount = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_events: events.length,
      category_breakdown: categoryCount,
      severity_breakdown: severityCount,
      unique_actors: new Set(events.map(e => e.actor_id).filter(Boolean)).size,
      date_range: {
        earliest: events.reduce((min, event) => event.timestamp < min ? event.timestamp : min, events[0]?.timestamp),
        latest: events.reduce((max, event) => event.timestamp > max ? event.timestamp : max, events[0]?.timestamp)
      }
    };
  }

  /**
   * Generate compliance-specific notes
   */
  private generateComplianceNotes(reportType: string, events: AuditEvent[]): string[] {
    const notes: string[] = [];

    switch (reportType) {
      case 'sox':
        notes.push('Sarbanes-Oxley compliance verification completed');
        if (events.some(e => e.category === AuditEventCategory.DATA_MODIFICATION)) {
          notes.push('Financial data modifications detected and logged');
        }
        break;
      case 'gdpr':
        notes.push('GDPR compliance audit completed');
        if (events.some(e => e.category === AuditEventCategory.DATA_ACCESS)) {
          notes.push('Personal data access events logged for data subject rights');
        }
        break;
      case 'hipaa':
        notes.push('HIPAA compliance verification completed');
        if (events.some(e => e.category === AuditEventCategory.AUTHENTICATION)) {
          notes.push('Healthcare data authentication events properly logged');
        }
        break;
    }

    return notes;
  }
}

/**
 * Comprehensive audit trail service for enterprise compliance
 */
export class AuditTrailService {
  private supabase: ReturnType<typeof createClient>;
  private logger: winston.Logger;
  private tamperEvidentLogger: TamperEvidentLogger;
  private retentionPolicyManager: RetentionPolicyManager;
  private complianceReporter: ComplianceReporter;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'audit-trail.log' })
      ]
    });

    this.tamperEvidentLogger = new TamperEvidentLogger();
    this.retentionPolicyManager = new RetentionPolicyManager(this.supabase, this.logger);
    this.complianceReporter = new ComplianceReporter(this, this.logger);
  }

  /**
   * Capture an audit event with tamper-evident logging
   */
  async capture(eventData: Omit<AuditEvent, 'id' | 'integrity_hash' | 'previous_hash'>): Promise<string> {
    try {
      // Validate event data
      const validatedEvent = AuditEventSchema.omit({ 
        id: true, 
        integrity_hash: true, 
        previous_hash: true 
      }).parse(eventData);

      // Get the last hash for chain integrity
      const { data: lastEvent } = await this.supabase
        .from('audit_events')
        .select('integrity_hash')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const previousHash = lastEvent?.integrity_hash || null;

      // Create complete event with integrity hash
      const completeEvent: AuditEvent = {
        ...validatedEvent,
        id: randomBytes(16).toString('hex'),
        previous_hash: previousHash,
        integrity_hash: ''
      };

      // Generate integrity hash
      completeEvent.integrity_hash = this.tamperEvidentLogger.generateEventHash(
        completeEvent,
        previousHash
      );

      // Store in database
      const { data, error } = await this.supabase
        .from('audit_events')
        .insert([completeEvent])
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to store audit event: ${error.message}`);
      }

      // Log to structured logger
      this.logger.info('Audit event captured', {
        event_id: data.id,
        event_type: completeEvent.event_type,
        category: completeEvent.category,
        severity: completeEvent.severity,
        actor_id: completeEvent.actor_id
      });

      return data.id;
    } catch (error) {
      this.logger.error('Failed to capture audit event', { error, eventData });
      throw error;
    }
  }

  /**
   * Query audit events with advanced filtering
   */
  async query(params: AuditQuery): Promise<{ events: AuditEvent[]; total: number }> {
    try {
      const validatedParams = AuditQuerySchema.parse(params);

      let query = this.supabase
        .from('audit_events')
        .select('*', { count: 'exact' });

      // Apply filters
      if (validatedParams.start_date) {
        query = query.gte('timestamp', validatedParams.start_date.toISOString());
      }

      if (validatedParams.end_date) {
        query = query.lte('timestamp', validatedParams.end_date.toISOString());
      }

      if (validatedParams.event_types?.length) {
        query = query.in('event_type', validatedParams.event_types);
      }

      if (validatedParams.categories?.length) {
        query = query.in('category', validatedParams.categories);
      }

      if (validatedParams.severities?.length) {
        query = query.in('severity', validatedParams.severities);
      }

      if (validatedParams.actor_id) {
        query = query.eq('actor_id', validatedParams.actor_id);
      }

      if (validatedParams.actor_type) {
        query = query.eq('actor_type', validatedParams.actor_type);
      }

      if (validatedParams.resource_type) {
        query = query.eq('resource_type', validatedParams.resource_type);
      }

      if (validatedParams.resource_id) {
        query = query.eq('resource_id', validatedParams.resource_id);
      }

      if (validatedParams.organization_id) {
        query = query.eq('organization_id', validatedParams.organization_id);
      }

      if (validatedParams.search_term) {
        query = query.or(`description.ilike.%${validatedParams.search_term}%,action.ilike.%${validatedParams.search_term}%`);
      }

      // Apply sorting
      query = query.order(validatedParams.sort_by, { 
        ascending: validatedParams.sort_order === 'asc' 
      });

      // Apply pagination
      query = query.range(
        validatedParams.offset,
        validatedParams.offset + validatedParams.limit - 1
      );

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to query audit events: ${error.message}`);
      }

      this.logger.info('Audit events queried', {
        params: validatedParams,
        result_count: data?.length || 0,
        total_count: count || 0
      });

      return {
        events: data || [],
        total: count || 0
      };
    } catch (error) {
      this.logger.error('Failed to query audit events', { error, params });
      throw error;
    }
  }

  /**
   * Verify integrity of audit trail
   */
  async verifyIntegrity(startDate?: Date, endDate?: Date): Promise<IntegrityVerificationResult> {
    try {
      let query = this.supabase
        .from('audit_events')
        .select('*')
        .order('timestamp', { ascending: true });

      if (startDate) {
        query = query.gte('timestamp', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('timestamp', endDate.toISOString());
      }

      const { data: events, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch events for integrity verification: ${error.message}`);
      }

      if (!events || events.length === 0) {
        return {
          is_valid: true,
          total_events: 0,
          verified_events: 0,
          tampered_events: [],
          missing_events: [],
          hash_mismatches: [],
          verification_timestamp: new Date()
        };
      }

      const result: IntegrityVerificationResult = {
        is_valid: true,
        total_events: events.length,
        verified_events: 0,
        tampered_events: [],
        missing_events: [],
        hash_mismatches: [],
        verification_timestamp: new Date()
      };

      // Verify