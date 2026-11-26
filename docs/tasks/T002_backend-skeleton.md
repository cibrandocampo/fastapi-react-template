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

## Execution evidence
**Date**: 2026-11-24
**Files**:
- `backend/app/main.py`, `backend/tests/test_lifespan.py` — lifespan (round 2).
- `backend/requirements*.in/.txt` — pinned runtime and dev dependencies with hashes (FastAPI 0.165,
  SQLAlchemy 2.1, asyncpg 0.32, Alembic 1.20, pytest 9.2, ruff 0.17, Python 3.14).
- `backend/app/core/{config,db,errors}.py`, `backend/app/health.py`, `backend/app/main.py`,
  `backend/app/models.py` — settings, async engine (NullPool in tests), error envelope, health check.
- `backend/alembic.ini`, `backend/alembic/` — async migrations environment, no revisions yet.
- `backend/tests/` — conftest (test database, migrations once, truncate per test) and 7 tests.
- `backend/pyproject.toml` — ruff, pytest (warnings are errors), coverage ≥ 95 %.
- `dev/docker-compose.yml`, `dev/Dockerfile.backend`, `dev/db-init.sql`, `.env.example`, `Makefile`, `.gitignore`.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Services healthy | `docs/tasks/evidence/T002/ps.txt` | PASS |
| 2 | Health 200 | `docs/tasks/evidence/T002/health.txt` | PASS |
| 3 | Lint | `docs/tasks/evidence/T002/lint.txt` | PASS |
| 4 | Tests + coverage ×3 (100 %) | `docs/tasks/evidence/T002/coverage_{1,2,3}.txt` | PASS |
| 5 | Hashes | `docs/tasks/evidence/T002/hashes.txt` | PASS |
| 6 | Migrations up/down/up | `docs/tasks/evidence/T002/migration.txt` | PASS |

### Decisions
- `make` is not installed on this host (the user was asked to install it). Every DoD check ran the
  exact command the Makefile target wraps (`docker compose --env-file .env -f dev/docker-compose.yml …`,
  with `HOST_UID/HOST_GID=1000`); the Makefile itself is checked once `make` exists (NEEDS USER).
- Docker needs `sg docker -c` in this session (group added after login).
- The backend container runs as the host user so files it writes on the bind mount (coverage data)
  are not owned by root; `HOME=/tmp` for tool caches.
- pytest treats warnings as errors: an Alembic deprecation (`path_separator`) was caught and fixed.
- Tests use `NullPool`: each test has its own event loop and pooled asyncpg connections cannot cross loops.
- `known-third-party = ["alembic"]` because `backend/alembic/` shadows the library name for isort.
- QA round 1 B1: `lifespan` added to `create_app()`; it disposes the engine on shutdown (tested).
  T005 adds the cleanup scheduler to it.
- QA round 1 B2: `pip-tools` is not in `requirements-dev.in`. `make lock` installs it in a throwaway
  container, so the dev image and the lock files don't carry a tool only the lock step uses.
- Mailpit pinned to `v1.34`; the 405 test asserts the whole body.

## QA — RETURNED (round 1)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Services db, mailpit, backend healthy | `docs/tasks/evidence/T002/qa/ps.txt` | PASS |
| 2 | `GET /api/health` → 200 `{"status":"ok"}` | `docs/tasks/evidence/T002/qa/health.txt` | PASS |
| 3 | Lint (ruff check + format --check) | `docs/tasks/evidence/T002/qa/lint.txt` | PASS |
| 4 | Tests (`pytest -q`, 7 passed) | `docs/tasks/evidence/T002/qa/test_backend.txt` | PASS |
| 5 | Coverage ×3 consecutive, 100 % (≥ 95) | `docs/tasks/evidence/T002/qa/coverage_{1,2,3}.txt` | PASS |
| 6 | Requirements hashes (1072 / 1227) | `docs/tasks/evidence/T002/qa/hashes.txt` | PASS |
| 7 | Lock reproducible (pip-compile re-run, no diff) | `docs/tasks/evidence/T002/qa/lock_rerun.txt` | PASS |
| 8 | Migrations up → down base → up, `alembic check` clean | `docs/tasks/evidence/T002/qa/migration.txt` | PASS |
| 9 | `app_test` database created by init script | `docs/tasks/evidence/T002/qa/databases.txt` | PASS |
| 10 | Dev image builds from scratch (`--no-cache`) | `docs/tasks/evidence/T002/qa/image_build.txt` | PASS |
| 11 | Live error envelope (404, 405), `/api/docs`, `/api/openapi.json` | `docs/tasks/evidence/T002/qa/envelope_live.txt` | PASS |
| 12 | Compose valid with `.env.example`; `.env` keys match | `docs/tasks/evidence/T002/qa/compose_config.txt` | PASS |
| 13 | Makefile targets expand to the intended commands (`make -n` in alpine) | `docs/tasks/evidence/T002/qa/makefile_dryrun.txt` | PASS |
| 14 | `make dev-up` / `make lint-backend` / `make coverage-backend` on the host | — (`make` not installed) | NEEDS USER |
| 15 | Scope review against Step 1 / Step 2 | this section | FAIL |

### Blockers
- **B1**: `backend/app/main.py:10-15` — Step 2 specifies `create_app(): routers under /api, error handlers,
  lifespan`; there is no lifespan. Expected a lifespan on the `FastAPI(...)` app (at minimum disposing
  the engine from `get_engine()` on shutdown; T005 will add its scheduler there), covered by a test.
  Not recorded as a decision in `Execution evidence`.
- **B2**: `backend/requirements-dev.in:1-7` — Step 1 lists `pip-tools` among the dev dependencies; it is
  absent (`grep '^pip-tools' backend/requirements-dev.txt` finds nothing). `make lock` installs it in a
  throwaway container, so it may be unnecessary: either add it and re-lock, or record the deviation
  under `### Decisions`.

### Observations (non-blocking)
- `AppError(status, code, message)` takes its arguments in a different order than the task's
  `AppError(code, message, status)` notation; harmless now, but later tasks should follow the code.
- `.env.example` and `app/core/config.py` point to `docs/configuration.md`, which T010 creates; the
  reference is dangling until then.
- `axllent/mailpit:latest` is not pinned to a version (postgres is pinned to 17-alpine).
- Ruff selects `SIM` and `RUF` on top of the task's rule set (superset, fine).
- `test_wrong_method_answers_method_not_allowed_envelope` asserts only the code, not the full body.
- No handler maps unexpected exceptions (500) to the envelope; not required by this task.

## QA — APPROVED (round 2)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Round-1 B1: `lifespan` on `create_app()` disposes the engine on shutdown; unit test (not awaited during startup, awaited once on exit) | `docs/tasks/evidence/T002/qa/round2_test_lifespan.txt` | PASS |
| 2 | Round-1 B1 live: backend restart runs "Waiting for application shutdown" → "Application shutdown complete" without errors | `docs/tasks/evidence/T002/qa/round2_lifespan_live.txt` | PASS |
| 3 | Round-1 B2: `pip-tools` absent from dev requirements, deviation recorded under `### Decisions` (installed only by `make lock` in a throwaway container) | `docs/tasks/evidence/T002/qa/round2_hashes.txt` | PASS |
| 4 | Stack up with build (db, mailpit `v1.34`, backend healthy) | `docs/tasks/evidence/T002/qa/round2_dev_up.txt`, `round2_ps.txt` | PASS |
| 5 | `GET /api/health` → 200 `{"status":"ok"}` | `docs/tasks/evidence/T002/qa/round2_health.txt` | PASS |
| 6 | Lint (ruff check + format --check) | `docs/tasks/evidence/T002/qa/round2_lint.txt` | PASS |
| 7 | Full suite + coverage ×3 consecutive (8 passed, 100 %, ≥ 95) | `docs/tasks/evidence/T002/qa/round2_coverage_{1,2,3}.txt` | PASS |
| 8 | Requirements hashes (1072 / 1227) | `docs/tasks/evidence/T002/qa/round2_hashes.txt` | PASS |
| 9 | Lock reproducible (pip-compile on a read-only copy, no diff) | `docs/tasks/evidence/T002/qa/round2_lock_rerun.txt` | PASS |
| 10 | Migrations up → down base → up, `alembic check` clean | `docs/tasks/evidence/T002/qa/round2_migration.txt` | PASS |
| 11 | Makefile targets expand to the intended commands (`make -n` in alpine) | `docs/tasks/evidence/T002/qa/round2_makefile_dryrun.txt` | PASS |
| 12 | `make dev-up` / `make lint-backend` / `make coverage-backend` on the host | — (`make` not installed) | NEEDS USER |
| 13 | Scope review (Steps 1–5, files, no stray tracked artefacts; `.coverage` ignored) | `docs/tasks/evidence/T002/qa/round2_git_status.txt` | PASS |

### Observations (non-blocking)
- Round-1 observations on mailpit pinning and the 405 body are resolved.
- `make -n lock` in a root container expands `chown 0:0`; on the host `id -u/-g` gives the real user, so this is an artefact of the dry run only.
- `test_unmapped_http_status_uses_the_generic_code` imports `HTTPException` inside the test body; move it to the module imports when the file is next touched.
- Still open from round 1: dangling `docs/configuration.md` reference until T010; no 500 → envelope handler (not required here).
