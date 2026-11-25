# T007 — Frontend skeleton

**Plan**: docs/plans/template-base.md · **Depends on**: T002

## Context
React foundation the pages (T008, T009) are built on, running in the dev compose.

## Objective
A Vite + React app in `frontend/` served at `localhost:15173` with routing, API client, i18n, theme,
an app shell, and lint/format/test tooling in Docker.

## Step 1 — Tooling
Node 24 LTS, Vite, React 19, React Router, TanStack Query, Mantine (`@mantine/core`, `@mantine/hooks`,
`@mantine/form`, `@mantine/notifications`, PostCSS preset), i18next + react-i18next +
browser language detector, ESLint (flat config, react-hooks, jsx-a11y), Prettier, vitest + jsdom +
Testing Library + msw, v8 coverage with thresholds 95/90/95/95. `dev/Dockerfile.frontend`, `frontend`
service in the dev compose (port 15173, `/api` proxied to the backend). npm scripts: `dev`, `build`,
`lint`, `format`, `format:check`, `test`, `test:coverage`. Makefile targets `test-frontend`,
`lint-frontend`, `format-frontend`.

## Step 2 — Core modules
- `src/api/client.js`: fetch wrapper; access token kept in memory; on 401 one shared `POST /api/auth/refresh`
  (cookie) then a single retry; when the refresh itself answers 401, retry it once after a short
  delay (another tab may have just rotated the cookie: the backend refuses the old token for 10 s
  without ending the session), and coordinate tabs with a Web Locks / BroadcastChannel lock so only
  one tab refreshes at a time; refresh failure → clear session and go to `/login`; errors thrown as
  `ApiError(status, code, message)` from the `{"error": {...}}` envelope.
- `src/i18n/`: en/es/gl JSON, fallback en, detection localStorage → navigator.
- `src/theme.js`: the Mantine theme (primary colour, radius, fonts) — the single place a project changes
  its look. Colour scheme light/dark/`auto` through Mantine's colour-scheme manager (localStorage), synced
  with the user's `theme` after login; no inline script (CSP-friendly).
- CSS modules only for the few layout pieces Mantine does not cover.
- App shell: Mantine `AppShell` with header (app name, navigation, user menu placeholder); `HomePage`
  placeholder; `NotFoundPage`. Notifications provider for API errors.

## DoD
1. `make dev-up` serves the app at `localhost:15173`; `/api/health` works through the proxy.
2. Tests: client refresh-and-retry, shared refresh for parallel 401s, refresh failure redirect, error
   parsing; language detection and fallback; colour scheme switch and persistence.
3. `make lint-frontend` (eslint --max-warnings 0 + prettier check) clean; coverage thresholds met;
   `npm run build` succeeds.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Proxy | `curl -s localhost:15173/api/health` | `proxy.txt` | `{"status":"ok"}` |
| 2 | Tests | `make test-frontend` (coverage) | `coverage.txt` | all pass, thresholds met |
| 3 | Lint | `make lint-frontend` | `lint.txt` | clean |
| 4 | Build | `npm run build` in the frontend container | `build.txt` | exit 0 |

## Files
| File | Action |
|------|--------|
| `frontend/**` | CREATE |
| `dev/Dockerfile.frontend`, `dev/docker-compose.yml`, `Makefile` | CREATE / MODIFY |

## Execution evidence
**Date**: 2026-11-25
**Files**:
- `frontend/package.json`, `package-lock.json` — React 19, React Router 8, TanStack Query 5, Mantine 9,
  i18next 27, Vite 8, Vitest 5, MSW 3, ESLint 9, Prettier 3.
- `frontend/vite.config.js` (dev proxy `/api` → `API_TARGET`, Vitest with jsdom and v8 coverage
  thresholds 95/90/95/95), `postcss.config.cjs` (Mantine preset), `eslint.config.js` (recommended,
  react-hooks, react-refresh, jsx-a11y), `.prettierrc.json`, `index.html` (no inline script).
- `frontend/src/api/client.js` — `api()` JSON client, access token in memory, one shared refresh on 401
  (Web Locks across tabs when available), single retry after 300 ms on `refresh_in_progress`,
  `onSessionEnd` handler (default: go to `/login`), `ApiError(status, code, message, details)`.
- `frontend/src/api/queryClient.js` — unhandled query/mutation errors shown as translated notifications.
- `frontend/src/i18n/` — en/es/gl, detection localStorage → navigator, `es-ES` → `es`, fallback en,
  `<html lang>` kept in step.
- `frontend/src/theme.js` — Mantine theme and colour-scheme manager (light/dark/auto in localStorage).
- `frontend/src/Providers.jsx`, `App.jsx`, `main.jsx`, `components/AppLayout.jsx`,
  `components/ColorSchemeMenu.jsx`, `pages/HomePage.jsx`, `pages/NotFoundPage.jsx`.
- Tests: `api/client.test.js`, `api/queryClient.test.jsx`, `i18n/i18n.test.js`, `App.test.jsx`; setup with
  jsdom polyfills Mantine needs, MSW server, `renderWithProviders`.
- `dev/Dockerfile.frontend` (runs as `node`, node_modules in a named volume), `dev/docker-compose.yml`
  (`frontend` service on 15173 with health check), `Makefile` (test/lint/format/build-frontend, test, lint).

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | `/api/health` through the Vite proxy | `docs/tasks/evidence/T007/proxy.txt` | PASS |
| 2 | Tests + coverage ×3 (24 tests, 100 % everywhere) | `docs/tasks/evidence/T007/coverage_{1,2,3}.txt` | PASS |
| 3 | Lint + format check | `docs/tasks/evidence/T007/lint.txt` | PASS |
| 4 | Production build | `docs/tasks/evidence/T007/build.txt` | PASS |

### Decisions
- Mantine instead of hand-written CSS tokens (user decision, plan updated): the theme is `theme.js`;
  CSS modules were not needed yet.
- JavaScript (JSX), as nudge; no TypeScript.
- ESLint 9 instead of 10: `eslint-plugin-jsx-a11y` does not support ESLint 10 yet; accessibility rules
  were kept over the newer major.
- The core `no-unused-vars` does not see JSX usage; names starting with a capital letter are exempt.
- Colour-scheme sync with the user's saved `theme` happens after login (T008).
- `make` is still not installed on the host: the Makefile targets' commands were run directly (NEEDS USER).

## QA — APPROVED (round 1)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | ESLint (`--max-warnings 0`) + Prettier check | `docs/tasks/evidence/T007/qa/lint.txt` | PASS |
| 2 | Frontend tests + v8 coverage (24 passed, 100 % stmts/branches/funcs/lines, every file) | `docs/tasks/evidence/T007/qa/coverage.txt` | PASS |
| 3 | Production build (`vite build`, exit 0) | `docs/tasks/evidence/T007/qa/build.txt` | PASS |
| 4 | Built `index.html` has no inline script | `docs/tasks/evidence/T007/qa/build_html.txt` | PASS |
| 5 | Backend suite, regression (283 passed, 100 %) | `docs/tasks/evidence/T007/qa/backend.txt` | PASS |
| 6 | `/api/health` through the Vite proxy → `{"status":"ok"}`; `/api/auth/refresh` reaches the backend (401 envelope) | `docs/tasks/evidence/T007/qa/proxy.txt` | PASS |
| 7 | Dev stack: `frontend` healthy; `/` and `/nowhere/deep` serve the SPA, `src/main.jsx` and `NotFoundPage.jsx` transform (200) | `docs/tasks/evidence/T007/qa/ps.txt`, `app_html.txt` | PASS |
| 8 | Visual check in a browser (colour-scheme menu, not-found page) | `docs/tasks/evidence/T007/qa/browser.txt` | NEEDS USER |
| 9 | `make dev-up` / `make test-frontend` / `make lint-frontend` (make not installed; wrapped commands run directly) | — | NEEDS USER |
| 10 | Code review (scope, client.js, a11y, tests) | this section | PASS |

### Observations        (non-blocking)
- **O1** DoD 2 asks for a "language detection" test: `i18n.test.js` covers regional mapping and fallback through
  `changeLanguage`, but not the detection order (localStorage before navigator). Worth a test in T008.
- **O2** `src/api/client.js:103-107`: any refresh failure ends the session, including a network error, 5xx or
  429 (`rate_limited`), so a transient failure logs the user out. Matches the task text literally; consider
  ending the session only on a 401. On a thrown `fetch` (network) `accessToken` is not cleared (line 76 only
  runs for HTTP errors).
- **O3** `client.js:105-106`: every request waiting on a failed shared refresh calls `sessionEndHandler`, so N
  parallel requests trigger N redirects. Harmless with `location.assign`; matters once T008 sets a handler
  with side effects.
- **O4** Cross-tab coordination uses Web Locks only (no BroadcastChannel fallback); without Web Locks tabs rely
  on the backend's 10 s grace and the `refresh_in_progress` retry. Acceptable per the task's "Web Locks /
  BroadcastChannel".
- **O5** Tests: `vi.unstubAllGlobals()` runs at the end of the test body (`client.test.js`), so a failing
  assertion leaks the stub; prefer `afterEach`. `App.test.jsx` imports `render` after the local imports.
- **O6** The colour-scheme test checks the value written to localStorage, not that it is read back on load.
- **O7** a11y: the header app name is an `h3` that precedes the page `h1`; the colour-scheme items express the
  selection with `aria-current` (a `menuitemradio` with `aria-checked` would be the closer role). Icons are
  decorative inside a labelled `ActionIcon`; `<html lang>` follows the language.
- **O8** Build warns about a 563 kB JS chunk (Mantine + icons); code-splitting can wait for T010.
- **O9** The refresh cookie is `Secure`; over `http://localhost:15173` Chrome/Firefox accept it, other browsers
  may not — keep in mind for the T008 manual checks.

### After QA approval
- O2: only a 401 from the refresh ends the session; a network error, 5xx or 429 keeps it (and the token).
  O3: the session-end handler runs once per failed refresh, not once per waiting request. Tests for both.
- O7: the header no longer uses a heading (the page's h1 is the first heading); Mantine forces
  `role="menuitem"`, so the active colour scheme keeps `aria-current` and gets a visible check mark.
- O1, O6: tests for the saved language winning over the browser's and for the saved colour scheme applied
  on load. O5: `vi.unstubAllGlobals()` in `afterEach`.
- O8 (bundle size) moved to T010, O9 (Secure cookie in dev) to T008; O4 (BroadcastChannel fallback) not
  done: Web Locks are in every current browser.
- 31 tests, 100 % coverage, three runs; build OK.
