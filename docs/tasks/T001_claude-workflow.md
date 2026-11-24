# T001 — Claude Code workflow for the template

**Plan**: docs/plans/template-base.md · **Depends on**: none

## Context
The repository was generated from `dotclaude`, whose workflow asks for confirmation on every commit and
push and commits once per feature. The user wants the autonomous workflow already used in nexus-home
(`/home/cibran/workspace/nexus-home`, branch `chore/claude-workflow`, PR #3): Claude plans with the user,
asks on any doubt, implements, runs QA in a subagent, commits per task and opens one PR per plan; the user merges.

## Objective
The template carries dotclaude's behavioural guidelines plus nexus-home's autonomous workflow, generic
for any FastAPI + React project created from it.

## Step 1 — CLAUDE.md
Merge dotclaude's `CLAUDE.md` (sections 1–4 guidelines, 8 monorepo, 9 Docker-first, 10 testing) with
nexus-home's `CLAUDE.md` (working mode "autonomous, but ask", hard stops, development paths, one branch
and PR per plan, one commit per task, `qa` subagent). Remove nexus/hardware specifics. Language rule:
repository in English, chat in the user's language. Keep the "commit once per feature" rule out: commits
are per task.

## Step 2 — Commands and agent
Replace `.claude/commands/*` with nexus-home's versions (`dev-1-plan`, `dev-2-tasks`, `dev-3-run`,
`dev-4-qa`, `fix`, `audit`, `push`), made generic: no devices, firmware or garage boards; areas are
`backend/`, `frontend/`, `e2e/`, `dev/`; commands through Docker (`docker compose -f dev/docker-compose.yml`).
Delete `pr-create.md` (its format lives in `git-conventions`). Add `.claude/agents/qa.md` from nexus-home,
generic (backend lint/tests/coverage, frontend lint/tests/coverage, E2E when UI changes, image build).

## Step 3 — Permissions and git conventions
`.claude/settings.json`: nexus-home's wide allow list and its deny list minus the hardware rules.
`.claude/skills/git-conventions/SKILL.md`: nexus-home's version with generic scopes
(`backend`, `frontend`, `e2e`, `ci`, `docker`, `claude`, `docs`).
Keep the other dotclaude skills untouched here (rewritten for the stack in T013).

## Step 4 — Index and memory
`docs/tasks/INDEX.md` lists this series. `MEMORY.md` stays as the dotclaude template (filled by projects).

## DoD
1. `.claude/settings.json` is valid JSON.
2. No reference to nexus, garage, firmware, boards or `pr-create` remains in `CLAUDE.md` or `.claude/`.
3. Every command, agent and skill referenced in `CLAUDE.md` exists.
4. `git push` with no flags is not denied; `gh pr merge` and `git push --force` are.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | JSON valid | `python3 -m json.tool .claude/settings.json` | `settings_json.txt` | exit 0 |
| 2 | No leftovers | `grep -rniE 'nexus|garage|firmware|pr-create|bench' CLAUDE.md .claude` | `leftovers.txt` | no matches |
| 3 | References | `grep -oE '/(dev-[1-4]-[a-z]+|fix|audit|push)|`[a-z-]+` skill' CLAUDE.md` + `ls .claude/commands .claude/skills .claude/agents` | `references.txt` | every name exists |
| 4 | Deny list | `python3 -c` printing the deny rules | `deny.txt` | contains force push and `gh pr merge`, not plain push |

## Files
| File | Action |
|------|--------|
| `CLAUDE.md` | MODIFY |
| `.claude/commands/*.md` | MODIFY / DELETE `pr-create.md` |
| `.claude/agents/qa.md` | CREATE |
| `.claude/settings.json` | MODIFY |
| `.claude/skills/git-conventions/SKILL.md` | MODIFY |
| `docs/tasks/INDEX.md` | MODIFY |
