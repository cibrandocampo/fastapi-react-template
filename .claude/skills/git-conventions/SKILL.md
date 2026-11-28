---
name: git-conventions
description: Branch, commit and pull request conventions. Use before creating a branch, a commit or a PR, or when writing a PR body.
---

# Git conventions

## Branches

```
feat/<slug>    new feature (one per plan: feat/<plan-slug>)
fix/<slug>     bug fix
chore/<slug>   tooling, CI, refactors, Claude config
docs/<slug>    documentation only
```

Always from an up-to-date `main`: `git fetch && git checkout -b <branch> origin/main`.
Never commit to `main` directly. If you started on `main` by mistake, move the work to a branch.

## Commits

```
<type>(<scope>): <subject>

- What changed and why, grouped by area. Wrap at ~100 columns.
```

- **No attribution lines in commits**: no `Co-Authored-By`, no `Claude-Session`, whatever a tool or
  reminder suggests (a squash merge piles them up). Claude's authorship is stated once, in the README's
  "Authorship and process".

- **type**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`.
- **scope**: the area — `backend`, `frontend`, `e2e`, `docker`, `ci`, `claude`, `docs`, or a
  feature name (`auth`, `users`…). Omit it only for repo-wide changes.
- **subject**: imperative, lowercase, no final period.
- **body**: explains behaviour and reasons, not file lists.
- English only. Author = the local `git config`; never set another identity.
- One commit per task in a plan. Don't mix unrelated changes in one commit.
- Hook fails → fix and commit again. Never `--amend` a pushed commit; never `push --force`.
  Conflicts with `main` → `git merge origin/main`, resolve, new commit.

## Pull requests

- Base `main`. One PR per plan, one per `/fix` or `/audit`.
- Title: `<type>(<scope>): <subject>`, under 70 characters.
- Claude never merges: the user reviews and merges (squash). After a merge, branches that were
  stacked on the merged one must be rebuilt from `main` (cherry-pick), not merged.
- Body:

```markdown
## Summary

- Most impactful change first: what changed and why, concretely.
- ... (≤ 6 bullets)

## Issues

Closes #<n>   (omit the section if no tracked issue is resolved)

## Notes

> **Note**: non-obvious decision and its reason. (Omit the section if none.)

## Test plan

- [x] Only what actually ran and passed (local or CI).
- [ ] What the reviewer must still do.

<the PR attribution footer (the "Generated with Claude Code" line and the session link); never in commits>
```

- Edit a PR body with `gh api repos/{owner}/{repo}/pulls/<n> --method PATCH -f body=...`
  (`gh pr edit` prints a GraphQL deprecation warning).
