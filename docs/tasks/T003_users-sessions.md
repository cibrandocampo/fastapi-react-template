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
