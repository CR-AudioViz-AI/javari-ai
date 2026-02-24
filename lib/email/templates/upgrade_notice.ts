// lib/email/templates/upgrade_notice.ts
// CR AudioViz AI — Upgrade Notice Email Template
// 2026-02-20 — STEP 6 Productization

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://javariai.com";

export interface UpgradeNoticeData {
  name:         string;
  email:        string;
  oldTier:      string;
  newTier:      string;
  creditsAdded: number;
  newBalance:   number;
  nextRenewal?:  string;
}

export function renderUpgradeNotice(data: UpgradeNoticeData): {
  subject: string;
  html:    string;
  text:    string;
} {
  const subject = `🚀 You've upgraded to ${capitalize(data.newTier)}!`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
      <h1 style="color:#fff;font-size:28px;font-weight:900;margin:0 0 8px;">
        Welcome to ${capitalize(data.newTier)}!
      </h1>
      <p style="color:rgba(255,255,255,0.8);margin:0;">Your Story. Our Design.</p>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#e2e8f0;margin:0 0 16px;">Hi ${data.name},</p>
      <p style="color:#94a3b8;margin:0 0 16px;">
        Your plan has been upgraded from <strong style="color:#e2e8f0;">${capitalize(data.oldTier)}</strong> 
        to <strong style="color:#60a5fa;">${capitalize(data.newTier)}</strong>.
      </p>
      <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#64748b;font-size:14px;">Credits Added</span>
          <span style="color:#60a5fa;font-weight:700;">+${data.creditsAdded.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#64748b;font-size:14px;">New Balance</span>
          <span style="color:#34d399;font-weight:700;">${data.newBalance.toLocaleString()}</span>
        </div>
      </div>
      <a href="${APP_URL}/javari" style="display:block;background:linear-gradient(90deg,#2563eb,#9333ea);color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        Start Using Javari AI →
      </a>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;">
      CR AudioViz AI, LLC · 
      <a href="${APP_URL}/account/billing" style="color:#60a5fa;">Manage Billing</a>
    </p>
  </div>
</body>
</html>`;

  const text = `
Hi ${data.name},

You've upgraded from ${capitalize(data.oldTier)} to ${capitalize(data.newTier)}!

Credits added: +${data.creditsAdded.toLocaleString()}
New balance: ${data.newBalance.toLocaleString()}
${data.nextRenewal ? `Next renewal: ${data.nextRenewal}` : ""}

Get started: ${APP_URL}/javari

CR AudioViz AI, LLC
`.trim();

  return { subject, html, text };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function sendUpgradeNotice(data: UpgradeNoticeData): Promise<{ success: boolean; error?: string }> {
  try {
    const { subject, html, text } = renderUpgradeNotice(data);
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type: "upgrade_notice", to: data.email, subject, html, text }),
    });
    const d = await res.json();
    return { success: d.success };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
