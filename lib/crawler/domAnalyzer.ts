// lib/crawler/domAnalyzer.ts
// Purpose: DOM structure analyzer — extracts auth flows, forms, payment flows,
//          admin panels, payment SDK integrations, and file upload patterns.
//          Phase 8 enhancement: payment integrations, API endpoints in JS bundles,
//          improved security header checks, enhanced admin panel patterns.
// Date: 2026-03-08

import type { PageResult } from "./siteCrawler";

// ── Types ──────────────────────────────────────────────────────────────────

export type FlowType =
  | "login" | "registration" | "password_reset" | "payment"
  | "file_upload" | "admin" | "api_key_form" | "contact" | "search" | "unknown";

export interface FormAnalysis {
  url     : string;
  action  : string;
  method  : string;
  flowType: FlowType;
  fields  : string[];
  hasCsrf : boolean;
  risks   : string[];
}

export interface PaymentIntegration {
  type       : "stripe" | "paypal" | "braintree" | "square" | "adyen" | "checkout_com" | "unknown";
  url        : string;
  scriptSrc? : string;
  evidence   : string;
  risk       : string;
}

export interface DomFinding {
  severity  : "low" | "medium" | "high" | "critical";
  url       : string;
  finding   : string;
  detail    : string;
  category  : "auth" | "form" | "admin" | "exposure" | "accessibility" | "payment";
}

export interface DomAnalysisResult {
  forms              : FormAnalysis[];
  adminPaths         : string[];
  loginPages         : string[];
  paymentPages       : string[];
  uploadPages        : string[];
  paymentIntegrations: PaymentIntegration[];
  apiEndpointsInJs   : string[];
  findings           : DomFinding[];
  pagesAnalyzed      : number;
}

// ── Pattern libraries ──────────────────────────────────────────────────────

const ADMIN_PATTERNS = [
  /\/admin/i, /\/dashboard/i, /\/manage/i, /\/control/i, /\/cms/i,
  /\/wp-admin/i, /\/backend/i, /\/staff/i, /\/internal/i, /\/ops/i,
  /\/moderator/i, /\/superuser/i, /\/settings\/admin/i, /\/panel/i,
  /\/console/i, /\/config/i, /\/_admin/i, /\/admin_/i,
];

const LOGIN_PATTERNS = [
  /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i, /\/authenticate/i,
  /\/account\/login/i, /\/user\/login/i, /\/session\/new/i,
  /\/oauth/i, /\/sso/i, /\/saml/i,
];

const PAYMENT_PATTERNS = [
  /\/checkout/i, /\/payment/i, /\/pay/i, /\/billing/i, /\/subscribe/i,
  /\/order/i, /\/purchase/i, /\/cart/i, /\/pricing/i, /\/upgrade/i,
];

const UPLOAD_PATTERNS = [
  /type\s*=\s*["']file["']/i,
  /<input[^>]+accept\s*=/i,
  /enctype\s*=\s*["']multipart\/form-data["']/i,
];

// ── Payment integration detector ───────────────────────────────────────────

function detectPaymentIntegrations(html: string, scripts: string[], pageUrl: string): PaymentIntegration[] {
  const integrations: PaymentIntegration[] = [];

  const paymentSignals: Array<{
    type: PaymentIntegration["type"];
    patterns: RegExp[];
    evidence: string;
    risk: string;
  }> = [
    {
      type: "stripe",
      patterns: [/js\.stripe\.com/i, /stripe\.js/i, /stripe\.confirmPayment/i, /loadStripe/i, /stripePublishableKey/i],
      evidence: "Stripe.js SDK or Stripe API call detected",
      risk: "Ensure HTTPS, verify publishable key exposure is intentional, confirm no secret keys in client code",
    },
    {
      type: "paypal",
      patterns: [/paypal\.com\/sdk\/js/i, /paypal\.Buttons/i, /braintree-paypal/i, /PAYPAL_CLIENT_ID/i],
      evidence: "PayPal SDK or PayPal API call detected",
      risk: "Verify client ID is publishable only; ensure no webhook secrets in client bundle",
    },
    {
      type: "braintree",
      patterns: [/js\.braintreegateway\.com/i, /braintree-web/i, /braintree\.create/i],
      evidence: "Braintree SDK detected",
      risk: "Verify tokenization key is client-safe",
    },
    {
      type: "square",
      patterns: [/squareup\.com\/v2\/paymentform/i, /web\.squarecdn\.com/i, /Square\.Web\.SDK/i],
      evidence: "Square payment SDK detected",
      risk: "Verify Square application ID is safe to expose",
    },
    {
      type: "adyen",
      patterns: [/checkoutshopper\.adyen\.com/i, /adyen-web/i, /adyen\.create/i],
      evidence: "Adyen payment SDK detected",
      risk: "Verify client key is origin-restricted",
    },
    {
      type: "checkout_com",
      patterns: [/cdn\.checkout\.com/i, /Frames\.init/i, /checkout\.com\/sdk/i],
      evidence: "Checkout.com Frames SDK detected",
      risk: "Verify public key scope",
    },
  ];

  const allScriptContent = [...scripts, html].join(" ");

  for (const signal of paymentSignals) {
    if (signal.patterns.some(p => p.test(allScriptContent))) {
      const matchedSrc = scripts.find(s => signal.patterns.some(p => p.test(s)));
      integrations.push({
        type     : signal.type,
        url      : pageUrl,
        scriptSrc: matchedSrc,
        evidence : signal.evidence,
        risk     : signal.risk,
      });
    }
  }

  return integrations;
}

// ── API endpoint extractor from JS bundles ─────────────────────────────────

function extractApiEndpointsFromHtml(html: string): string[] {
  const endpoints: string[] = [];
  const seen = new Set<string>();

  // Match quoted API paths: "/api/...", '/api/...', `/api/...`
  const apiPatterns = [
    /["'`](\/api\/[^"'`\s]{3,100})["'`]/g,
    /["'`](\/v\d+\/[^"'`\s]{3,100})["'`]/g,
    /["'`](\/graphql[^"'`\s]*)["'`]/g,
    /["'`](\/rpc\/[^"'`\s]{3,80})["'`]/g,
  ];

  for (const pattern of apiPatterns) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(html)) !== null) {
      const endpoint = m[1];
      if (!seen.has(endpoint)) {
        seen.add(endpoint);
        endpoints.push(endpoint);
      }
    }
  }

  return endpoints.slice(0, 50); // cap at 50 to avoid noise
}

// ── Form extractor ─────────────────────────────────────────────────────────

function extractFormsFromHtml(html: string, pageUrl: string): FormAnalysis[] {
  const forms: FormAnalysis[] = [];
  const formPattern = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  let m: RegExpExecArray | null;

  while ((m = new RegExp(formPattern.source, formPattern.flags).exec(html)) !== null) {
    const attrs = m[1];
    const body  = m[2];

    const actionMatch = /action\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const methodMatch = /method\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const action = actionMatch?.[1] ?? "";
    const method = (methodMatch?.[1] ?? "GET").toUpperCase();

    const fields: string[] = [];
    const inputPattern = /<input([^>]*)>/gi;
    let inp: RegExpExecArray | null;
    while ((inp = new RegExp(inputPattern.source, inputPattern.flags).exec(body)) !== null) {
      const iAttrs = inp[1];
      const typeM  = /type\s*=\s*["']([^"']*)["']/i.exec(iAttrs);
      const nameM  = /name\s*=\s*["']([^"']*)["']/i.exec(iAttrs);
      const idM    = /id\s*=\s*["']([^"']*)["']/i.exec(iAttrs);
      const desc   = [typeM?.[1], nameM?.[1] ?? idM?.[1]].filter(Boolean).join(":");
      if (desc) fields.push(desc);
    }

    const hasCsrf =
      /csrf/i.test(body) || /\b_token\b/i.test(body) ||
      /name\s*=\s*["'][^"']*csrf[^"']*["']/i.test(body) ||
      /name\s*=\s*["']authenticity_token["']/i.test(body);

    let flowType: FlowType = "unknown";
    const combined = `${action} ${body} ${pageUrl}`.toLowerCase();
    if (/password/.test(combined) && /email|username/.test(combined)) {
      flowType = PAYMENT_PATTERNS.some(p => p.test(pageUrl)) ? "payment" : "login";
    } else if (/register|signup|sign.up/.test(combined)) {
      flowType = "registration";
    } else if (/forgot.password|reset.password/.test(combined)) {
      flowType = "password_reset";
    } else if (PAYMENT_PATTERNS.some(p => p.test(combined))) {
      flowType = "payment";
    } else if (UPLOAD_PATTERNS.some(p => p.test(body))) {
      flowType = "file_upload";
    } else if (ADMIN_PATTERNS.some(p => p.test(pageUrl))) {
      flowType = "admin";
    } else if (/api.key|api.token|secret/.test(combined)) {
      flowType = "api_key_form";
    } else if (/search|query/.test(combined)) {
      flowType = "search";
    } else if (/contact|message|feedback/.test(combined)) {
      flowType = "contact";
    }

    const risks: string[] = [];
    if (!hasCsrf && method === "POST") risks.push("No CSRF token on POST form");
    if (flowType === "login" && !pageUrl.startsWith("https://")) risks.push("Login form on non-HTTPS page");
    if (flowType === "payment" && !hasCsrf) risks.push("Payment form without CSRF protection");
    if (flowType === "file_upload") risks.push("File upload form — verify server-side validation");
    if (flowType === "api_key_form") risks.push("API key form — ensure key is masked and not logged");

    let hostname = "";
    try { hostname = new URL(pageUrl).hostname; } catch { /* ok */ }
    if (action.startsWith("http") && hostname && !action.includes(hostname)) {
      risks.push(`Form posts to external domain: ${action}`);
    }

    forms.push({ url: pageUrl, action, method, flowType, fields, hasCsrf, risks });
  }

  return forms;
}

// ── Main analyzer ──────────────────────────────────────────────────────────

export async function analyzeDom(
  pages  : PageResult[],
  htmlMap: Map<string, string>
): Promise<DomAnalysisResult> {
  const allForms           : FormAnalysis[]       = [];
  const adminPaths         : string[]             = [];
  const loginPages         : string[]             = [];
  const paymentPages       : string[]             = [];
  const uploadPages        : string[]             = [];
  const paymentIntegrations: PaymentIntegration[] = [];
  const apiEndpointsInJs   : string[]             = [];
  const findings           : DomFinding[]         = [];
  const seenPaymentTypes   = new Set<string>();
  const seenApiEndpoints   = new Set<string>();

  for (const page of pages) {
    const html           = htmlMap.get(page.url) ?? "";
    const isAdmin        = ADMIN_PATTERNS.some(p => p.test(page.url));
    const isLogin        = LOGIN_PATTERNS.some(p => p.test(page.url));
    const isPayment      = PAYMENT_PATTERNS.some(p => p.test(page.url));

    if (isAdmin)   adminPaths.push(page.url);
    if (isLogin)   loginPages.push(page.url);
    if (isPayment) paymentPages.push(page.url);

    // Critical: admin page accessible
    if (isAdmin && page.statusCode === 200) {
      findings.push({
        severity: "critical", url: page.url,
        finding : "Admin path publicly accessible (HTTP 200)",
        detail  : "Verify authentication middleware is enforced",
        category: "admin",
      });
    }

    if (html) {
      // Payment integrations
      const pagePayments = detectPaymentIntegrations(html, page.scripts, page.url);
      for (const payment of pagePayments) {
        if (!seenPaymentTypes.has(payment.type + payment.url)) {
          seenPaymentTypes.add(payment.type + payment.url);
          paymentIntegrations.push(payment);
          findings.push({
            severity: "low", url: page.url,
            finding : `Payment integration: ${payment.type}`,
            detail  : `${payment.evidence} | Risk: ${payment.risk}`,
            category: "payment",
          });
        }
      }

      // API endpoints in JS
      const pageApis = extractApiEndpointsFromHtml(html);
      for (const endpoint of pageApis) {
        if (!seenApiEndpoints.has(endpoint)) {
          seenApiEndpoints.add(endpoint);
          apiEndpointsInJs.push(endpoint);
        }
      }

      // Forms
      const pageForms = extractFormsFromHtml(html, page.url);
      allForms.push(...pageForms);
      for (const form of pageForms) {
        if (form.flowType === "file_upload") uploadPages.push(page.url);
        for (const risk of form.risks) {
          findings.push({
            severity: form.flowType === "payment" || form.flowType === "login" ? "high" : "medium",
            url: page.url, finding: risk,
            detail: `Form action=${form.action} method=${form.method}`,
            category: "form",
          });
        }
      }

      // Open redirect
      const openRedirects = page.links.filter(l => {
        try {
          const u = new URL(l);
          return u.searchParams.has("redirect") || u.searchParams.has("next") || u.searchParams.has("url");
        } catch { return false; }
      });
      if (openRedirects.length > 0) {
        findings.push({
          severity: "medium", url: page.url,
          finding : "Potential open redirect parameter in links",
          detail  : `${openRedirects.length} link(s) with redirect/next/url params`,
          category: "auth",
        });
      }

      // Mixed content
      if (page.url.startsWith("https://") && html.includes("http://")) {
        const mixedCount = (html.match(/src\s*=\s*["']http:\/\//gi) ?? []).length;
        if (mixedCount > 0) {
          findings.push({
            severity: "medium", url: page.url,
            finding : "Mixed content: HTTP resources on HTTPS page",
            detail  : `${mixedCount} resource(s) loaded over HTTP`,
            category: "exposure",
          });
        }
      }
    }
  }

  return {
    forms: allForms, adminPaths, loginPages, paymentPages, uploadPages,
    paymentIntegrations, apiEndpointsInJs,
    findings: findings.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    }),
    pagesAnalyzed: pages.length,
  };
}
