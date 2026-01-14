# Env Lockdown (No Secret Leakage)

## Rules (Non-Negotiable)
- Never print secret values to console logs
- Never commit `.env` files
- Never paste secrets into chats, tickets, or documentation
- Use secret managers (GitHub Actions, Netlify, Supabase) for values
- Only log key NAMES and pass/fail states

## Verification
Use:
- `bash scripts/env-verify-run.sh`

Outputs:
- `security-logs/env-verify-report.json` (redacted)
- `security-logs/env-verify-report.md` (redacted)

## Remediation
If keys are missing or invalid:
- Set them in the correct secret manager
- Re-run the verify script
- Do not store or share values outside secret managers

NOTE:
This process intentionally does not attempt to "guess" or "restore" secrets from chat history.
That behavior would create a leak path.
