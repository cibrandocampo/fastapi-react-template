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
