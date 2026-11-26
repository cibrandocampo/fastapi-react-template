# T014 — Absorb dotclaude (it is retired)

**Plan**: docs/plans/template-base.md · **Depends on**: T013

## Context
Decided with the user on 2026-11-26: `cibrandocampo/dotclaude` will be deleted (by the user). This
template becomes the single base for new projects: dotclaude's Claude setup, the skills added here and
a working FastAPI + React app with sign-in. The original T014 (a backport PR to dotclaude) is cancelled.

## Objective
Nothing worth keeping from dotclaude is lost, and the template no longer depends on or points to it.

## Step 1 — Inventory
Compare dotclaude's files with the template. Result: every file is present except
`.claude/commands/pr-create.md`, removed on purpose in T001 (`/push` opens the PR; the format lives in
`git-conventions`).

## Step 2 — Bring what only lived in dotclaude's README
The principles behind the workflow (control over raw capability, evidence-based QA, total ownership,
right-sized architecture, Docker-first) and the acknowledgement of the skills' inspiration go into the
README's "Working with Claude Code" section.

## Step 3 — References
Present-tense references to dotclaude in living documents are removed (README, CLAUDE.md, skills,
commands). Historical documents (plan decisions, T001–T013 records, QA verdicts) keep them: they
describe what happened. The plan records the change of scope.

## DoD
1. No file of dotclaude is missing without a recorded reason.
2. `grep -rni dotclaude README.md CLAUDE.md MEMORY.md .claude` finds nothing.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Inventory | file list of dotclaude (`gh api …/git/trees/main?recursive=1`) vs the checkout | `inventory.txt` | only `pr-create.md`, explained |
| 2 | References | the grep above | `references.txt` | no matches |

## Files
| File | Action |
|------|--------|
| `README.md`, `docs/plans/template-base.md`, `docs/tasks/INDEX.md` | MODIFY |

## Implementation notes
- Inventory (`inventory.txt`): 31 files in dotclaude; the only one absent here is `pr-create.md`,
  removed on purpose in T001.
- README "Working with Claude Code" now carries the principles that only lived in dotclaude's README
  (control over raw capability, evidence-based QA, total ownership, right-sized architecture,
  Docker-first) and the acknowledgement of the skills' inspiration.
- References (`references.txt`): none left in README, CLAUDE.md, MEMORY.md or `.claude/`. The plan
  records the decision (Decisions table, step 13); T001–T013 keep theirs as history.
- dotclaude itself is not touched: the user deletes it.

## QA — APPROVED (round 1)

**Date**: 2026-11-26

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | DoD 1: dotclaude's 31 files vs the checkout — 30 present and tracked; only `pr-create.md` absent, removal recorded in T001 (`T001_claude-workflow.md:26,71`) and its content covered by `git-conventions` + `/push` | `docs/tasks/evidence/T014/qa/inventory.txt` | PASS |
| 2 | dotclaude README vs README "Working with Claude Code": principles (control, evidence, ownership, right-sized architecture, Docker-first) and the acknowledgement carried over; setup checklist obsolete; "one commit per feature" deliberately now one per task | `docs/tasks/evidence/T014/qa/readme-compare.txt` | PASS |
| 3 | DoD 2: no `dotclaude` in README.md, CLAUDE.md, MEMORY.md, `.claude/` (untracked files included); remaining matches only in the plan and T001/T013/T014/INDEX records | `docs/tasks/evidence/T014/qa/references.txt` | PASS |
| 4 | Plan records the change: Decisions row "dotclaude (2026-11-26)" and step 13 struck through → T014; INDEX row renamed | `git diff docs/plans/template-base.md docs/tasks/INDEX.md` (read in review) | PASS |
| 5 | dotclaude repository untouched (read-only `gh api` calls only; `archived=false`, `is_template=true`) | `docs/tasks/evidence/T014/qa/inventory.txt` | PASS |

### Observations (non-blocking)
- **O1**: dotclaude's README "Option B — copy `.claude/` into an existing project" has no equivalent;
  with dotclaude gone, adding just the Claude setup to an existing repo is undocumented. One line in
  "Working with Claude Code" (copy `CLAUDE.md`, `MEMORY.md`, `.claude/`, then rewrite the stack skills)
  would keep it.
- **O2**: README principle "Docker-first … the host needs Docker, git and make" vs CLAUDE.md §9 (`docker`,
  `git`, `gh`, `make`, `curl`) and dev-workflow (plus `openssl rand`); "Start a project" says Docker,
  `make`, `git`. Consistent for a user, but the lists differ.
- **O3**: the README skills list in "Working with Claude Code" omits `memory-conventions` (present in
  `.claude/skills/`, and in dotclaude's skills table).
- **O4**: plan Decisions row "Claude workflow … backported to `dotclaude` afterwards | One workflow
  everywhere" (`template-base.md:24`) now reads as current next to the new row; acceptable as history,
  a "(superseded, see below)" would make it explicit.
