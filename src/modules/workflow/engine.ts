```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

/**
 * Workflow status enumeration
 */
export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

/**
 * Approval action enumeration
 */
export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  DELEGATE = 'delegate',
  ESCALATE = 'escalate',
  REQUEST_INFO = 'request_info'
}

/**
 * Notification channel enumeration
 */
export enum NotificationChannel {
  EMAIL = 'email',
  TEAMS = 'teams',
  SLACK = 'slack',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app'
}

/**
 * Workflow condition interface
 */
export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
  logicalOperator?: 'and' | 'or';
}

/**
 * SLA configuration interface
 */
export interface SLAConfig {
  responseTimeHours: number;
  resolutionTimeHours: number;
  escalationTimeHours: number;
  businessHoursOnly: boolean;
  holidays: string[];
  timezone: string;
}

/**
 * Approval stage configuration
 */
export interface ApprovalStageConfig {
  id: string;
  name: string;
  description: string;
  approvers: string[];
  requiredApprovals: number;
  allowDelegation: boolean;
  allowSkip: boolean;
  conditions: WorkflowCondition[];
  sla: SLAConfig;
  notificationChannels: NotificationChannel[];
  escalationChain: string[];
  autoApproveConditions?: WorkflowCondition[];
}

/**
 * Workflow template interface
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  stages: ApprovalStageConfig[];
  globalSLA: SLAConfig;
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow instance interface
 */
export interface WorkflowInstance {
  id: string;
  templateId: string;
  initiatorId: string;
  currentStageId: string;
  status: WorkflowStatus;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Approval record interface
 */
export interface ApprovalRecord {
  id: string;
  workflowInstanceId: string;
  stageId: string;
  approverId: string;
  delegatedFrom?: string;
  action: ApprovalAction;
  comments: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

/**
 * Delegation record interface
 */
export interface DelegationRecord {
  id: string;
  delegatorId: string;
  delegateeId: string;
  workflowInstanceId: string;
  stageId: string;
  reason: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

/**
 * SLA metrics interface
 */
export interface SLAMetrics {
  workflowInstanceId: string;
  stageId: string;
  startTime: Date;
  responseTime?: Date;
  completionTime?: Date;
  escalationTime?: Date;
  isBreached: boolean;
  breachReason?: string;
}

/**
 * Notification payload interface
 */
export interface NotificationPayload {
  channel: NotificationChannel;
  recipients: string[];
  subject: string;
  body: string;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Integration adapter interface
 */
export interface IntegrationAdapter {
  name: string;
  authenticate(): Promise<boolean>;
  sendNotification(payload: NotificationPayload): Promise<boolean>;
  getUserInfo(userId: string): Promise<any>;
  validateUser(userId: string): Promise<boolean>;
  createTicket?(data: any): Promise<string>;
  updateTicket?(ticketId: string, data: any): Promise<boolean>;
}

/**
 * Workflow engine configuration
 */
export interface WorkflowEngineConfig {
  supabaseUrl: string;
  supabaseKey: string;
  defaultSLA: SLAConfig;
  integrations: IntegrationAdapter[];
  auditEnabled: boolean;
  metricsEnabled: boolean;
}

/**
 * Individual approval stage with conditions and SLA tracking
 */
export class ApprovalStage extends EventEmitter {
  private config: ApprovalStageConfig;
  private slaTracker: SLATracker;
  private notifications: NotificationDispatcher;

  constructor(config: ApprovalStageConfig, slaTracker: SLATracker, notifications: NotificationDispatcher) {
    super();
    this.config = config;
    this.slaTracker = slaTracker;
    this.notifications = notifications;
  }

  /**
   * Evaluate if stage conditions are met
   */
  public evaluateConditions(data: Record<string, any>): boolean {
    try {
      if (!this.config.conditions || this.config.conditions.length === 0) {
        return true;
      }

      let result = true;
      for (let i = 0; i < this.config.conditions.length; i++) {
        const condition = this.config.conditions[i];
        const fieldValue = this.getNestedValue(data, condition.field);
        const conditionResult = this.evaluateCondition(fieldValue, condition);

        if (i === 0) {
          result = conditionResult;
        } else {
          const logicalOp = this.config.conditions[i - 1].logicalOperator || 'and';
          result = logicalOp === 'and' ? result && conditionResult : result || conditionResult;
        }
      }

      return result;
    } catch (error) {
      this.emit('error', new Error(`Stage condition evaluation failed: ${error}`));
      return false;
    }
  }

  /**
   * Check if stage can be auto-approved
   */
  public canAutoApprove(data: Record<string, any>): boolean {
    if (!this.config.autoApproveConditions) {
      return false;
    }

    return this.config.autoApproveConditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);
      return this.evaluateCondition(fieldValue, condition);
    });
  }

  /**
   * Start stage processing
   */
  public async start(workflowInstanceId: string, data: Record<string, any>): Promise<void> {
    try {
      // Start SLA tracking
      await this.slaTracker.startTracking(workflowInstanceId, this.config.id, this.config.sla);

      // Check for auto-approval
      if (this.canAutoApprove(data)) {
        this.emit('auto-approved', { stageId: this.config.id, workflowInstanceId });
        return;
      }

      // Send notifications to approvers
      await this.notifyApprovers(workflowInstanceId, data);

      this.emit('started', { stageId: this.config.id, workflowInstanceId });
    } catch (error) {
      this.emit('error', new Error(`Failed to start approval stage: ${error}`));
      throw error;
    }
  }

  /**
   * Process approval action
   */
  public async processApproval(
    workflowInstanceId: string,
    approverId: string,
    action: ApprovalAction,
    comments: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const record: ApprovalRecord = {
        id: this.generateId(),
        workflowInstanceId,
        stageId: this.config.id,
        approverId,
        action,
        comments,
        metadata,
        timestamp: new Date()
      };

      // Record the approval
      await this.recordApproval(record);

      // Update SLA metrics
      await this.slaTracker.recordResponse(workflowInstanceId, this.config.id);

      this.emit('approval-processed', { record, stageId: this.config.id });
    } catch (error) {
      this.emit('error', new Error(`Failed to process approval: ${error}`));
      throw error;
    }
  }

  private evaluateCondition(value: any, condition: WorkflowCondition): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains': return String(value).includes(String(condition.value));
      default: return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async notifyApprovers(workflowInstanceId: string, data: Record<string, any>): Promise<void> {
    for (const approverId of this.config.approvers) {
      const payload: NotificationPayload = {
        channel: this.config.notificationChannels[0] || NotificationChannel.EMAIL,
        recipients: [approverId],
        subject: `Approval Required: ${this.config.name}`,
        body: `A workflow requires your approval. Stage: ${this.config.name}`,
        data: { workflowInstanceId, stageId: this.config.id, ...data },
        priority: 'medium'
      };

      await this.notifications.send(payload);
    }
  }

  private async recordApproval(record: ApprovalRecord): Promise<void> {
    // Implementation would record to database
    this.emit('approval-recorded', record);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Handles approval delegation and escalation
 */
export class DelegationManager extends EventEmitter {
  private supabase: SupabaseClient;
  private activeDelegations: Map<string, DelegationRecord[]> = new Map();

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.loadActiveDelegations();
  }

  /**
   * Create a delegation record
   */
  public async delegate(
    workflowInstanceId: string,
    stageId: string,
    delegatorId: string,
    delegateeId: string,
    reason: string,
    endDate: Date
  ): Promise<string> {
    try {
      const delegation: DelegationRecord = {
        id: this.generateId(),
        delegatorId,
        delegateeId,
        workflowInstanceId,
        stageId,
        reason,
        startDate: new Date(),
        endDate,
        isActive: true
      };

      const { error } = await this.supabase
        .from('delegation_chains')
        .insert(delegation);

      if (error) throw error;

      // Update in-memory cache
      const key = `${workflowInstanceId}-${stageId}`;
      const existing = this.activeDelegations.get(key) || [];
      existing.push(delegation);
      this.activeDelegations.set(key, existing);

      this.emit('delegation-created', delegation);
      return delegation.id;
    } catch (error) {
      this.emit('error', new Error(`Failed to create delegation: ${error}`));
      throw error;
    }
  }

  /**
   * Revoke a delegation
   */
  public async revokeDelegation(delegationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('delegation_chains')
        .update({ isActive: false })
        .eq('id', delegationId);

      if (error) throw error;

      // Update in-memory cache
      for (const [key, delegations] of this.activeDelegations.entries()) {
        const updated = delegations.map(d => 
          d.id === delegationId ? { ...d, isActive: false } : d
        );
        this.activeDelegations.set(key, updated);
      }

      this.emit('delegation-revoked', { delegationId });
    } catch (error) {
      this.emit('error', new Error(`Failed to revoke delegation: ${error}`));
      throw error;
    }
  }

  /**
   * Get effective approver (considering delegations)
   */
  public getEffectiveApprover(workflowInstanceId: string, stageId: string, originalApproverId: string): string {
    const key = `${workflowInstanceId}-${stageId}`;
    const delegations = this.activeDelegations.get(key) || [];

    const activeDelegation = delegations.find(d => 
      d.delegatorId === originalApproverId && 
      d.isActive && 
      new Date() <= d.endDate
    );

    return activeDelegation ? activeDelegation.delegateeId : originalApproverId;
  }

  /**
   * Check for expired delegations and clean up
   */
  public async cleanupExpiredDelegations(): Promise<void> {
    try {
      const now = new Date();
      const { error } = await this.supabase
        .from('delegation_chains')
        .update({ isActive: false })
        .lt('endDate', now.toISOString())
        .eq('isActive', true);

      if (error) throw error;

      // Update in-memory cache
      for (const [key, delegations] of this.activeDelegations.entries()) {
        const updated = delegations.map(d => 
          d.endDate <= now ? { ...d, isActive: false } : d
        );
        this.activeDelegations.set(key, updated);
      }

      this.emit('delegations-cleaned');
    } catch (error) {
      this.emit('error', new Error(`Failed to cleanup delegations: ${error}`));
    }
  }

  private async loadActiveDelegations(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('delegation_chains')
        .select('*')
        .eq('isActive', true)
        .gt('endDate', new Date().toISOString());

      if (error) throw error;

      this.activeDelegations.clear();
      if (data) {
        for (const delegation of data) {
          const key = `${delegation.workflowInstanceId}-${delegation.stageId}`;
          const existing = this.activeDelegations.get(key) || [];
          existing.push(delegation);
          this.activeDelegations.set(key, existing);
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to load delegations: ${error}`));
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Monitors and enforces service level agreements
 */
export class SLATracker extends EventEmitter {
  private supabase: SupabaseClient;
  private activeTracking: Map<string, SLAMetrics> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.loadActiveMetrics();
  }

  /**
   * Start SLA tracking for a workflow stage
   */
  public async startTracking(workflowInstanceId: string, stageId: string, slaConfig: SLAConfig): Promise<void> {
    try {
      const key = `${workflowInstanceId}-${stageId}`;
      const metrics: SLAMetrics = {
        workflowInstanceId,
        stageId,
        startTime: new Date(),
        isBreached: false
      };

      // Store in database
      const { error } = await this.supabase
        .from('sla_metrics')
        .insert(metrics);

      if (error) throw error;

      // Store in memory
      this.activeTracking.set(key, metrics);

      // Set escalation timer
      this.setEscalationTimer(key, slaConfig);

      this.emit('tracking-started', { workflowInstanceId, stageId });
    } catch (error) {
      this.emit('error', new Error(`Failed to start SLA tracking: ${error}`));
      throw error;
    }
  }

  /**
   * Record response time
   */
  public async recordResponse(workflowInstanceId: string, stageId: string): Promise<void> {
    try {
      const key = `${workflowInstanceId}-${stageId}`;
      const metrics = this.activeTracking.get(key);

      if (!metrics) return;

      metrics.responseTime = new Date();

      // Update database
      const { error } = await this.supabase
        .from('sla_metrics')
        .update({ responseTime: metrics.responseTime })
        .eq('workflowInstanceId', workflowInstanceId)
        .eq('stageId', stageId);

      if (error) throw error;

      this.emit('response-recorded', { workflowInstanceId, stageId, responseTime: metrics.responseTime });
    } catch (error) {
      this.emit('error', new Error(`Failed to record response: ${error}`));
    }
  }

  /**
   * Record completion time
   */
  public async recordCompletion(workflowInstanceId: string, stageId: string): Promise<void> {
    try {
      const key = `${workflowInstanceId}-${stageId}`;
      const metrics = this.activeTracking.get(key);

      if (!metrics) return;

      metrics.completionTime = new Date();

      // Update database
      const { error } = await this.supabase
        .from('sla_metrics')
        .update({ completionTime: metrics.completionTime })
        .eq('workflowInstanceId', workflowInstanceId)
        .eq('stageId', stageId);

      if (error) throw error;

      // Clear timer
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }

      // Remove from active tracking
      this.activeTracking.delete(key);

      this.emit('completion-recorded', { workflowInstanceId, stageId, completionTime: metrics.completionTime });
    } catch (error) {
      this.emit('error', new Error(`Failed to record completion: ${error}`));
    }
  }

  /**
   * Mark SLA as breached
   */
  public async markBreached(workflowInstanceId: string, stageId: string, reason: string): Promise<void> {
    try {
      const key = `${workflowInstanceId}-${stageId}`;
      const metrics = this.activeTracking.get(key);

      if (metrics) {
        metrics.isBreached = true;
        metrics.breachReason = reason;
      }

      const { error } = await this.supabase
        .from('sla_metrics')
        .update({ 
          isBreached: true, 
          breachReason: reason 
        })
        .eq('workflowInstanceId', workflowInstanceId)
        .eq('stageId', stageId);

      if (error) throw error;

      this.emit('sla-breached', { workflowInstanceId, stageId, reason });
    } catch (error) {
      this.emit('error', new Error(`Failed to mark SLA breach: ${error}`));
    }
  }

  /**
   * Get SLA metrics for a workflow
   */
  public getSLAMetrics(workflowInstanceId: string, stageId: string): SLAMetrics | undefined {
    const key = `${workflowInstanceId}-${stageId}`;
    return this.activeTracking.get(key);
  }

  private setEscalationTimer(key: string, slaConfig: SLAConfig): void {
    const escalationMs = this.calculateEscalationTime(slaConfig);
    
    const timer = setTimeout(() => {
      const [workflowInstanceId, stageId] = key.split('-');
      this.handleEscalation(workflowInstanceId, stageId);
    }, escalationMs);

    this.timers.set(key, timer);
  }

  private calculateEscalationTime(slaConfig: SLAConfig): number {
    // Convert hours to milliseconds, considering business hours if specified
    let hours = slaConfig.escalationTimeHours;
    
    if (slaConfig.businessHoursOnly) {
      // Adjust for business hours (simplified calculation)
      hours = hours * (24 / 8); // Assume 8-hour business day
    }

    return hours * 60 * 60 * 1000;
  }

  private async handleEscalation(workflowInstanceId: string, stageId: string): Promise<void> {
    const key = `${workflowInstanceId}-${stageId}`;
    const metrics = this.activeTracking.get(key);

    if (metrics) {
      metrics.escalationTime = new Date();
    }

    // Update database
    await this.supabase
      .from('sla_metrics')
      .update({ escalationTime: new Date() })
      .eq('workflowInstanceId', workflowInstanceId)
      .eq('stageId', stageId);

    this.emit('escalation-triggered', { workflowInstanceId, stageId });
  }

  private async loadActiveMetrics(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('sla_metrics')
        .select('*')
        .is('completionTime', null);

      if (error) throw error;

      if (data) {
        for (const metrics of data) {
          const key = `${metrics.workflow