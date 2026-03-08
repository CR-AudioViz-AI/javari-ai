// lib/crawler/domAnalyzer.ts
// Purpose: DOM structure analyzer — extracts auth flows, forms, payment flows,
//          admin panels, and file upload patterns from crawled HTML pages.
//          Flags unprotected routes and missing security patterns.
// Date: 2026-03-07

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
  fields  : string[];   // input name/type/id attributes
  hasCsrf : boolean;
  risks   : string[];
}

export interface DomFinding {
  severity   : "low" | "medium" | "high" | "critical";
  url        : string;
  finding    : string;
  detail     : string;
  category   : "auth" | "form" | "admin" | "exposure" | "accessibility";
}

export interface DomAnalysisResult {
  forms          : FormAnalysis[];
  adminPaths     : string[];
  loginPages     : string[];
  paymentPages   : string[];
  uploadPages    : string[];
  findings       : DomFinding[];
  pagesAnalyzed  : number;
}

// ── Pattern libraries ──────────────────────────────────────────────────────

const ADMIN_PATTERNS = [
  /\/admin/i, /\/dashboard/i, /\/manage/i, /\/control/i, /\/cms/i,
  /\/wp-admin/i, /\/backend/i, /\/staff/i, /\/internal/i, /\/ops/i,
];

const LOGIN_PATTERNS = [
  /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i, /\/authenticate/i,
  /\/account\/login/i, /\/user\/login/i, /\/session\/new/i,
];

const PAYMENT_PATTERNS = [
  /\/checkout/i, /\/payment/i, /\/pay/i, /\/billing/i, /\/subscribe/i,
  /\/order/i, /\/purchase/i, /\/cart/i,
];

const UPLOAD_PATTERNS = [
  /type\s*=\s*["']file["']/i,
  /<input[^>]+accept\s*=/i,
  /enctype\s*=\s*["']multipart\/form-data["']/i,
];

// ── Form extractor ─────────────────────────────────────────────────────────

function extractFormsFromHtml(html: string, pageUrl: string): FormAnalysis[] {
  const forms: FormAnalysis[] = [];
  const formPattern = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  let m: RegExpExecArray | null;

  while ((m = new RegExp(formPattern.source, formPattern.flags).exec(html)) !== null) {
    const attrs   = m[1];
    const body    = m[2];

    const actionMatch = /action\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const methodMatch = /method\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const action = actionMatch?.[1] ?? "";
    const method = (methodMatch?.[1] ?? "GET").toUpperCase();

    // Extract input fields
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

    // Detect CSRF token
    const hasCsrf =
      /csrf/i.test(body) ||
      /\b_token\b/i.test(body) ||
      /name\s*=\s*["'][^"']*csrf[^"']*["']/i.test(body) ||
      /name\s*=\s*["']authenticity_token["']/i.test(body);

    // Classify flow
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

    // Assess risks
    const risks: string[] = [];
    if (!hasCsrf && method === "POST") risks.push("No CSRF token detected on POST form");
    if (flowType === "login" && !pageUrl.startsWith("https://")) risks.push("Login form on non-HTTPS page");
    if (flowType === "payment" && !hasCsrf) risks.push("Payment form without CSRF protection");
    if (flowType === "file_upload") risks.push("File upload form — verify server-side validation");
    if (flowType === "api_key_form") risks.push("API key form — ensure key is masked and not logged");
    if (action.startsWith("http") && !action.includes(new URL(pageUrl).hostname)) {
      risks.push(`Form posts to external domain: ${action}`);
    }

    forms.push({ url: pageUrl, action, method, flowType, fields, hasCsrf, risks });
  }

  return forms;
}

// ── Path classifier ────────────────────────────────────────────────────────

function classifyPage(url: string): { isAdmin: boolean; isLogin: boolean; isPayment: boolean; isUpload: boolean } {
  return {
    isAdmin  : ADMIN_PATTERNS.some(p => p.test(url)),
    isLogin  : LOGIN_PATTERNS.some(p => p.test(url)),
    isPayment: PAYMENT_PATTERNS.some(p => p.test(url)),
    isUpload : false, // determined from form content
  };
}

// ── Main analyzer ──────────────────────────────────────────────────────────

export async function analyzeDom(
  pages    : PageResult[],
  htmlMap  : Map<string, string>  // url → raw HTML
): Promise<DomAnalysisResult> {
  const allForms   : FormAnalysis[] = [];
  const adminPaths : string[] = [];
  const loginPages : string[] = [];
  const paymentPages: string[] = [];
  const uploadPages : string[] = [];
  const findings   : DomFinding[] = [];

  for (const page of pages) {
    const html  = htmlMap.get(page.url) ?? "";
    const classification = classifyPage(page.url);

    if (classification.isAdmin) adminPaths.push(page.url);
    if (classification.isLogin) loginPages.push(page.url);
    if (classification.isPayment) paymentPages.push(page.url);

    // Admin page accessible without auth check detectable signal
    if (classification.isAdmin && page.statusCode === 200) {
      findings.push({
        severity: "critical",
        url     : page.url,
        finding : "Admin path publicly accessible",
        detail  : `${page.url} returned HTTP 200 — verify authentication is enforced`,
        category: "admin",
      });
    }

    // Analyze forms
    if (html) {
      const pageForms = extractFormsFromHtml(html, page.url);
      allForms.push(...pageForms);

      for (const form of pageForms) {
        if (form.flowType === "file_upload") uploadPages.push(page.url);
        for (const risk of form.risks) {
          findings.push({
            severity: form.flowType === "payment" || form.flowType === "login" ? "high" : "medium",
            url     : page.url,
            finding : risk,
            detail  : `Form action=${form.action} method=${form.method}`,
            category: "form",
          });
        }
      }
    }

    // Check for open redirect patterns in links
    const openRedirectLinks = page.links.filter(l => {
      try {
        const u = new URL(l);
        return u.searchParams.has("redirect") || u.searchParams.has("next") || u.searchParams.has("url");
      } catch { return false; }
    });
    if (openRedirectLinks.length > 0) {
      findings.push({
        severity: "medium",
        url     : page.url,
        finding : "Potential open redirect parameter detected",
        detail  : `Parameters: redirect/next/url found in ${openRedirectLinks.length} link(s)`,
        category: "auth",
      });
    }

    // Mixed content check
    if (page.url.startsWith("https://") && html.includes("http://")) {
      const mixedCount = (html.match(/src\s*=\s*["']http:\/\//gi) ?? []).length;
      if (mixedCount > 0) {
        findings.push({
          severity: "medium",
          url     : page.url,
          finding : "Mixed content detected",
          detail  : `${mixedCount} resource(s) loaded over HTTP on HTTPS page`,
          category: "exposure",
        });
      }
    }
  }

  return {
    forms      : allForms,
    adminPaths,
    loginPages,
    paymentPages,
    uploadPages,
    findings,
    pagesAnalyzed: pages.length,
  };
}
