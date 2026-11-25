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
