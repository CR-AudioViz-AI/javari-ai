// app/(public)/legal/privacy/page.tsx
// CR AudioViz AI — Privacy Policy
// 2026-02-21 — STEP 8 Go-Live

import { Metadata } from "next";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";
import LegalLayout from "../LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — CR AudioViz AI",
  description: "How CR AudioViz AI collects, uses, and protects your personal information.",
};

const LAST_UPDATED = "February 21, 2026";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>

      <section>
        <h2>1. Introduction</h2>
        <p>
          CR AudioViz AI, LLC (&ldquo;CR AudioViz AI,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;us&rdquo;) operates {BRAND_IDENTITY.url} and the Javari AI platform
          (&ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our Service.
        </p>
        <p>
          By accessing or using our Service, you acknowledge that you have read and understood this
          Privacy Policy. If you disagree with any terms, please discontinue use of our Service.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <h3>2.1 Information You Provide</h3>
        <ul>
          <li><strong>Account information:</strong> name, email address, password</li>
          <li><strong>Payment information:</strong> processed by Stripe — we never store raw card data</li>
          <li><strong>Profile data:</strong> preferences, settings, usage configurations</li>
          <li><strong>Communications:</strong> support requests, feedback, survey responses</li>
        </ul>
        <h3>2.2 Information We Collect Automatically</h3>
        <ul>
          <li><strong>Usage data:</strong> pages visited, features used, time spent</li>
          <li><strong>AI interaction logs:</strong> prompts and responses to improve service quality</li>
          <li><strong>Device data:</strong> browser type, IP address, operating system</li>
          <li><strong>Cookies and tracking:</strong> see our Cookie Policy for details</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>Provide, maintain, and improve our Service</li>
          <li>Process transactions and send related information</li>
          <li>Send technical notices, security alerts, and support messages</li>
          <li>Respond to your comments and questions</li>
          <li>Analyze usage patterns to improve user experience</li>
          <li>Detect and prevent fraudulent or unauthorized activity</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your personal data to third parties. We do not use your AI
          prompts to train our models without explicit consent.
        </p>
      </section>

      <section>
        <h2>4. Data Storage & Security</h2>
        <p>
          Your data is stored in Supabase (PostgreSQL) with Row-Level Security (RLS) enforced at
          the database level. All data in transit is encrypted with TLS 1.3. Backups are encrypted
          at rest using AES-256.
        </p>
        <p>
          We implement industry-standard security measures including: access controls, audit logging,
          intrusion detection, and regular security assessments. No method of transmission is 100%
          secure; we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>5. Data Retention</h2>
        <p>
          We retain your personal information for as long as your account is active or as needed to
          provide services. Analytics events are automatically purged after 90 days. Error logs are
          retained for 30 days. You may request deletion of your account and associated data at any
          time by contacting {BRAND_IDENTITY.support}.
        </p>
      </section>

      <section>
        <h2>6. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li><strong>Supabase:</strong> database and authentication</li>
          <li><strong>Vercel:</strong> hosting and edge network</li>
          <li><strong>Stripe:</strong> payment processing</li>
          <li><strong>Anthropic, OpenAI, Google:</strong> AI model providers</li>
          <li><strong>Resend:</strong> transactional email</li>
        </ul>
        <p>Each provider has its own privacy policy governing their data handling practices.</p>
      </section>

      <section>
        <h2>7. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your personal data</li>
          <li>Object to or restrict processing of your data</li>
          <li>Data portability (receive your data in a structured format)</li>
          <li>Withdraw consent at any time</li>
        </ul>
        <p>To exercise these rights, contact us at {BRAND_IDENTITY.support}.</p>
      </section>

      <section>
        <h2>8. Children&apos;s Privacy</h2>
        <p>
          Our Service is not directed to children under 13 years of age. We do not knowingly collect
          personal information from children under 13. If we discover that a child under 13 has
          provided us with personal information, we will delete such information promptly.
        </p>
      </section>

      <section>
        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by
          posting the new policy on this page and updating the &ldquo;Last Updated&rdquo; date. For
          significant changes, we will also send an email notification.
        </p>
      </section>

      <section>
        <h2>10. Contact Us</h2>
        <p>
          For privacy-related questions or requests, contact us at:<br />
          <strong>CR AudioViz AI, LLC</strong><br />
          Fort Myers, Florida, United States<br />
          Email: <a href={`mailto:${BRAND_IDENTITY.support}`}>{BRAND_IDENTITY.support}</a>
        </p>
      </section>

    </LegalLayout>
  );
}
