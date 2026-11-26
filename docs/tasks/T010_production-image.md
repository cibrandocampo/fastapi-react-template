# T010 — Production image and deployment files

**Plan**: docs/plans/template-base.md · **Depends on**: T009

## Objective
One image serves the API and the built frontend; `docker-compose.yml` runs it with Postgres, ready for
Synology Container Manager.

## Step 1 — Dockerfile (repository root)
Multi-stage: node stage builds `frontend/dist`; python 3.14-slim stage installs `requirements.txt`
with `--require-hashes`, copies the backend and the dist; non-root user; entrypoint runs
`alembic upgrade head` then uvicorn with `--no-proxy-headers` (enabled by default since uvicorn 0.54;
one trust list only: the app's
`TRUSTED_PROXIES`, used by `client_ip()`; HTTPS detection is not needed because cookies are
configured by `COOKIE_SECURE`);
`HEALTHCHECK` on `/api/health`; build arg `APP_VERSION` exposed in `/api/health`.
FastAPI serves `/assets` statically and every non-`/api` path with `index.html` (SPA fallback),
with cache headers (hashed assets immutable, index no-cache) and security headers
(CSP without inline scripts, X-Content-Type-Options, Referrer-Policy, frame-ancestors none).
Refuses to start in production with the default `SECRET_KEY` or one shorter than 32 bytes.
Logging configured for the app's own loggers (level from `LOG_LEVEL`), without personal data.
Unhandled exceptions are logged and answered as 500 with the error envelope
(`internal_error`, no details leaked); tested.

First paint: avoid the white flash before the colour scheme is applied in dark mode (a `color-scheme`
meta / background in a static stylesheet, no inline script).
Bundle size: split the frontend bundle (lazy-loaded routes, Mantine/vendor chunk) so the build has no
chunk-size warning (T007 QA O8: 563 kB single chunk).

## Step 2 — Compose and config
`docker-compose.yml`: `app` (image `${DOCKER_IMAGE}:${APP_TAG:-stable}`, port `${APP_PORT:-8000}`,
`restart: unless-stopped`, `read_only` with tmpfs `/tmp`, healthcheck) and `db` (postgres:17-alpine,
bind mount `${DATA_PATH:-./data}/postgres`). `.env.example` complete and commented.
`docs/configuration.md`: every variable, default and purpose; HTTPS behind a reverse proxy
(`COOKIE_SECURE`, `TRUSTED_PROXIES`); backups of the database.

## Step 3 — Tooling
Makefile: `build` (local image), `up`, `down`, `logs`, `pull`, `qa` (all lint + tests), `e2e` placeholder
filled in T011. `scripts/pre-commit` (ruff check/format, eslint, prettier in the dev containers) and
`scripts/install-hooks.sh`; `make hooks`.

## DoD
1. `make build` builds the image; it runs as non-root.
2. Image started with a fresh Postgres via `docker-compose.yml`: `/api/health` 200, `/` returns the
   SPA, `/some/route` returns the SPA, `/api/nope` returns the JSON 404 envelope, headers present.
3. Start with default `SECRET_KEY` and `ENV=production` fails with a clear message.
4. Pre-commit hook blocks a badly formatted file.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Build | `make build` | `build.txt` | exit 0 |
| 2 | User | `docker run --rm --entrypoint id <image>` | `user.txt` | not uid 0 |
| 3 | Smoke | curl of the four URLs with `-si` | `smoke.txt` | statuses and bodies as described |
| 4 | Secret guard | start with default secret | `secret_guard.txt` | exits with the message |
| 5 | Hook | commit a misformatted file in a scratch branch | `hook.txt` | commit refused |

## Files
| File | Action |
|------|--------|
| `Dockerfile`, `.dockerignore`, `docker-compose.yml` | CREATE / MODIFY |
| `backend/app/spa.py`, `backend/app/main.py`, `backend/entrypoint.sh` | CREATE / MODIFY |
| `scripts/pre-commit`, `scripts/install-hooks.sh`, `Makefile` | CREATE / MODIFY |
| `.env.example`, `docs/configuration.md` | MODIFY / CREATE |

## Implementation notes
- `Dockerfile` (root): node 24 stage builds the frontend; python 3.14-slim runtime installs
  `requirements.txt --require-hashes` (bind-mounted, not left in the image), copies alembic, the app and
  `dist` → `/app/static`, all owned by root and run as `app` (uid 10001). `APP_VERSION` build arg →
  env → `/api/health` and the OpenAPI version. `HEALTHCHECK` on `/api/health`. 314 MB.
- `backend/entrypoint.sh`: `python -m app.preflight` (clear message and exit 1 for a default or < 32-byte
  `SECRET_KEY` in production), `alembic upgrade head`, then one uvicorn worker with `--no-proxy-headers`
  and `--no-server-header`. `create_app()` refuses the same settings (`ensure_production_ready`).
- SPA (`app/spa.py`): `/assets` served with `immutable` caching; a 404 for a GET/HEAD outside `/api/` and
  `/assets/` becomes `index.html` (`no-cache`), or a top-level file from `frontend/public` (no path
  traversal: only direct children of the build directory). Without a build (dev, tests) nothing changes.
  Done in the 404 handler rather than a catch-all route, so `POST /api/nope` stays 404 instead of 405.
- Security headers on every response (pure ASGI middleware, does not overwrite a header a route set):
  CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (Mantine writes styles at
  run time) `… frame-ancestors 'none'`, `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options:
  DENY`, `Cross-Origin-Opener-Policy: same-origin`. The interactive API docs load CDN scripts the CSP
  forbids, so they are off in production.
- Unhandled exceptions: logged with the traceback, answered `500 {"error": {"code": "internal_error"}}`.
- Logging: the `app` logger gets a handler at `LOG_LEVEL`; the SMTP failure log no longer includes the
  exception text (it can quote the recipient address). Other app logs carry ids only.
- Frontend: Profile and Users pages lazy-loaded (Suspense inside the shell), `manualChunks` splits
  react / mantine / vendor — no chunk-size warning (largest: mantine 355 kB). `public/boot.css` (linked
  in `index.html`, no inline script) paints the system scheme's background before any script runs; an
  explicit in-app choice that differs from the system still shows the system colour until the app starts
  (known limit, documented in frontend-patterns since T015).
- Tests: lazy pages are imported once in `setup.js`; `asyncUtilTimeout` 3 s (first render of a file under
  coverage was flaky at 1 s).
- `docker-compose.yml`: `app` (`${DOCKER_IMAGE}:${APP_TAG:-stable}`, `read_only`, tmpfs `/tmp`, all
  capabilities dropped, `no-new-privileges`) and `db` (postgres:17-alpine, `${DATA_PATH}/postgres`).
  `.env.example` gained `LOG_LEVEL`, `DOCKER_IMAGE`, `APP_TAG`, `APP_PORT`, `DATA_PATH`.
  `docs/configuration.md`: deployment, every variable, HTTPS behind the DSM reverse proxy, backups.
- Makefile: `build`, `up`, `down`, `logs`, `pull`, `qa`, `e2e` (placeholder), `hooks`.
  `scripts/pre-commit` checks staged backend/frontend files with ruff / eslint / prettier inside the dev
  containers (it reads the working tree of the main checkout, which the containers mount).
- Evidence (`make` is not installed here — NEEDS USER; the equivalent commands were run):
  `build.txt` (`docker build --build-arg APP_VERSION=t010-smoke -t myapp:local .`), `user.txt`
  (uid 10001), `smoke.txt` + `app-log.txt` (the production compose from a scratch folder with a fresh
  Postgres: health 200 with the version, `/` and `/some/route` the SPA no-cache, `/api/nope` and
  `/assets/nope.js` JSON 404, hashed asset immutable, `/api/docs` 404, headers on all, migrations and the
  first admin created), `secret_guard.txt`, `hook.txt` (the script run directly on staged files: bad
  files refused, good ones pass), lint, coverage (backend 310 tests 99 %, frontend 118 tests ×3).

## QA — RETURNED (round 1)

**Date**: 2026-11-25

Image `myapp:qa` built by QA; production `docker-compose.yml` run from a scratch copy (fresh Postgres,
random 64-hex `SECRET_KEY`, `COOKIE_SECURE=false`, port 18080; a QA-only override added
`host.docker.internal` to reach the dev Mailpit). Browser checks: Playwright 1.50 (Chromium) in a
throwaway container. Stack torn down with `docker compose down -v`.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint backend (ruff check + format) | `docs/tasks/evidence/T010/qa/lint-backend.txt` | PASS |
| 2 | Lint frontend (eslint + prettier) | `docs/tasks/evidence/T010/qa/lint-frontend.txt` | PASS |
| 3 | Backend suite + coverage (310 passed, 99 %, spa.py 95 %) | `docs/tasks/evidence/T010/qa/coverage-backend.txt` | PASS |
| 4 | Frontend suite + coverage (118 passed, 100/99.6/100/100) | `docs/tasks/evidence/T010/qa/coverage-frontend.txt` | PASS |
| 5 | Frontend build: split chunks, no chunk-size warning (largest mantine 355 kB) | `docs/tasks/evidence/T010/qa/build-frontend.txt` | PASS |
| 6 | `make build` equivalent (`docker build --build-arg APP_VERSION=qa`) | `docs/tasks/evidence/T010/qa/build.txt` | PASS |
| 7 | Non-root (uid 10001), HEALTHCHECK, label; layers/filesystem: no tests, .env, requirements, node_modules, source maps or secrets; only /tmp-like dirs writable | `docs/tasks/evidence/T010/qa/image-inspect.txt` | PASS |
| 8 | Compose up with fresh Postgres: migrations, first admin, healthy | `docs/tasks/evidence/T010/qa/stack-up.txt`, `app-start-log.txt` | PASS |
| 9 | Hardening of the running container: read-only rootfs, tmpfs /tmp, CapEff 0, NoNewPrivs 1, healthcheck exit 0 | `docs/tasks/evidence/T010/qa/hardening.txt` | PASS |
| 10 | DoD 2 smoke + SPA fallback: `/`, deep routes, query strings, `/apix` → SPA; `/api`, `/api/`, `/api/nope`, `/assets/`, `/assets/nope.js` → JSON 404; HEAD; POST/PUT/DELETE/OPTIONS → 404; `/api/docs`, `/api/openapi.json` 404; cache headers; security headers | `docs/tasks/evidence/T010/qa/probes.txt` | PASS |
| 11 | Path traversal (plain, `%2f`, `%2e%2e`, double-encoded, `%5c`, overlong UTF-8) under `/` and `/assets/` | `docs/tasks/evidence/T010/qa/probes.txt`, `probes-edge.txt` | PASS |
| 12 | Symlinks out of the build dir (top level and `/assets`) never served | `docs/tasks/evidence/T010/qa/symlinks.txt` | PASS |
| 13 | Null byte in a page path (`/%00`, `/foo%00bar`) | `docs/tasks/evidence/T010/qa/probes.txt`, `probes-edge.txt`, `app-log-probes.txt` | FAIL (B1) |
| 14 | DoD 3 secret guard: image start with no / default / 31-byte key exits 1 with the message; `create_app` refuses too (uvicorn without preflight) | `docs/tasks/evidence/T010/qa/secret_guard.txt` | PASS |
| 15 | 500 envelope leaks nothing (`{"error":{"code":"internal_error",...}}` only) | `docs/tasks/evidence/T010/qa/probes.txt` | PASS |
| 16 | `--no-proxy-headers`: spoofed XFF/Forwarded/X-Real-IP ignored without TRUSTED_PROXIES (429 at 31st); with `TRUSTED_PROXIES=172.16.0.0/12` XFF decides the key; uvicorn keeps the peer | `docs/tasks/evidence/T010/qa/proxy-untrusted.txt`, `proxy-trusted.txt` | PASS |
| 17 | Real build in Chromium under the CSP, light and dark: password login, welcome, profile, users, deep link, 404 page, OTP login with a Mailpit code — 0 CSP violations, no page errors; lazy chunks fetched on demand | `docs/tasks/evidence/T010/qa/browser/browser.txt` + screenshots | PASS (see O1) |
| 18 | First paint without JS follows the system scheme (dark #14161d) | `docs/tasks/evidence/T010/qa/browser/first-paint-nojs-*.png` | PASS |
| 19 | Logs during real logins: no emails, names, OTP code, password, access token or refresh cookie | `docs/tasks/evidence/T010/qa/logs-pii.txt` | PASS |
| 20 | Logs "never emails" (documented promise) | `docs/tasks/evidence/T010/qa/logs-search-query.txt` | FAIL (B3) |
| 21 | DoD 4 pre-commit hook blocks a misformatted file in a real `git commit` | `docs/tasks/evidence/T010/qa/hook.txt` | FAIL (B2) |
| 22 | `make` targets | — | NEEDS USER (`make` not installed; Makefile reviewed, equivalents run) |

### Blockers
- **B1**: `backend/app/spa.py:35-38` — a page path containing a NUL byte reaches `Path.resolve()` /
  `is_file()`, which raise `ValueError: lstat: embedded null character in path`. Expected: an anonymous
  `GET /%00` or `GET /foo%00bar` gets the SPA (or a JSON 404). Found: `500 internal_error`, the traceback
  logged twice (`app.core.errors` and uvicorn's "Exception in ASGI application"), and — because the
  `Exception` handler runs in Starlette's outermost `ServerErrorMiddleware` — the 500 carries none of the
  security headers (`probes.txt`, `/%00` block; `probes-edge.txt`; `app-log-probes.txt:36-127`). Any
  client can fill the log with tracebacks. Needs a guard (e.g. reject names containing `\x00`, or catch
  `ValueError`/`OSError` around the lookup) and a test in `test_production.py`.
- **B2**: `scripts/pre-commit` and `scripts/install-hooks.sh` are mode 0664. `install-hooks.sh` symlinks
  `.git/hooks/pre-commit` to the non-executable script, and git skips it ("hook was ignored because it's
  not set as executable"): a real `git commit` of misformatted backend and frontend files succeeded
  (`hook.txt`; QA undid that commit immediately). With an executable copy the same commit is refused, so
  the logic is right — the mode is not. Expected: the scripts committed executable (`chmod +x` /
  `git update-index --chmod=+x`), or `install-hooks.sh` installing a wrapper that runs `sh scripts/pre-commit`.
  The implementer's `hook.txt` ran `sh scripts/pre-commit` directly, which hides this; DoD 4 says the hook
  blocks the commit.
- **B3**: `docs/configuration.md:31` (and `backend/app/core/logging.py:1`) promise "Logs carry ids, never
  emails or tokens", but uvicorn's access log (on by default in `backend/entrypoint.sh`) records query
  strings: the Users page search sends `GET /api/users?q=<email or name>`, logged as
  `"GET /api/users?q=qa.otp.t010%40example.com HTTP/1.1" 200` (`logs-search-query.txt`). Either keep
  personal data out of the access log (e.g. `--no-access-log`, or a filter that drops the query string) or
  state precisely what the access log contains.

### Observations (non-blocking)
- **O1**: `browser.txt` lists one `console.error` per fresh page: the 401 of the anonymous session probe
  (`POST /api/auth/refresh` without a cookie) — expected behaviour since T008, not a CSP or T010 problem;
  the script's "no console errors" line counts it.
- **O2**: A `304 Not Modified` for a hashed asset (`If-None-Match`) carries no `Cache-Control` (only 200
  gets `immutable`, `spa.py:24`; branch also shown as partial in coverage). Harmless while the 200 is cached
  forever.
- **O3**: With `--no-proxy-headers` the scheme is always `http`, so Starlette's absolute redirects
  (`/assets` → `307 http://…/assets/`, any `redirect_slashes`) point at `http://` behind the HTTPS proxy
  (`probes.txt`, `proxy-untrusted.txt`). No current frontend call triggers one; worth knowing.
- **O4**: `DATABASE_URL` is a setting but not in `docs/configuration.md` (the compose file builds it from
  `POSTGRES_*`; a line saying so would complete "every variable").
- **O5**: `README.md:121` still says to replace `<dockerhub-org>/<project>` in `docker-compose.yml`; now it is
  `DOCKER_IMAGE` in `.env` (T013 may cover the README).
- **O6**: The hook checks the main checkout's working tree through the containers' bind mount, so in a
  `git worktree` it checks the wrong files (documented in the script header for the working tree, not for
  worktrees).

### Round 2 (QA round 1: B1–B3)
- B1: `spa_response` treats a path with a NUL byte as no page (404 envelope, no filesystem call).
  Unhandled exceptions are now caught by `UnhandledErrorMiddleware` (inside the security-headers
  middleware) instead of Starlette's `Exception` handler: the 500 carries the security headers and is
  logged once (no re-raise to uvicorn). An error after the response started is re-raised (tested).
- B2: `scripts/pre-commit` and `scripts/install-hooks.sh` are executable (git mode 755). A real
  `git commit` through a hooks directory linked like `install-hooks.sh` does was refused
  (`hook-r2.txt`; done with `core.hooksPath` in the scratchpad so `.git/hooks` was not touched).
- B3: a `uvicorn.access` filter drops the query string (searches can hold emails); the docs and the
  logging module say what the access log records.
- O2: a 304 for a hashed asset keeps `Cache-Control: immutable`.
- O3: `redirect_slashes=False`: no slash redirect to an `http://` URL behind the HTTPS proxy
  (`/api/health/` is a 404).
- O4: `DATABASE_URL` documented. O5 (README) is T013's rewrite. O6 is stated in the hook's header.
- Evidence: backend 317 tests 99 %, `build.txt` (rebuilt image), `smoke-r2.txt` + `app-log-r2.txt`
  (NUL paths 404 with headers, query dropped in the access log), `hook-r2.txt`.

## QA — APPROVED (round 2)

**Date**: 2026-11-25

Image `myapp:qa` rebuilt by QA (`APP_VERSION=qa2`); production `docker-compose.yml` (identical copy) run
from a scratch folder with its own `.env` (random secrets generated inside a container, never printed),
project `t010qa2`, port 18081, fresh Postgres. curl probes from a `curlimages/curl` container, browser
check with Playwright 1.50 (Chromium) in a throwaway container. Stack torn down with `docker compose down -v`.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | B1: 40 malformed paths (NUL in page, `/assets/`, `/api/` paths, GET/HEAD/POST; `%2500`, overlong / invalid UTF-8, surrogates, CR/LF, control chars, `%5c`, `..%00`, 300- and 5000-char names) — no 500, every answer 5/5 security headers; NUL paths → JSON 404 | `docs/tasks/evidence/T010/qa/probes-r2.txt` | PASS |
| 2 | B1: forced 500 (database stopped, `POST /api/auth/login/start` and `/login/verify`): envelope `internal_error` only, all 5 security headers; one `app.core.errors` traceback per request, no uvicorn "Exception in ASGI application"; health answers 503 | `docs/tasks/evidence/T010/qa/forced-500-r2.txt`, `app-log-500-r2.txt` | PASS |
| 3 | B3: access log after probes and a real Users search with an email (`q=` sent twice by the page): 0 lines with `?`, 0 emails; method, path and status still recorded; error log has no email/query either | `docs/tasks/evidence/T010/qa/app-log-r2.txt`, `app-log-500-r2.txt`, `browser/browser-r2.txt` | PASS |
| 4 | No secret value (Postgres password, `SECRET_KEY`, admin password) in any log or probe output | `docs/tasks/evidence/T010/qa/secrets-in-logs-r2.txt` | PASS |
| 5 | B2: scripts mode 0775 (`core.fileMode` true); real `git commit` through `core.hooksPath` = scratch dir with a symlink to `scripts/pre-commit` (`.git/hooks` untouched) of a misformatted `.py` + `.js` refused (ruff format, prettier), exit 1, HEAD unchanged; probe files unstaged and removed | `docs/tasks/evidence/T010/qa/hook-r2.txt` | PASS |
| 6 | O2: 304 for a hashed asset (`If-None-Match` etag, `*`, `If-Modified-Since`) carries `immutable` | `docs/tasks/evidence/T010/qa/probes-r2.txt` | PASS |
| 7 | O3: no slash redirect anywhere (`/assets` → SPA 200, `/api/health/`, `/api/users/`, `/api/auth/me/` → 404, `/profile/` → SPA) | `docs/tasks/evidence/T010/qa/probes-r2.txt` | PASS |
| 8 | O4: `DATABASE_URL` documented | `docs/configuration.md:47` | PASS |
| 9 | Regression: SPA routes, API JSON 404, docs off, other methods 404, traversal set (15 paths) — every 200 is the SPA `text/html` (only `boot.css`, the asset and health differ), no `/etc/passwd` or environ content | `docs/tasks/evidence/T010/qa/probes-r2.txt` | PASS |
| 10 | Regression: browser (light) under the CSP — login, profile, users, users search, deep link; lazy chunks on demand; 0 CSP violations, 0 page errors (only console line: the expected anonymous refresh 401, O1) | `docs/tasks/evidence/T010/qa/browser/browser-r2.txt`, `browser/r2-*.png` | PASS |
| 11 | Regression: secret guard (none / default / 31-byte key exit 1 with the message; `create_app` guard without preflight); image runs as uid 10001 | `docs/tasks/evidence/T010/qa/secret_guard-r2.txt`, `user-r2.txt` | PASS |
| 12 | Image build | `docs/tasks/evidence/T010/qa/build-r2.txt` | PASS |
| 13 | Lint backend (ruff check + format) / frontend (eslint + prettier) | `docs/tasks/evidence/T010/qa/lint-backend-r2.txt`, `lint-frontend-r2.txt` | PASS |
| 14 | Backend 317 passed, 99 % (all changed files 100 % lines; `spa.py` 2 partial branches) | `docs/tasks/evidence/T010/qa/coverage-backend-r2.txt` | PASS |
| 15 | Frontend 118 passed, 100/99.6/100/100 | `docs/tasks/evidence/T010/qa/coverage-frontend-r2.txt` | PASS |
| 16 | Frontend build: no chunk-size warning (largest mantine 355 kB) | `docs/tasks/evidence/T010/qa/build-frontend-r2.txt` | PASS |
| 17 | Stack torn down | `docs/tasks/evidence/T010/qa/stack-down-r2.txt` | PASS |
| 18 | `make` targets | — | NEEDS USER (`make` not installed; equivalents run) |

### Observations (non-blocking)
- **O7**: the 500 log line carries the full traceback, whose last line is the exception message; an
  exception that quotes user input (the test raises one with an email) would put it in the log. Inherent to
  logging tracebacks; the "never emails" wording in `docs/configuration.md:31` is about the app's own messages.
- **O8**: `test_access_log_drops_query_strings` checks three things (the filter, a non-access record passing
  through, idempotent `configure_access_log`); test-discipline prefers one concept per test.
- **O9**: `spa.py` keeps two partial branches (`24->26`: a StaticFiles answer other than 200/304, e.g. 206;
  `51->53`: a build without `assets/`). No uncovered lines.
- O5 (README, T013) and O6 (worktrees, stated in the hook header) unchanged.
