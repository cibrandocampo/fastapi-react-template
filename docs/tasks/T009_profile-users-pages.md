# T009 — Profile and users admin pages

**Plan**: docs/plans/template-base.md · **Depends on**: T006, T015

## Objective
Every user edits their profile and preferences; admins manage users from the UI.

## Step 0 — Navigation (decided with the user, 2026-11-25)
- Icons: `lucide-react` (same set as nudge) instead of `@tabler/icons-react`, across the app.
- Bottom navigation always (mobile and desktop), with nudge's mechanics: fixed to the bottom, opaque surface
  with a top border, `--nav-h` height plus `safe-area-inset-bottom`, the content padded to clear it, hidden while
  the on-screen keyboard is open, reduced motion respected, one `<nav>` with `aria-current="page"`.
- Visual style "Expanding label": the current tab is a slate pill with icon and label that moves between tabs;
  the other tabs show only their icon (with an accessible name). Pill text uses the on-filled colour.
- Tabs: Home, Profile, and Users (admins only). The top bar keeps the brand and the language and colour-scheme
  menus; the account avatar menu is replaced by the Profile tab (log out moves to the profile page).

## Step 1 — Profile page (`/profile`)
Name, language and theme (saved immediately, applied at once), password: change (password users) or
set one (OTP users, switching to password login). User menu in the header links here and to logout.

The waiting page (T008) gets a link to the profile (T008 QA O8).

## Step 2 — Users page (`/admin/users`, admin only)
Mantine `Table`, `Modal`, `@mantine/form` and notifications. Table with search and filters (role, active),
pagination; "pending" badge and one-click "Grant access"
for role `none`; create user dialog; edit dialog (names, role, active, method, language); set password;
delete with confirmation. Guard errors (`last_admin`, `cannot_delete_self`, `email_taken`) shown
translated. Navigation entry visible to admins only.

## DoD
1. Tests for each action, its error states, and visibility by role.
2. Lint clean; coverage thresholds met; build succeeds.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make test-frontend` | `coverage.txt` | all pass, thresholds met |
| 2 | Lint | `make lint-frontend` | `lint.txt` | clean |
| 3 | Build | `npm run build` | `build.txt` | exit 0 |

## Files
| File | Action |
|------|--------|
| `frontend/src/pages/ProfilePage*`, `frontend/src/pages/admin/UsersPage*`, `frontend/src/components/**` | CREATE |
| `frontend/src/App.jsx`, `frontend/src/i18n/*.json` | MODIFY |

## Implementation notes
- Icons: `lucide-react` 1.80 replaces `@tabler/icons-react`; decorative icons are `aria-hidden`.
- `BottomNav`: fixed bottom bar, `--nav-h` 64 px + safe area, opaque surface with a top border, 48 px targets,
  current tab = slate pill with label (on-filled text), others icon-only with the label kept in the DOM
  (accessible name), `aria-current="page"`, transitions off with reduced motion, a border in forced colours.
  Hidden while the on-screen keyboard is open (`useKeyboardOpen`, visual viewport 150 px shorter) and for
  accounts waiting for access (only one tab: not navigation). The avatar menu is gone; log out is on the
  profile page.
- Profile: name (validated), language and theme saved at once, password change (current required) or set (OTP
  accounts) via `changePassword` in the auth context, which adopts the new session the server returns; log out.
  Sections separated by dividers, no cards.
- Users admin: debounced search, role/status filters (reset to page 1), pagination, one-click "Grant access"
  for role `none`, create/edit/set-password/delete dialogs with translated guard errors; your own row has no
  delete button. The edit dialog sends `auth_method` only when it changed.
- Tests: Mantine notifications are cleared between tests (module-level store).
- Evidence: lint, coverage (114 tests, 100 % lines, 99.6 % branches), build.

## QA — RETURNED (round 1)

**Date**: 2026-11-25

Browser checks: `docs/tasks/evidence/T009/qa/probe.py` (Playwright 1.50 in Docker, `--network container:myapp-dev-frontend-1`,
real backend, OTP codes from Mailpit, throwaway `qa-t009-*` users, all deleted at the end). Screenshots in `qa/screens/`.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (eslint) + prettier check | `docs/tasks/evidence/T009/qa/lint.txt` | PASS |
| 2 | Tests + coverage: 114 passed, 11 files, 100 % lines / 99.59 % branches (thresholds 95/90) | `docs/tasks/evidence/T009/qa/coverage.txt` | PASS |
| 3 | Build | `docs/tasks/evidence/T009/qa/build.txt` | PASS |
| 4 | i18n key parity en/es/gl; no `@tabler` import left | `qa/i18n-parity.txt`, `qa/icons-deps.txt` | PASS |
| 5 | Role visibility: `none` → /waiting, no nav, profile reachable, /admin/users → /waiting; `user` → Home+Profile, /admin/users not found, API 403; `admin` → Home+Profile+Users | `qa/probe.txt` (role none / role user / admin) | PASS |
| 6 | Password change: wrong current / weak / mismatch errors translated; change keeps session A (also after reload), closes session B, old password 401, new 200 | `qa/probe.txt` | PASS |
| 7 | OTP account sets a password: no current field, form switches to "change", password login works, session kept | `qa/probe.txt` | PASS |
| 8 | Name, language (es applied at once, nav label/names translated), theme (dark applied at once), all saved in the backend; log out | `qa/probe.txt` | PASS |
| 9 | Admin guards end to end: `last_admin` (demote and deactivate self), `email_taken`, `password_required`, `weak_password` translated in the dialogs; own row has no delete; API DELETE self → 409 `cannot_delete_self`; admin unchanged | `qa/probe.txt` | PASS |
| 10 | Users CRUD: grant access, search (page 1), role filter, pagination (26 users), create, edit, set password (login 200), delete with confirmation | `qa/probe.txt` | PASS |
| 11 | Bottom nav: names (aria snapshot), `aria-current="page"`, icons `aria-hidden`, 48 px targets, opaque bar, pill text 8.83:1 light / 9.82:1 dark, pill vs bar ≥ 8.8:1, inactive icons 6.58 / 6.18:1, focus ring 8.83:1, reduced motion, forced colours, 390 px and 1280 px | `qa/probe.txt` (bottom nav section) | PASS |
| 12 | Keyboard-open hiding (visual viewport 300 px shorter → nav gone, back on close) | `qa/probe.txt` | PASS |
| 13 | Content clears the bar at the end of the page | `qa/probe.txt`, `qa/content-padding.txt`, `qa/screens/profile-bottom-*.png` | FAIL (B1) |
| 14 | Focus not obscured by the bar (Tab through the profile page) | `qa/probe.txt`, `qa/screens/focus-obscured-*.png` | FAIL (B1) |
| 15 | Dialogs: accessible name of the close button; focus returns to the trigger | `qa/dialog-focus.txt` | FAIL (B2, B3) |
| 16 | Visual system: sentence case, control-state contrast | `qa/contrast-extra.txt`, `qa/screens/admin-users-*.png`, `qa/screens/user-profile-mobile-dark.png` | FAIL (B4, B5) |
| 17 | Docs: frontend-patterns updated for the new layout/icons | `.claude/skills/frontend-patterns/SKILL.md` | FAIL (B6) |
| 18 | Cleanup: no `qa-t009-*` users left; admin@example.com unchanged (active admin) | `qa/probe.txt` (cleanup) | PASS |

### Blockers
- **B1**: `frontend/src/components/AppLayout.jsx:30` / `AppLayout.module.css:7` — the `.content` bottom padding never
  applies: `py="xl"` wins, computed `padding-bottom` is `32px`, not `64px + safe area + 2rem` (`qa/content-padding.txt`).
  Even scrolled to the very bottom, the last control (profile "Log out") ends 33 px under the bar (390 px and 1280 px,
  both schemes), and keyboard focus scrolls controls under it (at 1280 px the "Current password" input is *fully* hidden;
  WCAG 2.4.11). Pointer clicks on the pagination "Next page" button at 1280×900 are intercepted by the `<nav>`.
  Expected: the reservation takes effect (e.g. `pt="xl"` plus the class, or the padding on `AppShell.Main`), and a
  `scroll-padding-bottom` of the bar height on the scroll root so focused/scrolled-into-view elements stop above it.
  Add a test that asserts the reservation (e.g. the class/padding is not overridden).
- **B2**: `frontend/src/pages/admin/UserDialogs.jsx` (all three `Modal`s) — the Modal close button has no accessible
  name (aria snapshot: `button:` with no name) and it is the element that receives focus when the dialog opens, so a
  screen reader announces just "button" (WCAG 4.1.2). Expected: `closeButtonProps={{ 'aria-label': t(...) }}`
  (translated) and a test that finds it by name.
- **B3**: `frontend/src/pages/admin/UsersPage.jsx:212-256` — dialogs are rendered conditionally (`dialog?.kind === … &&`),
  so they unmount on close and Mantine's focus return never runs: after Escape/Cancel/success, focus lands on `<body>`
  (`qa/dialog-focus.txt`, also when opened with the keyboard). A keyboard user loses their place in the table
  (WCAG 2.4.3). Expected: focus returns to the row button that opened the dialog (keep the Modal mounted with
  `opened`, or restore focus explicitly); a test for it.
- **B4**: `frontend/src/pages/ProfilePage.jsx` (role `Badge`) and `UsersPage.jsx` (role / pending badges) — Mantine's
  default `text-transform: uppercase` renders "ADMINISTRATOR", "USER", "WAITING FOR ACCESS" (`qa/contrast-extra.txt`,
  screenshots). Visual system: "sentence case; no all-caps labels". Expected: badges in sentence case (theme-level
  `Badge` default so every future badge complies).
- **B5**: `frontend/src/pages/ProfilePage.jsx` colour-scheme `SegmentedControl` — the selected indicator is 1.10:1
  against the track in light and 1.40:1 in dark (`qa/contrast-extra.txt`; in the dark screenshot the selected "Dark" is
  barely distinguishable). Visual system / WCAG 1.4.11: control state ≥ 3:1. Expected: a selected state that reaches
  3:1 (e.g. primary-coloured indicator with on-filled text, or a bordered indicator) in both schemes, measured.
- **B6**: `.claude/skills/frontend-patterns/SKILL.md` "Visual system" → Layout still describes `AppLayout` as the top bar
  only; the bottom navigation (always on, `--nav-h`, content reservation, keyboard-open hiding, one tab = no nav), the
  icon library (`lucide-react`, decorative icons `aria-hidden`) and the "log out lives on the profile page" decision are
  not documented. Expected: the skill updated so new screens follow them.

### Observations (non-blocking)
- **O1**: The dev frontend served a blank page (Vite 504 "Outdated Optimize Dep", log `ENOENT @tabler/icons-react`)
  because the dev server predated the dependency swap; QA restarted the frontend service
  (`qa/devserver-restart.txt`). Worth a line in dev-workflow: restart `frontend` after changing dependencies.
- **O2**: `useKeyboardOpen` treats any visual-viewport shrink as a keyboard: pinch-zoom ×2 on desktop hides the bar
  (`qa/probe.txt`, "pinch zoom x2 … nav present = False"). Low-vision users who pinch-zoom lose the navigation while
  zoomed. Consider also checking `visualViewport.scale` / a focused editable element. It also does not compute the
  initial state on mount (only on `resize`).
- **O3**: Row action icons are 28×28 px (above the 24 px AA minimum, below the 48 px used elsewhere); on a 390 px
  screen the role/status/actions columns are only reachable by scrolling the table sideways.
- **O4**: "Set password" is offered on the admin's own row; the backend's `set_password` revokes *all* that user's
  sessions, so the admin is signed out when the access token expires. Profile → Password is the path that keeps the
  session; consider hiding or redirecting the own-row action.
- **O5**: After a failed save in a dialog, focus falls to `<body>` (the submit button is disabled while loading). B3's
  fix may cover it; otherwise move focus to the alert.

### Round 2 (QA round 1: B1–B6)
- B1: the content container uses `pt="xl"` so its class keeps the bottom reserve (nav height + safe area +
  2 rem); `:root:has([data-bottom-nav])` adds `scroll-padding-bottom` so tabbed-to fields clear the bar.
- B2: every Modal names its close button ("Close", translated).
- B3: the users page remembers the element that opened a dialog and focuses it on close, falling back to
  "New user" when that row no longer exists (after a delete). O5: a failed action focuses its error alert.
- B4: `Badge` defaults to `tt: 'none'` (sentence case).
- B5: `SegmentedControl` defaults to `color: 'slate'` (filled indicator; dark mode gets dark label text via the
  on-filled override).
- B6: frontend-patterns documents the navigation, the bottom reserve, lucide-react, dialogs and badges.
- O1: dev-workflow says to restart the frontend service after changing dependencies.
- O2: `useKeyboardOpen` computes its state on mount and ignores pinch zoom (`visualViewport.scale > 1`).
- O3: row action icons are 34 px (`size="lg"`); the table keeps horizontal scrolling on phones.
- O4: your own row has no "Set password" (it would end all your sessions); use the profile.
- 117 tests, 100 % lines, 99.6 % branches.

## QA — APPROVED (round 2)

**Date**: 2026-11-25

Frontend service restarted first (`qa/round2-devserver-restart.txt`). Browser checks in Docker as in round 1
(Playwright 1.50, `--network container:myapp-dev-frontend-1`, real backend): the round-1 `qa/probe.py` re-run
unchanged (`qa/round2-probe.txt`; it rewrites the round-1 screenshot names in `qa/screens/`, the round-1
`focus-obscured-*.png` are kept as the before state) plus `qa/round2-extra.py`, which recreates and extends the
content-padding, dialog-focus and contrast checks (`qa/round2-extra.txt`, `qa/screens/round2-*.png`). Throwaway
users `qa-t009-*` / `qa-t009-r2-*` all deleted; admin@example.com identical before and after.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (eslint, 0 warnings) + prettier check | `docs/tasks/evidence/T009/qa/round2-lint.txt` | PASS |
| 2 | Tests + coverage: 117 passed, 11 files, 100 % lines / 99.6 % branches (thresholds 95/90) | `docs/tasks/evidence/T009/qa/round2-coverage.txt` | PASS |
| 3 | Build (exit 0; chunk-size warning as in round 1) | `docs/tasks/evidence/T009/qa/round2-build.txt` | PASS |
| 4 | Round-1 probe re-run: 119/119, incl. role visibility (none/user/admin), password change/set, profile preferences, users CRUD, admin guards, bottom nav contrast/size/forced colours/reduced motion, keyboard-open hiding, cleanup | `qa/round2-probe.txt` | PASS |
| 5 | B1: content `padding-bottom` 96 px (64 + 2 rem), `padding-top` 32 px, root `scroll-padding-bottom` 80 px, at 390 and 1280 px in both schemes; Log out ends 31 px above the bar; pointer click on Log out works | `qa/round2-extra.txt`, `qa/screens/round2-profile-bottom-*.png` | PASS |
| 6 | B1: Tab through the profile (4 configs) and the users page (65 controls, 1280 and 390 px): no focused control under the bar; pagination "Next page" is the hit target at its centre and a pointer click reaches page 2 at 1280×900 and 390×844 | `qa/round2-probe.txt`, `qa/round2-extra.txt`, `qa/screens/round2-users-bottom-light-*.png` | PASS |
| 7 | B2: all four dialogs (Edit, Set password, Delete, New user) have a close button named "Close", which takes focus on open | `qa/round2-extra.txt` | PASS |
| 8 | B3: focus returns to the trigger after Escape, Cancel, close button and keyboard open, for all four dialogs; after a save to the Edit button; after a delete to "New user". O5: a failed create (`email_taken`) focuses the alert | `qa/round2-extra.txt` | PASS |
| 9 | B4: badges sentence case, `text-transform: none` ("Administrator", "Waiting for access", profile role badge) | `qa/round2-extra.txt`, `qa/screens/round2-users-pending-badge-light.png` | PASS |
| 10 | B5: SegmentedControl, every option selected under OS light and dark: indicator vs track 8.03:1 (light) / 10.18:1 (dark); selected label 8.83:1 / 9.82:1; other labels 5.98:1 / 9.90:1 | `qa/round2-extra.txt`, `qa/screens/round2-segmented-*.png` | PASS |
| 11 | B6: frontend-patterns documents the bottom nav, content reserve, lucide-react, profile-owned account actions, dialogs and badges; O1: dev-workflow restart note | `.claude/skills/frontend-patterns/SKILL.md`, `.claude/skills/dev-workflow/SKILL.md` | PASS |
| 12 | O2: pinch zoom ×2 keeps the nav; a short visual viewport at mount hides it from the start. O3: row icons 34×34. O4: own row offers only Edit | `qa/round2-extra.txt` | PASS |
| 13 | Cleanup: no `qa-t009*` users left; admin unchanged | `qa/round2-probe.txt`, `qa/round2-extra.txt` | PASS |

### Observations (non-blocking)
- **O6**: B1 asked for a unit test asserting the bottom reserve is not overridden; none was added (no test renders
  `AppLayout`), so reverting `pt="xl"` to `py="xl"` would pass the suite. Verified in the browser instead; a small
  `AppLayout` test (e.g. the content container has no inline `padding-bottom`) would guard it. Not blocking under
  the proportional-QA rule for frontend work.
- O6 (round 2): a test guards the content bottom reserve (fails if `py` comes back; checked by mutation).
