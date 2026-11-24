# T003 — Users, roles and sessions

**Plan**: docs/plans/template-base.md · **Depends on**: T002

## Context
Core identity model and session machinery the login (T005) and user management (T006) rely on.

## Objective
Users with roles exist, the first admin is created from env, and the app can issue, rotate and revoke
sessions and protect endpoints by role.

## Step 1 — Models and migration
`User`: id, email (unique, lower-cased), first_name, last_name, `auth_method` (`otp`|`password`),
password_hash (nullable), `role` (`none`|`user`|`admin`), is_active, language (`en`|`es`|`gl`),
theme (`system`|`light`|`dark`), created_at, updated_at, last_login_at.
`RefreshToken`: id, user_id, family_id, token_hash (SHA-256), created_at, expires_at, revoked_at,
replaced_by_id. Alembic migration.

## Step 2 — Security helpers (`app/core/security.py`)
bcrypt hash/verify; password rules (min 10 chars, not all digits, not equal to the email); access JWT
(HS256, `SECRET_KEY`, 15 min, claims sub/role/exp/iat/jti); refresh token = 32 random bytes urlsafe.

## Step 3 — Session service (`app/auth/sessions.py`)
- `issue(user)` → access token + new refresh token (new family), sets the cookie.
- `rotate(raw)` → valid token: revoke it, issue the next in the same family. A revoked token presented
  again → revoke the whole family (reuse detection) and 401. Expired → 401.
- `revoke(raw)`.
- Cookie: name `refresh_token`, HttpOnly, SameSite=Strict, path `/api/auth`, `Secure` from
  `COOKIE_SECURE` (default true), max-age = refresh lifetime (`REFRESH_TOKEN_DAYS`, default 30).

## Step 4 — Dependencies
`current_user` (Bearer access token, active user, else 401 `unauthorized`), `require_role("user")`
(`admin` passes too; role `none` → 403 `forbidden`), `require_admin`.

## Step 5 — Admin bootstrap
On start-up: if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set and no admin exists, create one
(password method, role admin, active). Idempotent; never changes an existing user.

## DoD
1. Migration applies and downgrades cleanly.
2. Tests: hashing and rules; access token valid/expired/tampered; rotation; reuse revokes the family;
   expired refresh; cookie attributes with `COOKIE_SECURE` true and false; role guards for none/user/admin
   and inactive users; bootstrap creates once and does nothing the second time or without env.
3. Lint clean; coverage ≥ 95 %.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Migration | `alembic upgrade head && alembic downgrade base && alembic upgrade head` in backend | `migration.txt` | exit 0 |
| 2 | Tests | `make coverage-backend` | `coverage.txt` | all pass, ≥ 95 % |
| 3 | Lint | `make lint-backend` | `lint.txt` | clean |

## Files
| File | Action |
|------|--------|
| `backend/app/users/models.py`, `backend/app/auth/models.py` | CREATE |
| `backend/app/core/security.py`, `backend/app/auth/sessions.py`, `backend/app/auth/deps.py` | CREATE |
| `backend/app/users/bootstrap.py`, `backend/app/main.py` | CREATE / MODIFY |
| `backend/alembic/versions/*` | CREATE |
| `backend/tests/**` | CREATE |
| `.env.example` | MODIFY |

## Execution evidence
**Date**: 2026-11-24
**Files**:
- `backend/app/users/models.py` — `User`, enums `Role`/`AuthMethod`/`Language`/`Theme` stored as text with
  check constraints; `has_role()` by level (none < user < admin).
- `backend/app/auth/models.py` — `RefreshToken` (hashed, family, expiry, revocation, replaced_by).
- `backend/app/core/security.py` — bcrypt (rounds from settings), password rules (10 chars minimum,
  72 bytes maximum, not only digits, not the email), access JWT (HS256, `type=access`, jti).
- `backend/app/auth/sessions.py` — issue / rotate (reuse revokes the family) / revoke / revoke_all,
  refresh cookie set/clear.
- `backend/app/auth/deps.py` — `CurrentUser`, `RequireUser`, `RequireAdmin`.
- `backend/app/users/bootstrap.py`, `backend/app/main.py` — first admin at start-up.
- `backend/app/core/config.py`, `.env.example` — session and admin settings.
- `backend/alembic/versions/20261124_4808058ebf43_users_and_refresh_tokens.py` — migration.
- `backend/tests/` — conftest fixtures `db`, `make_user`; tests for security, sessions, deps, bootstrap,
  model, lifespan.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Migration down/up + `alembic check` | `docs/tasks/evidence/T003/migration.txt` | PASS |
| 2 | Tests + coverage ×3 (66 tests after round 2, 100 %) | `docs/tasks/evidence/T003/coverage_{1,2,3}.txt` | PASS |
| 3 | Lint | `docs/tasks/evidence/T003/lint.txt` | PASS |
| 4 | Admin created in the dev stack at start-up | `docs/tasks/evidence/T003/dev_admin.txt` | PASS |

### Decisions
- Expired access tokens answer 401 `token_expired` (other invalid tokens 401 `unauthorized`): the
  frontend refreshes on any 401, the distinct code only helps debugging.
- Password maximum of 72 bytes: bcrypt ignores the rest; rejecting is clearer than truncating.
- A weak `ADMIN_PASSWORD` stops the start-up (RuntimeError) instead of being skipped silently.
- An `ADMIN_EMAIL` that belongs to an existing non-admin is not promoted (logged warning).
- Reuse detection revokes only that token family; other sessions of the user continue.
- `BCRYPT_ROUNDS=4` in tests for speed; production default 12.
- Two `# noqa: S105` with reasons: the `SECRET_KEY` placeholder and the enum value `password`.

## QA — RETURNED (round 1)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format check (`ruff check . && ruff format --check .`) | `docs/tasks/evidence/T003/qa/lint.txt` | PASS |
| 2 | Migration upgrade → downgrade base → upgrade + `alembic check` | `docs/tasks/evidence/T003/qa/migration.txt` | PASS |
| 3 | Targeted tests (security, sessions, deps, bootstrap, model, lifespan: 52) | `docs/tasks/evidence/T003/qa/targeted.txt` | PASS |
| 4 | Full suite + coverage ×3 (59 passed, 100 %, threshold 95) | `docs/tasks/evidence/T003/qa/coverage_{1,2,3}.txt` | PASS |
| 5 | Dev stack: admin created at start-up, idempotent on second restart | `docs/tasks/evidence/T003/qa/dev_admin.txt` | PASS |
| 6 | Security probes: JWT `alg=none`/HS512/other key rejected, claims sub/role/exp/iat/jti, 15 min, demoted admin → 403 (role read from DB) | `docs/tasks/evidence/T003/qa/probes.txt` | PASS |
| 7 | Step 1: email lower-cased and unique | `docs/tasks/evidence/T003/qa/probes.txt` | FAIL |
| 8 | Step 3: a refresh token is single-use (rotation under concurrency) | `docs/tasks/evidence/T003/qa/probes.txt` | FAIL |
| 9 | `make` targets | — | NEEDS USER (`make` not installed on the host; the wrapped commands were run instead) |

Probe source: `docs/tasks/evidence/T003/qa/qa_probe_test.py` (run inside the backend container with
`-p tests.conftest`, against the test database).

### Blockers
- **B1**: `backend/app/users/models.py:53` — Step 1 requires the email "unique, lower-cased"; the model
  stores it as given and the unique constraint is case-sensitive. Probe: `User(email="Mixed.Case@Example.com")`
  is stored as `Mixed.Case@Example.com`, and `Dup@Example.com` + `dup@example.com` are both stored
  (2 rows). Only `bootstrap.py` lower-cases. Expected: the model (or the database, e.g. a check
  constraint `email = lower(email)` / unique index on `lower(email)`) guarantees it for every writer
  (T005 sign-up, T006 user management), with a test.
- **B2**: `backend/app/auth/sessions.py:57-60` — `rotate()` reads the token without a lock and decides
  on `revoked_at` in Python, so concurrent rotations of the same refresh token all succeed. Probe:
  3 concurrent `rotate()` calls with one token → 3 successful rotations, 3 live tokens in the family.
  This defeats the single-use / reuse-detection guarantee (a stolen token raced against the owner
  yields a live session without revoking the family). Expected: an atomic claim (`SELECT … FOR UPDATE`,
  or `UPDATE … WHERE revoked_at IS NULL RETURNING`) so exactly one rotation wins and the others take
  the reuse path, with a concurrency test.

### Observations (non-blocking)
- Concurrent `ensure_admin()` (two workers starting at once) → one `IntegrityError` on the unique email
  (`probes.txt`). Harmless with one process; relevant if the production image runs several workers.
- The dev `.env` and `.env.example` use `SECRET_KEY=change-me` (9 bytes): PyJWT emits
  `InsecureKeyLengthWarning` (`secret_key.txt`). T010 should also enforce a minimum length (≥ 32 bytes),
  not only refuse the literal default.
- `log.info("Created the first administrator …")` (`bootstrap.py:44`) is not visible in the dev logs:
  no logging configuration routes `app.*` INFO records (`dev_admin.txt`). The warning/info also write
  the email (PII) to the logs.
- 401 responses carry no `WWW-Authenticate: Bearer` header (RFC 6750); harmless for the SPA.
- `issue()` does not set `last_login_at`; presumably T005 (login) does — confirm there.

### Round 2 (QA round 1: B1, B2)
- **B1**: `User.email` normalised by a model validator (`normalise_email`, also used by the bootstrap),
  and a unique index on `lower(email)` in the database, so writers that bypass the model are covered.
  A first attempt (`func.lower("email")`) indexed the literal string `'email'`; caught in the generated
  migration and fixed to `func.lower(User.email)`. Tests: normalisation, case duplicate via the ORM,
  case duplicate via raw SQL.
- **B2**: `rotate()` claims the token with one `UPDATE … WHERE revoked_at IS NULL RETURNING`. Test: three
  concurrent rotations of one token → exactly one succeeds and one live token remains.
- Consequence handled: two tabs refreshing at the same time would now trip reuse detection and log the
  user out. A rotated token presented again within `REFRESH_REUSE_GRACE_SECONDS` (10 s) is refused
  without revoking the family; later reuse, or reuse of a logged-out token, revokes it. T007's client
  retries a failed refresh once. Tests for inside/after the window and for logged-out tokens.
- Bootstrap: an `IntegrityError` from a concurrent instance is tolerated (test); log lines no longer
  contain the email.
- The initial migration was regenerated (not pushed yet); `app_test` was recreated because it was
  stamped with the discarded revision.
- QA observations moved to later tasks: SECRET_KEY length and logging (T010), `WWW-Authenticate` (T005),
  refresh retry (T007). `last_login_at` is set by the login (T005).

## QA — APPROVED (round 2)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format check (`ruff check . && ruff format --check .`) | `docs/tasks/evidence/T003/qa/round2_lint.txt` | PASS |
| 2 | Migration `cd2fe685ddc1`: upgrade → downgrade base → upgrade + `alembic check` (dev db) | `docs/tasks/evidence/T003/qa/round2_migration.txt` | PASS |
| 3 | Dev stack after migration down/up + restart: admin re-created; `uq_users_email_lower` is `lower((email)::text)` | `docs/tasks/evidence/T003/qa/round2_dev_admin.txt` | PASS |
| 4 | Targeted tests (sessions, model, bootstrap, security, deps, lifespan: 59) | `docs/tasks/evidence/T003/qa/round2_targeted.txt` | PASS |
| 5 | Full suite + coverage ×3 (66 passed, 100 %, threshold 95) | `docs/tasks/evidence/T003/qa/round2_coverage_{1,2,3}.txt` | PASS |
| 6 | B1: email lower-cased by the model (constructor and reassignment); case duplicates rejected for ORM, Core insert, Core update, raw SQL insert, raw SQL update | `docs/tasks/evidence/T003/qa/round2_probes.txt` | PASS |
| 7 | B2: concurrent `rotate()` of one token with 3 / 10 / 25 sessions → exactly 1 winner, others 401, 1 live token in the family; 20 rounds × 5 → 0 bad rounds | `docs/tasks/evidence/T003/qa/round2_probes.txt` | PASS |
| 8 | Grace window: replays inside the window issue no tokens (401, 0 rows created); replay after the window, ancestor replay and logged-out replay revoke the family; expired/inactive claims get no grace; two-tab race + retry with the new cookie works | `docs/tasks/evidence/T003/qa/round2_probes.txt` | PASS |
| 9 | `make` targets | — | NEEDS USER (`make` not installed on the host; the wrapped commands were run instead) |

Probe source: `docs/tasks/evidence/T003/qa/qa_probe_round2_test.py` (copied into the backend container,
run with `-p tests.conftest -c /app/pyproject.toml` against the test database).

### Round-1 blockers
- **B1** — resolved. Uniqueness ignoring case holds for every writer (functional unique index, verified
  in the dev db and by five writer paths). Lower-case storage is guaranteed only through the model (see
  observation 1).
- **B2** — resolved. The claim is a single `UPDATE … WHERE revoked_at IS NULL RETURNING`; under Postgres
  READ COMMITTED a concurrent claim re-checks the predicate after the winner commits and gets no row.

### Grace window — security review
- No replay window: a token presented inside the window is still refused (401) and nothing is issued;
  the window only defers the family revocation. The legitimate race (two tabs) is the only case it helps.
- Stolen token, owner rotates first: the thief's replay after 10 s revokes the family (probe). Inside
  10 s the thief gets nothing and the family survives until the next stale replay.
- Residual risk (accepted, same trade-off as the "reuse interval" of common IdPs): if the **thief**
  rotates first and the owner's refresh with the stale cookie lands within 10 s, detection does not fire
  (probe `test_grace_thief_first_owner_replays_inside_window`). The owner is sent to `/login`; the
  thief's chain stays live and slides indefinitely (each rotation gets a fresh 30-day expiry) unless the
  stale token is presented again after the window. Requires the thief to act within 10 s of the owner's
  own refresh. Mitigations listed below for T005; not a blocker for T003's scope.

### Observations (non-blocking)
1. A writer that bypasses the model (Core `insert`) stores `Core.Mixed@Example.com` as given, and the
   lookup `User.email == lower(x)` (as `bootstrap.py:29` does) then misses it. A check constraint
   `email = lower(email)` would make the database guarantee the "lower-cased" half too; lookups by
   `func.lower(User.email)` would also use the functional index (the current equality lookup cannot).
2. For T005 (`/refresh`, `/logout`): (a) a 401 from the grace path must **not** send a clearing
   `Set-Cookie` — in the two-tab race the losing response can arrive after the winner's and would delete
   the new cookie; (b) `/logout` with an already-rotated token is ignored by `revoke()` — consider
   revoking its family, so a user logged out by a thief-first race ends the thief's chain when the client
   calls logout; (c) consider an absolute family lifetime (from the login) and logging reuse events
   (family id, no PII) to bound the residual risk above; (d) rate-limit `/refresh` (security skill).
3. For T007: the refresh retry only helps once the winning tab's response has stored the new cookie; a
   retry fired while both refreshes are in flight sends the old token again (still 401). A short delay
   or a cross-tab lock (`navigator.locks` / BroadcastChannel) avoids it.
4. `REFRESH_REUSE_GRACE_SECONDS` (and `BCRYPT_ROUNDS`) are not listed in `.env.example`; defaults are
   sensible, documenting them would help operators.

### After QA approval
- Applied QA observations 1 and 4: check constraint `email = lower(email)` (test added, initial
  migration regenerated, test database recreated) and `REFRESH_REUSE_GRACE_SECONDS`, `BCRYPT_ROUNDS`
  in `.env.example`. Observations 2 and 3 added to T005 and T007.
