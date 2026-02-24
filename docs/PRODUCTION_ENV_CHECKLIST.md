# Phase Ω-VIII — Production Environment Checklist

## Purpose

This checklist ensures production is correctly configured before any public launch or rollout stage.
It is designed to prevent avoidable outages due to missing secrets, misconfigured flags, or weak protections.

---

## 1) Secrets (Required)

Confirm these exist and meet minimum length requirements per `secretValidator.ts`:

- [ ] DATABASE_URL
- [ ] ANTHROPIC_API_KEY
- [ ] OPENAI_API_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] JWT_SECRET

Notes:
- Never paste secrets into chats or issues.
- Use the platform secret manager (GitHub Actions secrets, Netlify env vars, Supabase secrets, etc.).

---

## 2) Security Feature Flags / Controls

- [ ] SECURITY_TELEMETRY_ENABLED is set appropriately
  - Suggested: true (can be disabled instantly if needed)
- [ ] Any risky features are behind flags (if applicable)
- [ ] Rate limiting settings are configured (if enabled in request guard)

---

## 3) CI/CD Protections

- [ ] Branch protection enabled on `main`
  - [ ] Require status checks to pass
  - [ ] Require pull request reviews (where applicable)
  - [ ] Block force pushes
- [ ] Security Scan workflow present and green
- [ ] Telemetry Smoke workflow present and can run manually

---

## 4) Operational Readiness

- [ ] On-call owner assigned for launch window
- [ ] Rollback steps documented and tested
- [ ] Monitoring plan defined
  - [ ] Scan latency
  - [ ] Blocked vs allowed ratio
  - [ ] Incident count trends
- [ ] Log retention expectations reviewed

---

## 5) Final Sign-off

- [ ] Pre-flight complete
- [ ] Canary criteria defined
- [ ] Rollout stages defined
- [ ] Rollback triggers defined
- [ ] Comms checklist ready
