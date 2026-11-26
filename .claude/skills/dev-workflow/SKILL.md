---
name: dev-workflow
description: Development commands of this template — every make target and the compose commands behind them, services and ports, migrations, dependencies, the production image and the end-to-end stack. Everything runs inside Docker, never on the host.
---

# Dev Workflow

## Layout

```
docker-compose.yml     production: app image + Postgres (deploy, or `make up` to try the image)
Dockerfile             production image (API + built SPA)
dev/                   docker-compose.yml (bind mounts, live reload) + Dockerfile.backend/.frontend
e2e/                   docker-compose.yml (production image + Postgres + Mailpit + Playwright), specs
backend/ frontend/     the code
.env / .env.example    shared settings (.env is git-ignored); docs/configuration.md describes them
```

## First time

```bash
make init        # copies .env.example to .env and starts the dev stack
make hooks       # optional: pre-commit lint of staged files (needs the dev stack running)
```

Sign in at http://localhost:15173 with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`; codes arrive in
Mailpit at http://localhost:18025.

## Services (dev, ports prefixed with 1)

| Service | Port | Notes |
|---|---|---|
| `frontend` | 15173 | Vite, proxies `/api` to the backend |
| `backend` | 18000 | uvicorn `--reload`, migrations applied on start; `/api/docs` |
| `db` | 15432 | Postgres 17; `app` (dev) and `app_test` (tests) databases |
| `mailpit` | 18025 (UI), 11025 (SMTP) | every email of the dev stack |

## Make targets

| Target | Does |
|---|---|
| `make help` | list the targets |
| `make init` | `.env` from the example + `dev-up` |
| `make dev-up` / `dev-down` / `dev-logs` / `dev-ps` | start (build, wait healthy) / stop / follow logs / list the dev stack |
| `make test-backend` | pytest |
| `make coverage-backend` | pytest with coverage, fails under 95 % |
| `make lint-backend` / `format-backend` | ruff check + format check / ruff format + safe fixes |
| `make test-frontend` | vitest with coverage, fails under the thresholds |
| `make lint-frontend` / `format-frontend` | eslint + prettier check / prettier write |
| `make build-frontend` | Vite production build |
| `make lint-e2e` | Prettier check of `e2e/` |
| `make test` / `make lint` / `make qa` | all unit tests / all linters / both (what CI checks before e2e) |
| `make e2e` | end-to-end suite against the production image; report in `e2e/artifacts/report` |
| `make db-migrate` | apply migrations to the dev database |
| `make db-revision m="…"` | autogenerate a migration (read and fix it before committing) |
| `make lock` | recompile `requirements*.txt` with hashes from the `.in` files |
| `make hooks` | install the git pre-commit hook |
| `make build` | production image as `$DOCKER_IMAGE:local` |
| `make up` / `down` / `logs` / `pull` | the production compose (`APP_TAG=local make up` runs your build) |

The Make targets wrap `docker compose --env-file .env -f dev/docker-compose.yml exec -T <service> …`
for the dev stack, so the stack must be up for test/lint targets.

## Dependencies

- Backend: edit `backend/requirements.in` / `requirements-dev.in`, `make lock`, then
  `docker compose … build backend && make dev-up`.
- Frontend: `docker compose … exec -T frontend npm install <pkg>`, then
  `docker compose … restart frontend`: a running Vite keeps its old pre-bundled deps and answers
  504 "Outdated Optimize Dep" (blank page) until restarted.
- E2E: `e2e/package.json` pins `@playwright/test` to the image version in `e2e/Dockerfile`; regenerate
  the lockfile in Docker (`node:24-alpine npm install --package-lock-only`).

## Database

```bash
make db-migrate
make db-revision m="add devices"
docker compose --env-file .env -f dev/docker-compose.yml exec db psql -U app -d app
```

## Docker group

If `docker` says permission denied in a shell that has not picked up the `docker` group yet, wrap the
command: `sg docker -c "…"`.

## Host-allowed tools

`docker` / `docker compose`, `git`, `gh`, `make`, `curl` for HTTP checks, and `openssl rand` to
generate a secret. Everything else (python,
node, npm, linters, Playwright, validators) runs in a container. If an exception is needed, document it
here with the reason.
