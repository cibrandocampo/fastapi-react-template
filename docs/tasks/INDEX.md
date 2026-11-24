# Task index

## Series T001–T014 — Template base (FastAPI + React with login)
Plan: [docs/plans/template-base.md](../plans/template-base.md) · Branch: `feat/template-base`

| ID | Title | Depends on | Status | QA |
|----|-------|------------|--------|----|
| T001 | Claude Code workflow | — | Completed | Approved |
| T002 | Backend skeleton and dev environment | T001 | Completed | Approved |
| T003 | Users, roles and sessions | T002 | Pending | — |
| T004 | Transactional emails | T002 | Pending | — |
| T005 | Login flow (OTP and password) | T003, T004 | Pending | — |
| T006 | User management API | T003 | Pending | — |
| T007 | Frontend skeleton | T002 | Pending | — |
| T008 | Login, onboarding and waiting pages | T005, T007 | Pending | — |
| T009 | Profile and users admin pages | T006, T008 | Pending | — |
| T010 | Production image and deployment files | T009 | Pending | — |
| T011 | End-to-end tests | T010 | Pending | — |
| T012 | Continuous integration | T011 | Pending | — |
| T013 | Stack skills and documentation | T012 | Pending | — |
| T014 | Backport the workflow to dotclaude (separate PR) | T013 | Pending | — |

Status: `Pending` → `In progress` → `Completed`. QA: `—` → `Approved` / `Returned (B1…)`.

```
T001 → T002 ─┬→ T003 ─┬→ T005 ─┐
             ├→ T004 ─┘        ├→ T008 → T009 → T010 → T011 → T012 → T013 → T014
             │         T003 → T006 ────────↗ (T009)
             └→ T007 ─────────────────┘ (T008)
```
