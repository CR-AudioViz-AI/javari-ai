# Phase Ω-VI — Security Test Suite

This directory contains the complete Phase Ω-VI security test coverage for the Javari AI platform.

## Test Files

- `security-input-tests.ts` — Request input validation, injection, XSS, traversal, file upload rules
- `security-threat-tests.ts` — Prompt injection and jailbreak detection
- `security-secrets-assets-tests.ts` — Secret leakage detection and signed asset URLs
- `security-permissions-tests.ts` — RBAC permission matrix enforcement
- `security-incidents-tests.ts` — Incident logging and scan runner orchestration

## Running Tests Locally

```bash
npm test
# or
npx vitest
```

## CI Enforcement

These tests are enforced by:
* `.github/workflows/security-scan.yml`
* Critical findings will fail the pipeline

## Acceptance Criteria

* All tests must pass on `main`
* No leading artifacts in source files
* No skipped tests
* No flaky behavior

## Ownership

Security tests are authoritative for Phase Ω-VI and must be updated alongside any changes to:
* `orchestrator/security/*`
* Admin security UI
* CI security policies
