# T008 — Login, onboarding and waiting-for-access pages

**Plan**: docs/plans/template-base.md · **Depends on**: T005, T007

## Objective
A user can sign in (code or password), sign up when enabled, complete their name, and a user without
permissions sees a waiting page; routes are protected by session and role.

## Step 1 — Auth state
`AuthContext`: on load tries `POST /api/auth/refresh` (restores the session from the cookie); exposes
`user`, `status` (`loading`|`anonymous`|`authenticated`), `loginStart`, `loginVerify`, `completeProfile`,
`logout`. After login applies the user's language and theme.

## Step 2 — Routes
`ProtectedRoute` (anonymous → `/login`, `is_new` → onboarding step), `RoleRoute(min="user"|"admin")`
(role `none` → `/waiting`, insufficient → 404 page). `/login`, `/waiting`, and the shell routes.

## Step 3 — Login page
Mantine components (`PinInput` for the code). Steps: email → code (6-digit input, 30 s resend cooldown, back) or password → name (new users).
Heading "Sign in" or "Sign in or create an account" from `/config`. Every API error code mapped to a
translated message (`user_not_found`, `disposable_email`, `invalid_credentials`, `method_mismatch`,
`locked`, `rate_limited`, `account_disabled`). Accessible labels and focus management.

## Step 4 — Waiting page
Explains that an administrator must grant access; shows the email; links to profile and logout.

## DoD
1. Tests for each step, each error, resend cooldown, session restore, redirects of both route guards, logout.
2. Lint clean; coverage thresholds met; build succeeds.
3. Manual check in the dev stack: sign-up with the code from Mailpit lands on `/waiting`; admin login lands on `/`.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make test-frontend` | `coverage.txt` | all pass, thresholds met |
| 2 | Lint | `make lint-frontend` | `lint.txt` | clean |
| 3 | Build | `npm run build` | `build.txt` | exit 0 |
| 4 | Manual | Playwright script or screenshots of both flows | `manual/*.png`, `manual.txt` | flows as described |

## Files
| File | Action |
|------|--------|
| `frontend/src/auth/**`, `frontend/src/pages/LoginPage*`, `frontend/src/pages/WaitingPage*` | CREATE |
| `frontend/src/App.jsx`, `frontend/src/i18n/*.json` | MODIFY |
