# T004 — Transactional emails

**Plan**: docs/plans/template-base.md · **Depends on**: T002

## Context
The OTP login sends codes by email in the user's language. Templates and sending are isolated so
projects can add their own emails.

## Objective
`send_email(to, template, lang, context)` renders text + HTML in en/es/gl with an inline logo and sends
it via SMTP; Mailpit receives it in development.

## Step 1 — Templates
`backend/app/emails/templates/_layout.html` (simple, inline CSS, logo by `cid:logo`), and for
`login_code` and `welcome_signup`: `<lang>.subject.txt`, `<lang>.body.txt`, `<lang>.body.html` for
en, es, gl. Context: `code`, `minutes`, `first_name`, `app_name`, `site_url`. Unknown language → en.
`backend/app/emails/assets/logo.png` (neutral placeholder, replaceable).

## Step 2 — Sender
`app/emails/sender.py`: Jinja2 environment (autoescape for HTML), builds a multipart/related message,
sends with aiosmtplib using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`
(`none`|`starttls`|`ssl`), `EMAIL_FROM`. A `EMAIL_BACKEND=memory` mode stores messages in a list for tests.
Send failures are logged and raised to the caller (the login decides what to answer).

## DoD
1. Tests: each template renders in each language with the expected subject and code; unknown language
   falls back to en; HTML is escaped; memory backend captures the message with the inline logo part.
2. Integration test sends a real message to Mailpit and finds it through Mailpit's API.
3. Lint clean; coverage ≥ 95 %.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make coverage-backend` | `coverage.txt` | all pass, ≥ 95 % |
| 2 | Mailpit | `curl -s localhost:18025/api/v1/messages` after the integration test | `mailpit.txt` | message present |
| 3 | Lint | `make lint-backend` | `lint.txt` | clean |

## Files
| File | Action |
|------|--------|
| `backend/app/emails/**` | CREATE |
| `backend/tests/test_emails.py` | CREATE |
| `.env.example`, `dev/docker-compose.yml` | MODIFY |
