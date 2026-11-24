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
