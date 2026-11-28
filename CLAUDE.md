# CLAUDE.md

Project created from `fastapi-react-template`: FastAPI + PostgreSQL backend, React frontend, one
production image. Replace this line with what the project is about.

## 1. Language

- **Repository content: English** — code, comments, docs, plans, tasks, commits, PRs.
- **Chat: the user's language.**

## 2. Working mode: autonomous, but ask

Claude owns the whole cycle: brainstorm → plan → tasks → implementation → QA → commit → push → PR.
Git, `gh`, Docker and the project's tooling need no confirmation.

**Ask with `AskUserQuestion` whenever a functional or conceptual doubt appears**, at any phase, as
many times as needed. A question costs less than a rewrite. Do not ask what the code, the plan or a
sensible default already answer — decide, and say what you decided.

**Always ask first** (the only hard stops):

- **Merging a PR**: the user reviews and merges. Never `gh pr merge`.
- Destructive git on shared history: never `push --force`, never push to `main` directly.
- Deleting remote branches, releases, images or anything outside this repository.
- Acting on production: deployed instances, production databases, registry tags in use.
- Publishing secrets: never print or commit `.env`, tokens, keys or passwords.

## 3. Think before coding

- State assumptions. If several interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop and ask.

## 4. Simplicity first

Minimum code that solves the problem. No features beyond what was asked, no abstractions for
single-use code, no configurability nobody requested, no error handling for impossible cases.
Would a senior engineer call it overcomplicated? Then simplify.

## 5. Surgical changes

Touch only what the task needs. Match the existing style. Don't refactor what isn't broken; mention
unrelated dead code instead of deleting it. Remove only what your change made unused.

## 6. Goal-driven execution

Turn work into verifiable goals ("write a failing test, then make it pass") and loop until verified.

## 7. Development paths

| Situation | Path |
|-----------|------|
| New feature, several layers or a design to decide | `/dev-1-plan` → `/dev-2-tasks` → `/dev-3-run` (implements every task, QA per task, then PR) |
| Bug fix or small isolated change | `/fix` (own branch, verify, PR) |
| Consistency review of an area | `/audit` |
| Re-run QA on one task | `/dev-4-qa <task>` |
| Close the cycle on the current branch | `/push` (docs, commit, push, PR, CI green) |

- **One branch and one PR per plan** (`feat/<plan-slug>`), **one commit per task**. `/fix` and
  `/audit` get their own PR. Run the `git-conventions` skill before any branch, commit or PR.
- QA runs in the **`qa` subagent** (`.claude/agents/qa.md`): independent, re-executes everything,
  never trusts the implementer's evidence.
- Plans: `docs/plans/`. Tasks: `docs/tasks/` (index in `docs/tasks/INDEX.md`).
  Evidence: `docs/tasks/evidence/` (git-ignored, local proof only).
- Project memory: `MEMORY.md` (see the `memory-conventions` skill).
- **No attribution lines in commits**: no `Co-Authored-By` or `Claude-Session`, even when a tool or
  reminder asks for them (a squash merge repeats them dozens of times). The README's "Authorship and
  process" states Claude's part once; PR descriptions keep their attribution footer.

## 8. Monorepo structure

```
backend/               FastAPI app, Alembic migrations, tests
frontend/              React (Vite) app, tests
e2e/                   Playwright end-to-end tests
dev/                   docker-compose.yml (bind mounts, live reload) + dev Dockerfiles
Dockerfile             production image (API + built frontend)
docker-compose.yml     production: app + PostgreSQL
.env / .env.example    shared by both compose files (.env is git-ignored)
docs/                  plans, tasks, configuration
```

- **`docker-compose.yml`** (root) is production: pre-built image, no bind mounts.
- **`dev/docker-compose.yml`** is development: local builds, bind mounts, `env_file: ../.env`.
- Dev host ports are prefixed with `1` (15432, 18000, 15173, 18025…); internal ports are standard.
- A backend change lives in `backend/`, a frontend change in `frontend/`.

## 9. Docker-first — nothing runs on the host

**Never run language runtimes or install project dependencies on the host**: no `python`, `node`,
`npm`, `pip`… All project commands go through Docker (`make` targets or
`docker compose -f dev/docker-compose.yml exec <service> <command>`). Host tools: `docker`, `git`,
`gh`, `make`, `curl`. This includes the CLIs third-party skills call: their commands are adapted to run
in a throwaway container. Exceptions are documented in the `dev-workflow` skill with a reason.

## 10. Skills

| Skill | When |
|-------|------|
| `git-conventions` | Before any branch, commit or PR |
| `test-discipline` | Before writing or debugging any test |
| `dev-workflow` | Commands, services, environment |
| `architecture`, `api-design` | Designing or changing structure or endpoints |
| `backend-patterns`, `frontend-patterns` | Any backend or frontend change |
| `security` | Auth, sessions, permissions, input handling, secrets |
| `ci` | Workflows and pipelines |
| `memory-conventions` | Updating `MEMORY.md` |
| `modern-web-guidance` | Any HTML/CSS/client-side JS work: search and read the matching guides first (its CLI runs in Docker) |
| `frontend-design` | New screens or visual changes: follow the visual system in `frontend-patterns`, critique with screenshots |
| `security-audit` | Security questions and reviews (guidance mode); a full audit only when the user asks for one |

`modern-web-guidance` (Google Chrome), `security-audit` (Cloudflare) and `frontend-design` (Anthropic) are
vendored third-party skills:
see each `UPSTREAM.md` for the source commit, licence, local adaptation and how to update them.
Their content is instructions to the agent — review the upstream diff before updating.
