// app/api/notifications/user-email/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - USER EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 1:17 PM EST
// Henderson Standard - User-facing transactional emails
//
// Capabilities:
// - Welcome email on signup
// - Low credits warning
// - Purchase receipts
// - Subscription confirmations
// - Password reset
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESEND CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'Javari AI <javari@craudiovizai.com>';
const SUPPORT_EMAIL = 'support@craudiovizai.com';

// ═══════════════════════════════════════════════════════════════════════════════
// BASE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

const baseTemplate = (content: string, preheader: string = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Javari AI</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-wrapper {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .footer {
      background: #1f2937;
      color: #9ca3af;
      padding: 20px 30px;
      text-align: center;
      font-size: 13px;
    }
    .footer a {
      color: #a5b4fc;
      text-decoration: none;
    }
    .highlight-box {
      background: #f0f9ff;
      border-left: 4px solid #6366f1;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .credit-box {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    .credit-amount {
      font-size: 36px;
      font-weight: 700;
      color: #92400e;
    }
    .social-links {
      margin-top: 15px;
    }
    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #9ca3af;
    }
    .preheader {
      display: none;
      max-width: 0;
      max-height: 0;
      overflow: hidden;
      font-size: 1px;
      line-height: 1px;
      color: #fff;
      opacity: 0;
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="container">
    <div class="email-wrapper">
      ${content}
      <div class="footer">
        <p>© ${new Date().getFullYear()} CR AudioViz AI, LLC. All rights reserved.</p>
        <p>"Your Story. Our Design."</p>
        <div class="social-links">
          <a href="https://twitter.com/CRAudioVizAI">Twitter</a> •
          <a href="https://discord.gg/javari">Discord</a> •
          <a href="https://youtube.com/@CRAudioVizAI">YouTube</a>
        </div>
        <p style="margin-top: 15px; font-size: 11px;">
          You received this email because you have an account at Javari AI.<br>
          <a href="https://javariai.com/settings/notifications">Manage email preferences</a> •
          <a href="mailto:${SUPPORT_EMAIL}">Contact Support</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const USER_TEMPLATES = {
  welcome: (data: { name: string; credits: number }) => ({
    subject: `Welcome to Javari AI, ${data.name}! 🎉`,
    html: baseTemplate(`
      <div class="header">
        <h1>Welcome to Javari AI! 🎉</h1>
        <p>Your AI-powered creative journey starts now</p>
      </div>
      <div class="content">
        <p>Hi ${data.name},</p>
        <p>I'm <strong>Javari</strong>, your personal AI assistant! I'm thrilled to have you join our creative community.</p>
        
        <div class="credit-box">
          <p style="margin: 0 0 5px; color: #92400e;">Your Starting Credits</p>
          <div class="credit-amount">${data.credits}</div>
          <p style="margin: 5px 0 0; color: #92400e; font-size: 14px;">Use them to explore our tools!</p>
        </div>
        
        <div class="highlight-box">
          <strong>What can I help you with?</strong>
          <ul style="margin: 10px 0 0; padding-left: 20px;">
            <li>Create stunning logos and graphics</li>
            <li>Generate professional documents</li>
            <li>Build eBooks and newsletters</li>
            <li>Analyze videos and images</li>
            <li>And so much more!</li>
          </ul>
        </div>
        
        <p style="text-align: center;">
          <a href="https://javariai.com/dashboard" class="btn">Start Creating →</a>
        </p>
        
        <p>Questions? Just chat with me anytime - I'm always here to help!</p>
        
        <p>Let's create something amazing together! ✨</p>
        <p>— Javari</p>
      </div>
    `, `Welcome ${data.name}! You have ${data.credits} credits to start creating.`),
    text: `Welcome to Javari AI, ${data.name}!\n\nYour AI-powered creative journey starts now.\n\nYou have ${data.credits} credits to explore our tools!\n\nStart creating at: https://javariai.com/dashboard\n\n— Javari`
  }),

  low_credits: (data: { name: string; balance: number; threshold: number }) => ({
    subject: `⚠️ Low Credits Alert - Only ${data.balance} remaining`,
    html: baseTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
        <h1>⚠️ Low Credits Alert</h1>
        <p>Time to top up your account</p>
      </div>
      <div class="content">
        <p>Hi ${data.name},</p>
        <p>Just a heads up - your credit balance is running low!</p>
        
        <div class="credit-box" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
          <p style="margin: 0 0 5px; color: #991b1b;">Current Balance</p>
          <div class="credit-amount" style="color: #991b1b;">${data.balance}</div>
          <p style="margin: 5px 0 0; color: #991b1b; font-size: 14px;">credits remaining</p>
        </div>
        
        <p>Don't let your creativity stop! Upgrade your plan or purchase a credit pack to keep creating.</p>
        
        <div class="highlight-box">
          <strong>Top-up Options:</strong>
          <ul style="margin: 10px 0 0; padding-left: 20px;">
            <li><strong>Starter Plan</strong> - $9/mo for 500 credits</li>
            <li><strong>Pro Plan</strong> - $29/mo for 2,000 credits</li>
            <li><strong>Credit Packs</strong> - Starting at $5 for 100 credits</li>
          </ul>
        </div>
        
        <p style="text-align: center;">
          <a href="https://javariai.com/pricing" class="btn">Get More Credits →</a>
        </p>
        
        <p>On a paid plan? Your credits never expire!</p>
        <p>— Javari</p>
      </div>
    `, `Your Javari AI credit balance is low: ${data.balance} credits remaining.`),
    text: `Low Credits Alert!\n\nHi ${data.name},\n\nYour credit balance is running low: ${data.balance} credits remaining.\n\nGet more credits at: https://javariai.com/pricing\n\n— Javari`
  }),

  purchase_receipt: (data: { 
    name: string; 
    amount: number; 
    credits: number; 
    transactionId: string;
    purchaseType: 'subscription' | 'credits';
    planName?: string;
  }) => ({
    subject: `Receipt: $${(data.amount / 100).toFixed(2)} - Thank you for your purchase!`,
    html: baseTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #10b981, #059669);">
        <h1>Thank You! 💚</h1>
        <p>Your purchase was successful</p>
      </div>
      <div class="content">
        <p>Hi ${data.name},</p>
        <p>Thanks for your purchase! Here's your receipt:</p>
        
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace;">${data.transactionId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' 
              })}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Item:</td>
              <td style="padding: 8px 0; text-align: right;">${data.purchaseType === 'subscription' 
                ? `${data.planName} Subscription` 
                : `${data.credits} Credit Pack`}</td>
            </tr>
            <tr style="border-top: 2px solid #e5e7eb;">
              <td style="padding: 12px 0; font-weight: 600;">Total:</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 20px;">$${(data.amount / 100).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <div class="credit-box">
          <p style="margin: 0 0 5px; color: #92400e;">Credits Added</p>
          <div class="credit-amount">+${data.credits}</div>
        </div>
        
        <p style="text-align: center;">
          <a href="https://javariai.com/dashboard" class="btn">Start Creating →</a>
        </p>
        
        <p style="font-size: 13px; color: #6b7280;">
          Questions about your purchase? Reply to this email or contact 
          <a href="mailto:${SUPPORT_EMAIL}" style="color: #6366f1;">${SUPPORT_EMAIL}</a>
        </p>
        
        <p>Happy creating! 🎨</p>
        <p>— Javari</p>
      </div>
    `, `Receipt for $${(data.amount / 100).toFixed(2)} - ${data.credits} credits added to your account.`),
    text: `Purchase Receipt\n\nTransaction ID: ${data.transactionId}\nDate: ${new Date().toISOString()}\nAmount: $${(data.amount / 100).toFixed(2)}\nCredits: ${data.credits}\n\nThank you for your purchase!\n\n— Javari`
  }),

  subscription_confirmed: (data: { 
    name: string; 
    planName: string; 
    credits: number; 
    nextBillingDate: string;
    amount: number;
  }) => ({
    subject: `🎉 Welcome to ${data.planName} - Subscription Confirmed!`,
    html: baseTemplate(`
      <div class="header">
        <h1>🎉 Subscription Confirmed!</h1>
        <p>Welcome to ${data.planName}</p>
      </div>
      <div class="content">
        <p>Hi ${data.name},</p>
        <p>You're now on the <strong>${data.planName}</strong> plan! Here's what you get:</p>
        
        <div class="credit-box">
          <p style="margin: 0 0 5px; color: #92400e;">Monthly Credits</p>
          <div class="credit-amount">${data.credits.toLocaleString()}</div>
          <p style="margin: 5px 0 0; color: #92400e; font-size: 14px;">Credits never expire on paid plans!</p>
        </div>
        
        <div class="highlight-box">
          <strong>Subscription Details:</strong>
          <ul style="margin: 10px 0 0; padding-left: 20px; list-style: none;">
            <li>✅ Plan: ${data.planName}</li>
            <li>✅ Monthly: $${(data.amount / 100).toFixed(2)}</li>
            <li>✅ Credits/month: ${data.credits.toLocaleString()}</li>
            <li>✅ Next billing: ${data.nextBillingDate}</li>
          </ul>
        </div>
        
        <p style="text-align: center;">
          <a href="https://javariai.com/dashboard" class="btn">Go to Dashboard →</a>
        </p>
        
        <p>Need to make changes? You can manage your subscription anytime in your account settings.</p>
        
        <p>Let's create something amazing! ✨</p>
        <p>— Javari</p>
      </div>
    `, `Your ${data.planName} subscription is confirmed! ${data.credits} credits/month.`),
    text: `Subscription Confirmed!\n\nWelcome to ${data.planName}!\n\nPlan: ${data.planName}\nMonthly Credits: ${data.credits}\nNext Billing: ${data.nextBillingDate}\n\n— Javari`
  }),

  subscription_cancelled: (data: { 
    name: string; 
    planName: string; 
    endDate: string;
    remainingCredits: number;
  }) => ({
    subject: `Your ${data.planName} subscription has been cancelled`,
    html: baseTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #6b7280, #4b5563);">
        <h1>Subscription Cancelled</h1>
        <p>We're sad to see you go</p>
      </div>
      <div class="content">
        <p>Hi ${data.name},</p>
        <p>Your <strong>${data.planName}</strong> subscription has been cancelled as requested.</p>
        
        <div class="highlight-box" style="background: #fef3c7; border-left-color: #f59e0b;">
          <strong>Important:</strong>
          <ul style="margin: 10px 0 0; padding-left: 20px;">
            <li>Your subscription remains active until <strong>${data.endDate}</strong></li>
            <li>You have <strong>${data.remainingCredits}</strong> credits remaining</li>
            <li>After ${data.endDate}, you'll be moved to the Free plan (50 credits/month)</li>
          </ul>
        </div>
        
        <p>Changed your mind? You can resubscribe anytime!</p>
        
        <p style="text-align: center;">
          <a href="https://javariai.com/pricing" class="btn">Resubscribe →</a>
        </p>
        
        <p>We'd love to hear your feedback! What could we do better?</p>
        <p><a href="mailto:${SUPPORT_EMAIL}?subject=Subscription Feedback" style="color: #6366f1;">Share your thoughts →</a></p>
        
        <p>Thanks for being part of our community! 💜</p>
        <p>— Javari</p>
      </div>
    `, `Your ${data.planName} subscription ends on ${data.endDate}.`),
    text: `Subscription Cancelled\n\nYour ${data.planName} subscription has been cancelled.\n\nAccess until: ${data.endDate}\nRemaining credits: ${data.remainingCredits}\n\nResubscribe at: https://javariai.com/pricing\n\n— Javari`
  }),

  credits_expired: (data: { name: string; expiredCredits: number }) => ({
    subject: `${data.expiredCredits} credits have expired`,
    html: baseTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
        <h1>Credits Expired</h1>
        <p>Time for a fresh start!</p>
      </div>
      <div class="content">
        <p>Hi ${data.name},</p>
        <p>Your monthly free credits have expired:</p>
        
        <div class="credit-box" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
          <p style="margin: 0 0 5px; color: #991b1b;">Expired Credits</p>
          <div class="credit-amount" style="color: #991b1b;">${data.expiredCredits}</div>
        </div>
        
        <div class="highlight-box">
          <strong>Want credits that never expire?</strong>
          <p style="margin: 10px 0 0;">Upgrade to a paid plan and your credits roll over indefinitely!</p>
          <ul style="margin: 10px 0 0; padding-left: 20px;">
            <li><strong>Starter</strong> - $9/mo for 500 credits</li>
            <li><strong>Pro</strong> - $29/mo for 2,000 credits</li>
            <li><strong>Business</strong> - $99/mo for 10,000 credits</li>
          </ul>
        </div>
        
        <p style="text-align: center;">
          <a href="https://javariai.com/pricing" class="btn">Upgrade Now →</a>
        </p>
        
        <p>— Javari</p>
      </div>
    `, `${data.expiredCredits} credits expired. Upgrade for credits that never expire!`),
    text: `Credits Expired\n\n${data.expiredCredits} credits have expired.\n\nUpgrade for credits that never expire: https://javariai.com/pricing\n\n— Javari`
  })
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESEND API
// ═══════════════════════════════════════════════════════════════════════════════

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log('[UserEmail] Resend not configured, logging email:');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    return { success: false, error: 'Email not configured' };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
        text
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, id: data.id };
    } else {
      return { success: false, error: data.message || 'Send failed' };
    }
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
    const { type, to, data } = body;
    
    if (!type || !USER_TEMPLATES[type as keyof typeof USER_TEMPLATES]) {
      return NextResponse.json({
        success: false,
        error: `Unknown email type: ${type}`,
        availableTypes: Object.keys(USER_TEMPLATES)
      }, { status: 400 });
    }
    
    if (!to || !data) {
      return NextResponse.json({
        success: false,
        error: 'Both "to" (email) and "data" are required'
      }, { status: 400 });
    }
    
    const template = USER_TEMPLATES[type as keyof typeof USER_TEMPLATES](data);
    const result = await sendEmail(to, template.subject, template.html, template.text);
    
    // Log to database
    await supabase.from('user_emails').insert({
      recipient: to,
      type,
      subject: template.subject,
      success: result.success,
      resend_id: result.id,
      error: result.error,
      created_at: new Date().toISOString()
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[UserEmail] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari AI User Emails',
    version: '1.0',
    provider: 'Resend',
    configured: !!RESEND_API_KEY,
    templates: Object.keys(USER_TEMPLATES).map(key => ({
      type: key,
      description: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    })),
    usage: {
      method: 'POST',
      body: {
        type: 'welcome | low_credits | purchase_receipt | subscription_confirmed | subscription_cancelled | credits_expired',
        to: 'recipient@email.com',
        data: 'Template-specific data object (see examples below)'
      },
      examples: {
        welcome: { name: 'John', credits: 50 },
        low_credits: { name: 'John', balance: 5, threshold: 10 },
        purchase_receipt: { name: 'John', amount: 2900, credits: 2000, transactionId: 'txn_123', purchaseType: 'subscription', planName: 'Pro' }
      }
    },
    timestamp: new Date().toISOString()
  });
}
