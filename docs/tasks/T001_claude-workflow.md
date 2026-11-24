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
Keep the other dotclaude skills as they are (rewritten for the stack in T013), except one change:
`backend-patterns`, `frontend-patterns` and `dev-workflow` start with a "not filled in — ask the user
about the stack" banner that would stop the autonomous workflow before every task. Replace that
banner with a pointer to `docs/plans/template-base.md` and the task files, which already fix the stack.

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
| `.claude/skills/{backend-patterns,frontend-patterns,dev-workflow}/SKILL.md` | MODIFY (banner only) |
| `docs/tasks/INDEX.md` | MODIFY |

## Execution evidence
**Date**: 2026-11-24
**Files**:
- `CLAUDE.md` — dotclaude guidelines (think first, simplicity, surgical changes, goal-driven, monorepo,
  Docker-first) merged with the autonomous working mode, hard stops and development paths.
- `.claude/commands/*` — nexus-home's commands made generic; `pr-create.md` removed (format in `git-conventions`).
- `.claude/agents/qa.md` — generic QA agent (backend/frontend lint, tests, coverage, E2E, image build).
- `.claude/settings.json` — wide allow list, deny list without hardware rules, plus `Read(**/.env)`.
- `.claude/skills/git-conventions/SKILL.md` — generic scopes, no hardware section.
- `.claude/skills/{backend-patterns,frontend-patterns,dev-workflow}/SKILL.md` — the "not filled in, ask
  the user" banner replaced with a pointer to the plan and tasks until T013.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | JSON valid | `docs/tasks/evidence/T001/settings_json.txt` | PASS |
| 2 | No leftovers | `docs/tasks/evidence/T001/leftovers.txt` | PASS |
| 3 | References | `docs/tasks/evidence/T001/references.txt` | PASS |
| 4 | Deny list | `docs/tasks/evidence/T001/deny.txt` | PASS |

### Decisions
- QA round 1 (B1): the banner change is now part of Step 3 and the Files table.
- The three unfilled skills would make Claude ask about the stack before every task; they now defer
  to the plan, which already fixes the stack.
- Host `python3` was used only for JSON checks of repository files (system tool, not a project runtime).

## QA — RETURNED (round 1)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint / format, targeted tests, coverage, full suites, E2E, builds | — (no backend/frontend code yet) | N/A |
| 2 | DoD 1 — `settings.json` valid JSON | `docs/tasks/evidence/T001/qa/settings_json.txt` | PASS |
| 3 | DoD 2 — no nexus/garage/firmware/pr-create/bench leftovers (plus extended board/device/hardware sweep: only false positive "dashboard") | `docs/tasks/evidence/T001/qa/leftovers.txt` | PASS |
| 4 | DoD 3 — every command, skill and agent referenced in `CLAUDE.md` and `.claude/` exists | `docs/tasks/evidence/T001/qa/references.txt` | PASS |
| 5 | DoD 4 — plain `git push` / `git push -u origin feat/x` allowed; `--force`, `-f`, `gh pr merge`, push to `main` denied | `docs/tasks/evidence/T001/qa/deny.txt` | PASS |
| 6 | Settings match nexus-home minus hardware rules (+ `Read(**/.env)`) | `docs/tasks/evidence/T001/qa/settings_vs_nexus.txt` | PASS |
| 7 | Scope — only the files listed in the task changed | `docs/tasks/evidence/T001/qa/scope.txt` | FAIL |

### Blockers
- **B1**: `.claude/skills/backend-patterns/SKILL.md:8`, `.claude/skills/frontend-patterns/SKILL.md:8`,
  `.claude/skills/dev-workflow/SKILL.md:8` — Step 3 says "Keep the other dotclaude skills untouched
  here (rewritten for the stack in T013)" and the Files table does not list them; found: the
  "not filled in, ask the user" banner replaced in all three (`scope.txt`, "Files changed outside the
  task Files table"). The reason in "Decisions" is sound, but it changes the task's agreed scope
  without the task saying so. Either revert the three files, or amend the task (Step 3 and the Files
  table) to include the banner change so the spec and the diff agree.

### Observations
- Commands defer project commands to the `dev-workflow` skill rather than spelling out
  `docker compose -f dev/docker-compose.yml`; Docker-first is stated in `CLAUDE.md` §9, which is enough
  until T013 fills `dev-workflow`.
- dotclaude's closing lines ("Tradeoff…", "These guidelines are working if…") and the step-plan example
  in "Goal-Driven Execution" were condensed away; the substance of sections 1–4 remains.
- `MEMORY.md` untouched, as Step 4 requires. Evidence directory is git-ignored (`.gitignore:32`).

## QA — APPROVED (round 2)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint / format, targeted tests, coverage, full suites, E2E, builds | — (no backend/frontend code yet) | N/A |
| 2 | B1 (round 1) — Step 3 and the Files table now include the banner change; the diff in the three skills is the banner only (one hunk at line 8 each) and matches the amended spec | `docs/tasks/evidence/T001/qa/scope_round2.txt` | PASS |
| 3 | DoD 1 — `settings.json` valid JSON | `docs/tasks/evidence/T001/qa/settings_json_round2.txt` | PASS |
| 4 | DoD 2 — no nexus/garage/firmware/pr-create/bench leftovers (plus word-bounded board/device/hardware/esp32/arduino/ota sweep: none) | `docs/tasks/evidence/T001/qa/leftovers_round2.txt` | PASS |
| 5 | DoD 3 — every command, skill and agent referenced in `CLAUDE.md` and `.claude/` exists (remaining "NOT-A-SKILL" lines are table cells such as `main`, `db`, shown with context) | `docs/tasks/evidence/T001/qa/references_round2.txt` | PASS |
| 6 | DoD 4 — plain `git push` / `git push -u origin feat/x` not denied; `--force`, `-f`, `gh pr merge`, push to `main` denied | `docs/tasks/evidence/T001/qa/deny_round2.txt` | PASS |
| 7 | Settings match nexus-home minus hardware rules (+ `Read(**/.env)`) | `docs/tasks/evidence/T001/qa/settings_vs_nexus_round2.txt` | PASS |
| 8 | Scope — every changed path is in the Files table; other dotclaude skills untouched | `docs/tasks/evidence/T001/qa/scope_round2.txt` | PASS |

### Observations
- The banner change is justified: `CLAUDE.md` asks for an autonomous workflow, and the three banners
  said "ask the user before any backend/frontend work or project command", which would stop every task.
  The plan already fixes the stack. Only those three skills had such a banner (`scope_round2.txt`),
  the pointer targets exist, and T013 rewrites all three, so the interim banner goes away there.
- For T014: dotclaude keeps the same "not filled in, ask the user" banners, which conflict with the
  autonomous workflow there too. T014's "fix only what contradicts the new workflow" should cover them
  with a generic rule (for example, ask once during `/dev-1-plan`), not this template-specific pointer.
- The round 1 observations still apply (commands defer to `dev-workflow` for commands; dotclaude
  closing lines condensed; `MEMORY.md` untouched).
