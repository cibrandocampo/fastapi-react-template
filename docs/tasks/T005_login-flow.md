# T005 — Login flow (OTP and password)

**Plan**: docs/plans/template-base.md · **Depends on**: T003, T004

## Context
Nudge's login contract re-implemented in FastAPI: email first, then a one-time code or a password
depending on the user; optional open sign-up; protections against brute force and disposable emails.

## Objective
All `/api/auth` endpoints work with their protections, verified by tests.

## Step 1 — Models
`LoginCode` (user_id, code_hash SHA-256, created_at, expires_at, attempts, consumed_at; index on
user/consumed/expires) and `FailedLogin` (user_id, created_at, ip). Migration.

## Step 2 — Endpoints (`/api/auth`)
- `GET /config` → `{"allow_self_signup": bool}` (`ALLOW_SELF_SIGNUP`, default false).
- `POST /login/start {email}` → `{"method": "otp"|"password"}`. Unknown email: sign-up closed → 404
  `user_not_found`; disposable domain → 400 `disposable_email`; else create inactive OTP user, role
  `none`, language from `Accept-Language` (en/es/gl, default en), send `welcome_signup`. Existing OTP
  user → send `login_code`. Password user → no email. Inactive non-signup users (deactivated by an admin)
  → 403 `account_disabled`.
- `POST /login/verify {email, code}` or `{email, password}` (exactly one, else 400 `invalid_request`).
  OTP: newest unconsumed unexpired code, 10 min, 5 attempts, consumed on success, activates a sign-up.
  Password: 5 failures in 15 min → 429 `locked`; success clears failures. Wrong method → 400
  `method_mismatch`; wrong credentials → 400 `invalid_credentials`. Success: `last_login_at`, session
  issued (cookie) and body `{"access_token", "user", "is_new"}` (`is_new` = no first and last name).
- `POST /refresh` (cookie) → `{"access_token", "user"}`; `POST /logout` → 204, revokes and clears cookie.
- `GET /me`, `PATCH /me` (first_name, last_name non-blank, language, theme).
- `POST /change-password {current_password, new_password}`; for OTP users without a password,
  `current_password` is not required and the method becomes `password`. Revokes other sessions.

## Step 3 — Rate limits (`app/core/ratelimit.py`)
In-memory sliding window keyed by IP or value: login/start 10/h per IP and 3/h per email, verify 10/min
per IP, refresh 30/min per IP, change-password 5/h per user → 429 `rate_limited` with `Retry-After`.
`RATE_LIMIT_ENABLED` (default true; false in dev compose and tests except the rate-limit tests).
Client IP from `X-Forwarded-For` only when `TRUSTED_PROXIES` matches the peer.

## Step 4 — Disposable emails
`backend/app/auth/disposable/disposable_email_domains.txt` (upstream list, generated) and
`disposable_email_domains.local.txt`; env `DISPOSABLE_EMAIL_EXTRA_DOMAINS`, `DISPOSABLE_EMAIL_ALLOW_DOMAINS`,
`BLOCK_DISPOSABLE_EMAIL` (default true). Subdomains of a listed domain are blocked.
`.github/workflows/sync-disposable-email-domains.yml`: weekly + manual, downloads the upstream
`disposable_email_blocklist.conf`, refuses fewer than 1000 lines, opens a PR with
`peter-evans/create-pull-request`.

## Step 5 — Cleanup scheduler
`app/core/scheduler.py`: asyncio task started in the lifespan, hourly: delete expired login codes,
failed logins older than 1 day, refresh tokens expired more than 7 days ago. Stopped on shutdown.

## DoD
1. One test per rule above (each error code, expiry, attempts, newest-code-only, activation,
   lockout and its reset, reuse via refresh, logout clears cookie, change-password both cases and
   session revocation, rate limits and `Retry-After`, proxy header trust, disposable subdomain, scheduler purge).
2. Lint clean; coverage ≥ 95 %.
3. Manual flow in the dev stack: start + verify with the code read from Mailpit returns a token.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make coverage-backend` | `coverage.txt` | all pass, ≥ 95 % |
| 2 | Lint | `make lint-backend` | `lint.txt` | clean |
| 3 | Manual flow | curl start → Mailpit API → curl verify | `manual_flow.txt` | 200 with `access_token` and `Set-Cookie` |
| 4 | Workflow YAML | `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" .github/workflows/sync-disposable-email-domains.yml` | `workflow.txt` | exit 0 |

## Files
| File | Action |
|------|--------|
| `backend/app/auth/**` | CREATE / MODIFY |
| `backend/app/core/ratelimit.py`, `backend/app/core/scheduler.py` | CREATE |
| `backend/alembic/versions/*` | CREATE |
| `backend/tests/**` | CREATE |
| `.github/workflows/sync-disposable-email-domains.yml` | CREATE |
| `.env.example`, `dev/docker-compose.yml` | MODIFY |
