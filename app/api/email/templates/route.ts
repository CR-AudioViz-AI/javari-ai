// app/api/email/templates/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 4:30 PM EST

import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// BASE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

const baseTemplate = (content: string, preheader?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Javari AI</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:30px;text-align:center;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;">✨ Javari AI</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;color:#e5e5e5;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:30px;text-align:center;background-color:#0a0a0a;border-top:1px solid #333333;">
              <p style="margin:0 0 10px;color:#888888;font-size:14px;">
                CR AudioViz AI, LLC | Fort Myers, FL
              </p>
              <p style="margin:0;color:#666666;font-size:12px;">
                <a href="https://javariai.com/unsubscribe" style="color:#888888;">Unsubscribe</a> | 
                <a href="https://javariai.com/preferences" style="color:#888888;">Email Preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATES: Record<string, (data: any) => { subject: string; html: string }> = {
  
  // Welcome Email
  welcome: (data) => ({
    subject: `Welcome to Javari AI, ${data.name}! 🎉`,
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">Welcome aboard, ${data.name}!</h2>
      <p style="line-height:1.6;">
        You've just unlocked the power of AI-driven business management. Javari is ready to help you run your business smarter.
      </p>
      <p style="line-height:1.6;">
        <strong style="color:#ffffff;">Your account includes:</strong>
      </p>
      <ul style="line-height:1.8;padding-left:20px;">
        <li>50 free credits to get started</li>
        <li>Text & voice commands</li>
        <li>Business reports & analytics</li>
        <li>24/7 AI assistance</li>
      </ul>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://javariai.com/javari" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Start Using Javari →
        </a>
      </div>
      <p style="line-height:1.6;">
        Questions? Just reply to this email or ask Javari directly!
      </p>
      <p style="color:#888888;margin-top:30px;">
        – The Javari AI Team
      </p>
    `, 'Your AI business partner is ready!')
  }),
  
  // Tips Email (Day 2)
  tips: (data) => ({
    subject: '💡 Quick tip: Get more from Javari',
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">Try these powerful commands</h2>
      <p style="line-height:1.6;">
        Hi ${data.name}, here are some commands to help you get the most out of Javari:
      </p>
      <div style="background-color:#1a1a1a;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 15px;"><code style="background:#2a2a2a;padding:4px 8px;border-radius:4px;color:#a78bfa;">"Show me a revenue report"</code></p>
        <p style="margin:0 0 15px;"><code style="background:#2a2a2a;padding:4px 8px;border-radius:4px;color:#a78bfa;">"Check system health"</code></p>
        <p style="margin:0 0 15px;"><code style="background:#2a2a2a;padding:4px 8px;border-radius:4px;color:#a78bfa;">"Draft an email about [topic]"</code></p>
        <p style="margin:0;"><code style="background:#2a2a2a;padding:4px 8px;border-radius:4px;color:#a78bfa;">"Create a 20% discount code"</code></p>
      </div>
      <p style="line-height:1.6;">
        <strong style="color:#ffffff;">Pro tip:</strong> Use voice commands for hands-free operation!
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://javariai.com/command" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Try It Now →
        </a>
      </div>
    `, 'Unlock these powerful commands...')
  }),
  
  // Credits Reminder (Day 5)
  credits_reminder: (data) => ({
    subject: `⚡ ${data.credits || 50} credits waiting for you`,
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">Your credits are ready!</h2>
      <p style="line-height:1.6;">
        Hi ${data.name}, you still have <strong style="color:#22c55e;">${data.credits || 50} credits</strong> available in your account.
      </p>
      <p style="line-height:1.6;">
        Each command uses 1-5 credits, so you've got plenty to explore everything Javari can do!
      </p>
      <div style="background-color:#1a1a1a;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="font-size:48px;margin:0;color:#22c55e;font-weight:bold;">${data.credits || 50}</p>
        <p style="margin:5px 0 0;color:#888888;">credits available</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://javariai.com/javari" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Use Your Credits →
        </a>
      </div>
    `, 'Your credits are waiting!')
  }),
  
  // Showcase (Day 7)
  showcase: (data) => ({
    subject: '🎨 See what others are creating with Javari',
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">Inspiration from our community</h2>
      <p style="line-height:1.6;">
        Hi ${data.name}, see how other entrepreneurs are using Javari to run their businesses:
      </p>
      <div style="background-color:#1a1a1a;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="color:#a78bfa;font-weight:bold;margin:0 0 10px;">🏢 Sarah, E-commerce</p>
        <p style="margin:0;line-height:1.6;">"Javari generates my weekly reports automatically. I save 3 hours every Monday!"</p>
      </div>
      <div style="background-color:#1a1a1a;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="color:#a78bfa;font-weight:bold;margin:0 0 10px;">📱 Mike, SaaS Founder</p>
        <p style="margin:0;line-height:1.6;">"Voice commands changed everything. I manage my business while commuting."</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://javariai.com/javari" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Start Creating →
        </a>
      </div>
    `, 'Get inspired by our community')
  }),
  
  // Upgrade Offer (Day 14)
  upgrade_offer: (data) => ({
    subject: '🎁 20% off Pro – Just for you',
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">Ready for unlimited power?</h2>
      <p style="line-height:1.6;">
        Hi ${data.name}, you've been crushing it with Javari! Ready to take it to the next level?
      </p>
      <div style="background:linear-gradient(135deg,#7c3aed20 0%,#2563eb20 100%);border:1px solid #7c3aed40;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="color:#a78bfa;margin:0 0 15px;">🚀 Pro Plan Includes:</h3>
        <ul style="margin:0;padding-left:20px;line-height:1.8;">
          <li>2,000 credits/month (never expire!)</li>
          <li>Voice & video commands</li>
          <li>Scheduled automation</li>
          <li>Priority support</li>
          <li>API access</li>
        </ul>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <p style="font-size:24px;margin:0 0 5px;"><s style="color:#666;">$29/mo</s> <span style="color:#22c55e;font-weight:bold;">$23/mo</span></p>
        <p style="color:#888888;margin:0 0 20px;">Use code: <strong style="color:#a78bfa;">UPGRADE20</strong></p>
        <a href="https://javariai.com/pricing?code=UPGRADE20" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Claim 20% Off →
        </a>
      </div>
      <p style="color:#888888;font-size:12px;text-align:center;">
        Offer expires in 48 hours
      </p>
    `, 'Exclusive 20% off for you!')
  }),
  
  // Trial Ending (3 days)
  trial_ending_3: (data) => ({
    subject: '⏰ Your trial ends in 3 days',
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">Don't lose your progress!</h2>
      <p style="line-height:1.6;">
        Hi ${data.name}, your Javari trial ends in <strong style="color:#f59e0b;">3 days</strong>.
      </p>
      <p style="line-height:1.6;">
        Upgrade now to keep all your settings, scheduled tasks, and workflows running smoothly.
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://javariai.com/pricing" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Keep My Account →
        </a>
      </div>
    `, 'Your trial ends soon!')
  }),
  
  // Win Back (7 days inactive)
  win_back_1: (data) => ({
    subject: '👋 We miss you!',
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">It's been a while!</h2>
      <p style="line-height:1.6;">
        Hi ${data.name}, we noticed you haven't logged in recently. Here's what's new:
      </p>
      <ul style="line-height:1.8;padding-left:20px;">
        <li>New voice command improvements</li>
        <li>Faster AI responses</li>
        <li>More business report options</li>
      </ul>
      <p style="line-height:1.6;">
        Your account and credits are still waiting for you!
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://javariai.com/javari" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Welcome Back →
        </a>
      </div>
    `, 'We have updates for you!')
  }),
  
  // New Subscriber Alert (internal)
  new_subscriber_alert: (data) => ({
    subject: `🎉 New subscriber: ${data.email}`,
    html: baseTemplate(`
      <h2 style="color:#22c55e;margin:0 0 20px;">New Paid Subscriber!</h2>
      <div style="background-color:#1a1a1a;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 10px;"><strong>Email:</strong> ${data.email}</p>
        <p style="margin:0 0 10px;"><strong>Plan:</strong> ${data.plan}</p>
        <p style="margin:0 0 10px;"><strong>Amount:</strong> $${data.amount}/mo</p>
        <p style="margin:0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p style="color:#22c55e;font-size:24px;text-align:center;font-weight:bold;">
        💰 MRR: $${data.mrr || 0}
      </p>
    `)
  }),
  
  // Support Ticket Auto-Response
  support_response: (data) => ({
    subject: `Re: ${data.subject} [Ticket #${data.ticketId}]`,
    html: baseTemplate(`
      <h2 style="color:#ffffff;margin:0 0 20px;">We got your message!</h2>
      <p style="line-height:1.6;">
        Hi ${data.name || 'there'},
      </p>
      <p style="line-height:1.6;">${data.autoResponse}</p>
      <div style="background-color:#1a1a1a;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0;color:#888888;font-size:12px;">
          <strong>Ticket ID:</strong> #${data.ticketId}<br>
          <strong>Category:</strong> ${data.category}<br>
          <strong>Priority:</strong> ${data.priority}
        </p>
      </div>
      <p style="line-height:1.6;">
        If this doesn't answer your question, just reply to this email!
      </p>
    `, 'Your support request has been received')
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template, data } = body
    
    if (!TEMPLATES[template]) {
      return NextResponse.json({ 
        error: 'Template not found',
        available: Object.keys(TEMPLATES)
      }, { status: 404 })
    }
    
    const result = TEMPLATES[template](data || {})
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Template error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Javari Email Templates',
    version: '1.0.0',
    templates: Object.keys(TEMPLATES),
    usage: 'POST { template: "welcome", data: { name: "John" } }'
  })
}
