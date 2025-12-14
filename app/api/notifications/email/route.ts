// app/api/notifications/email/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 6:55 PM EST
// Version: 1.0 - CRITICAL ALERTS & NOTIFICATIONS
//
// Capabilities:
// - Send critical alerts to Roy/team
// - Daily/weekly digest emails
// - Deployment status notifications
// - Self-healing reports
// - Custom notification triggers
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: 'javari@craudiovizai.com',
    fromName: 'Javari AI'
  },
  defaultRecipients: [
    { email: 'royhenderson@craudiovizai.com', name: 'Roy Henderson' },
    { email: 'cindyhenderson@craudiovizai.com', name: 'Cindy Henderson' }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATES = {
  critical_alert: (data: any) => ({
    subject: `🚨 CRITICAL: ${data.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
          .btn { display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🚨 Critical Alert</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${data.title}</p>
          </div>
          <div class="content">
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
            <p><strong>Severity:</strong> ${data.severity || 'Critical'}</p>
            <p><strong>Details:</strong></p>
            <p>${data.message}</p>
            ${data.action ? `<p><a href="${data.action.url}" class="btn">${data.action.label}</a></p>` : ''}
            ${data.metadata ? `<p><strong>Additional Info:</strong></p><pre style="background: #e5e7eb; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(data.metadata, null, 2)}</pre>` : ''}
          </div>
          <div class="footer">
            <p>This alert was sent by Javari AI - CR AudioViz AI Autonomous System</p>
            <p>To adjust notification settings, visit the admin dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `CRITICAL ALERT: ${data.title}\n\nTime: ${new Date().toISOString()}\nSeverity: ${data.severity || 'Critical'}\n\n${data.message}\n\n${data.metadata ? JSON.stringify(data.metadata, null, 2) : ''}`
  }),

  deployment_status: (data: any) => ({
    subject: data.success 
      ? `✅ Deployment Successful: ${data.project}`
      : `❌ Deployment Failed: ${data.project}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${data.success ? '#10b981' : '#ef4444'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
          .btn { display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${data.success ? '✅' : '❌'} Deployment ${data.success ? 'Successful' : 'Failed'}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${data.project}</p>
          </div>
          <div class="content">
            <p><strong>Project:</strong> ${data.project}</p>
            <p><strong>URL:</strong> <a href="${data.url}">${data.url}</a></p>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
            ${!data.success ? `
              <p><strong>Error:</strong></p>
              <pre style="background: #fef2f2; color: #991b1b; padding: 10px; border-radius: 4px;">${data.error || 'Unknown error'}</pre>
              ${data.healingTriggered ? '<p>✨ <strong>Self-healing has been triggered automatically.</strong></p>' : ''}
            ` : ''}
            <p><a href="${data.vercelUrl || 'https://vercel.com'}" class="btn">View in Vercel</a></p>
          </div>
          <div class="footer">
            <p>Deployment notification from Javari AI</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Deployment ${data.success ? 'Successful' : 'Failed'}: ${data.project}\nURL: ${data.url}\nTime: ${new Date().toISOString()}`
  }),

  daily_digest: (data: any) => ({
    subject: `📊 Javari Daily Report - ${data.date}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
          .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📊 Daily Report</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${data.date}</p>
          </div>
          <div class="content">
            <h2>Platform Health: ${data.healthScore}/100</h2>
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-value">${data.conversations}</div>
                <div class="stat-label">Conversations</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.requests}</div>
                <div class="stat-label">API Requests</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.tokens}</div>
                <div class="stat-label">Tokens Used</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.errorRate}%</div>
                <div class="stat-label">Error Rate</div>
              </div>
            </div>
            ${data.suggestions?.length > 0 ? `
              <h3>Suggestions</h3>
              <ul>
                ${data.suggestions.map((s: any) => `<li><strong>${s.priority}:</strong> ${s.title}</li>`).join('')}
              </ul>
            ` : ''}
            ${data.healingActions?.length > 0 ? `
              <h3>Self-Healing Actions</h3>
              <ul>
                ${data.healingActions.map((a: any) => `<li>${a.project}: ${a.status}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
          <div class="footer">
            <p>Daily digest from Javari AI - CR AudioViz AI</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Javari Daily Report - ${data.date}\n\nHealth Score: ${data.healthScore}/100\nConversations: ${data.conversations}\nRequests: ${data.requests}\nTokens: ${data.tokens}\nError Rate: ${data.errorRate}%`
  }),

  self_healing_report: (data: any) => ({
    subject: `🔧 Self-Healing Report: ${data.healed}/${data.total} Fixed`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0891b2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
          .result { padding: 10px; margin: 10px 0; border-radius: 4px; }
          .healed { background: #d1fae5; border-left: 4px solid #10b981; }
          .failed { background: #fee2e2; border-left: 4px solid #ef4444; }
          .manual { background: #fef3c7; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔧 Self-Healing Report</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${data.healed}/${data.total} Issues Automatically Fixed</p>
          </div>
          <div class="content">
            <p><strong>Scan Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
            <p><strong>Duration:</strong> ${data.duration}ms</p>
            
            ${data.results?.map((r: any) => `
              <div class="result ${r.status}">
                <strong>${r.project}</strong>
                <p>Status: ${r.status}</p>
                ${r.fixCommit ? `<p>Fix: <code>${r.fixCommit.slice(0, 7)}</code></p>` : ''}
                ${r.error ? `<p>Error: ${r.error}</p>` : ''}
              </div>
            `).join('') || '<p>No issues found.</p>'}
          </div>
          <div class="footer">
            <p>Self-healing report from Javari AI</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Self-Healing Report\n\n${data.healed}/${data.total} Fixed\nDuration: ${data.duration}ms`
  })
};

// ═══════════════════════════════════════════════════════════════════════════════
// SENDGRID API
// ═══════════════════════════════════════════════════════════════════════════════

async function sendEmail(
  to: { email: string; name?: string }[],
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  if (!CONFIG.sendgrid.apiKey) {
    console.log('[Email] SendGrid not configured, logging email:');
    console.log(`To: ${to.map(t => t.email).join(', ')}`);
    console.log(`Subject: ${subject}`);
    return false;
  }
  
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.sendgrid.apiKey}`
    },
    body: JSON.stringify({
      personalizations: [{
        to: to.map(t => ({ email: t.email, name: t.name }))
      }],
      from: {
        email: CONFIG.sendgrid.fromEmail,
        name: CONFIG.sendgrid.fromName
      },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  });
  
  return response.ok;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendNotification(
  type: keyof typeof TEMPLATES,
  data: any,
  recipients?: { email: string; name?: string }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const template = TEMPLATES[type](data);
    const to = recipients || CONFIG.defaultRecipients;
    
    const success = await sendEmail(to, template.subject, template.html, template.text);
    
    // Log notification
    await supabase.from('email_notifications').insert({
      type,
      recipients: to.map(t => t.email),
      subject: template.subject,
      success,
      created_at: new Date().toISOString()
    }).catch(() => {});
    
    return { success };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, recipients } = body;
    
    if (!type || !TEMPLATES[type as keyof typeof TEMPLATES]) {
      return NextResponse.json({
        success: false,
        error: `Unknown notification type: ${type}`,
        availableTypes: Object.keys(TEMPLATES)
      }, { status: 400 });
    }
    
    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'Data is required'
      }, { status: 400 });
    }
    
    const result = await sendNotification(
      type as keyof typeof TEMPLATES,
      data,
      recipients
    );
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Email] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  const isConfigured = !!CONFIG.sendgrid.apiKey;
  
  // Get recent notifications
  const { data: recent } = await supabase
    .from('email_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  return NextResponse.json({
    status: isConfigured ? 'ok' : 'not_configured',
    name: 'Javari Email Notifications',
    version: '1.0',
    provider: 'SendGrid',
    configured: isConfigured,
    templates: Object.keys(TEMPLATES).map(key => ({
      type: key,
      description: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    })),
    defaultRecipients: CONFIG.defaultRecipients.map(r => r.email),
    recentNotifications: recent || [],
    usage: {
      method: 'POST',
      body: {
        type: 'critical_alert | deployment_status | daily_digest | self_healing_report',
        data: 'Template-specific data object',
        recipients: 'Optional array of { email, name }'
      }
    },
    timestamp: new Date().toISOString()
  });
}
