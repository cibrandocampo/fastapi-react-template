# T007 — Frontend skeleton

**Plan**: docs/plans/template-base.md · **Depends on**: T002

## Context
React foundation the pages (T008, T009) are built on, running in the dev compose.

## Objective
A Vite + React app in `frontend/` served at `localhost:15173` with routing, API client, i18n, theme,
an app shell, and lint/format/test tooling in Docker.

## Step 1 — Tooling
Node 24 LTS, Vite, React 19, React Router, TanStack Query, i18next + react-i18next +
browser language detector, ESLint (flat config, react-hooks, jsx-a11y), Prettier, vitest + jsdom +
Testing Library + msw, v8 coverage with thresholds 95/90/95/95. `dev/Dockerfile.frontend`, `frontend`
service in the dev compose (port 15173, `/api` proxied to the backend). npm scripts: `dev`, `build`,
`lint`, `format`, `format:check`, `test`, `test:coverage`. Makefile targets `test-frontend`,
`lint-frontend`, `format-frontend`.

## Step 2 — Core modules
- `src/api/client.js`: fetch wrapper; access token kept in memory; on 401 one shared `POST /api/auth/refresh`
  (cookie) then a single retry; refresh failure → clear session and go to `/login`; errors thrown as
  `ApiError(status, code, message)` from the `{"error": {...}}` envelope.
- `src/i18n/`: en/es/gl JSON, fallback en, detection localStorage → navigator.
- `src/theme/`: `data-theme` on `<html>` (absent for `system`), CSS custom properties for both themes,
  cached choice applied before first render (no inline script, CSP-friendly).
- `src/styles/`: tokens (colours, spacing, radius, typography) and base styles; CSS modules for components.
- App shell: header with app name, navigation slot and user menu placeholder; `HomePage` placeholder;
  `NotFoundPage`.

## DoD
1. `make dev-up` serves the app at `localhost:15173`; `/api/health` works through the proxy.
2. Tests: client refresh-and-retry, shared refresh for parallel 401s, refresh failure redirect, error
   parsing; language detection and fallback; theme application and cache.
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
