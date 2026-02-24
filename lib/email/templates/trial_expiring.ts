// lib/email/templates/trial_expiring.ts
// CR AudioViz AI — Trial Expiring Email Template
// 2026-02-20 — STEP 6 Productization

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://javariai.com";

export interface TrialExpiringData {
  name:        string;
  email:       string;
  tier:        string;
  daysLeft:    number;
  expiryDate:  string;
  creditsUsed: number;
}

export function renderTrialExpiring(data: TrialExpiringData): {
  subject: string;
  html:    string;
  text:    string;
} {
  const urgent  = data.daysLeft <= 3;
  const subject = urgent
    ? `⏰ Your ${capitalize(data.tier)} trial ends in ${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"}`
    : `Reminder: Your ${capitalize(data.tier)} trial ends on ${data.expiryDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,${urgent ? "#78350f,#92400e" : "#1e40af,#7c3aed"});border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
      <h1 style="color:#fff;font-size:24px;font-weight:900;margin:0 0 8px;">
        ${urgent ? `⏰ ${data.daysLeft} Day${data.daysLeft === 1 ? "" : "s"} Left` : "Trial Ending Soon"}
      </h1>
      <p style="color:rgba(255,255,255,0.8);margin:0;font-size:14px;">Your ${capitalize(data.tier)} trial expires on ${data.expiryDate}</p>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#e2e8f0;margin:0 0 16px;">Hi ${data.name},</p>
      <p style="color:#94a3b8;margin:0 0 16px;">
        You've used <strong style="color:#60a5fa;">${data.creditsUsed.toLocaleString()} credits</strong> during your trial. 
        Subscribe now to keep your access and all features.
      </p>
      <a href="${APP_URL}/account/billing" style="display:block;background:linear-gradient(90deg,#2563eb,#9333ea);color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        Subscribe Now →
      </a>
      <p style="color:#64748b;font-size:12px;text-align:center;margin-top:12px;">
        No commitment — cancel anytime.
      </p>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;">
      CR AudioViz AI, LLC · <a href="${APP_URL}/pricing" style="color:#60a5fa;">View Plans</a>
    </p>
  </div>
</body>
</html>`;

  const text = `
Hi ${data.name},

Your ${capitalize(data.tier)} trial ends in ${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"} (${data.expiryDate}).

You've used ${data.creditsUsed.toLocaleString()} credits. Subscribe to keep access.

Subscribe now: ${APP_URL}/account/billing
View plans: ${APP_URL}/pricing

CR AudioViz AI, LLC
`.trim();

  return { subject, html, text };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function sendTrialExpiring(data: TrialExpiringData): Promise<{ success: boolean; error?: string }> {
  try {
    const { subject, html, text } = renderTrialExpiring(data);
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type: "trial_expiring", to: data.email, subject, html, text }),
    });
    const d = await res.json();
    return { success: d.success };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
