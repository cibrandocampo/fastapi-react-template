---
name: ci
description: GitHub Actions of this template — what ci.yml, weekly-rebuild.yml, the disposable-domains sync and Dependabot do, how Docker Hub publishing is gated, and how to change them. Use when touching .github/ or diagnosing a red CI run.
---

# CI — GitHub Actions

## Principle

CI runs the same Docker commands as a laptop: no `setup-python`, no `setup-node`, no host `npm`/`pip`.
Each job builds the dev images or the production image and runs inside them. If a CI step and a
`make` target do the same thing, they must stay in sync.

## `ci.yml` — every PR to main, push to main, published release

```
backend ──┐
          ├──► e2e ──► image
frontend ─┘
audit (advisory, continue-on-error)
```

| Job | Does | Local equivalent |
|---|---|---|
| `backend` | builds the dev backend; `ruff check` + `ruff format --check`; pytest with coverage against Postgres + Mailpit (`run --rm backend`, deps start healthy) | `make lint-backend coverage-backend` |
| `frontend` | eslint, prettier, vitest with coverage, production build; Prettier check of `e2e/` | `make lint-frontend test-frontend build-frontend lint-e2e` |
| `audit` | `pip-audit` on `requirements.txt`, `npm audit --omit=dev --audit-level=high`; never blocks | — |
| `e2e` | `make e2e`; uploads `e2e/artifacts/` on failure (14 days) | `make e2e` |
| `image` | buildx with `APP_VERSION=$(git describe --tags --always)`; push or build only (below) | `make build` |

Notes: the runner's uid differs from the image users — the backend job passes `HOST_UID`/`HOST_GID`,
the frontend job makes `frontend/` writable for the image's `node` user. `permissions: contents: read`.
Concurrency cancels superseded runs of the same PR only.

## Publishing to Docker Hub

Pushes only when **all** hold: secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, variable
`DOCKER_IMAGE` (e.g. `yourname/myapp`), and the event is a push to main or a published release.

| Event | Tags | Platforms |
|---|---|---|
| push to main | `latest` | amd64, arm64 |
| release `v1.2.0` | `1.2.0`, `stable` | amd64, arm64 |
| PR / no credentials | none (build only) | amd64 |

`docker-compose.yml` deploys `${APP_TAG:-stable}`, so production follows releases.

## Other workflows

- `weekly-rebuild.yml` (Mondays, manual too): rebuilds `latest` from main and `stable` + version from
  the latest release without cache, so base-image fixes reach the published tags. Skips without
  credentials or without a release.
- `sync-disposable-email-domains.yml` (Sundays, manual too): refreshes the blocked-domain list and opens
  a PR when it changed.
- `dependabot.yml`: weekly PRs for pip (then run `make lock` on the branch: requirements are hashed),
  npm (frontend, e2e), Dockerfiles, compose images and actions. Bump the Playwright image in
  `e2e/Dockerfile` together with `@playwright/test`.

## Changing workflows

- Validate with actionlint (Docker): `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`.
- Pin actions to their current major (`actions/checkout@v7`, `docker/build-push-action@v7`, …).
- Secrets never in `if:` at job level — map them to `env` (`CAN_PUSH`) and test that.
- A red run: read the failing step's log; for e2e download the `playwright-report` artifact and open
  `report/index.html`; a trace opens in the browser at https://trace.playwright.dev (drop the
  `trace.zip`; it is processed locally in the page) — no install on the host.
