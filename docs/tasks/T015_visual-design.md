# T015 — Visual design system

**Plan**: docs/plans/template-base.md · **Depends on**: T008

## Context
The screens built in T007–T008 use Mantine's defaults and look generic. The user asked for a minimal,
professional design based on nudge's palette, and approved this plan (2026-11-25), made with Anthropic's
`frontend-design` skill: nudge's colours, the system font stack, a left-aligned login column without a card,
borders instead of shadows, small radii, no decorative motion. Done before T009 so the profile and admin
pages are built on it.

## Objective
One visual system in the Mantine theme, applied to the login, welcome, waiting and shell screens, documented
for the next screens, with the `frontend-design` skill vendored.

## Step 1 — Skill
Vendor `anthropics/skills` `frontend-design` (Apache-2.0) unchanged in `.claude/skills/frontend-design/` with
`UPSTREAM.md`; mention it in CLAUDE.md's skills table.

## Step 2 — Tokens in the Mantine theme (`frontend/src/theme.js`)
- Colours (from nudge): primary slate `#454961` (dark mode `#b9bde0`) as a 10-shade Mantine colour; brand amber
  `#fcd34d` (text on it `#78350f`) used only for the brand mark; background `#fafafa` / `#14161d`, surface
  `#ffffff` / `#1d2029`, ink `#0a0a0a` / `#f4f4f6`, text `#454961`… / `#e6e7ef`, border `#e4e4e7` / `#343849`;
  success `#0f766e`, danger `#9f1239` (dark `#2dd4bf`, `#f87171`).
- Type: the system font stack; a type scale for h1–h3 and body; sentence case everywhere.
- Radius 6 px (inputs, buttons) and 8 px (surfaces); shadows off, borders separate surfaces.
- Focus ring visible in both schemes (slate ring), reduced motion respected.

## Step 3 — Screens
- Brand mark component (amber square with the app's initial + app name).
- Login, welcome: a left-aligned column (max ~360 px) on the page background, brand mark at the top, no card;
  preferences menus in a quiet top-right corner.
- Waiting page: same column layout, plain text and one action.
- Shell: thin top bar (brand, navigation slot, menus) with a bottom border; content left-aligned, max ~1080 px.
- No white flash before the colour scheme applies: background colour in a static stylesheet keyed on
  `prefers-color-scheme` and on Mantine's `data-mantine-color-scheme` (moved here from T010).

## Step 4 — Document
`frontend-patterns` skill: a "Visual system" section with the tokens, layout rules and principles, so new
screens follow it.

## DoD
1. Lint, tests with coverage (100 % on new files), build.
2. Screenshots of login (code step), welcome, waiting and home, in light and dark, at desktop and mobile
   widths, reviewed against the plan (self-critique per the skill).
3. Contrast: text and primary button colours meet WCAG AA in both schemes (computed).

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Lint | `npm run lint && npm run format:check` (frontend container) | `lint.txt` | clean |
| 2 | Tests | `npm run test:coverage` ×3 | `coverage_{1,2,3}.txt` | all pass, 100 % |
| 3 | Build | `npm run build` | `build.txt` | exit 0 |
| 4 | Screenshots | browser against the dev stack | `screens/*.jpg` | reviewed |
| 5 | Contrast | computed ratios | `contrast.txt` | ≥ 4.5:1 text, ≥ 3:1 UI |

## Files
| File | Action |
|------|--------|
| `.claude/skills/frontend-design/**`, `CLAUDE.md` | CREATE / MODIFY |
| `frontend/src/theme.js`, `frontend/src/styles/*`, `frontend/src/main.jsx` | MODIFY / CREATE |
| `frontend/src/components/BrandMark.jsx`, `AuthLayout.jsx`, `AppLayout.jsx` | CREATE / MODIFY |
| `frontend/src/pages/{Login,Welcome,Waiting}Page.jsx` | MODIFY |
| `.claude/skills/frontend-patterns/SKILL.md` | MODIFY |

## Execution evidence
**Date**: 2026-11-25
**Files**:
- `.claude/skills/frontend-design/` (vendored, Apache-2.0, `UPSTREAM.md`); `CLAUDE.md` skills table.
- `frontend/src/theme.js` — slate primary (10 shades; light shade 7 `#454961`, dark shade 3 `#b9bde0`), dark and
  zinc scales, amber `BRAND` for the mark only, system font stack, type scale, radii 6/8 px, shadows only on
  floating layers, `cssVariablesResolver` (page, text, borders, `--app-color-on-primary`), Button vars.
- `frontend/src/styles/base.css` — `color-scheme`, page background before React renders (no white flash),
  heading colour, 3:1 control borders. `index.html` — `<meta name="color-scheme" content="light dark">`.
- `frontend/src/components/BrandMark.jsx`, `AuthLayout.jsx` (+ CSS modules), `AppLayout.jsx` (56 px top bar,
  1080 px container); `LoginPage`, `WelcomePage`, `WaitingPage` on the new layouts; `UserMenu` slate avatar.
- `frontend/src/theme.test.js`; login tests updated for the new code-step texts.
- `.claude/skills/frontend-patterns/SKILL.md` — "Visual system" section.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format | `docs/tasks/evidence/T015/lint.txt` | PASS |
| 2 | Tests + coverage ×3 (80 tests, 100 %) | `docs/tasks/evidence/T015/coverage_{1,2,3}.txt` | PASS |
| 3 | Build | `docs/tasks/evidence/T015/build.txt` | PASS |
| 4 | Screenshots: login light/dark, code step light/dark, mobile, waiting, home | `docs/tasks/evidence/T015/screens/` | PASS |
| 5 | Contrast of all 16 token pairs (≥ 4.5:1 text, ≥ 3:1 controls) | `docs/tasks/evidence/T015/contrast.txt` | PASS |

### Self-critique (frontend-design process)
- First pass: the address wrapped mid-word on the code step, the countdown looked like a heavy grey button,
  the code boxes showed Mantine's "○" placeholder, the avatar used Mantine's indigo. Fixed: the address on its
  own bold line (wraps only when it must), the countdown as quiet text with the "Send a new code" link only
  when allowed, empty boxes, slate avatar.
- Dark mode: the enabled primary button had white text on `#b9bde0` (≈1.8:1): Mantine resolves filled-button
  text colour in JS without the colour scheme. Fixed with a scheme-aware `--app-color-on-primary` (8.85:1);
  `autoContrast` removed.
- Modern Web Guidance (run in Docker): `dark-mode` and `color` guides — `color-scheme` meta and property,
  3:1 control borders, borders instead of shadows (forced-colours mode).
- The browser window could not be resized (window manager); the mobile check used a 390 px iframe of the app.
- Waiting page stays inside the app shell (the user has a session); its layout follows the shell, not
  `AuthLayout`.

## QA — RETURNED (round 1)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format (eslint, prettier) | `docs/tasks/evidence/T015/qa/lint.txt` | PASS |
| 2 | Tests + coverage ×3 (8 files, 80 tests, 100 % all files) | `docs/tasks/evidence/T015/qa/coverage_{1,2,3}.txt` | PASS |
| 3 | Build | `docs/tasks/evidence/T015/qa/build.txt` | PASS (chunk-size warning, known, T010) |
| 4 | Tokens in theme/base CSS vs Step 2 | `frontend/src/theme.js`, `docs/tasks/evidence/T015/qa/screens/browser.txt` | FAIL (B2: success/danger missing) |
| 5 | Screenshots: login, code step, welcome, waiting, home × light/dark × 1280/390 px (Playwright in Docker) | `docs/tasks/evidence/T015/qa/screens/*.png`, `browser.txt`, `browser2.txt` | PASS for layout rules; see B1, observations |
| 6 | Contrast recomputed (Docker python): implementer's pairs reproduce; Mantine-rendered pairs added | `docs/tasks/evidence/T015/qa/contrast.txt` | FAIL (B2, B3) |
| 7 | Dark-mode on-primary fix covers other filled uses / red buttons | `docs/tasks/evidence/T015/qa/mantine-internals.txt`, `browser.txt` | FAIL (B3) |
| 8 | Focus visible on inputs | `docs/tasks/evidence/T015/qa/screens/browser.txt`, `login-email-focused-*.png` | FAIL (B1) |
| 9 | No-flash rules in base.css | `frontend/src/styles/base.css`, `dist/index.html` (build) | PASS with O1 |
| 10 | Labels, headings (one h1 per page), landmarks | `browser.txt`, `browser2.txt` | PASS |

### Blockers
- **B1**: `frontend/src/styles/base.css:33-36` — the 3:1 control-border rule removes the focus indicator of every
  text input and PIN box. `.mantine-Input-input:not([data-error])` has the same specificity (0,2,0) as Mantine's
  `.m_8fb7ebe7:focus { outline: none; --input-bd: var(--input-bd-focus) }` and loads later, so the border stays
  `#8a8ea1`/`#6f7590` when focused, with no outline. Measured: email input unfocused `rgb(138,142,161) | none`,
  focused `rgb(138,142,161) | none` (light; dark the same with `rgb(111,117,144)`) — `qa/screens/browser.txt`,
  `login-email-focused-{light,dark}.png`; also visible in the implementer's `3-code-dark.png` (focused first box
  looks like the others). Expected: a visible focus state on inputs in both schemes (WCAG 2.4.7; Step 2 "focus
  ring visible in both schemes"), e.g. exclude `:focus`/`:focus-within` from the rule or set `--input-bd-focus`
  instead, and a test or browser check that proves it.
- **B2**: `frontend/src/theme.js` (whole theme, `cssVariablesResolver` at :95) — Step 2's success `#0f766e` /
  `#2dd4bf` and danger `#9f1239` / `#f87171` tokens are not implemented nor documented in the skill table. Errors
  render in Mantine's red: field errors and required asterisks `#fa5252` on `#fafafa` = 3.15:1 (light) and
  `#e03131` on `#14161d` = 4.00:1 (dark), below 4.5:1 — DoD 3 fails on the welcome page's "Required" messages
  (`qa/contrast.txt`, `qa/screens/browser.txt` "welcome field error text colours", `welcome-errors-*.png`).
  The planned tokens pass (7.68, 6.53, 5.24, 9.71:1). Expected: danger/success wired into the theme
  (`--mantine-color-error`, the red/teal used by Alert/notifications), in `contrast.txt` and the skill table.
- **B3**: `frontend/src/theme.js:54` + `:82-91` — `primaryShade: { dark: 3 }` makes shade 3 the dark filled shade
  of **every** colour, and only `Button` gets the scheme-aware text: computed dark `--mantine-color-red-filled`
  = `#ffa8a8`, so `<Button color="red">` (delete actions in T009) has white text at 1.84:1; and
  `--mantine-primary-color-contrast` stays `#ffffff` in dark, so filled primary ActionIcon, Badge, Checkbox,
  Chip, Avatar `variant="filled"`, Switch/Radio/Pagination etc. put white on `#b9bde0` (1.84:1)
  (`qa/mantine-internals.txt`, `qa/screens/browser.txt`, `qa/contrast.txt`). The theme test "leaves other
  buttons to Mantine" (`theme.test.js`) locks in the broken red case. Expected: on-primary set through
  `--mantine-primary-color-contrast` (so all components use it), a danger colour whose dark filled shade has
  ≥ 4.5:1 text, and tests for both.

### Observations (non-blocking)
- **O1**: base.css's explicit-choice rules (:14-23) are correct but only apply once Mantine sets
  `data-mantine-color-scheme` from JS; before that only the OS query applies, so an explicit dark choice on a
  light OS (and the reverse) still flashes. The comment overstates it. With "CSP without inline scripts" (T010),
  closing it needs a small external blocking script in `<head>`, or accept and document the limit.
- **O2**: The implementer's screenshots do not cover DoD 2 (no welcome; waiting light only; home dark only;
  mobile only for login), and `7-home-dark.jpg` still shows the pre-fix indigo avatar. The QA set in
  `qa/screens/` covers all screens × schemes × widths.
- **O3**: Dark avatar (`UserMenu`, slate light variant) is `rgb(21,23,33)` on the `#14161d` bar: the control has
  no visible boundary (only the initials), unlike the bordered menu buttons beside it. `radius="xl"` is now 8 px
  (rounded square, not a circle) because the radius scale caps at 8 — confirm it is intended.
- **O4**: Light header border is `#d4d4d8` (AppShell's gray-3), not the documented divider `#e4e4e7`.
- **O5**: Text token deviates from the plan (`#454961…` → body `#2a2e42`, dimmed `#575c75`); documented in the
  skill but not explained in the execution evidence. `contrast.txt` lists dark links as `#b9bde0`; Mantine
  renders anchors in `#9a9fc0` (6.96:1, passes).
- **O6**: Welcome's "Log out" (subtle, full width) is centred in a left-aligned column; light standalone links
  (`#454961`) read almost like body text (`#2a2e42`) — weak affordance.
- **O7**: AuthLayout uses a 960 px container and 24 px gutter, the shell 1080 px and 16 px: the brand mark moves
  between the login and the app.
- **O8**: Placeholders (`#8a8ea1` 3.25:1, `#6f7590` 3.58:1) are below 4.5:1; none used today — keep it that way
  or darken them.
- **O9**: The dark red Alert is a saturated `#651515` block, loud against the quiet system (follows from B2).
- **O10**: base.css:34 is redundant (the first selector already matches PIN inputs).
- **O11**: frontend-design review: none of the skill's generic clusters (no cream/serif, no card kit, no
  all-caps eyebrows, no decorative motion); layout rules followed (left column ≤ 360 px, no card, 56 px bar with
  bottom border, 1080 px left-aligned content, one h1 per page, `main` landmark).
- QA created a throwaway sign-up user (`qa-t015@example.com`) in the dev stack for the welcome/waiting shots and
  deleted it afterwards (`qa/screens/cleanup.txt`).

### Round 2 (QA round 1: B1, B2, B3)
- **B1**: the 3:1 control-border rule no longer applies to focused inputs (`:not(:focus)`), and focused text
  fields and code digits get a 2 px primary outline (visible in forced-colours mode too; 9.8:1 / 8.5:1 against
  the page). Checked in Chrome in both schemes (`screens/8-focus-error-light.jpg`, `9-focus-error-dark.jpg`).
- **B2**: `red` and `teal` scales carry nudge's danger (`#9f1239` / `#f87171`) and success (`#0f766e` / `#2dd4bf`)
  tokens on shades 7 / 3; `--mantine-color-error` set per scheme. Error text 7.9:1 (light) and 6.5:1 (dark).
- **B3**: the theme's `variantColorResolver` sets the text of every filled variant (buttons, action icons,
  badges, avatars…) from `--app-color-on-filled` (white / `#14161d`); `--mantine-primary-color-contrast` set per
  scheme for checkboxes and similar. Tests cover slate, red and teal filled colours and the shade placement.
- Observations applied: standalone links underlined; round avatar; header border uses the documented divider
  colour; welcome "Log out" is a left-aligned link; `AuthLayout` uses the shell's 1080 px container and 56 px
  top row; redundant selector removed; dark link token is `#b9bde0` (`--mantine-color-anchor`). O1 (flash when an
  explicit scheme differs from the OS) recorded as a known limit in the skill. Contrast table recomputed with
  26 pairs, all PASS (`contrast.txt`).
- 83 tests, 100 % coverage.

## QA — RETURNED (round 2)

**Date**: 2026-11-25

Probe: `docs/tasks/evidence/T015/qa/round2-probe.py` (Playwright 1.50 in Docker, sharing the dev frontend's
network namespace; the dark run emulates a dark OS because a new account's saved `auto` preference replaces
the local choice after login). It also renders a harness of Mantine components the app does not use yet, with
the app's own theme and Mantine instance from the Vite dev server (`round2-harness-{light,dark}.png`).

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format (eslint `--max-warnings 0`, prettier) | `docs/tasks/evidence/T015/qa/round2-lint.txt` | PASS |
| 2 | Tests + coverage ×3 (8 files, 83 tests, 100 % all files) | `docs/tasks/evidence/T015/qa/round2-coverage_{1,2,3}.txt` | PASS |
| 3 | Build | `docs/tasks/evidence/T015/qa/round2-build.txt` | PASS (chunk-size warning, known) |
| 4 | B1 focus: email input and code digits, keyboard and mouse, light/dark | `qa/screens/round2-browser.txt`, `round2-login-email-focused-*.png`, `round2-code-focused-*.png` | PASS — 2 px solid outline, 8.46:1 (light) / 9.82:1 (dark) vs page; unfocused digits keep the 3:1 border; invalid inputs keep the danger border and get the ring when focused |
| 5 | B2 danger/success: CSS vars, field errors, asterisks, alerts, filled red/teal | `round2-browser.txt`, `round2-welcome-errors-*.png`, `round2-login-error-*.png`, `round2-harness-*.png` | PASS — error 7.68:1 / 6.53:1; alerts 9.78–17.57:1; filled red/teal 5.47–9.71:1 |
| 6 | B3 filled text in dark: Button, ActionIcon (any colour), Badge/ThemeIcon with a `color`, Avatar filled | `round2-browser.txt` (harness) | PASS — `#14161d` text, 6.53–13.86:1 |
| 7 | B3 filled text in dark: default-colour Badge, ThemeIcon, Checkbox, Switch, Radio, Chip, Pagination | `round2-browser.txt` (harness), `round2-harness-dark.png`, `qa/round2-mantine-internals.txt` | FAIL (B3) |
| 8 | Round-2 observation fixes (links, avatar, header border, Log out, AuthLayout, selector, anchor token) | `round2-browser.txt`, `round2-welcome-errors-*.png`, `round2-waiting-*.png`, `frontend/src/styles/base.css` | PASS with O13–O14 |
| 9 | Skill "Visual system" section vs the implementation | `.claude/skills/frontend-patterns/SKILL.md:133-170` | PASS except the B3 claim (O15) |

### Blockers
- **B3 (partly open)**: `frontend/src/theme.js:116-119` (`variantColorResolver`) + `:150`
  (`--mantine-primary-color-contrast`) — the fix only reaches components that call the resolver with a
  colour. In Mantine 9.8.2 (`qa/round2-mantine-internals.txt`) Badge, ThemeIcon and Chip set `--*-color` only
  when a `color`/`variant` prop is passed, and Checkbox/Radio set their icon colour only with `autoContrast`;
  otherwise `@mantine/core/styles.css` falls back to `var(--mantine-color-white)` (`--badge-color`,
  `--ti-color`, `--chip-color`, `--checkbox-icon-color`, `--radio-icon-color`, `--switch-text-color`,
  `--pagination-active-color`, switch thumb). `--mantine-primary-color-contrast` is not read by any of them.
  Measured in dark mode, default colour: Badge, ThemeIcon, Checkbox tick, Radio dot, Switch label and thumb,
  checked Chip and active Pagination are `#ffffff` on `#b9bde0` = **1.84:1** (`round2-browser.txt`,
  `round2-harness-dark.png`). The round-2 note ("`--mantine-primary-color-contrast` set per scheme for
  checkboxes and similar") does not hold. Expected: these components show `--app-color-on-filled` in dark mode
  without a `color` prop (e.g. map `--mantine-color-white`-based fallbacks through the theme's component vars /
  `defaultProps`, or a scoped CSS override for those variables), plus a test or browser check per component
  family. T009 (profile, users admin) will use Checkbox/Switch/Badge.

### Observations (non-blocking)
- **O12**: The resolver forces white text on every filled colour in light mode, which disables Mantine's
  contrast choice for its own palette: `color="yellow"` is white on `#f59f00` = 2.13:1, `color="blue"` 4.20:1
  (`round2-browser.txt`). The skill's shade rule covers new colours; say in the skill that Mantine's built-in
  colours other than slate/red/teal/gray are not tuned (or retune/limit them).
- **O13**: The brand still moves after login: brand mark at x = 100 on login/welcome vs 116 in the shell at
  1280 px (`round2-browser.txt` "brand position"). `AuthLayout` pads outside a 1080 px box, Mantine's
  `Container size={1080}` pads inside it (content 1048 px). The CSS comment says it does not move.
- **O14**: Dark avatar is still `rgb(21,23,33)` on the `#14161d` bar (1.01:1, no border): the control has no
  visible boundary (O3; the round avatar part is done) — `round2-waiting-dark.png`.
- **O15**: Two values for one role: `--app-color-on-filled` `#14161d` vs `--mantine-primary-color-contrast`
  `#1d2029` in dark; the skill table only lists the first. Once B3 is fixed, use one.
- **O16**: `base.css` focus rule lists `:focus-visible` and `:focus`; the second makes the first redundant
  (mouse focus shows the ring too — fine for text fields).
- Round-2 fixes verified: links underlined (`Log out` underline, left edge = h1 edge, 52 px wide); avatar
  round (`100%`); light header border `rgb(228,228,231)` = `#e4e4e7`; redundant selector removed; dark anchor
  `#b9bde0`; O1 recorded as a known limit in the skill.
- QA created throwaway users `qa-t015-r2-{light,dark}@example.com` (and an earlier `qa-t015-r2@`) in the dev
  stack and deleted them (`qa/screens/round2-cleanup.txt`).

### Round 3 (QA round 2: B3)
- User decision (2026-11-25): keep nudge's lavender as the dark-mode fill (instead of switching dark fills to a
  mid slate with white text).
- **B3**: the `variantColorResolver` is removed. In dark mode, `base.css` sets `--mantine-color-white` to
  `--app-color-on-filled` (`#14161d`) inside the components that use "white" as text or icon colour on a fill
  (from Mantine's stylesheet: ActionIcon, Button, Badge, Chip, Checkbox(+Indicator), Radio(+Indicator), Switch
  track, ThemeIcon, Pagination, Progress label, Indicator, Stepper icons, Tabs, NavLink, Combobox option,
  Avatar); the switch thumb keeps white. The override has to sit on the element that declares the component's
  colour variable — the avatar showed this (fixed on `.mantine-Avatar-root`, checked in Chrome: `#14161d` on
  `#b9bde0`). Mantine's `autoContrast` is on again (dark text on light fills such as yellow in light mode, QA O12).
- O13: `AuthLayout` reproduces the shell Container's geometry; the brand sits at the same x before and after
  login (16 px at 500 px width, checked). O14: filled avatar (visible edge in dark). O15: one dark contrast value
  (`#14161d`). O16: one focus rule.
- 79 tests (the resolver tests removed), 100 % coverage.

## QA — RETURNED (round 3)

**Date**: 2026-11-25

Probe: `docs/tasks/evidence/T015/qa/round3-probe.py` (the round-2 probe with a full component matrix:
every listed component without `color` and with red/teal/yellow, plus the light/outline/subtle/default/white/
transparent/dot variants, in light and dark; Playwright 1.50 in Docker, app theme and Mantine 9.8.2 from the Vite
dev server). `round3-probe-detail.py` confirms the causes (inline vars, option classes, outline checkbox with and
without `autoContrast`) with close-up screenshots `qa/screens/round3-detail-{light,dark}.png`. Threshold: 4.5:1
text, 3:1 icons/thumbs, against the effective fill.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format (eslint `--max-warnings 0`, prettier) | `docs/tasks/evidence/T015/qa/round3-lint.txt` | PASS |
| 2 | Tests + coverage ×3 (8 files, 79 tests, 100 % all files) | `docs/tasks/evidence/T015/qa/round3-coverage_{1,2,3}.txt` | PASS |
| 3 | Build | `docs/tasks/evidence/T015/qa/round3-build.txt` | PASS (chunk-size warning, known) |
| 4 | Filled text/icons, dark: Button, ActionIcon, Badge, ThemeIcon, Avatar, Checkbox tick + indeterminate, Radio dot, Switch label (checked), Chip (label + icon), NavLink filled — default/red/teal/yellow | `qa/screens/round3-browser.txt`, `round3-harness-dark.png` | PASS — `#14161d` on fill 6.53–9.82:1; yellow `#0a0a0a` 15.18:1 |
| 5 | Filled text/icons, dark: Pagination active, Tabs pills active, Progress label, Indicator, Stepper completed icon (default/red/teal), Combobox (Select) selected option | `round3-browser.txt`, `round3-detail.txt`, `round3-detail-dark.png` | FAIL (B3) — white, 1.84 / 2.77 / 1.86:1 |
| 6 | Switch thumb | `round3-browser.txt` | FAIL (B3, B6) — dark checked 1.30–2.77:1; light unchecked 1.48:1 |
| 7 | Filled text/icons, light: every component, default/red/teal/yellow | `round3-browser.txt`, `round3-harness-light.png` | PASS except Switch (B6) — 5.47–9.28:1, yellow filled now dark text 9.28:1 (O12 filled part fixed) |
| 8 | Non-filled variants not broken by the override (light, outline, subtle, default, white, transparent, dot; Chip/Tabs/NavLink/Pagination inactive; Stepper pending) | `round3-browser.txt`, `round3-detail-*.png` | FAIL (B4, B5); all others PASS 5.18–19.80:1 (yellow in light: O17) |
| 9 | Round-2 flow re-run: focus ring, errors, alerts, avatar, brand position | `round3-browser.txt`, `qa/screens/round3-{login,code,welcome,waiting}-*.png` | PASS — ring 8.46 / 9.82:1; error 7.68 / 6.53:1; avatar 8.83 / 9.82:1 vs bar; brand x = 116 before and after login (O13 fixed); one dark contrast value (O15 fixed); O18 |
| 10 | Throwaway users deleted | `qa/screens/round3-cleanup.txt` | PASS |

### Blockers
- **B3 (still open)**: `frontend/src/styles/base.css:48-75` — the override does not reach components whose colour
  variable is declared on an element outside the list. With `autoContrast: true` (`frontend/src/theme.js:83`) Mantine
  writes the text colour inline on the component root as `var(--mantine-color-white)`, which is resolved to `#fff`
  there, before the listed child inherits it (`round3-detail.txt`): `--pagination-active-color` on
  `.mantine-Pagination-root`, `--tabs-text-color` on `.mantine-Tabs-root`, `--progress-label-color` on
  `.mantine-Progress-section`, `--indicator-text-color` on `.mantine-Indicator-root`, `--stepper-icon-color` on
  `.mantine-Stepper-root`. Select's options carry `mantine-Select-option`, not `mantine-Combobox-option` (same for
  Autocomplete/MultiSelect…). Measured in dark: Pagination active, Tabs pills active, Progress label, Indicator,
  Stepper completed icon = white on `#b9bde0` **1.84:1**, on red `#f87171` **2.77:1**, on teal `#2dd4bf`
  **1.86:1**; Select selected option white on `#b9bde0` **1.84:1** (`round3-browser.txt`,
  `round3-detail-dark.png`). The switch thumb (kept white on purpose) is white on the checked track: **1.84:1**
  default, 2.77 red, 1.86 teal, 1.30 yellow (< 3:1). Expected: `#14161d` (or ≥ 3:1 thumb) in every case — put the
  override on the declaring elements, cover the option class of every Combobox-based input, and give the dark
  checked thumb a colour with ≥ 3:1 against the fill. A browser/unit check per component family should cover it.
- **B4 (new, caused by the override)**: `frontend/src/styles/base.css:52` (`.mantine-Badge-root`) — Mantine's dark
  `variant="dot"` badge uses `--mantine-color-white` as text on a dark surface (`dark-5`); it is now `#14161d` on
  `#2a2e42` = **1.35:1** (unreadable, `round3-detail-dark.png` "DOT BADGE"). Light is unaffected (19.80:1).
  Expected: non-filled variants keep their colours (exclude `[data-variant='dot']` or scope the rule to filled
  variants).
- **B5 (new, caused by `autoContrast: true`)**: `frontend/src/theme.js:83` (`autoContrast: true`) — Checkbox's vars
  resolver puts `--checkbox-icon-color: var(--mantine-color-white)` inline on the root whenever autoContrast is on,
  which overrides the outline variant's icon colour: `variant="outline"` checked tick is white on the page,
  **1.04:1** in light, `#14161d` on the page **1.00:1** in dark (yellow: `#0a0a0a`, 1.10:1 in dark) — the tick is
  invisible (`round3-detail-*.png`: "Outline (theme autoContrast)" vs "Outline, autoContrast=false", which shows
  `#454961` / `#f2f3f8`). Expected: a visible outline tick (≥ 3:1) in both schemes.
- **B6**: Switch, light mode (`round3-browser.txt`): unchecked track label `#63677a` on track `#d4d4d8` =
  **3.79:1** (< 4.5); unchecked thumb `#ffffff` on `#d4d4d8` = **1.48:1**; checked yellow label and thumb white on
  `#f59f00` = **2.13:1** (`--switch-text-color` ignores autoContrast). The unchecked values come from the app's
  gray scale (`theme.js` gray 3 / 6). Expected: ≥ 4.5:1 track labels and a ≥ 3:1 thumb in every state, or record
  in the skill that `onLabel`/`offLabel` and non-palette colours are not to be used on Switch.

### Observations (non-blocking)
- **O17**: Mantine's stock yellow (not tuned) fails as text/icon colour in light mode: light/outline/subtle/white/
  transparent Button, ActionIcon, Badge, ThemeIcon, Avatar, Chip, NavLink, Radio outline: 2.04–2.87:1. The skill's
  shade rule covers new colours but does not say that built-ins other than slate/red/teal/gray are untuned (O12,
  second half).
- **O18**: The welcome page's "Log out" link is no longer underlined (`decoration none`; round 2: `underline`).
  Mantine 9.8.2's Anchor default is `underline="hover"`, so the skill line "standalone links are underlined
  (`Anchor` default)" (`.claude/skills/frontend-patterns/SKILL.md:154`) does not hold.
- **O19**: In dark mode `variant="white"` Button/ActionIcon/Badge/ThemeIcon now render a `#14161d` background with
  coloured text (9.82 / 6.53 / 9.71:1): readable, but no longer white. Worth a line in the skill.
- **O20**: The skill's rule "add a new filled component to `base.css` on the element that declares its colour
  variable" is not followed by the list itself (B3) and is hard to apply with `autoContrast` (it moves the
  declaration to the root). Consider describing the rule as "the root of the component".
- Round-2 observations: O12 filled part fixed (yellow filled = dark text 9.28:1 light / 15.18:1 dark); O13 fixed
  (brand x = 116 on welcome and in the shell at 1280 px); O14 fixed (dark avatar `#b9bde0`, 9.82:1 vs bar); O15
  fixed (`--mantine-primary-color-contrast` = `--app-color-on-filled` = `#14161d`); O16 fixed (mouse focus still
  shows the ring, by design).
- QA created throwaway users `qa-t015-r3-{light,dark}@example.com` in the dev stack and deleted them
  (`qa/screens/round3-cleanup.txt`).

### Round 4 (QA round 3: B3, B4, B5, B6)
- `autoContrast` removed again: it wrote "white" inline on component roots (bypassing the override) and made
  the outline checkbox tick invisible (B5).
- The dark-mode override is matched by state instead of a component list: `[data-variant='filled']`,
  default-variant Button/ActionIcon/Badge/ThemeIcon (Mantine writes no `data-variant` for the default),
  `[data-combobox-selected]` (any combobox, incl. Select — B3), checkbox/radio fills (not outline), active
  pagination control, tabs tab and nav link, progress section, indicator, stepper icons. Variants without a fill
  keep Mantine's colours (dot badge fixed — B4).
- Switch (B6): dark checked → dark thumb and label on lavender; light unchecked → track in the control-border
  colour (white thumb 3.25:1) with a dark track label.
- Implementer run of the QA probe (Docker): 420 checks pass; the only failures left are Mantine colours outside
  the palette (yellow), the `white` variant on lavender, and Avatar.Group's separator border (same colour as the
  page on purpose) — documented in the skill as not used / by design (`round4-probe-implementer.txt`).
- O18: the `Anchor` default `underline: "always"` had been lost with the resolver block; restored with a test.
- Skill: palette colours (`slate`, `red`, `teal`, `gray`), no `white` variant, how to check new filled
  components; "standalone links are underlined" stays true because `Anchor` defaults to `underline="always"`.

## QA — APPROVED (round 4)

**Date**: 2026-11-25

Probe: the round-3 probes re-run unchanged except for output names and throwaway addresses
(`docs/tasks/evidence/T015/qa/round4-probe.py`, `round4-probe-detail.py`; Playwright 1.50 image in the dev frontend's
network namespace, `pip install --break-system-packages playwright==1.50.0`). 480 rows: 420 PASS, 60 FAIL, every
FAIL limited to yellow, the `white` variant or Avatar.Group's separator border — out of scope by the agreed palette
(slate/red/teal/gray) and recorded below as observations.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint + format (eslint `--max-warnings 0`, prettier) | `docs/tasks/evidence/T015/qa/round4-lint.txt` | PASS |
| 2 | Tests + coverage ×3 (8 files, 80 tests, 100 % all files) | `docs/tasks/evidence/T015/qa/round4-coverage_{1,2,3}.txt` | PASS |
| 3 | Build | `docs/tasks/evidence/T015/qa/round4-build.txt` | PASS (chunk-size warning, known) |
| 4 | B3: dark Pagination active, Tabs pills active, Progress label, Indicator, Stepper completed icon — default/red/teal; Select selected option | `qa/screens/round4-browser.txt`, `round4-detail.txt`, `round4-detail-dark.png` | PASS — `#14161d` on fill 9.82 / 6.53 / 9.71:1; option 9.82:1 |
| 5 | B4: dot badge, dark | `round4-browser.txt`, `round4-detail-dark.png` | PASS — white on `#2a2e42` 13.39:1 (light 19.80:1) |
| 6 | B5: outline checkbox tick / outline radio dot | `round4-browser.txt`, `round4-detail.txt` | PASS — light 8.46 / 7.68 / 5.24:1, dark 16.31 / 16.45 / 17.32:1 (default/red/teal) |
| 7 | B6: Switch thumb and track label, every state, slate/red/teal | `round4-browser.txt` | PASS — light unchecked label 6.09:1, thumb 3.25:1; light checked 8.83 / 8.02 / 5.47:1; dark checked 9.82 / 6.53 / 9.71:1; dark unchecked label 7.08:1, thumb 13.39:1 |
| 8 | Filled text/icons, both schemes, every component, slate/red/teal (no regression from round 3) | `round4-browser.txt`, `round4-harness-{light,dark}.png` | PASS |
| 9 | Non-filled variants (light, outline, subtle, default, transparent, dot; inactive Tabs/Pagination/Chip/NavLink; Stepper pending/active), slate/red/teal | `round4-browser.txt` | PASS |
| 10 | O18: standalone links underlined | `round4-browser.txt` ("welcome log out link: decoration underline"), `round4-welcome-errors-light.png`, `frontend/src/theme.js:107`, `theme.test.js:24` | PASS |
| 11 | Round-2 flow re-run: focus ring, errors, alert, avatar, brand position | `round4-browser.txt`, `qa/screens/round4-{login,code,welcome,waiting}-*.png` | PASS — ring 8.46 / 9.82:1; error 7.68 / 6.53:1; avatar 8.83 / 9.82:1; brand x = 116 |
| 12 | Throwaway users deleted | `qa/screens/round4-cleanup.txt` | PASS |

### Observations (non-blocking)
- **O21**: Removing `autoContrast` brings back white text on Mantine's stock yellow filled in light mode (2.13:1 on
  `#f59f00`; round 3 had dark text, 9.28:1) — Button/ActionIcon/Badge/ThemeIcon/Avatar/Checkbox/Radio/Switch/Chip/
  Pagination/Tabs/Progress/Indicator/NavLink/Stepper. Out of the palette and covered by the skill line "Mantine's
  other colours (yellow, blue…) are not used" (`.claude/skills/frontend-patterns/SKILL.md:169`). O17 (yellow
  non-filled, light) unchanged, same coverage.
- **O22**: `variant="white"` in dark: primary/red/teal/yellow text on white, 1.30–2.77:1 (Button, ActionIcon, Badge,
  ThemeIcon). Covered by "Do not use the `white` variant" (`SKILL.md:170`); O19 superseded.
- **O23**: Avatar.Group's separator border is the page colour (1.00:1 in both schemes), Mantine's design. The round-4
  notes say it is documented in the skill, but `SKILL.md` has no Avatar.Group line; worth one sentence so a later
  QA run does not re-raise it.
- Round-3 observations: O18 fixed (Anchor `underline: 'always'`, with a test); O20 addressed (the skill now says
  "on the element whose CSS reads the variable", and the override is matched by state).
- QA created `qa-t015-r4-{light,dark}@example.com` in the dev stack and deleted them (`qa/screens/round4-cleanup.txt`).
