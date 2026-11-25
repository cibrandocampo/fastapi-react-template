# T014 — Backport the autonomous workflow to dotclaude

**Plan**: docs/plans/template-base.md · **Depends on**: T013

## Context
`dotclaude` is the user's stack-agnostic Claude template. The autonomous workflow (T001) and the
generic improvements found while building this template belong there too. This is a separate PR in
`cibrandocampo/dotclaude`, not a commit of this branch.

## Objective
dotclaude has the autonomous workflow, the `qa` agent, the wide permissions and the git conventions,
still stack-agnostic.

## Step 1
Clone dotclaude, branch `feat/autonomous-workflow`, port `CLAUDE.md` working mode, commands, `qa`
agent, `settings.json`, `git-conventions`; keep its generic skills (only fix what contradicts the new
workflow, e.g. "commit once per feature").
Its `backend-patterns`, `frontend-patterns` and `dev-workflow` skills start with a "not filled in —
ask the user" banner that stops the autonomous workflow; replace it with a generic rule (fill the
skill from the answers gathered in `/dev-1-plan`, then follow it), not a pointer to a specific plan. README section describing the workflow.

Also bring `.claude/skills/modern-web-guidance/` and `.claude/skills/security-audit/` (vendored, see their
`UPSTREAM.md`) with the CLAUDE.md lines that say when to use them.

## Step 2
Commit, push, PR to dotclaude's `main`. Record the PR link in this task file.

## DoD
1. No stack-specific or project-specific content in the dotclaude diff (grep for fastapi, react, nexus, garage).
2. PR open in dotclaude.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Leftovers | `grep -rniE 'fastapi|react|nexus|garage|postgres' CLAUDE.md .claude` in dotclaude | `leftovers.txt` | no matches |
| 2 | PR | `gh pr view --repo cibrandocampo/dotclaude <n>` | `pr.txt` | open |

## Files
| File | Action |
|------|--------|
| dotclaude: `CLAUDE.md`, `.claude/**`, `README.md` | MODIFY |
