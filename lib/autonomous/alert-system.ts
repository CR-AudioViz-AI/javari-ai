/**
 * JAVARI AI - ALERT NOTIFICATION SYSTEM
 * 
 * Sends alerts via multiple channels:
 * - Slack webhooks
 * - Email (via Resend)
 * - Database logging
 * - Push notifications (future)
 * 
 * Created: January 3, 2026
 */

import { createClient } from '@supabase/supabase-js';

interface AlertPayload {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source: string;
  projectId?: string;
  projectName?: string;
  metadata?: Record<string, any>;
}

interface AlertResult {
  alertId: string;
  channels: {
    slack: boolean;
    email: boolean;
    database: boolean;
  };
  timestamp: string;
}

export class AlertSystem {
  private slackWebhookUrl?: string;
  private resendApiKey?: string;
  private supabaseUrl: string;
  private supabaseKey: string;
  private alertEmail: string;

  constructor(config: {
    slackWebhookUrl?: string;
    resendApiKey?: string;
    supabaseUrl: string;
    supabaseKey: string;
    alertEmail?: string;
  }) {
    this.slackWebhookUrl = config.slackWebhookUrl;
    this.resendApiKey = config.resendApiKey;
    this.supabaseUrl = config.supabaseUrl;
    this.supabaseKey = config.supabaseKey;
    this.alertEmail = config.alertEmail || 'royhenderson@craudiovizai.com';
  }

  /**
   * Send alert to all configured channels
   */
  async sendAlert(alert: AlertPayload): Promise<AlertResult> {
    const alertId = `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const results = {
      slack: false,
      email: false,
      database: false,
    };

    // Always log to database first
    try {
      await this.logToDatabase(alertId, alert, timestamp);
      results.database = true;
    } catch (error) {
      console.error('Failed to log alert to database:', error);
    }

    // Send to Slack for critical and warning
    if (this.slackWebhookUrl && alert.severity !== 'info') {
      try {
        await this.sendSlackAlert(alert);
        results.slack = true;
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }

    // Send email for critical only
    if (this.resendApiKey && alert.severity === 'critical') {
      try {
        await this.sendEmailAlert(alert, alertId);
        results.email = true;
      } catch (error) {
        console.error('Failed to send email alert:', error);
      }
    }

    return {
      alertId,
      channels: results,
      timestamp,
    };
  }

  /**
   * Log alert to Supabase database
   */
  private async logToDatabase(
    alertId: string,
    alert: AlertPayload,
    timestamp: string
  ): Promise<void> {
    const supabase = createClient(this.supabaseUrl, this.supabaseKey);

    await supabase.from('javari_alerts').insert({
      alert_id: alertId,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      source: alert.source,
      project_id: alert.projectId,
      project_name: alert.projectName,
      metadata: alert.metadata,
      created_at: timestamp,
      acknowledged: false,
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackAlert(alert: AlertPayload): Promise<void> {
    if (!this.slackWebhookUrl) return;

    const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
    const color = alert.severity === 'critical' ? '#FF0000' : '#FFA500';

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} ${alert.title}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: alert.message,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Source:* ${alert.source} | *Severity:* ${alert.severity.toUpperCase()}`,
                },
              ],
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Time:* ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`,
                },
              ],
            },
          ],
        },
      ],
    };

    await fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send email notification via Resend
   */
  private async sendEmailAlert(
    alert: AlertPayload,
    alertId: string
  ): Promise<void> {
    if (!this.resendApiKey) return;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Javari AI <alerts@javariai.com>',
        to: [this.alertEmail],
        subject: `🚨 CRITICAL: ${alert.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #FF0000; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🚨 CRITICAL ALERT</h1>
            </div>
            <div style="padding: 20px; background: #f5f5f5;">
              <h2 style="color: #333;">${alert.title}</h2>
              <p style="color: #666; font-size: 16px;">${alert.message}</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="color: #888;">Alert ID:</td>
                  <td>${alertId}</td>
                </tr>
                <tr>
                  <td style="color: #888;">Source:</td>
                  <td>${alert.source}</td>
                </tr>
                <tr>
                  <td style="color: #888;">Project:</td>
                  <td>${alert.projectName || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="color: #888;">Time:</td>
                  <td>${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</td>
                </tr>
              </table>
            </div>
            <div style="padding: 10px; text-align: center; color: #888; font-size: 12px;">
              Javari AI Autonomous Monitoring System
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email send failed: ${response.status}`);
    }
  }

  /**
   * Quick helpers for common alert types
   */
  async deploymentFailed(projectName: string, deploymentId: string, error: string): Promise<AlertResult> {
    return this.sendAlert({
      severity: 'critical',
      title: `Deployment Failed: ${projectName}`,
      message: `Deployment ${deploymentId} failed.\n\nError: ${error}`,
      source: 'deployment-monitor',
      projectName,
      metadata: { deploymentId, error },
    });
  }

  async healthCheckFailed(projectName: string, endpoint: string): Promise<AlertResult> {
    return this.sendAlert({
      severity: 'critical',
      title: `Health Check Failed: ${projectName}`,
      message: `The health endpoint at ${endpoint} is not responding.`,
      source: 'health-monitor',
      projectName,
      metadata: { endpoint },
    });
  }

  async autoFixApplied(projectName: string, issue: string, fix: string): Promise<AlertResult> {
    return this.sendAlert({
      severity: 'info',
      title: `Auto-Fix Applied: ${projectName}`,
      message: `Issue: ${issue}\n\nFix: ${fix}`,
      source: 'self-healing',
      projectName,
      metadata: { issue, fix },
    });
  }

  async rollbackPerformed(projectName: string, fromDeployment: string, toDeployment: string): Promise<AlertResult> {
    return this.sendAlert({
      severity: 'warning',
      title: `Rollback Performed: ${projectName}`,
      message: `Rolled back from ${fromDeployment} to ${toDeployment} due to deployment failure.`,
      source: 'auto-rollback',
      projectName,
      metadata: { fromDeployment, toDeployment },
    });
  }
}

export default AlertSystem;
