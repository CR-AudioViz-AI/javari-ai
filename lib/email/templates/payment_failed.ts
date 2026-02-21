// lib/email/templates/payment_failed.ts
// CR AudioViz AI — Payment Failed Email Template
// 2026-02-20 — STEP 6 Productization

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://javariai.com";

export interface PaymentFailedData {
  name:           string;
  email:          string;
  tier:           string;
  amountUsd:      number;
  attemptDate:    string;
  nextRetryDate?: string;
  failureReason?: string;
}

export function renderPaymentFailed(data: PaymentFailedData): {
  subject: string;
  html:    string;
  text:    string;
} {
  const subject = `⚠️ Payment failed for your ${capitalize(data.tier)} plan`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#7f1d1d;border:1px solid #991b1b;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
      <h1 style="color:#fca5a5;font-size:24px;font-weight:900;margin:0 0 8px;">Payment Failed</h1>
      <p style="color:#fca5a5;opacity:0.8;margin:0;font-size:14px;">Action required to keep your subscription active</p>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#e2e8f0;margin:0 0 16px;">Hi ${data.name},</p>
      <p style="color:#94a3b8;margin:0 0 16px;">
        We couldn&apos;t process your payment of <strong style="color:#e2e8f0;">$${data.amountUsd.toFixed(2)}</strong> 
        for your <strong style="color:#60a5fa;">${capitalize(data.tier)}</strong> plan.
      </p>
      ${data.failureReason ? `<p style="color:#fca5a5;font-size:14px;background:#450a0a;border-radius:8px;padding:12px;margin-bottom:16px;">Reason: ${data.failureReason}</p>` : ""}
      ${data.nextRetryDate ? `<p style="color:#94a3b8;font-size:14px;margin-bottom:16px;">We'll retry on <strong style="color:#e2e8f0;">${data.nextRetryDate}</strong>.</p>` : ""}
      <a href="${APP_URL}/account/billing" style="display:block;background:#dc2626;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        Update Payment Method →
      </a>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;">
      CR AudioViz AI, LLC · <a href="${APP_URL}/support" style="color:#60a5fa;">Contact Support</a>
    </p>
  </div>
</body>
</html>`;

  const text = `
Hi ${data.name},

Your payment of $${data.amountUsd.toFixed(2)} for ${capitalize(data.tier)} plan failed.
${data.failureReason ? `Reason: ${data.failureReason}` : ""}
${data.nextRetryDate ? `We'll retry on ${data.nextRetryDate}.` : ""}

Update your payment method: ${APP_URL}/account/billing

CR AudioViz AI, LLC
`.trim();

  return { subject, html, text };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function sendPaymentFailed(data: PaymentFailedData): Promise<{ success: boolean; error?: string }> {
  try {
    const { subject, html, text } = renderPaymentFailed(data);
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type: "payment_failed", to: data.email, subject, html, text }),
    });
    const d = await res.json();
    return { success: d.success };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
