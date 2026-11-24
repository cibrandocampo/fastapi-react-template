# FastAPI + React template with login

## Context

nexusHome needs a platform (middleware) to manage its WiFi devices. Its foundation (login, users,
languages, theme, Docker, CI) is the same any future web project needs, and nudge already solved it
in Django. Instead of building it inside nexus-home, it becomes a reusable GitHub template repository:
FastAPI + React with a complete login, and the Claude Code workflow already in place. nexus-home's
platform is then created from it.

## Decisions confirmed with the user

| Topic | Decision | Why |
|-------|----------|-----|
| Repository | New template repo generated from `dotclaude` | Inherits the Claude skills; dotclaude stays stack-agnostic |
| Backend | FastAPI + PostgreSQL | User's choice |
| Frontend | React (Vite) | As in nudge |
| Login | Like nudge: email first, then a one-time code by email (OTP) or a password, per user | Proven flow |
| Sign-up | Open sign-up enabled by an environment variable (`ALLOW_SELF_SIGNUP`, default off). A new account starts **without permissions** until an admin grants them | A house-facing app must not give access to strangers |
| Included | Languages en/es/gl, user management UI, light/dark theme, Docker dev + prod, CI, E2E | Everything a project needs on day one |
| Deployment | One app image (FastAPI serves the API and the built frontend) + PostgreSQL | Two containers in Synology Container Manager |
| Web access | HTTPS through a reverse proxy by default (`Secure` cookies); `COOKIE_SECURE=false` only for plain-HTTP setups | Synology DSM reverse proxy in front |
| Claude workflow | nexus-home's autonomous workflow; backported to `dotclaude` afterwards | One workflow everywhere |

## Design

### Repository layout

```
backend/            FastAPI app (app/), Alembic migrations, tests/, pyproject (ruff, pytest)
frontend/           React + Vite app, vitest tests
e2e/                Playwright (own Dockerfile)
dev/                docker-compose.yml (bind mounts, reload), Dockerfiles for dev
Dockerfile          production image: build frontend (node) -> python runtime serving API + static
docker-compose.yml  production: app + db, bind-mounted ./data, .env
.claude/, CLAUDE.md workflow, skills concretised for this stack
.github/workflows/  ci.yml, weekly-rebuild.yml, sync-disposable-email-domains.yml; dependabot
Makefile            init, dev-*, test, lint, format, e2e, lock, db-*
```

### Backend

- Python 3.14, FastAPI, SQLAlchemy 2 (async, asyncpg), Alembic, pydantic-settings, PyJWT, bcrypt,
  aiosmtplib + Jinja2 for emails. Dependencies pinned with hashes (`pip-compile`), as in ovh-dyndns.
- No Redis or Celery: emails go out in background tasks; periodic cleanups (expired codes, old failed
  logins, revoked tokens) run in an in-process scheduler started with the app. One app instance is
  assumed; this is documented.
- **Users**: email (unique, lower-cased), first/last name, `auth_method` (`otp` | `password`),
  `role` (`none` | `user` | `admin`), `is_active`, `language` (en/es/gl), `theme` (system/light/dark),
  timestamps. New sign-ups get `role = none`: they can log in, see a "waiting for access" page and
  edit their profile, nothing else. Projects add their own permissions on top of `user`/`admin`.
- **Login flow** (same contract as nudge, under `/api/auth`):
  - `GET /config` → `{allow_self_signup}`.
  - `POST /login/start {email}` → `{method: "otp" | "password"}`; sends the code for OTP users;
    creates an inactive OTP user when sign-up is open; blocks disposable email domains for sign-ups;
    `user_not_found` when sign-up is closed.
  - `POST /login/verify {email, code | password}` → tokens + `is_new` (name onboarding).
    OTP: 6 digits, SHA-256 stored, 10 min, 5 attempts, only the newest code counts, first success
    activates a sign-up. Password: lockout after 5 failures in 15 min.
  - `POST /refresh`, `POST /logout`, `GET/PATCH /me`, `POST /change-password`.
- **Sessions**: short-lived access JWT (15 min) kept in memory by the frontend; refresh token rotated
  on every use, stored hashed in the database (revocable, reuse of a rotated token revokes the family),
  sent as an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`. `Secure` is on by default
  and can be turned off (`COOKIE_SECURE=false`) for plain-HTTP LAN deployments.
  (Nudge keeps both tokens in localStorage; the cookie keeps the long-lived token away from scripts.)
- **Rate limits** (in memory, per process): login start 10/h per IP and 3/h per destination email,
  verify 10/min per IP, refresh 30/min per IP, change password 5/h per user. Relaxed in development.
- **Admin bootstrap**: `ADMIN_EMAIL` + `ADMIN_PASSWORD` create the first admin (password method) at
  start-up if no admin exists.
- **User management API** (admin only, `/api/users`): list/search, grant role, activate/deactivate,
  set auth method, reset password, delete. An admin cannot demote or delete the last admin.
- **Emails**: login code and sign-up welcome, en/es/gl, text + HTML with an inline logo, from
  `templates/emails/<name>/<lang>.*`. SMTP from env; Mailpit in development; captured in tests.
- **Disposable emails**: upstream list + local list + env allow/extra lists, weekly sync workflow
  opening a PR (as in nudge).
- `GET /health` for the container health check. API errors: `{"error": {"code", "message"}}`.

### Frontend

- React + Vite, React Router, TanStack Query, i18next (en/es/gl: browser language, then the user's
  saved one), CSS custom properties for the light/dark theme (`system` follows the OS), ESLint + Prettier.
- API client: attaches the access token, refreshes once on 401 (shared between parallel requests),
  sends the user to `/login` when the refresh fails.
- Pages: login (email → code or password → name for new users, 30 s resend cooldown), waiting for
  access (role `none`), profile/settings (name, language, theme, password), users admin (table,
  role, active, method, reset password), an app shell (header, navigation, user menu) and an empty
  home page for the project to fill.

### Infrastructure and quality

- Dev compose: db (Postgres 17), mailpit, backend (uvicorn `--reload`), frontend (Vite), on
  non-default host ports. Tests use a separate database in the same Postgres.
- Production image: multi-stage, non-root, runs migrations then uvicorn; multi-arch (amd64, arm64),
  pushed to Docker Hub (`latest` on main, version + `stable` on releases). Weekly rebuild.
- CI: ruff check/format, pytest with coverage, eslint/prettier, vitest with coverage, Playwright
  E2E against the dev stack (OTP read from Mailpit, so the code path is covered end to end),
  pip-audit/npm audit (non-blocking), image build on main and releases.
- Pre-commit hook running the linters in the dev containers.
- `.claude/`: nexus-home's commands, `qa` agent and `git-conventions`/`test-discipline`, plus
  dotclaude's skills (architecture, api-design, backend-patterns, frontend-patterns, security, ci,
  dev-workflow) rewritten for this exact stack.

## Scope

### Included
Everything above, with a README explaining how to start a project from the template (rename,
`.env`, Docker Hub names) and `docs/configuration.md` listing every variable.

### Not included
PWA/offline, push notifications, idempotency keys, optimistic concurrency (nudge-specific);
social login; multi-tenant; anything domain-specific.

## Implementation order

1. Create the repository from `dotclaude`, mark it as a template, bring the workflow and this plan.
2. Backend skeleton: settings, database, Alembic, health, error format, tests and lint in Docker.
3. Users, roles and admin bootstrap.
4. Login (OTP + password), sessions, rate limits, lockout, disposable emails.
5. Emails (templates, SMTP, Mailpit).
6. User management API.
7. Frontend skeleton: routing, API client, i18n, theme, app shell.
8. Login and onboarding pages, waiting-for-access page.
9. Profile/settings and users admin pages.
10. Production image, compose, Makefile, pre-commit hook.
11. CI (lint, unit, E2E, audit, image publishing) and the weekly workflows.
12. Skills and docs for the stack; README "use this template".
13. Backport the autonomous workflow to `dotclaude` (separate PR there).

## Testing strategy

- Backend: pytest against real Postgres (no SQLite substitutes), httpx `AsyncClient`, one test per
  rule of the login (expiry, attempts, lockout, rotation reuse, last-admin guard, role `none`).
- Frontend: vitest + Testing Library + msw; coverage thresholds as nudge.
- E2E: Playwright for sign-up with OTP (Mailpit API), password login, onboarding, waiting page,
  admin granting a role, language and theme persistence, logout.

## Risks

- Secure cookies do not work over plain HTTP: deployments without HTTPS must set `COOKIE_SECURE=false`
  (documented; the Synology reverse proxy can provide HTTPS).
- In-memory rate limits reset on restart and do not work across several replicas (accepted: one instance).
- Keeping the template and its descendants in sync is manual; the template gets a CHANGELOG so a
  project can see what to port.
