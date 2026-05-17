// lib/platform.ts
// ─────────────────────────────────────────────────────────────────────────────
// CR AudioViz AI — Universal Platform Standard
// Every Javari app imports this ONE file to get:
//   auth, credits, payments (Stripe + PayPal), AI, analytics, branding
//
// "Your Story. Our Design. Everyone Connects. Everyone Wins."
// CR AudioViz AI, LLC — EIN: 39-3646201
// Created: May 16, 2026
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM  = process.env.NEXT_PUBLIC_CENTRAL_API_URL ?? 'https://craudiovizai.com'
const JAVARI_AI = process.env.NEXT_PUBLIC_JAVARI_AI_URL   ?? 'https://javariai.com'
const APP_NAME  = process.env.NEXT_PUBLIC_APP_NAME         ?? 'Javari'

// ── Brand ────────────────────────────────────────────────────────────────────

export const Brand = {
  company:    'CR AudioViz AI, LLC',
  ein:        '39-3646201',
  tagline:    'Your Story. Our Design.',
  philosophy: 'Everyone connects. Everyone wins.',
  support:    'support@craudiovizai.com',
  website:    'https://craudiovizai.com',
  ai:         'https://javariai.com',
  appName:    APP_NAME,
  copyright:  `© ${new Date().getFullYear()} CR AudioViz AI, LLC`,
  social: {
    twitter:   'https://twitter.com/CRAudioVizAI',
    instagram: 'https://instagram.com/CRAudioVizAI',
    linkedin:  'https://linkedin.com/company/cr-audioviz-ai',
    youtube:   'https://youtube.com/@CRAudioVizAI',
    tiktok:    'https://tiktok.com/@CRAudioVizAI',
    discord:   'https://discord.gg/javari',
  },
  colors: {
    primary:   '#6366f1',
    secondary: '#8b5cf6',
    accent:    '#10b981',
    dark:      '#0a0a0f',
    card:      '#111118',
  },
} as const

// ── Pricing ──────────────────────────────────────────────────────────────────

export const Pricing = {
  plans: [
    { id: 'free',     name: 'Free',     price: 0,  yearly: 0,   credits: 50,    stripe_price: null },
    { id: 'starter',  name: 'Starter',  price: 9,  yearly: 90,  credits: 500,   stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY  ?? 'price_1SdaKx7YeQ1dZTUvCeaYqKXh' },
    { id: 'pro',      name: 'Pro',      price: 29, yearly: 290, credits: 2000,  stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY       ?? 'price_1Sk8AZ7YeQ1dZTUvwpubHpWW' },
    { id: 'business', name: 'Business', price: 99, yearly: 990, credits: 10000, stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY  ?? 'price_1SdaLG7YeQ1dZTUvCzgdjaTp' },
  ],
  creditPacks: [
    { credits: 100,  price: 5,   stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_100  ?? 'price_1SdaLR7YeQ1dZTUvX4qPsy3c' },
    { credits: 500,  price: 20,  stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_500  ?? 'price_1SdaLa7YeQ1dZTUvsjFZWqjB' },
    { credits: 1000, price: 35,  stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_1000 ?? 'price_1SdaLk7YeQ1dZTUvdcDKtnTI' },
    { credits: 2500, price: 89,  stripe_price: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_2500 ?? 'price_1SdaLt7YeQ1dZTUvGhjqaNyk' },
  ],
  paypalPlans: {
    starter:  process.env.PAYPAL_PLAN_STARTER  ?? 'P-4HX540418N9313244NE3PDMY',
    pro:      process.env.PAYPAL_PLAN_PRO      ?? 'P-8KF409823L3623059NE3PDNA',
    business: process.env.PAYPAL_PLAN_BUSINESS ?? 'P-6T2485363S985353DNE3PDNA',
  },
} as const

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  getLoginUrl(returnTo?: string, provider: 'google' | 'github' | 'email' = 'google') {
    const params = new URLSearchParams({
      app: APP_NAME,
      provider,
      ...(returnTo ? { return_to: returnTo } : {}),
    })
    return `${PLATFORM}/auth/signin?${params}`
  },

  async getUser(token: string) {
    if (!token) return null
    try {
      const res = await fetch(`${PLATFORM}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      })
      if (!res.ok) return null
      return res.json() as Promise<{
        id: string; email: string; name: string; tier: string; credits: number
      }>
    } catch { return null }
  },

  getToken(): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(/sb-access-token=([^;]+)/)
    return match ? match[1] : null
  },
}

// ── Credits ──────────────────────────────────────────────────────────────────

export const credits = {
  async getBalance(token: string) {
    try {
      const res = await fetch(`${PLATFORM}/api/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return 0
      const d = await res.json() as { balance?: number }
      return d.balance ?? 0
    } catch { return 0 }
  },

  async spend(token: string, amount: number, action: string, appId?: string) {
    try {
      const res = await fetch(`${PLATFORM}/api/credits/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, action, app_id: appId ?? APP_NAME }),
      })
      const d = await res.json() as { success?: boolean; balance?: number; error?: string }
      return { success: res.ok, balance: d.balance ?? 0, error: d.error }
    } catch (err) { return { success: false, balance: 0, error: String(err) } }
  },
}

// ── Payments ─────────────────────────────────────────────────────────────────

export const payments = {
  async createStripeCheckout(token: string, priceKey: string, successUrl?: string, cancelUrl?: string) {
    try {
      const res = await fetch(`${PLATFORM}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          price_key:   priceKey,
          success_url: successUrl ?? `${PLATFORM}/dashboard?plan=${priceKey}`,
          cancel_url:  cancelUrl  ?? `${PLATFORM}/pricing`,
        }),
      })
      const d = await res.json() as { url?: string; session_id?: string; error?: string }
      return d
    } catch (err) { return { error: String(err) } }
  },

  async createPayPalOrder(token: string, planId: string) {
    try {
      const res = await fetch(`${PLATFORM}/api/payments/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: planId }),
      })
      return res.json() as Promise<{ order_id?: string; approval_url?: string; error?: string }>
    } catch (err) { return { error: String(err) } }
  },

  redirectToCheckout(token: string, priceKey: string) {
    payments.createStripeCheckout(token, priceKey).then(d => {
      if (d.url) window.location.href = d.url
    })
  },
}

// ── AI ───────────────────────────────────────────────────────────────────────

export const ai = {
  async generate(prompt: string, system?: string): Promise<string> {
    const GROQ = process.env.GROQ_API_KEY ?? ''
    const OR   = process.env.OPENROUTER_API_KEY ?? ''

    if (OR) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OR}`, 'HTTP-Referer': PLATFORM },
          body: JSON.stringify({
            model: 'deepseek/deepseek-v4-flash:free', max_tokens: 2048, temperature: 0.7,
            messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
          }),
        })
        if (res.ok) {
          const d = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
          const t = d.choices?.[0]?.message?.content ?? ''
          if (t.length > 10) return t
        }
      } catch { /* fall through */ }
    }

    if (GROQ) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', max_tokens: 2048,
          messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        }),
      })
      if (res.ok) {
        const d = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        return d.choices?.[0]?.message?.content ?? ''
      }
    }

    // Fallback to Javari AI
    const res = await fetch(`${JAVARI_AI}/api/javari/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: false }),
    })
    const d = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return d.choices?.[0]?.message?.content ?? ''
  },

  chatUrl:    `${JAVARI_AI}/api/javari/chat`,
  voiceUrl:   `${JAVARI_AI}/api/javari/voice`,
  videoUrl:   `${JAVARI_AI}/api/javari/video`,
  executeUrl: `${JAVARI_AI}/api/execute`,
}

// ── Analytics ────────────────────────────────────────────────────────────────

export const analytics = {
  async track(event: string, properties?: Record<string, unknown>) {
    try {
      await fetch(`${PLATFORM}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, properties, app: APP_NAME, ts: new Date().toISOString() }),
      })
    } catch { /* non-fatal */ }
  },
}

// ── Cross-sell ───────────────────────────────────────────────────────────────

export const Ecosystem = {
  apps: [
    { name: 'Javari AI',          url: 'https://javariai.com',                              emoji: '🤖', category: 'ai'        },
    { name: 'Javari Resume',      url: 'https://javari-resume-builder.vercel.app',          emoji: '📄', category: 'creative'  },
    { name: 'Javari Legal',       url: 'https://javari-legal.vercel.app',                   emoji: '⚖️', category: 'business'  },
    { name: 'Javari Spirits',     url: 'https://javarispirits.com',                         emoji: '🥃', category: 'lifestyle' },
    { name: 'Javari Property',    url: 'https://javariproperty.com',                        emoji: '🏠', category: 'property'  },
    { name: 'Javari Travel',      url: 'https://javaritravel.com',                          emoji: '✈️', category: 'travel'    },
    { name: 'Javari Games',       url: 'https://javarigames.com',                           emoji: '🎮', category: 'games'     },
    { name: 'Javari Cards',       url: 'https://javaricards.com',                           emoji: '🃏', category: 'collector' },
    { name: 'Javari Social',      url: 'https://javari-social-posts.vercel.app',            emoji: '📱', category: 'marketing' },
    { name: 'Javariverse',        url: 'https://javariverse.com',                           emoji: '🌐', category: 'community' },
    { name: 'Orlando Trip Deal',  url: 'https://orlandotripdeal.com',                       emoji: '🏰', category: 'travel'    },
  ],
  pricingUrl: `${PLATFORM}/pricing`,
  signupUrl:  `${PLATFORM}/auth/signup`,
  dashUrl:    `${PLATFORM}/dashboard`,
}

// ── Footer ───────────────────────────────────────────────────────────────────

export const footer = {
  html: `
    <footer style="border-top:1px solid #1e1e2e;padding:32px 24px;text-align:center;background:#0a0a0f;color:#374151;font-family:Inter,system-ui,sans-serif;font-size:12px">
      <div style="max-width:960px;margin:0 auto">
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-bottom:16px">
          <a href="https://craudiovizai.com" style="color:#6366f1;text-decoration:none">CR AudioViz AI</a>
          <a href="https://javariai.com" style="color:#6b7280;text-decoration:none">Javari AI</a>
          <a href="https://craudiovizai.com/pricing" style="color:#6b7280;text-decoration:none">Pricing</a>
          <a href="https://craudiovizai.com/privacy" style="color:#6b7280;text-decoration:none">Privacy</a>
          <a href="https://craudiovizai.com/terms" style="color:#6b7280;text-decoration:none">Terms</a>
          <a href="mailto:support@craudiovizai.com" style="color:#6b7280;text-decoration:none">Support</a>
        </div>
        <p style="margin:0">© ${new Date().getFullYear()} CR AudioViz AI, LLC — EIN: 39-3646201<br>
        Your Story. Our Design. Everyone Connects. Everyone Wins.</p>
      </div>
    </footer>
  `,
}

export default { Brand, Pricing, auth, credits, payments, ai, analytics, Ecosystem, footer }
