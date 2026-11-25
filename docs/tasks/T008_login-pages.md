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

Dev note (T007 QA O9): the refresh cookie is `Secure` by default; browsers accept it on
`http://localhost`, but check the session survives a reload in the dev stack, and set
`COOKIE_SECURE=false` in the dev compose if a browser drops it.

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

## Execution evidence
**Date**: 2026-11-25
**Files**:
- `frontend/src/auth/AuthContext.jsx` — `AuthProvider`: restores the session from the refresh cookie on load,
  `loginStart`, `loginVerify`, `updateProfile`, `logout` (local logout even when the server is unreachable),
  session-end handler → `/login`, applies the user's saved language and colour scheme.
- `frontend/src/auth/useAuth.js` — context and `useAuth()` hook (own file for fast refresh).
- `frontend/src/auth/routes.jsx` — `RequireSession` (anonymous → `/login` with `from`; no name → `/welcome`),
  `RequireRole` (role `none` → `/waiting`, insufficient → not found), `AnonymousOnly` (the single place that
  leaves the login page once there is a session: back to `from` or home).
- `frontend/src/pages/LoginPage.jsx` — email → code (PinInput, 30 s resend countdown, back) or password; every
  API error code translated; heading from `/auth/config`.
- `frontend/src/pages/WelcomePage.jsx`, `WaitingPage.jsx`; `components/LanguageMenu.jsx`, `UserMenu.jsx`;
  `ColorSchemeMenu.jsx` and the language menu save the choice in the profile when logged in.
- `frontend/src/App.jsx` — routes; `Providers.jsx` — `env` prop (Mantine `env="test"` in tests).
- `frontend/src/i18n/*.json` — login, welcome, waiting, user and language texts in en/es/gl.
- Tests: `auth/auth.test.jsx`, `pages/LoginPage.test.jsx`, `pages/WelcomePage.test.jsx`, `App.test.jsx`;
  `test/server.js` default handlers (no session, sign-up closed), `withSession`, `makeUser`, `apiError`.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Tests + coverage ×3 (66 tests, 100 % everywhere) | `docs/tasks/evidence/T008/coverage_{1,2,3}.txt` | PASS |
| 2 | Lint + format check | `docs/tasks/evidence/T008/lint.txt` | PASS |
| 3 | Production build | `docs/tasks/evidence/T008/build.txt` | PASS |
| 4 | Manual flows in Chrome (sign-up with the Mailpit code → waiting; admin → home; reload keeps the session) | `docs/tasks/evidence/T008/manual.txt`, `manual/*.jpg` | PASS |

### Decisions
- Two redirects raced after a login (the login page's own `navigate` and `AnonymousOnly`'s redirect to `/`),
  so the return-to-page was lost: `AnonymousOnly` is now the only redirect (to `from` or `/`), and
  `RequireSession` sends new accounts to `/welcome`.
- Tests use Mantine's `env="test"` (no transitions or portals): menu items were found but inaccessible
  during the opening transition.
- No `autoFocus` (jsx-a11y): focus moves to the code/password field when its step appears.
- The welcome form uses `noValidate`; validation is `@mantine/form`'s, translated.
- The bootstrap admin has no name, so it also goes through the welcome step on its first login.
- The Secure refresh cookie works on `http://localhost` (checked), so the dev compose keeps the default
  (T007 QA O9 closed). The white first-paint flash in dark mode is moved to T010.

## QA — RETURNED (round 1)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | ESLint (`npm run lint`, 0 warnings) | `docs/tasks/evidence/T008/qa/lint.txt` | PASS |
| 2 | Prettier check | `docs/tasks/evidence/T008/qa/format.txt` | PASS |
| 3 | Frontend tests + coverage (66 passed, 100 % statements/branches/functions/lines, every new file) | `docs/tasks/evidence/T008/qa/coverage.txt` | PASS |
| 4 | Production build (exit 0; >500 kB chunk warning only) | `docs/tasks/evidence/T008/qa/build.txt` | PASS |
| 5 | Backend suite (283 passed) | `docs/tasks/evidence/T008/qa/backend.txt` | PASS |
| 6 | No code, password or token logged, put in a URL or in web storage (token in memory only; storage holds colour scheme and language) | `docs/tasks/evidence/T008/qa/secrets-grep.txt` | PASS |
| 7 | Route guards and session: restore, anonymous → `/login` with `from`, new → `/welcome`, role none → `/waiting`, insufficient → not found, return to `from`, logout (online and offline), session end → `/login` (code review + tests in `auth.test.jsx`, `LoginPage.test.jsx`) | `docs/tasks/evidence/T008/qa/coverage.txt` | PASS |
| 8 | Manual flows (sign-up with Mailpit code → `/waiting` in gl; admin → welcome → `/`; reload keeps the session) — implementer's screenshots reviewed | `docs/tasks/evidence/T008/manual.txt`, `manual/*.jpg` | PASS |
| 9 | Accessible labels of the code input (Step 3) | `docs/tasks/evidence/T008/qa/pininput-dom.txt` | FAIL |

### Blockers
- **B1**: `frontend/src/pages/LoginPage.jsx:140-152` — Step 3 requires accessible labels. Expected: each code
  input has a translated accessible name and the visible "Code" label names a real control. Found: Mantine
  renders the six digit inputs with `aria-label="PinInput"` (its English default, in en/es/gl alike: a screen
  reader announces "PinInput" six times), and `<label for="login-code">` points at the `role="group"` div,
  which is not labelable (the label names nothing; clicking it focuses nothing). The group's own
  `aria-label="Code"` does not name the inputs. Evidence: `qa/pininput-dom.txt`. Fix: pass PinInput's
  `ariaLabel` prop (or `getInputProps={(i) => ({ 'aria-label': t('login.codeDigit', { n: i + 1 }) })}`-style
  per-digit names, translated) and point the label at `login-code-1` or drop `htmlFor` in favour of
  `aria-labelledby` on the group; add a test that finds the first digit by its accessible name.

### Observations (non-blocking)
- **O1** — Invalid email (e.g. `not-an-email`): the form is `noValidate`, so the backend's `422 validation_error`
  (`qa/invalid-email.txt`) is shown as "Something went wrong. Please try again." A likely typo deserves its own
  message ("Enter a valid email address") or native `type=email` validation.
- **O2** — modern-web-guidance `forms/autofill-sign-in-form`: the email field uses `autocomplete="email"`; the
  guide asks for `autocomplete="username"` (password managers pair it with the password) and
  `spellcheck="false"`. On the password step the email is no longer in the form, so a password manager cannot
  associate the saved password with the account; a hidden/read-only `autocomplete="username"` input holding the
  email on that step fixes it.
- **O3** — `forms/sms-otp-form` recommends one `type="text" inputmode="numeric"` input instead of split boxes;
  the task mandates `PinInput`, so this is noted only. PinInput does set `autocomplete="one-time-code"` and
  `inputmode="numeric"` (inputs are `type="tel"`).
- **O4** — Error alert is announced (`role="alert"`) but not tied to the field (`aria-invalid` /
  `aria-describedby`).
- **O5** — On a fresh load without a session, `refreshSession()` gets a 401 and fires the session-end handler
  (`navigate('/login')` without state) while `RequireSession` also redirects with `from`. `from` survives only
  because the guard's redirect runs last (router updates are transitions). It works and is tested, but the
  initial restore could skip the session-end handler to remove the double redirect.
- **O6** — `from` keeps only `pathname`; query string and hash are dropped on the return trip.
- **O7** — `LanguageMenu` / `ColorSchemeMenu`: `updateProfile(...)` is fire-and-forget; a failed PATCH is an
  unhandled promise rejection and the user gets no feedback while the preference is not saved.
- **O8** — Step 4 asks for a link to the profile from the waiting page; the profile page arrives in T009, which
  does not mention adding that link. Carry it over to T009.
- **O9** — `Loader aria-label="Loading"` (`auth/routes.jsx`) is not translated.
- **O10** — Texts hard-code "10 minutes" (OTP) and "15 minutes" (lockout) while `otp_minutes` and
  `lockout_minutes` are configurable; they drift if an operator changes them.
- **O11** — Wording: es "Esta cuenta entra de otra forma" / gl "Esta conta entra doutro xeito" read unnaturally;
  suggest "Esta cuenta usa otro método de acceso. Vuelve atrás e inténtalo de nuevo." / "Esta conta usa outro
  método de acceso. Volve atrás e téntao de novo." es says "un administrador" while gl uses the inclusive
  "unha persoa administradora"; align one way. gl "Enviamos un código" reads better as "Enviámosche un código".
- **O12** — The welcome step has no way to log out (a user who does not want to give a name is stuck there).

### Round 2 (QA round 1: B1)
- **B1**: the code digits are named "Code digit N of 6" (translated) through PinInput's `getInputProps`, and the
  group is labelled by the visible "Code" text (`aria-labelledby`). Test: the group and the six digits are found
  by their accessible names; the code-typing helper now uses them.
- Observations applied: O1 the email shape is checked before calling the API and a server `validation_error`
  reads "Enter a valid email address"; O2 `autocomplete="username"`, no spellcheck/autocapitalise on the email,
  and a hidden read-only username field on the password step for password managers; O7 failures saving the
  language or colour scheme from the menus show a notification; O11 Spanish and Galician wording (method
  mismatch, "una persona administradora", "Enviámosche"); the loader label is translated; the welcome step has a
  log-out button; the return-to-page keeps the query string and hash. O8 (profile link on the waiting page)
  moved to T009. Durations in the texts stay at their defaults (10 and 15 minutes).
- 73 tests, 100 % coverage, three runs; lint and build OK.

## QA — RETURNED (round 2)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Round-1 B1: code group named "Code" via `aria-labelledby`, digits named "Code digit N of 6" / "Cifra N de 6 del código" / "Cifra N de 6 do código" (rendered DOM, accessible names computed, en/es/gl) | `docs/tasks/evidence/T008/qa/round2-pininput-dom.txt` | PASS |
| 2 | Focus management: focus moves to the first field of the next step (code and password) | `docs/tasks/evidence/T008/qa/round2-focus.txt` | FAIL |
| 3 | ESLint (`npm run lint`, 0 warnings) | `docs/tasks/evidence/T008/qa/round2-lint.txt` | PASS |
| 4 | Prettier check | `docs/tasks/evidence/T008/qa/round2-format.txt` | PASS |
| 5 | Frontend tests + coverage (73 passed, 100 % statements/branches/functions/lines) | `docs/tasks/evidence/T008/qa/round2-coverage.txt` | PASS |
| 6 | Production build (exit 0; >500 kB chunk warning only) | `docs/tasks/evidence/T008/qa/round2-build.txt` | PASS |
| 7 | Round-1 observations applied (code review + tests): O1 email shape check and `validation_error` → "Enter a valid email address"; O2 `autocomplete="username"`, no spellcheck/autocapitalise, hidden read-only username on the password step; O7 menu save failures → notification; O9 loader label translated; O11 es/gl wording; O12 welcome log-out; O6 return keeps query and hash; O8 carried to T009 | `docs/tasks/evidence/T008/qa/round2-coverage.txt` | PASS |

### Blockers
- **B2**: `frontend/src/pages/LoginPage.jsx:142-153` — Step 3 requires focus management; round 1 had focus on the
  first digit after the code step appeared (`qa/pininput-dom.txt`). Found: focus reaches "Code digit 1 of 6" and is
  then lost to `<body>`. Cause: round 2 removed PinInput's static `id`; Mantine's `useId` then swaps the React id for
  a random one in a layout effect, and PinInput keys its inputs by `${uuid}-${index}`, so all six inputs remount
  after `secretInput.current.focus()` has run (trace and Mantine source in `qa/round2-focus.txt`). The password step
  is unaffected (its node is kept). No test asserts focus. Fix: give PinInput a static `id` again (e.g.
  `id="login-code"`; the group keeps `aria-labelledby`) and add tests that the first code digit and the password
  field have focus when their step appears (`toHaveFocus()`).

### Observations (non-blocking)
- **O13** — `LoginPage.jsx` maps every `validation_error` to `invalid_email`, also on resend and verify, where the
  email is not the field at fault; scope the mapping to `start` (or check the error's field).
- **O14** — Only the language menu's save failure is tested; the colour-scheme menu's `.catch(notifyError)` has no
  test (coverage stays 100 % because the handler is a function reference).
- **O15** — The hidden username input uses `type="email"`; with `hidden` it is fine for password managers, but a
  plain `type="text"` avoids any constraint-validation surprise if `noValidate` is ever removed.
- Earlier observations not addressed (O3, O4, O5, O10) remain as recorded in round 1.

### Round 3 (QA round 2: B2)
- **B2**: PinInput has a fixed `id` again (without it Mantine swaps a generated id after mounting and rebuilds
  the inputs, dropping the focus). Tests: focus on the first code digit (checked again after Mantine's layout
  effects) and on the password field. The code-digit test fails with the `id` removed (checked).
- O13: a `validation_error` reads "invalid email" only on the email step (test). O14: a failed colour-scheme
  save notifies (test). O15: the hidden username field is `type="text"`.
- 77 tests, 100 % coverage, three runs.

## QA — APPROVED (round 3)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Round-2 B2: focus trace (same probe as round 2) — code step: focus lands on `#login-code-1` "Code digit 1 of 6" and is still there, connected, 300 ms later; password step: focus on the password field | `docs/tasks/evidence/T008/qa/round3-focus.txt` | PASS |
| 2 | B2 tests: `LoginPage.test.jsx` asserts `toHaveFocus()` on the first code digit (re-checked after Mantine's layout effects) and on the password field | `docs/tasks/evidence/T008/qa/round3-coverage.txt` | PASS |
| 3 | Round-2 observations: O13 `validation_error` → invalid email only on the email step (test); O14 colour-scheme save failure notifies (test); O15 hidden username is `type="text"` | `docs/tasks/evidence/T008/qa/round3-coverage.txt` | PASS |
| 4 | ESLint (`npm run lint`, 0 warnings) | `docs/tasks/evidence/T008/qa/round3-lint.txt` | PASS |
| 5 | Prettier check | `docs/tasks/evidence/T008/qa/round3-format.txt` | PASS |
| 6 | Frontend tests + coverage (77 passed, 100 % statements/branches/functions/lines) | `docs/tasks/evidence/T008/qa/round3-coverage.txt` | PASS |
| 7 | Production build (exit 0; >500 kB chunk warning only) | `docs/tasks/evidence/T008/qa/round3-build.txt` | PASS |

### Observations (non-blocking)
- **O16** — The first-code-digit focus test waits a fixed 50 ms (`setTimeout`) before re-checking; it works, but a
  fixed sleep is timing-dependent. Acceptable here because the condition is already true before the wait.
- Earlier observations not addressed (O3, O4, O5, O10) remain as recorded in round 1.
