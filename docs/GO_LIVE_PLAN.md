# Phase Ω-VIII — Go-Live Control Plan (Javari AI)

## Purpose

This document defines the step-by-step go-live procedure for production releases.
It is designed to prevent outages, enable fast rollback, and ensure every launch is measurable.

---

## 1) Pre-Flight Checklist (Must Be True)

- [ ] Main branch is green (CI passing)
- [ ] Security scan workflow is passing
- [ ] Telemetry smoke workflow can run manually and pass
- [ ] Secrets are configured in the production environment (no missing required secrets)
- [ ] Feature flags are defined for any risky change
- [ ] Rollback plan is written for the release
- [ ] Owner on call is assigned for launch window

---

## 2) Release Stages

### Stage A — Canary

- Release to a limited audience (or internal only)
- Monitor telemetry: scan latency, blocked scans, incident count

Exit criteria:
- No spike in incidents
- No degradation in latency
- No unexpected blocks on normal traffic

Rollback triggers:
- Critical incidents
- Sustained error rate increase
- Security false-positive spike

### Stage B — Limited Rollout

- Expand to a small percentage of users/traffic
- Repeat monitoring

### Stage C — Full Rollout

- Enable for all users
- Continue monitoring for 24–72 hours

---

## 3) Monitoring Checklist (During Launch)

Track:
- `security.scan.count` (allow vs block ratio)
- `security.scan.latency_ms`
- incident log volume `security.incident.count`)
- top categories/severities
- errors in application logs

---

## 4) Rollback Procedure

### Soft rollback (preferred)

- Disable risky features via feature flags
- Disable telemetry if needed via `SECURITY_TELEMETRY_ENABLED=false`

### Hard rollback

- Revert to last known good commit SHA
- Confirm CI green
- Re-run telemetry smoke workflow

---

## 5) Post-Launch

- [ ] Write release notes
- [ ] Capture issues into backlog
- [ ] Run a short postmortem if any incident occurred
- [ ] Update this plan with lessons learned
