// lib/javari-templates.ts
// JAVARI TEMPLATE LIBRARY - Pre-built solutions for instant delivery
// Timestamp: 2025-11-30 06:40 AM EST

// =====================================================
// APP TEMPLATES
// =====================================================

export const APP_TEMPLATES = {
  // Landing Page
  landing_page: {
    name: 'Landing Page',
    description: 'Modern landing page with hero, features, pricing, CTA',
    files: {
      'page.tsx': `'use client';

import { useState } from 'react';

export default function LandingPage() {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Hero */}
      <section className="pt-20 pb-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            {{HEADLINE}}
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {{SUBHEADLINE}}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:border-purple-500"
            />
            <button className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition">
              Get Started
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-black/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Feature 1', desc: 'Description of feature 1' },
              { title: 'Feature 2', desc: 'Description of feature 2' },
              { title: 'Feature 3', desc: 'Description of feature 3' }
            ].map((f, i) => (
              <div key={i} className="p-6 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8">Join thousands of satisfied customers today.</p>
          <button className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg transition">
            Start Free Trial
          </button>
        </div>
      </section>
    </div>
  );
}`
    },
    variables: ['HEADLINE', 'SUBHEADLINE']
  },

  // Dashboard
  dashboard: {
    name: 'Admin Dashboard',
    description: 'Full admin dashboard with sidebar, stats, tables',
    files: {
      'page.tsx': `'use client';

import { useState } from 'react';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const stats = [
    { label: 'Total Users', value: '12,345', change: '+12%' },
    { label: 'Revenue', value: '$45,678', change: '+8%' },
    { label: 'Orders', value: '1,234', change: '+23%' },
    { label: 'Conversion', value: '3.2%', change: '+2%' }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <aside className={\`\${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-800 p-4 transition-all\`}>
        <div className="text-xl font-bold mb-8">{{APP_NAME}}</div>
        <nav className="space-y-2">
          {['Dashboard', 'Users', 'Products', 'Orders', 'Settings'].map(item => (
            <a key={item} href="#" className="block px-4 py-2 rounded hover:bg-gray-700">
              {sidebarOpen ? item : item[0]}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {stats.map(stat => (
            <div key={stat.label} className="bg-gray-800 p-6 rounded-xl">
              <div className="text-gray-400 text-sm">{stat.label}</div>
              <div className="text-3xl font-bold mt-1">{stat.value}</div>
              <div className="text-green-400 text-sm mt-1">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-3">Order</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4,5].map(i => (
                <tr key={i} className="border-b border-gray-700/50">
                  <td className="py-3">#100{i}</td>
                  <td className="py-3">Customer {i}</td>
                  <td className="py-3">$99.00</td>
                  <td className="py-3"><span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">Completed</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}`
    },
    variables: ['APP_NAME']
  },

  // SaaS Pricing Page
  pricing_page: {
    name: 'SaaS Pricing',
    description: 'Pricing page with three tiers',
    files: {
      'page.tsx': `'use client';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: 29,
      features: ['5 Projects', '10GB Storage', 'Email Support', 'Basic Analytics'],
      cta: 'Start Free Trial'
    },
    {
      name: 'Pro',
      price: 79,
      popular: true,
      features: ['Unlimited Projects', '100GB Storage', 'Priority Support', 'Advanced Analytics', 'API Access'],
      cta: 'Get Started'
    },
    {
      name: 'Enterprise',
      price: 199,
      features: ['Everything in Pro', 'Unlimited Storage', 'Dedicated Support', 'Custom Integrations', 'SLA'],
      cta: 'Contact Sales'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h1>
        <p className="text-gray-400 text-center mb-12">Choose the plan that's right for you</p>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map(plan => (
            <div 
              key={plan.name}
              className={\`p-8 rounded-2xl border \${plan.popular ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800'}\`}
            >
              {plan.popular && (
                <div className="text-purple-400 text-sm font-semibold mb-2">MOST POPULAR</div>
              )}
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={\`w-full py-3 rounded-lg font-semibold transition \${
                plan.popular 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }\`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`
    },
    variables: []
  },

  // Contact Form
  contact_form: {
    name: 'Contact Form',
    description: 'Contact form with validation',
    files: {
      'page.tsx': `'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    
    // Replace with actual API call
    await new Promise(r => setTimeout(r, 1000));
    setStatus('sent');
    setForm({ name: '', email: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-gray-400 mb-8">We'd love to hear from you</p>

        {status === 'sent' ? (
          <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-xl text-center">
            <div className="text-green-400 text-xl mb-2">✓ Message Sent!</div>
            <p className="text-gray-400">We'll get back to you soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Message</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={e => setForm({...form, message: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-lg font-semibold transition"
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}`
    },
    variables: []
  },

  // API Route Template
  api_route: {
    name: 'API Route',
    description: 'Next.js API route with validation and error handling',
    files: {
      'route.ts': `import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Your logic here
    const data = { message: 'Success' };
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    // Your logic here
    const result = { id: '123', ...body };
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`
    },
    variables: []
  }
};

// =====================================================
// DOCUMENT TEMPLATES
// =====================================================

export const DOCUMENT_TEMPLATES = {
  contract: {
    name: 'Service Contract',
    content: `# SERVICE AGREEMENT

**Effective Date:** {{DATE}}

**Between:**
- **Service Provider:** {{PROVIDER_NAME}} ("Provider")
- **Client:** {{CLIENT_NAME}} ("Client")

## 1. SERVICES

Provider agrees to provide the following services:

{{SERVICES_DESCRIPTION}}

## 2. COMPENSATION

Client agrees to pay Provider:

- **Amount:** ${{AMOUNT}}
- **Payment Terms:** {{PAYMENT_TERMS}}

## 3. TERM

This agreement begins on {{START_DATE}} and continues until {{END_DATE}} unless terminated earlier.

## 4. TERMINATION

Either party may terminate this agreement with {{NOTICE_PERIOD}} days written notice.

## 5. CONFIDENTIALITY

Both parties agree to maintain confidentiality of proprietary information.

## 6. GOVERNING LAW

This agreement is governed by the laws of {{STATE}}.

---

**Provider Signature:** _________________________ Date: _________

**Client Signature:** _________________________ Date: _________`
  },

  proposal: {
    name: 'Business Proposal',
    content: `# PROPOSAL

**Prepared for:** {{CLIENT_NAME}}
**Prepared by:** {{YOUR_NAME}}
**Date:** {{DATE}}

---

## Executive Summary

{{EXECUTIVE_SUMMARY}}

## Problem Statement

{{PROBLEM}}

## Proposed Solution

{{SOLUTION}}

## Deliverables

{{DELIVERABLES}}

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1 | {{PHASE1_DURATION}} | {{PHASE1_DELIVERABLES}} |
| Phase 2 | {{PHASE2_DURATION}} | {{PHASE2_DELIVERABLES}} |
| Phase 3 | {{PHASE3_DURATION}} | {{PHASE3_DELIVERABLES}} |

## Investment

**Total Investment:** ${{TOTAL_AMOUNT}}

{{PAYMENT_BREAKDOWN}}

## Next Steps

1. Review and approve proposal
2. Sign agreement
3. Submit initial payment
4. Kick-off meeting

---

We look forward to working with you.

**{{YOUR_NAME}}**
{{YOUR_TITLE}}
{{YOUR_CONTACT}}`
  },

  invoice: {
    name: 'Invoice',
    content: `# INVOICE

**Invoice #:** {{INVOICE_NUMBER}}
**Date:** {{DATE}}
**Due Date:** {{DUE_DATE}}

---

**From:**
{{YOUR_COMPANY}}
{{YOUR_ADDRESS}}

**To:**
{{CLIENT_NAME}}
{{CLIENT_ADDRESS}}

---

## Services

| Description | Quantity | Rate | Amount |
|-------------|----------|------|--------|
| {{SERVICE_1}} | {{QTY_1}} | ${{RATE_1}} | ${{AMOUNT_1}} |
| {{SERVICE_2}} | {{QTY_2}} | ${{RATE_2}} | ${{AMOUNT_2}} |

---

**Subtotal:** ${{SUBTOTAL}}
**Tax ({{TAX_RATE}}%):** ${{TAX_AMOUNT}}
**Total Due:** ${{TOTAL}}

---

**Payment Methods:**
- Bank Transfer: {{BANK_DETAILS}}
- PayPal: {{PAYPAL_EMAIL}}

**Terms:** Net {{NET_DAYS}}

Thank you for your business!`
  }
};

// =====================================================
// EMAIL TEMPLATES
// =====================================================

export const EMAIL_TEMPLATES = {
  welcome: {
    name: 'Welcome Email',
    subject: 'Welcome to {{APP_NAME}}!',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {{APP_NAME}}!</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Thanks for signing up! We're excited to have you on board.</p>
      <p>Here's what you can do next:</p>
      <ul>
        <li>Complete your profile</li>
        <li>Explore our features</li>
        <li>Connect with the community</li>
      </ul>
      <a href="{{CTA_URL}}" class="button">Get Started</a>
      <p>If you have any questions, just reply to this email.</p>
      <p>Best,<br>The {{APP_NAME}} Team</p>
    </div>
    <div class="footer">
      <p>© {{YEAR}} {{APP_NAME}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  },

  password_reset: {
    name: 'Password Reset',
    subject: 'Reset your password',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hi {{USER_NAME}},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <a href="{{RESET_URL}}" class="button">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>Best,<br>The {{APP_NAME}} Team</p>
    </div>
  </div>
</body>
</html>`
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

export function getTemplate(category: string, name: string): any {
  const categories: Record<string, any> = {
    app: APP_TEMPLATES,
    document: DOCUMENT_TEMPLATES,
    email: EMAIL_TEMPLATES
  };
  return categories[category]?.[name];
}

export function listTemplates(): Array<{ category: string; name: string; description: string }> {
  const result: Array<{ category: string; name: string; description: string }> = [];
  
  for (const [name, template] of Object.entries(APP_TEMPLATES)) {
    result.push({ category: 'app', name, description: (template as any).description || name });
  }
  for (const [name, template] of Object.entries(DOCUMENT_TEMPLATES)) {
    result.push({ category: 'document', name, description: (template as any).name || name });
  }
  for (const [name, template] of Object.entries(EMAIL_TEMPLATES)) {
    result.push({ category: 'email', name, description: (template as any).name || name });
  }
  
  return result;
}

export default {
  APP_TEMPLATES,
  DOCUMENT_TEMPLATES,
  EMAIL_TEMPLATES,
  fillTemplate,
  getTemplate,
  listTemplates
};
