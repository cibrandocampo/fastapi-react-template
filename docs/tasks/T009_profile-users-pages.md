# T009 — Profile and users admin pages

**Plan**: docs/plans/template-base.md · **Depends on**: T006, T008

## Objective
Every user edits their profile and preferences; admins manage users from the UI.

## Step 1 — Profile page (`/profile`)
Name, language and theme (saved immediately, applied at once), password: change (password users) or
set one (OTP users, switching to password login). User menu in the header links here and to logout.

The waiting page (T008) gets a link to the profile (T008 QA O8).

## Step 2 — Users page (`/admin/users`, admin only)
Mantine `Table`, `Modal`, `@mantine/form` and notifications. Table with search and filters (role, active),
pagination; "pending" badge and one-click "Grant access"
for role `none`; create user dialog; edit dialog (names, role, active, method, language); set password;
delete with confirmation. Guard errors (`last_admin`, `cannot_delete_self`, `email_taken`) shown
translated. Navigation entry visible to admins only.

## DoD
1. Tests for each action, its error states, and visibility by role.
2. Lint clean; coverage thresholds met; build succeeds.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make test-frontend` | `coverage.txt` | all pass, thresholds met |
| 2 | Lint | `make lint-frontend` | `lint.txt` | clean |
| 3 | Build | `npm run build` | `build.txt` | exit 0 |

## Files
| File | Action |
|------|--------|
| `frontend/src/pages/ProfilePage*`, `frontend/src/pages/admin/UsersPage*`, `frontend/src/components/**` | CREATE |
| `frontend/src/App.jsx`, `frontend/src/i18n/*.json` | MODIFY |
