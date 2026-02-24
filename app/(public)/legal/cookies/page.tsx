// app/(public)/legal/cookies/page.tsx
// CR AudioViz AI — Cookie Policy
// 2026-02-21 — STEP 8 Go-Live

import { Metadata } from "next";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";
import LegalLayout from "../LegalLayout";

export const metadata: Metadata = {
  title: "Cookie Policy — CR AudioViz AI",
  description: "How CR AudioViz AI uses cookies and similar tracking technologies.",
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="February 21, 2026">

      <section>
        <h2>1. What Are Cookies</h2>
        <p>
          Cookies are small text files stored on your device when you visit a website. They help us
          recognize your browser, remember your preferences, and improve your experience. We also
          use similar technologies like local storage and session storage.
        </p>
      </section>

      <section>
        <h2>2. Cookies We Use</h2>
        <h3>Strictly Necessary Cookies</h3>
        <p>These cookies are essential for the Service to function and cannot be disabled:</p>
        <ul>
          <li><strong>sb-auth-token:</strong> Supabase session authentication</li>
          <li><strong>cr-canary:</strong> Feature flag assignments (sticky rollout)</li>
          <li><strong>csrf:</strong> Cross-site request forgery protection</li>
        </ul>

        <h3>Performance Cookies</h3>
        <p>Help us understand how the Service is used to improve performance:</p>
        <ul>
          <li><strong>cr-analytics:</strong> Anonymous usage metrics (no PII)</li>
          <li><strong>_vercel-skip-toolbar:</strong> Vercel deployment toolbar control</li>
        </ul>

        <h3>Functional Cookies</h3>
        <p>Remember your preferences and settings:</p>
        <ul>
          <li><strong>cr-theme:</strong> UI color scheme preference</li>
          <li><strong>cr-locale:</strong> Language preference</li>
          <li><strong>cr-model:</strong> Preferred AI model selection</li>
        </ul>
      </section>

      <section>
        <h2>3. Third-Party Cookies</h2>
        <p>
          We use Stripe for payment processing. Stripe may set cookies necessary for payment
          security and fraud prevention. We do not use advertising or tracking cookies from
          third-party ad networks. Our products are ad-free.
        </p>
      </section>

      <section>
        <h2>4. Managing Cookies</h2>
        <p>
          You can control cookies through your browser settings. Disabling strictly necessary
          cookies may prevent you from using authenticated features of the Service. Most browsers
          allow you to:
        </p>
        <ul>
          <li>View and delete stored cookies</li>
          <li>Block cookies from specific sites</li>
          <li>Block all third-party cookies</li>
          <li>Set preferences for specific categories</li>
        </ul>
      </section>

      <section>
        <h2>5. Data Collected via Cookies</h2>
        <p>
          Cookie-collected data is used solely to operate and improve our Service. We do not sell
          cookie data to advertisers. Analytics data is aggregated and anonymized before any
          cross-user analysis. For full details on data use, see our{" "}
          <a href="/legal/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          For cookie-related questions:<br />
          Email: <a href={`mailto:${BRAND_IDENTITY.support}`}>{BRAND_IDENTITY.support}</a>
        </p>
      </section>

    </LegalLayout>
  );
}
