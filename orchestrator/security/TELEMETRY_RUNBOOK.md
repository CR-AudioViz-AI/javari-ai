# Phase Ω-VII — Security Telemetry Runbook

## Purpose

This runbook describes how to run and validate the Security Telemetry layer added in Phase Ω-VII:
- Scan completion metrics (latency, result, recommended action)
- Threat detection counters (category + severity)
- Incident logged events

Telemetry is designed to be:
- **Feature-flagged** (can be disabled)
- **Privacy-preserving** (hashing / no raw PII required)
- **Low overhead** (sampling supported)

---

## Feature Flags / Environment

Telemetry emission is controlled by:
- `SECURITY_TELEMETRY_ENABLED=true|false`

Recommended:
- Local dev: `true`
- CI smoke workflow: `true` (already set in workflow env)
- Production: start `true`, adjust sampling if needed

---

## How to Run (Local)

From repo root:

1) Install dependencies
   - `npm ci`

2) Run telemetry smoke script
   - `npm run security:telemetry-smoke`

Expected behavior:
- Script exits successfully
- Console logs (JSON or known telemetry format) appear when telemetry is enabled
- Prompts/requests that match signatures produce threat events and incident events

---

## How to Run (GitHub Actions)

Workflow:
- `.github/workflows/telemetry-smoke.yml`

Run:
- GitHub → Actions → "Telemetry Smoke Test (Manual)" → Run workflow

Expected:
- Workflow green
- Logs show the smoke test ran
- If the workflow fails, see Debugging below

---

## Debugging

### 1) Smoke test fails immediately
- Check Node version is 20+
- Confirm dependencies install cleanly `npm ci`)
- Confirm `ts-node` is installed as devDependency (package.json)

### 2) Telemetry shows no output
- Confirm `SECURITY_TELEMETRY_ENABLED=true`
- Confirm telemetry module is imported and invoked from:
  - `orchestrator/security/securityScanRunner.ts`
  - `orchestrator/security/incidentLogger.ts`

### 3) False positives or noisy metrics
- Adjust sampling logic in `orchestrator/security/telemetry.ts`
- Consider excluding low-severity events or sampling INFO/LOW

---

## Rollback

If telemetry causes issues, rollback options are:

### Soft rollback (recommended)
- Set `SECURITY_TELEMETRY_ENABLED=false` in runtime/CI env

### Hard rollback
- Revert the following commits (in reverse order):
  1) Telemetry runbook commit
  2) Telemetry smoke workflow commit
  3) Telemetry smoke script commit
  4) Telemetry integration commit

---

## Verification Checklist

- [ ] Smoke workflow runs manually in GitHub Actions
- [ ] Local `npm run security:telemetry-smoke` runs successfully
- [ ] Telemetry can be disabled with `SECURITY_TELEMETRY_ENABLED=false`
- [ ] No secrets/PII are written to telemetry output
- [ ] Security scans still block threats as expected (Ω-VI test suite remains green)
