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
- 401 answers carry `WWW-Authenticate: Bearer`.
- `/refresh` failures clear the cookie only when the session really ended (unknown, expired, revoked
  family); a refusal inside the reuse grace window keeps the cookie (another tab just replaced it).
- `/logout` with an already-rotated token revokes its family.
- Reuse events (family revoked) logged without personal data (user id and family only).
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

## Execution evidence
**Date**: 2026-11-24
**Files**:
- `backend/app/auth/router.py` — `/api/auth`: config, login/start, login/verify, refresh, logout, me
  (GET/PATCH), change-password; `preferred_language()` from Accept-Language.
- `backend/app/auth/otp.py` — 6-digit codes, SHA-256 stored, newest live code only (row locked while
  checked), attempts counted, consumed on success.
- `backend/app/auth/models.py` — `LoginCode`, `FailedLogin`; `backend/app/users/models.py` —
  `email_verified_at`; migration `…_login_codes_failed_logins_email_.py` (backfills existing users).
- `backend/app/auth/sessions.py` — `refresh_in_progress` code for the grace window; logout revokes the family;
  reuse logged with user id and family only.
- `backend/app/auth/schemas.py`, `backend/app/users/schemas.py` — request/response bodies (`UserOut`,
  `ProfileUpdate` with `extra=forbid`).
- `backend/app/core/ratelimit.py` — sliding-window limits and `client_ip()` with trusted proxies.
- `backend/app/core/scheduler.py` — hourly clean-up started in the lifespan.
- `backend/app/core/errors.py` — `AppError.headers`; 401 adds `WWW-Authenticate: Bearer`.
- `backend/app/auth/disposable/` — synced list (10 455 domains), local list, checker.
- `backend/app/users/bootstrap.py` — bootstrap admin is created verified.
- `.github/workflows/sync-disposable-email-domains.yml`, `.env.example`, `dev/docker-compose.yml`.
- Tests: `test_auth_login.py`, `test_auth_session_api.py`, `test_ratelimit.py`, `test_disposable.py`,
  `test_scheduler.py`, `helpers.py`; conftest resets limits, outbox and caches per test.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Tests + coverage ×3 (171 tests, 100 %) | `docs/tasks/evidence/T005/coverage_{1,2,3}.txt` | PASS |
| 2 | Lint | `docs/tasks/evidence/T005/lint.txt` | PASS |
| 3 | Manual flow: sign-up → code from Mailpit → verify → me → refresh; admin password login | `docs/tasks/evidence/T005/manual_flow.txt` | PASS |
| 4 | Workflow (actionlint) | `docs/tasks/evidence/T005/workflow.txt` | PASS |
| 5 | Migration down/up + check | `docs/tasks/evidence/T005/migration.txt` | PASS |

### Decisions
- **Pending sign-up vs disabled account** (deviation from Step 2's "inactive OTP user, activated by the
  first code"): that design cannot tell a sign-up waiting for its code from an account an admin
  disabled, so a disabled user who never logged in could re-activate themself with a code.
  `is_active` is now only changed by admins; a sign-up is created active with role `none` and
  `email_verified_at` empty, which the first successful login sets. Sessions only exist after a
  verified login, and role `none` grants nothing.
- Admin-created and bootstrap users are created verified; existing rows are backfilled by the migration.
  The clean-up deletes OTP sign-ups never confirmed after `UNVERIFIED_SIGNUP_DAYS` (7).
- The per-address limit (3/h) counts emails actually sent, not every start: password users get no email
  and are not limited by it.
- Account enumeration (corrected after QA O1): the login reveals whether an account exists and how it
  signs in (`user_not_found`, `method`, `method_mismatch`, `account_disabled`), as in nudge, because the
  UI needs it to show the right step. It is limited by the rate limits, not hidden.
- Change password keeps the current session with a new token and ends all others.
- `PATCH /me` with an explicit `null` answers 400 `invalid_request`; unknown fields or values 422.
- One test case was wrong, not the code: `notmailinator.com` is in the upstream list; replaced by
  `mailinator.com.example` (whole-suffix matching).
- Dev compose enables sign-up and disables rate limits; tests set both explicitly.

## QA — RETURNED (round 1)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (ruff check + format check) | `docs/tasks/evidence/T005/qa/lint.txt` | PASS |
| 2 | Full backend suite + coverage ×3 (171 passed, 100 %, threshold 95) | `docs/tasks/evidence/T005/qa/coverage_{1,2,3}.txt` | PASS |
| 3 | Migration down → up → `alembic check` | `docs/tasks/evidence/T005/qa/migration.txt` | PASS |
| 4 | Workflow YAML parses; actionlint clean | `docs/tasks/evidence/T005/qa/workflow.txt` | PASS |
| 5 | Manual flow: sign-up start → code from Mailpit → verify (200, `access_token`, `Set-Cookie` HttpOnly/Secure/SameSite=strict/Path=/api/auth) → me → refresh | `docs/tasks/evidence/T005/qa/manual_flow.txt` | PASS |
| 6 | Enumeration matrix (start/verify for unknown, OTP, password, disabled) | `docs/tasks/evidence/T005/qa/probe_enumeration.txt` | PASS (see O1) |
| 7 | OTP brute force: 5 attempts then right code refused; newest code only; consumed once; 30 concurrent guesses → attempts = 5 (row lock holds) | `docs/tasks/evidence/T005/qa/probe_otp_bruteforce.txt` | PASS |
| 8 | Password lockout, sequential and concurrent | `docs/tasks/evidence/T005/qa/probe_lockout.txt` | FAIL (B2) |
| 9 | Event loop while passwords are checked | `docs/tasks/evidence/T005/qa/probe_event_loop.txt` | FAIL (B1) |
| 10 | Spoofed X-Forwarded-For / X-Real-IP / Forwarded from an untrusted peer ignored (stored IP = peer) | `docs/tasks/evidence/T005/qa/probe_proxy_headers.txt` | PASS |
| 11 | Rate limits live (second instance, limits on, trusted proxy): start 10/h per IP, XFF spoof behind proxy keyed on the real hop, 3 emails/h per address (case-insensitive), verify 10/min, refresh 30/min, `Retry-After`, 429 does not touch the cookie | `docs/tasks/evidence/T005/qa/probe_ratelimit.txt` | PASS |
| 12 | Cookies and sessions: no Set-Cookie on failed verify; planted cookie value replaced at login and rejected by refresh; grace window keeps cookie; reuse after grace clears cookie and kills the family; logout with rotated cookie kills the family and clears; 401 carries `WWW-Authenticate: Bearer`; reuse log has only family + user id | `docs/tasks/evidence/T005/qa/probe_cookies_sessions.txt` | PASS |
| 13 | Pending vs disabled: disabled pending sign-up cannot use its live code nor restart; disabled verified user loses `/me` and refresh (cookie cleared); 15 concurrent sign-ups → 1 user, no 500; disposable domain/subdomain/case variants blocked; PATCH /me rejects role/is_active/email/auth_method | `docs/tasks/evidence/T005/qa/probe_signup_disabled.txt` | PASS |
| 14 | Shared `INVALID_CREDENTIALS` instance does not accumulate tracebacks/memory (1000 failed verifies) | `docs/tasks/evidence/T005/qa/probe_exception_singleton.txt` | PASS |

### Blockers
- **B1**: `backend/app/auth/router.py:155` (`verify_password` in `_check_password`) and `:209`/`:214`
  (`verify_password`/`hash_password` in `change_password`) — bcrypt (12 rounds, ~0.3 s) runs
  synchronously inside `async def` endpoints, so every password check freezes the whole event loop.
  Expected: CPU-bound hashing off the loop (e.g. `await run_in_threadpool(...)` /
  `asyncio.to_thread`). Found: `/api/health` takes 0.0027 s alone and **1.53 s** while 5
  unauthenticated wrong-password verifies run (`probe_event_loop.txt`); 40 concurrent verifies took
  2.2 s, serialised (`probe_lockout.txt`). Any unauthenticated client can stall every user's
  requests with `/login/verify`.
- **B2**: `backend/app/auth/router.py:145-158` — the lockout is a non-atomic read-then-write
  (`count(FailedLogin)` → bcrypt → insert), so concurrent requests all pass the `failures >= 5`
  check before any failure is recorded. Spec: 5 failures in 15 min lock. Found: 40 concurrent wrong
  passwords → **6** `invalid_credentials` and 6 `failed_logins` rows (`probe_lockout.txt` C2/C3);
  today the window is narrowed only by B1's event-loop blocking, and once B1 is fixed every
  concurrent request in a burst gets a guess. Expected: serialise the check per user (e.g.
  `SELECT … FOR UPDATE` on the user row, or record the attempt before verifying and count it), plus
  a test that concurrent wrong passwords never check more than `LOCKOUT_ATTEMPTS` guesses.

### Observations (non-blocking)
- **O1**: the Decisions note says verify "does not reveal accounts", but it does: a password sent for
  an OTP account answers `method_mismatch` (unknown → `invalid_credentials`), a code sent for a
  password account answers `method_mismatch`, disabled answers 403 before any credential check, and
  a password user's wrong password takes ~0.33 s vs ~0.005 s for unknown emails. With sign-up open
  this is a silent oracle (start would create the account and email the victim). The error codes are
  mandated by Step 2, so this is a wording fix in the Decisions unless the design should change.
- **O2**: `app/core/scheduler.py` deletes unverified OTP sign-ups regardless of `is_active`: a pending
  sign-up an admin disabled is deleted after 7 days and the address can then sign up again. Probably
  fine (the address was never proven), but worth a sentence in the Decisions.
- **O3**: `RateLimit._hits` never drops empty keys; per-IP/per-address dictionaries grow with every
  distinct key (IPv6 makes this cheap for an attacker). Consider pruning empty deques.
- **O4**: T010 plans uvicorn `--proxy-headers --forwarded-allow-ips` in production. Uvicorn would then
  rewrite `request.client.host` from X-Forwarded-For before `client_ip()` applies `TRUSTED_PROXIES`;
  two independent trust lists invite a `*` misconfiguration that lets clients spoof their IP and
  bypass every per-IP limit. Pick one mechanism in T010.
- **O5**: no test asserts the content of the reuse log line (no email / PII); it is covered only by
  line coverage. Verified manually: `Refresh token reuse: family <uuid> of user <id> revoked`.
- **O6**: `LoginVerify.code` has no length bound (any string is hashed); `max_length` would be cheap.

### Round 2 (QA round 1: B1, B2)
- **B1**: bcrypt runs in a worker thread (`hash_password_async` / `verify_password_async`, also used by
  the bootstrap). Test: a slow password check no longer delays a concurrent `/api/health`. Live probe:
  `/api/health` answered in 0.013 s during a burst of 5 wrong passwords (was 1.53 s) —
  `docs/tasks/evidence/T005/event_loop_probe.txt`.
- **B2**: `_check_password` locks the user's row (`SELECT … FOR UPDATE`) for count → verify → record,
  so attempts on one account are serialised. Test: 12 concurrent wrong passwords → exactly 5 checks,
  5 `invalid_credentials`, 7 `locked`, 5 rows recorded.
- Observations: O1 wording corrected in Decisions (the login does reveal accounts, by design, limited
  by rate limits); O2 the clean-up keeps pending sign-ups an admin disabled (test); O3 `RateLimit.prune()`
  called by the clean-up (test); O4 T010 now uses only `TRUSTED_PROXIES` (no uvicorn proxy headers);
  O5 test of the reuse log content; O6 length limits on code (12) and passwords (1024) (tests).
- 177 tests, 100 % coverage, three runs.

## QA — APPROVED (round 2)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | B1 re-check: `/api/health` 0.012–0.033 s during 5 concurrent wrong passwords (round 1: 1.53 s); bcrypt in `asyncio.to_thread` for verify, change-password and bootstrap | `docs/tasks/evidence/T005/qa/round2_probe_b1_b2.txt` | PASS |
| 2 | B1 loop vs pool: 40 parallel bcrypts on 4 CPUs — DB-free `/api/auth/config` ≤ 0.37 s (CPU contention), DB-backed `/api/health` 2.4–2.7 s waiting for a pooled connection (see O7) | `docs/tasks/evidence/T005/qa/round2_probe_loop_vs_pool.txt` | PASS |
| 3 | B2 re-check: sequential 5 → `locked` (right password too); 40 concurrent → 5 `invalid_credentials` / 35 `locked` / 5 rows; 100 concurrent → 5 / 95 / 5 rows; 39 wrong + right → 5 rows; success clears failures, then 5 more lock | `docs/tasks/evidence/T005/qa/round2_probe_b1_b2.txt` | PASS |
| 4 | Row lock on every path: bcrypt raising inside the locked section (500, generic body, lock released, 5 concurrent finish in 0.07 s); 8 clients disconnecting mid-check (5 rows, lock released, follow-ups answer in ms); wrong/right/locked mixes; no `idle in transaction`, no `users` locks left, 0 deadlocks in `pg_stat_database` | `docs/tasks/evidence/T005/qa/round2_probe_tx_paths.txt` | PASS |
| 5 | Lint (ruff check + format check) | `docs/tasks/evidence/T005/qa/round2_lint.txt` | PASS |
| 6 | Full backend suite + coverage ×3 (177 passed, 100 %, threshold 95) | `docs/tasks/evidence/T005/qa/round2_coverage_{1,2,3}.txt` | PASS |
| 7 | Migration down → up → `alembic check` | `docs/tasks/evidence/T005/qa/round2_migration.txt` | PASS |
| 8 | Workflow YAML parses; actionlint clean | `docs/tasks/evidence/T005/qa/round2_workflow.txt` | PASS |
| 9 | Manual flow: config → sign-up start (es) → code from Mailpit → verify (200, `access_token`, `Set-Cookie` HttpOnly/Secure/SameSite=strict/Path=/api/auth) → me → refresh; admin password login; O6 limits (13-char code, 1025-char password → 422) | `docs/tasks/evidence/T005/qa/round2_manual_flow.txt` | PASS |
| 10 | Round-1 observations: O1 Decisions reworded; O2 disabled pending sign-ups kept (test); O3 `RateLimit.prune()` from the clean-up (test); O4 T010 reworded (see O10); O5 reuse-log content test; O6 `max_length` on code/passwords (test + live) | code review + items 6, 9 | PASS |

Probe scripts: `round2_probe_b1_b2.sh`, `round2_probe_loop_vs_pool.sh`, `round2_probe_tx_paths.sh` (same folder).
Throwaway `qa-r2-*` users and all `failed_logins` rows were deleted after probing; the admin is not locked.

Lock review: one row lock per transaction, always taken first (`users` → `failed_logins`); the
locked path rolls back, the wrong path commits, the right path is committed by `login_verify`
right after; exceptions and cancellations end in `get_session`'s close (rollback). The scheduler
and cascades take `failed_logins`/`users` locks without waiting on the other order, so no cycle.
The tests run on PostgreSQL, so `test_concurrent_wrong_passwords_cannot_exceed_the_lockout`
exercises the real `FOR UPDATE`.

### Observations (non-blocking)
- **O7**: each password check keeps its pooled DB connection (and, now, the row lock) while bcrypt
  waits for and runs in the default executor (8 threads on 4 CPUs), so a burst of ≥ 15 verifies
  (pool 5 + overflow 10) makes every DB-backed request wait for a connection: `/api/health` took
  2.4–2.7 s during 40 concurrent verifies while the event loop itself stayed responsive. In
  production the per-IP verify limit (10/min) keeps a single client far from this; a distributed
  burst would saturate bcrypt CPU anyway. If it matters later: record the attempt and commit
  before hashing (verify outside the transaction, delete the row on success) or a dedicated
  bounded executor/semaphore smaller than the pool.
- **O8**: `with_for_update()` is `FOR UPDATE`, which also conflicts with the `FOR KEY SHARE` that
  inserting a `refresh_tokens` row takes on the parent user: refresh of the attacked account's own
  session took 1.65 s during 10 concurrent wrong passwords on it (bounded by the lockout to ~5
  bcrypts per window). `with_for_update(key_share=True)` (`FOR NO KEY UPDATE`) serialises the
  check equally without blocking FK inserts.
- **O9**: `user` (`is_active`, `password_hash`, `auth_method`) is loaded before the lock and not
  re-read after it, so a disable or password change committed while a request waits on the lock
  is not seen by that request. Tiny window; `populate_existing()` on the locking select would close it.
- **O10**: T010's new wording ("uvicorn without `--proxy-headers`") does not disable them: uvicorn
  0.54 defaults to `proxy_headers=True` (trusting `FORWARDED_ALLOW_IPS`, default 127.0.0.1).
  T010 should say `--no-proxy-headers` to keep `TRUSTED_PROXIES` the only trust list.

### After QA approval
- O8: the lockout lock is `FOR NO KEY UPDATE` (still serialises password checks; does not block the
  user's token refreshes) — test. O9: the user row is re-read under the lock and a disabled account is
  refused — test. O10: T010 says `--no-proxy-headers`. O7 accepted (bounded by the per-IP limit).
- 179 tests, 100 % coverage.
