# T013 — Stack skills and template documentation

**Plan**: docs/plans/template-base.md · **Depends on**: T012

## Objective
Claude and humans starting a project from the template find the exact conventions and steps.

## Step 1 — Skills
Rewrite dotclaude's generic skills for this stack, from what was actually built: `architecture`
(layout, request flow, auth model), `api-design` (routes, error envelope, pagination, auth headers),
`backend-patterns` (modules, settings, sessions, migrations, background work, rate limits),
`frontend-patterns` (structure, API client, i18n keys, theme tokens, CSS modules, accessibility),
`security` (sessions, cookies, roles, rate limits, headers, secrets), `ci`, `dev-workflow` (every make
target and compose command), `test-discipline` (pytest/vitest/Playwright specifics). Keep
`memory-conventions`.

## Step 2 — Docs
`README.md`: what the template gives, screenshots of login/profile/users (taken in the dev stack),
"Start a project from this template" (Use this template, rename, `.env`, `DOCKER_IMAGE` variable and
Docker Hub secrets, first admin), development commands, deployment (Synology/compose, reverse proxy).
`CHANGELOG.md` starting at 1.0.0. `docs/tasks/INDEX.md` final state.

## DoD
1. Every make target and env variable named in the skills and README exists (checked by script).
2. Links in README resolve to existing files.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Targets/vars | script comparing names in docs with Makefile and `.env.example` | `names.txt` | no missing names |
| 2 | Links | script resolving relative links in README and docs | `links.txt` | none broken |

## Files
| File | Action |
|------|--------|
| `.claude/skills/*/SKILL.md` | MODIFY |
| `README.md`, `CHANGELOG.md`, `docs/screenshots/*` | MODIFY / CREATE |

## Implementation notes
- Skills rewritten from the code as built: `architecture` (system, backend/frontend layout, auth model,
  checklist), `api-design` (routes without trailing slash, statuses and codes, envelope, pagination,
  auth), `backend-patterns` (settings, database, the lock order, sessions, emails, scheduler, rate
  limits, tests), `frontend-patterns` (new head: stack, structure, API/Query, i18n, accessibility,
  tests — the T015 visual system and T009 navigation sections kept), `security` (the model as a table
  with file pointers + checklist), `ci` (jobs, publishing rules, other workflows), `dev-workflow` (every
  make target, services and ports, dependencies, database), `test-discipline` (a section on the three
  suites). `memory-conventions`, `git-conventions`, `frontend-design`, `modern-web-guidance`,
  `security-audit` unchanged.
- `README.md` rewritten for the template: what it gives, screenshots (`docs/screenshots/`, taken from the
  dev stack with Playwright in Docker; demo users created through the API and deleted afterwards),
  starting a project (rename points verified in the code: `app.name` in the three i18n files and the
  `<title>`), Docker Hub secrets/variable, development, deployment, the Claude workflow, layout.
- `CHANGELOG.md` at 1.0.0.
- Leftovers from T010 QA: O8 the access-log test split in three; O9 the cache header is set on every
  returned static response (misses raise) and a build without `assets/` is tested — backend coverage
  100 %; O7 documented in the security skill.
- Evidence: `names-and-links.txt` (script `check.py` in the evidence folder: 28 make targets, every
  `make …` and back-quoted variable in README, CHANGELOG, configuration and all skills exists; no broken
  relative link).

## QA — RETURNED (round 1)

**Date**: 2026-11-26

Depth agreed with the user: moderate (docs + two small backend changes). E2E not re-run: no UI or API
change; the `spa.py` change is covered by the backend suite.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Backend lint + format (ruff) | `docs/tasks/evidence/T013/qa/lint-backend.txt` | PASS |
| 2 | Targeted tests `tests/test_production.py` (37) | `docs/tasks/evidence/T013/qa/targeted-tests.txt` | PASS |
| 3 | Full backend suite with coverage: 320 passed, 100 % (threshold 95) | `docs/tasks/evidence/T013/qa/coverage-backend.txt` | PASS |
| 4 | Frontend suite with coverage: 118 passed, 100/99.6/100/100 | `docs/tasks/evidence/T013/qa/test-frontend.txt` | PASS |
| 5 | DoD 1+2: names and links script re-run (0 missing targets/vars, 0 broken links); allowlist reviewed, every allowlisted name exists | `docs/tasks/evidence/T013/qa/check-rerun.txt` | PASS |
| 6 | 53 doc claims checked against the code | `docs/tasks/evidence/T013/qa/claims.txt` | FAIL (2 wrong) |
| 7 | Screenshots exist, current UI, no real personal data | `docs/tasks/evidence/T013/qa/screenshots-and-host-tools.txt` | PASS |
| 8 | No host tools beyond docker/git/gh/make/curl | `docs/tasks/evidence/T013/qa/screenshots-and-host-tools.txt` | PASS with O5 |

### Blockers
- **B1**: `.claude/skills/api-design/SKILL.md` (Auth section) — says the dependencies are
  `require_role(Role.user | Role.admin)`. `require_role(minimum: Role)` takes one minimum role
  (`backend/app/auth/deps.py:28`) and `Role` is a `StrEnum`, so `Role.user | Role.admin` raises
  `TypeError`. Expected: `require_role(Role.user)` / `require_role(Role.admin)` (minimum role, admin passes
  every check) and the ready aliases `CurrentUser`, `RequireUser`, `RequireAdmin` (`deps.py:40-42`), which
  the routers actually use. Evidence: `claims.txt` #14.
- **B2**: `.claude/skills/backend-patterns/SKILL.md` (Concurrency) — "Refresh takes the token `FOR SHARE`
  before rotating it atomically". `sessions.rotate()` takes the **user row** `FOR SHARE`
  (`lock_user(db, owner, share=True)`, `backend/app/auth/sessions.py:97`) and claims the token with one
  atomic `UPDATE … RETURNING` (`sessions.py:100-106`); the token is never locked `FOR SHARE`. This is the
  section the skill says to read before touching users or tokens. Evidence: `claims.txt` #22.

### Observations (non-blocking)
- **O1**: api-design says input schemas are `*In` / `*Update`; there is no `*In` class — inputs are
  `UserCreate`, `ProfileUpdate`, `SetPassword`, `LoginStart`, `LoginVerify`, `ChangePassword`. Describe the
  real naming (`claims.txt` #15).
- **O2**: backend-patterns writes `send_email(to, template, language, context)`; the parameter is `lang`
  (`emails/sender.py:60`).
- **O3**: README "≈99 % coverage" and backend-patterns "currently ~99 %": measured 100 %.
- **O4**: README table "`make build` / `make up` — build the production image / run it": `make up` runs
  `APP_TAG` from `.env` (`stable`, pulled), not the local build, unless `APP_TAG=local` (dev-workflow says
  so; README does not).
- **O5**: README Deployment suggests `openssl rand -hex 32` (also in `docs/configuration.md`,
  `.env.example`, the preflight message — pre-existing). It runs on the server, but contradicts "Nothing
  else runs on the host"; a Docker one-liner would be consistent.
- **O6**: security skill "per IP and per account on login": `login/verify` is limited per IP only; the
  per-account side is the password lockout / OTP attempts. Wording, not behaviour.
- **O7**: ci skill: "`npx playwright show-trace`, in Docker" gives no command (show-trace is a GUI);
  `trace.playwright.dev` or the HTML report is the practical route.
- **O8**: api-design's error list omits 401 `token_expired` / `refresh_in_progress` (both handled by the
  client) and 400 `invalid_request`, `method_mismatch`, `disposable_email`, `password_required`.
- **O9**: `check.py` hides nothing real (ENV/APP_VERSION/STATIC_DIR are settings documented in
  configuration.md; TEST_DATABASE_URL, MAILPIT_*, HOST_UID/GID in the dev compose/Makefile; CAN_PUSH,
  GITHUB_ENV in ci.yml; `ALL`, `TABS` exist as constants). Limits: bare targets without `make` (dev-workflow
  table) and back-quoted file paths are not checked — verified by hand, all exist.
- **O10**: T013 depends on T012, which INDEX still shows as `In progress`.

### Round 2 (QA round 1: B1, B2)
- B1: api-design shows the real dependencies — `CurrentUser`, `RequireUser`, `RequireAdmin` from
  `auth/deps.py`; `require_role` takes one minimum role.
- B2: backend-patterns describes refresh as it is: the owner's user row `FOR SHARE`, then one atomic
  `UPDATE … RETURNING` on the token.
- O1 schema naming as in the code; O2 `send_email(..., lang, ...)`; O3 coverage 100 %; O4 `make up`
  runs `APP_TAG` from `.env` (`APP_TAG=local` for your build); O5 `openssl rand` listed as a
  host-allowed tool (generating a secret on a server); O6 the rate limits listed per endpoint with their
  numbers; O7 traces open at trace.playwright.dev, nothing installed; O8 api-design lists every error
  code in use. O10: T012 closes when the PR's CI is green.
- Re-ran the docs check: `names-and-links-r2.txt` (no missing names, no broken links).

## QA — RETURNED (round 2)

**Date**: 2026-11-26

Scope: the round-1 blockers and observations and every claim changed in round 2 (docs only; no code
changed since round 1, so the suites were not re-run).

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | B1 api-design Auth vs `auth/deps.py:28,40-42` | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 2 | B2 backend-patterns refresh locking vs `auth/sessions.py:93-106` | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 3 | O1 schema names, O2 `send_email(..., lang, ...)`, O3 coverage wording | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 4 | O4 README `make up` / `APP_TAG=local` vs Makefile, compose, `.env.example` | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 5 | O5 host-allowed tools (dev-workflow, CLAUDE.md §9, README) | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 6 | O6 security rate-limit numbers vs `core/ratelimit.py` and each hit in `auth/router.py` | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 7 | O7 ci trace/report instructions vs `ci.yml` artifact and `playwright.config.js` | `docs/tasks/evidence/T013/qa/claims-r2.txt` | PASS |
| 8 | O8 api-design error table: every listed code exists; every emitted code listed | `docs/tasks/evidence/T013/qa/claims-r2.txt`, `docs/tasks/evidence/T013/qa/method-not-allowed-r2.txt` | FAIL |
| 9 | Docs check re-run (`check.py`): 0 missing targets/vars, 0 broken links | `docs/tasks/evidence/T013/qa/check-rerun-r2.txt` | PASS |

### Blockers
- **B1**: `.claude/skills/api-design/SKILL.md:26-37` ("Errors in use") — round 2 claims it lists every
  error code in use; `405 method_not_allowed` is missing. It is emitted by `core/errors.py:20`
  (`HTTP_CODES`) for any wrong method on an existing route: `curl -X DELETE
  http://localhost:18000/api/auth/me` → `HTTP 405 {"error":{"code":"method_not_allowed",…}}`
  (`method-not-allowed-r2.txt`). Expected: a `405 | method_not_allowed` row (and, optionally, a note
  that other framework statuses map through `HTTP_CODES` — `bad_request`, fallback `http_error`).
  Every listed code exists in `backend/app` (no extra codes).

### Observations (non-blocking)
- **O1**: `bad_request` (400) and the `http_error` fallback (`core/errors.py:16,54`) are reachable only
  through a Starlette `HTTPException` that no endpoint raises today; listing them is optional.
- Round-1 O9 and O10 need no action from this task (O10 closes with T012).

## QA — APPROVED (round 3)

**Date**: 2026-11-26

Scope: the round-2 blocker and the README/plan changes made for T014's observations (docs only).

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | R2-B1: `405 method_not_allowed` row; note on `bad_request` / `http_error` vs `core/errors.py:16,20,54` (no `HTTPException` raised in `backend/app`) | `docs/tasks/evidence/T013/qa/claims-r3.txt`, `docs/tasks/evidence/T013/qa/method-not-allowed-r2.txt` | PASS |
| 2 | README "existing project" paragraph: the 13 skills split into generic and stack, each once | `docs/tasks/evidence/T013/qa/claims-r3.txt` | PASS |
| 3 | README Docker-first host tools = CLAUDE.md §9; `memory-conventions` in the skills list | `docs/tasks/evidence/T013/qa/claims-r3.txt` | PASS |
| 4 | Plan line 24 marked superseded | `docs/tasks/evidence/T013/qa/claims-r3.txt` | PASS |
| 5 | Docs check re-run: 0 missing targets/vars, 0 broken links | `docs/tasks/evidence/T013/qa/check-rerun-r3.txt` | PASS |

### Observations (non-blocking)
None new. Round-2 O1 resolved by the note.
