# T002 — Backend skeleton and dev environment

**Plan**: docs/plans/template-base.md · **Depends on**: T001

## Context
Foundation every later backend task builds on: a FastAPI app running in the dev compose with Postgres,
migrations, tests against a real database, linting and pinned dependencies. Docker-first: nothing runs on the host.

## Objective
`make dev-up` starts db, mailpit and backend; `/api/health` answers; `make test-backend` and
`make lint-backend` run inside the container and pass.

## Step 1 — Dependencies
`backend/requirements.in` (fastapi, uvicorn[standard], sqlalchemy[asyncio] 2, asyncpg, alembic,
pydantic-settings, pyjwt, bcrypt, aiosmtplib, jinja2, email-validator) and `backend/requirements-dev.in`
(pytest, pytest-asyncio, httpx, coverage, ruff, pip-tools). Compiled with hashes to `requirements.txt`
/ `requirements-dev.txt` by `make lock` (pip-compile inside a python container). Python 3.14.

## Step 2 — App structure
```
backend/app/main.py           create_app(): routers under /api, error handlers, lifespan
backend/app/core/config.py    Settings (pydantic-settings) from env
backend/app/core/db.py        async engine, session dependency, Base
backend/app/core/errors.py    AppError(code, message, status) -> {"error": {"code", "message"}};
                              validation errors -> 422 {"error": {"code": "validation_error", ...}}
backend/app/health.py         GET /api/health -> {"status": "ok"} after a SELECT 1
backend/alembic/ + alembic.ini (async env, naming convention for constraints)
backend/pyproject.toml        ruff (line 100, rules E,F,I,UP,B,S,ASYNC), pytest, coverage (fail_under 95)
```

## Step 3 — Dev compose
`dev/docker-compose.yml`: `db` (postgres:17-alpine, healthcheck, init script creating `app_test`),
`mailpit` (SMTP 11025, UI 18025), `backend` (`dev/Dockerfile.backend`, bind mount `../backend`,
`alembic upgrade head` then `uvicorn --reload`, port 18000). `.env.example` with every variable used so far.

## Step 4 — Tests
`backend/tests/conftest.py`: settings pointing to `app_test`; migrations applied once per session;
tables truncated between tests; `client` fixture (httpx `AsyncClient` with ASGI transport).
Tests: health OK, health 503 when the database is unreachable, error envelope for an `AppError`,
for a 404 route and for a validation error.

## Step 5 — Makefile
Targets: `init` (copy `.env`, `dev-up`), `dev-up`, `dev-down`, `dev-logs`, `lock`, `db-migrate`,
`db-revision m=...`, `test-backend`, `coverage-backend`, `lint-backend`, `format-backend`.

## DoD
1. `make dev-up` brings db, mailpit and backend up healthy.
2. `curl -s localhost:18000/api/health` → `{"status":"ok"}`.
3. `make lint-backend` (ruff check + format --check) clean.
4. `make coverage-backend` passes with coverage ≥ 95 %.
5. Requirements files contain hashes.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Services | `docker compose -f dev/docker-compose.yml ps` | `ps.txt` | db, mailpit, backend running/healthy |
| 2 | Health | `curl -si localhost:18000/api/health` | `health.txt` | 200 and `{"status":"ok"}` |
| 3 | Lint | `make lint-backend` | `lint.txt` | no errors |
| 4 | Tests | `make coverage-backend` | `coverage.txt` | all pass, total ≥ 95 % |
| 5 | Hashes | `grep -c -- '--hash' backend/requirements*.txt` | `hashes.txt` | > 0 for both |

## Files
| File | Action |
|------|--------|
| `backend/**` | CREATE |
| `dev/docker-compose.yml`, `dev/Dockerfile.backend`, `dev/db-init.sql` | CREATE / MODIFY |
| `.env.example`, `Makefile`, `.gitignore` | CREATE / MODIFY |
