// app/api/webhooks/github/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - GITHUB WEBHOOK LISTENER
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 12:22 PM EST
// Version: 1.0 - INSTANT RESPONSE TO GITHUB EVENTS
//
// Supported Events:
// - push: Analyze changes, suggest improvements
// - pull_request: Review code, suggest fixes
// - issues: Triage, suggest solutions
// - workflow_run: Monitor CI/CD, auto-fix failures
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK SIGNATURE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true; // Skip verification if no secret configured
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handlePush(payload: any): Promise<{ action: string; details: any }> {
  const { repository, commits, ref, pusher } = payload;
  
  // Log the push
  await supabase.from('github_events').insert({
    event_type: 'push',
    repository: repository.full_name,
    ref,
    commits_count: commits?.length || 0,
    pusher: pusher?.name,
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  // Analyze commits for potential issues
  const commitMessages = commits?.map((c: any) => c.message).join('\n') || '';
  const hasHotfix = /hotfix|urgent|critical|fix:/i.test(commitMessages);
  const hasBreakingChange = /breaking|major:/i.test(commitMessages);
  
  // If this is a hotfix or breaking change, create a suggestion
  if (hasHotfix || hasBreakingChange) {
    await supabase.from('proactive_suggestions').insert({
      suggestion_id: `github_push_${Date.now()}`,
      type: hasBreakingChange ? 'warning' : 'action',
      priority: hasBreakingChange ? 'high' : 'medium',
      title: hasBreakingChange ? 'Breaking Change Detected' : 'Hotfix Pushed',
      description: `${pusher?.name} pushed ${commits?.length || 0} commits to ${ref} in ${repository.name}`,
      metadata: {
        repository: repository.full_name,
        ref,
        commits: commits?.map((c: any) => ({ sha: c.id?.slice(0, 7), message: c.message?.slice(0, 100) }))
      },
      created_at: new Date().toISOString()
    });
  }
  
  return {
    action: 'push_logged',
    details: {
      repository: repository.full_name,
      commits: commits?.length || 0,
      ref,
      flagged: hasHotfix || hasBreakingChange
    }
  };
}

async function handlePullRequest(payload: any): Promise<{ action: string; details: any }> {
  const { action, pull_request, repository } = payload;
  
  // Log the PR event
  await supabase.from('github_events').insert({
    event_type: 'pull_request',
    repository: repository.full_name,
    action,
    pr_number: pull_request.number,
    pr_title: pull_request.title,
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  // For opened PRs, we could auto-review
  if (action === 'opened' || action === 'synchronize') {
    // Create a suggestion to review this PR
    await supabase.from('proactive_suggestions').insert({
      suggestion_id: `github_pr_${Date.now()}`,
      type: 'action',
      priority: 'medium',
      title: `New PR: ${pull_request.title}`,
      description: `PR #${pull_request.number} in ${repository.name} needs review`,
      metadata: {
        repository: repository.full_name,
        prNumber: pull_request.number,
        prUrl: pull_request.html_url,
        author: pull_request.user?.login,
        additions: pull_request.additions,
        deletions: pull_request.deletions
      },
      created_at: new Date().toISOString()
    });
  }
  
  return {
    action: `pr_${action}`,
    details: {
      repository: repository.full_name,
      prNumber: pull_request.number,
      title: pull_request.title
    }
  };
}

async function handleWorkflowRun(payload: any): Promise<{ action: string; details: any }> {
  const { action, workflow_run, repository } = payload;
  
  // Log workflow event
  await supabase.from('github_events').insert({
    event_type: 'workflow_run',
    repository: repository.full_name,
    action,
    workflow_name: workflow_run.name,
    workflow_status: workflow_run.status,
    workflow_conclusion: workflow_run.conclusion,
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  // If workflow failed, trigger self-healing analysis
  if (action === 'completed' && workflow_run.conclusion === 'failure') {
    await supabase.from('proactive_suggestions').insert({
      suggestion_id: `github_workflow_${Date.now()}`,
      type: 'warning',
      priority: 'high',
      title: `Workflow Failed: ${workflow_run.name}`,
      description: `CI/CD workflow failed in ${repository.name}`,
      metadata: {
        repository: repository.full_name,
        workflowName: workflow_run.name,
        runUrl: workflow_run.html_url,
        branch: workflow_run.head_branch,
        commit: workflow_run.head_sha?.slice(0, 7)
      },
      created_at: new Date().toISOString()
    });
    
    // Optionally trigger self-healing
    // await fetch('/api/autonomous/heal', { method: 'POST', body: JSON.stringify({ mode: 'auto' }) });
  }
  
  return {
    action: `workflow_${action}`,
    details: {
      repository: repository.full_name,
      workflow: workflow_run.name,
      status: workflow_run.status,
      conclusion: workflow_run.conclusion
    }
  };
}

async function handleIssue(payload: any): Promise<{ action: string; details: any }> {
  const { action, issue, repository } = payload;
  
  // Log issue event
  await supabase.from('github_events').insert({
    event_type: 'issues',
    repository: repository.full_name,
    action,
    issue_number: issue.number,
    issue_title: issue.title,
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  // For new issues, analyze and suggest triage
  if (action === 'opened') {
    // Detect issue type from title/body
    const issueText = `${issue.title} ${issue.body || ''}`.toLowerCase();
    let issueType = 'general';
    let priority = 'medium';
    
    if (/bug|error|crash|broken|not working/i.test(issueText)) {
      issueType = 'bug';
      priority = 'high';
    } else if (/feature|request|enhancement|would be nice/i.test(issueText)) {
      issueType = 'feature';
      priority = 'low';
    } else if (/question|how to|help/i.test(issueText)) {
      issueType = 'question';
      priority = 'low';
    }
    
    await supabase.from('proactive_suggestions').insert({
      suggestion_id: `github_issue_${Date.now()}`,
      type: issueType === 'bug' ? 'warning' : 'action',
      priority,
      title: `New Issue: ${issue.title}`,
      description: `Issue #${issue.number} opened in ${repository.name}. Detected type: ${issueType}`,
      metadata: {
        repository: repository.full_name,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        author: issue.user?.login,
        detectedType: issueType,
        labels: issue.labels?.map((l: any) => l.name)
      },
      created_at: new Date().toISOString()
    });
  }
  
  return {
    action: `issue_${action}`,
    details: {
      repository: repository.full_name,
      issueNumber: issue.number,
      title: issue.title
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get event type from header
    const eventType = request.headers.get('x-github-event');
    const signature = request.headers.get('x-hub-signature-256') || '';
    
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && !verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Parse payload
    const payload = JSON.parse(rawBody);
    
    console.log(`[GitHub Webhook] Received ${eventType} event`);
    
    let result: { action: string; details: any };
    
    switch (eventType) {
      case 'push':
        result = await handlePush(payload);
        break;
      case 'pull_request':
        result = await handlePullRequest(payload);
        break;
      case 'workflow_run':
        result = await handleWorkflowRun(payload);
        break;
      case 'issues':
        result = await handleIssue(payload);
        break;
      case 'ping':
        result = { action: 'ping_received', details: { zen: payload.zen } };
        break;
      default:
        result = { action: 'unhandled_event', details: { eventType } };
    }
    
    return NextResponse.json({
      success: true,
      event: eventType,
      ...result,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('[GitHub Webhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Get recent webhook events
  const { data: recentEvents } = await supabase
    .from('github_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari GitHub Webhook',
    version: '1.0',
    supportedEvents: ['push', 'pull_request', 'workflow_run', 'issues', 'ping'],
    recentEvents: recentEvents || [],
    setup: {
      webhookUrl: 'https://javariai.com/api/webhooks/github',
      contentType: 'application/json',
      secret: 'Set GITHUB_WEBHOOK_SECRET env var',
      events: ['Push', 'Pull requests', 'Issues', 'Workflow runs']
    },
    timestamp: new Date().toISOString()
  });
}
