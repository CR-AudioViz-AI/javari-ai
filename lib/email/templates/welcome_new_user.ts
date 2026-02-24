// lib/email/templates/welcome_new_user.ts
// CR AudioViz AI — Welcome New User Email Template
// 2026-02-20 — STEP 6 Productization

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://javariai.com";

export interface WelcomeNewUserData {
  name:          string;
  email:         string;
  tier:          string;
  startCredits:  number;
  onboardingUrl?: string;
}

export function renderWelcomeNewUser(data: WelcomeNewUserData): {
  subject: string;
  html:    string;
  text:    string;
} {
  const subject = `Welcome to CR AudioViz AI, ${data.name}! 🎉`;
  const onboarding = data.onboardingUrl ?? `${APP_URL}/account/onboarding`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);border-radius:16px;padding:40px 32px;text-align:center;margin-bottom:24px;">
      <h1 style="color:#fff;font-size:32px;font-weight:900;margin:0 0 12px;letter-spacing:-1px;">
        Welcome to CR AudioViz AI
      </h1>
      <p style="color:rgba(255,255,255,0.85);margin:0;font-size:18px;font-style:italic;">Your Story. Our Design.</p>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#e2e8f0;margin:0 0 16px;font-size:16px;">Hi ${data.name}, 👋</p>
      <p style="color:#94a3b8;margin:0 0 20px;">
        Your account is ready. You're on the <strong style="color:#60a5fa;">${capitalize(data.tier)}</strong> plan 
        with <strong style="color:#34d399;">${data.startCredits.toLocaleString()} credits</strong> to get started.
      </p>

      <div style="background:#0f172a;border-radius:10px;padding:20px;margin-bottom:20px;">
        <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Quick Start</p>
        ${[
          { icon: "🤖", title: "Chat with Javari AI",     href: `${APP_URL}/javari`,         desc: "Ask anything, execute any goal" },
          { icon: "📦", title: "Browse Module Store",     href: `${APP_URL}/store`,          desc: "Install pre-built modules" },
          { icon: "⚡", title: "View Your Plan",           href: `${APP_URL}/account/plan`,   desc: "Credits, features, and more" },
        ].map((item) => `
          <a href="${item.href}" style="display:flex;align-items:center;gap:12px;padding:12px;background:#1e293b;border-radius:8px;text-decoration:none;margin-bottom:8px;">
            <span style="font-size:20px;">${item.icon}</span>
            <div>
              <p style="color:#e2e8f0;font-weight:600;margin:0;font-size:14px;">${item.title}</p>
              <p style="color:#64748b;margin:0;font-size:12px;">${item.desc}</p>
            </div>
          </a>
        `).join("")}
      </div>

      <a href="${onboarding}" style="display:block;background:linear-gradient(90deg,#2563eb,#9333ea);color:#fff;text-align:center;padding:16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        Complete Onboarding →
      </a>
    </div>

    <p style="color:#475569;font-size:12px;text-align:center;">
      CR AudioViz AI, LLC · Fort Myers, FL<br>
      <a href="${APP_URL}/support" style="color:#60a5fa;">Support</a> · 
      <a href="${APP_URL}/pricing" style="color:#60a5fa;">Pricing</a>
    </p>
  </div>
</body>
</html>`;

  const text = `
Hi ${data.name},

Welcome to CR AudioViz AI! Your Story. Our Design.

You're on the ${capitalize(data.tier)} plan with ${data.startCredits.toLocaleString()} credits.

Get started:
- Chat with Javari AI: ${APP_URL}/javari
- Browse modules: ${APP_URL}/store
- Your plan: ${APP_URL}/account/plan

Complete onboarding: ${onboarding}

CR AudioViz AI, LLC
`.trim();

  return { subject, html, text };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function sendWelcomeNewUser(data: WelcomeNewUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const { subject, html, text } = renderWelcomeNewUser(data);
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type: "welcome_new_user", to: data.email, subject, html, text }),
    });
    const d = await res.json();
    return { success: d.success };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
