# T006 — User management API

**Plan**: docs/plans/template-base.md · **Depends on**: T003

## Context
Admins grant access to sign-ups (role `none` → `user`) and manage accounts from the UI (T009).

## Objective
Admin-only `/api/users` endpoints with guards that keep at least one active admin.

## Step 1 — Endpoints (admin only)
- `GET /api/users?q=&role=&active=&page=&size=` → paginated list (`items`, `total`), search by email/name.
- `POST /api/users {email, first_name, last_name, role, auth_method, password?, language?}` → creates an
  active user with `email_verified_at` set (the admin vouches for it, so the unverified-sign-up
  clean-up never deletes it) (password required for the password method, rules from T003).
- `GET /api/users/{id}`, `PATCH /api/users/{id}` (names, role, is_active, auth_method, language).
- `POST /api/users/{id}/set-password {password}` (sets method `password`, revokes their sessions).
- `DELETE /api/users/{id}`.
- Deactivating, demoting or deleting a user revokes their sessions.
- Guards: the last active admin cannot be demoted, deactivated or deleted (409 `last_admin`); an admin
  cannot delete themselves (409 `cannot_delete_self`). Duplicate email → 409 `email_taken`.

## DoD
1. Tests for each endpoint, each guard, 403 for `user`/`none`, 401 without token, session revocation.
2. Lint clean; coverage ≥ 95 %.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make coverage-backend` | `coverage.txt` | all pass, ≥ 95 % |
| 2 | Lint | `make lint-backend` | `lint.txt` | clean |

## Files
| File | Action |
|------|--------|
| `backend/app/users/router.py`, `backend/app/users/schemas.py`, `backend/app/users/service.py` | CREATE |
| `backend/app/main.py` | MODIFY |
| `backend/tests/test_users_admin.py` | CREATE |
