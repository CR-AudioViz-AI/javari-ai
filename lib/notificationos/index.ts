// ============================================================================
// NOTIFICATIONOS SERVICE LAYER
// ============================================================================
// Description: Core notification service with email delivery
// Version: 1.0.0
// Created: 2026-01-29
// Repository: CR-AudioViz-AI/javari-ai
// Path: lib/notificationos/index.ts
// ============================================================================

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = 'email' | 'system' | 'alert' | 'info' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type NotificationChannel = 'email' | 'in_app' | 'sms' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  subject: string;
  body: string;
  html_body?: string;
  channel: NotificationChannel;
  template_id?: string;
  status: NotificationStatus;
  read_at?: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  delivery_attempts: number;
  max_attempts: number;
  next_retry_at?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  dedup_key?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface NotificationTemplate {
  id: string;
  template_key: string;
  name: string;
  description?: string;
  subject_template: string;
  body_template: string;
  html_template?: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  variables?: string[];
  metadata?: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  priority?: NotificationPriority;
  subject: string;
  body: string;
  html_body?: string;
  channel?: NotificationChannel;
  template_id?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  dedup_key?: string;
  send_immediately?: boolean;
}

export interface SendFromTemplateInput {
  user_id: string;
  template_key: string;
  variables: Record<string, string>;
  metadata?: Record<string, any>;
  send_immediately?: boolean;
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export class NotificationService {
  /**
   * Create a new notification
   */
  static async create(input: CreateNotificationInput): Promise<Notification | null> {
    const supabase = createClient();

    // Check for duplicate if dedup_key provided
    if (input.dedup_key) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', input.user_id)
        .eq('dedup_key', input.dedup_key)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .single();

      if (existing) {
        console.log(`Notification deduplicated: ${input.dedup_key}`);
        return null;
      }
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: input.user_id,
        type: input.type,
        priority: input.priority || 'normal',
        subject: input.subject,
        body: input.body,
        html_body: input.html_body,
        channel: input.channel || 'email',
        template_id: input.template_id,
        metadata: input.metadata || {},
        tags: input.tags || [],
        dedup_key: input.dedup_key,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    // Send immediately if requested
    if (input.send_immediately && data) {
      await this.send(data.id);
    }

    return data as Notification;
  }

  /**
   * Send a notification from a template
   */
  static async sendFromTemplate(input: SendFromTemplateInput): Promise<Notification | null> {
    const supabase = createClient();

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('template_key', input.template_key)
      .eq('active', true)
      .single();

    if (templateError || !template) {
      console.error('Template not found:', input.template_key);
      return null;
    }

    // Substitute variables
    const subject = this.substituteVariables(template.subject_template, input.variables);
    const body = this.substituteVariables(template.body_template, input.variables);
    const html_body = template.html_template
      ? this.substituteVariables(template.html_template, input.variables)
      : undefined;

    // Create notification
    return this.create({
      user_id: input.user_id,
      type: 'system',
      priority: template.priority as NotificationPriority,
      subject,
      body,
      html_body,
      channel: template.channel as NotificationChannel,
      template_id: template.id,
      metadata: input.metadata,
      send_immediately: input.send_immediately,
    });
  }

  /**
   * Send a notification (triggers delivery)
   */
  static async send(notificationId: string): Promise<boolean> {
    const supabase = createClient();

    // Get notification
    const { data: notification } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (!notification) {
      console.error('Notification not found:', notificationId);
      return false;
    }

    // Check delivery attempts
    if (notification.delivery_attempts >= notification.max_attempts) {
      console.error('Max delivery attempts reached:', notificationId);
      return false;
    }

    // Deliver based on channel
    let success = false;
    let error_message = '';

    try {
      if (notification.channel === 'email') {
        success = await this.sendEmail(notification);
      } else if (notification.channel === 'in_app') {
        // In-app notifications are just stored, mark as sent
        success = true;
      } else {
        error_message = `Channel not supported in Phase 1: ${notification.channel}`;
      }
    } catch (error: any) {
      error_message = error.message || 'Unknown error';
      success = false;
    }

    // Update notification status
    const updates: Partial<Notification> = {
      delivery_attempts: notification.delivery_attempts + 1,
    };

    if (success) {
      updates.status = notification.channel === 'email' ? 'sent' : 'delivered';
      updates.sent_at = new Date().toISOString();
      if (notification.channel === 'in_app') {
        updates.delivered_at = new Date().toISOString();
      }
    } else {
      updates.status = 'failed';
      updates.failed_at = new Date().toISOString();
      updates.failure_reason = error_message;

      // Schedule retry if not at max attempts
      if (notification.delivery_attempts + 1 < notification.max_attempts) {
        const retryDelay = Math.pow(2, notification.delivery_attempts) * 60 * 1000; // Exponential backoff
        updates.next_retry_at = new Date(Date.now() + retryDelay).toISOString();
      }
    }

    await supabase
      .from('notifications')
      .update(updates)
      .eq('id', notificationId);

    // Log delivery attempt
    await supabase
      .from('notification_delivery_log')
      .insert({
        notification_id: notificationId,
        attempt_number: notification.delivery_attempts + 1,
        channel: notification.channel,
        status: success ? 'success' : 'failed',
        error_message: error_message || undefined,
        attempted_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

    return success;
  }

  /**
   * Send email notification
   */
  private static async sendEmail(notification: Notification): Promise<boolean> {
    // Get user email
    const supabase = createClient();
    const { data: user } = await supabase.auth.admin.getUserById(notification.user_id);

    if (!user?.user?.email) {
      throw new Error('User email not found');
    }

    // Check for email provider configuration
    const provider = process.env.EMAIL_PROVIDER || 'console'; // 'console', 'smtp', 'resend', 'sendgrid'

    if (provider === 'console') {
      // Development mode: log to console
      console.log('='.repeat(80));
      console.log('EMAIL NOTIFICATION (Console Mode)');
      console.log('='.repeat(80));
      console.log(`To: ${user.user.email}`);
      console.log(`Subject: ${notification.subject}`);
      console.log(`Priority: ${notification.priority}`);
      console.log('-'.repeat(80));
      console.log(notification.body);
      console.log('='.repeat(80));
      return true;
    }

    // TODO: Implement actual email providers
    // if (provider === 'resend') { ... }
    // if (provider === 'sendgrid') { ... }
    // if (provider === 'smtp') { ... }

    throw new Error(`Email provider not configured: ${provider}`);
  }

  /**
   * Substitute variables in template
   */
  private static substituteVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return variables[key.trim()] || match;
    });
  }

  /**
   * List notifications for user
   */
  static async list(userId: string, options?: {
    status?: NotificationStatus;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    const supabase = createClient();

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing notifications:', error);
      return [];
    }

    return (data as Notification[]) || [];
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Mark all notifications as read for user
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .is('read_at', null);

    return !error;
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const supabase = createClient();

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Process retry queue (should be called by cron/background job)
   */
  static async processRetryQueue(): Promise<number> {
    const supabase = createClient();

    // Get notifications ready for retry
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('status', 'failed')
      .not('next_retry_at', 'is', null)
      .lte('next_retry_at', new Date().toISOString())
      .lt('delivery_attempts', 'max_attempts');

    if (!notifications || notifications.length === 0) {
      return 0;
    }

    // Process retries
    let processed = 0;
    for (const notification of notifications) {
      const success = await this.send(notification.id);
      if (success) processed++;
    }

    return processed;
  }
}
