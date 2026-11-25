---
name: frontend-patterns
description: Frontend architecture patterns and conventions for this project. Customize this skill with the project's actual stack, design tokens, and component patterns.
---

# Frontend Patterns

> **Being filled in by the template-base series.** Until task T013 rewrites this skill, the stack,
> layout and commands are defined by `docs/plans/template-base.md` and the task files in
> `docs/tasks/`; follow them instead of the empty sections below and do not ask about them.

## Stack

> _Fill in: framework, routing, state management, styling approach, build tool, test framework._

```
Framework:        # e.g. React 18, Vue 3, SvelteKit
Routing:          # e.g. React Router v6, Next.js App Router
State:            # e.g. Zustand, Redux Toolkit, Pinia, Context API
Styling:          # e.g. CSS Modules, Tailwind, styled-components
Build:            # e.g. Vite, webpack, Turbopack
Tests:            # e.g. Vitest + Testing Library, Jest, Cypress
```

## Design Tokens

> _Fill in: color palette, spacing scale, typography, breakpoints. These are the source of truth — never use raw values._

### Colors

```css
/* Fill in project color variables */
/* --c-primary: ;       */
/* --c-secondary: ;     */
/* --c-background: ;    */
/* --c-surface: ;       */
/* --c-text: ;          */
/* --c-text-muted: ;    */
/* --c-border: ;        */
/* --c-error: ;         */
/* --c-success: ;       */
/* --c-warning: ;       */
```

### Typography

```
/* Fill in: font family, scale, weights */
/* Base size:  */
/* Scale:      */
/* Weights:    */
```

### Spacing

```
/* Fill in: spacing scale */
/* Base unit:  */
/* Scale:      */
```

### Breakpoints

```
/* Fill in: breakpoint values */
/* sm:  */
/* md:  */
/* lg:  */
```

## Reuse-First Principle

Before writing new UI code:

1. **Check existing components** — does a component already do this?
2. **Check existing styles** — does a CSS class or token already cover this?
3. **Check existing hooks/utils** — does a hook already encapsulate this logic?

The 1/2/3 rule: once is fine, twice is a pattern, three times means extract.

## Component Patterns

> _Fill in: conventions for pages vs shared components, naming, file structure, props patterns. All frontend code lives under `frontend/` in the monorepo._

```
Root:            # frontend/
Pages:           # e.g. frontend/src/pages/, one file per route
Shared:          # e.g. frontend/src/components/, only truly reusable UI
Naming:          # e.g. PascalCase files, named exports
Co-location:     # e.g. component + styles + tests in same folder
```

## CSS Conventions

> _Fill in: how styles are written and organised._

```
Approach:        # e.g. CSS Modules, utility classes, BEM
Tokens:          # Always use design tokens, never raw values
Avoid:           # e.g. inline styles, magic numbers, global overrides
```

## API Client

> _Fill in: how the frontend calls the backend._

```
Client:          # e.g. src/api/client.js, fetch wrapper, axios instance
Auth:            # e.g. JWT in header, cookie, session
Error handling:  # e.g. throws on non-2xx, global error boundary
```

## State Management

> _Fill in: what lives where._

```
Server state:    # e.g. React Query, SWR, manual fetch + useState
UI state:        # e.g. local useState, Zustand store
Global state:    # e.g. auth context, theme context
```

## Testing

> _Fill in: what to test and how._

```
Unit:            # e.g. Vitest + Testing Library, test behaviour not implementation
E2E:             # e.g. Playwright, cover critical user flows
Mocking:         # e.g. MSW for API mocks
```

## Visual system (T015)

Minimal and professional, from nudge's palette; made with the `frontend-design` skill. All values live in
`frontend/src/theme.js` (Mantine theme + `cssVariablesResolver`) and `frontend/src/styles/base.css`.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Primary (slate) | `#454961` | `#b9bde0` | Actions, links, focus, avatar |
| Text on filled colours | `#ffffff` | `#14161d` | `--app-color-on-filled`; in dark mode `base.css` maps Mantine's `--mantine-color-white` to it inside filled components (user decision: keep nudge's lavender fill) |
| Danger (red) | `#9f1239` | `#f87171` | Errors (`--mantine-color-error`), destructive actions |
| Success (teal) | `#0f766e` | `#2dd4bf` | Confirmations |
| Brand (amber) | `#fcd34d` / text `#78350f` | same | The brand mark only — never actions or page text |
| Page | `#fafafa` | `#14161d` | `--mantine-color-body` |
| Surface | `#ffffff` | `#1d2029` | `--app-color-surface`, inputs |
| Heading | `#0a0a0a` | `#f4f4f6` | h1–h3 |
| Text / dimmed | `#2a2e42` / `#575c75` | `#e6e7ef` / `#9a9fb2` | Body, secondary |
| Divider border | `#e4e4e7` | `#343849` | Separators, header |
| Control border | `#8a8ea1` | `#6f7590` | Inputs (3:1 contrast, WCAG 1.4.11); focused inputs get a 2 px primary outline |

- **Type**: the system font stack; h1 1.75 rem, h2 1.375 rem, h3 1.125 rem, weight 650; sentence case;
  no all-caps labels.
- **Links**: standalone links are underlined (`Anchor` default); the brand link opts out.
- **Shape**: radius 6 px (controls), 8 px (surfaces), avatars round. Borders separate surfaces; shadows only on floating
  layers (menus, notifications).
- **Layout**: screens before the app use `AuthLayout` (same 1080 px container and 56 px top row as the shell,
  so the brand does not move; a 360 px left-aligned column, no card). The app uses `AppLayout` (56 px top bar with a bottom border, content in a
  1080 px container, left-aligned). Pages start with an h1.
- **Motion**: none decorative; Mantine transitions only on things the user opened; reduced motion respected.
- **Copy**: plain, active, sentence case; errors say what happened and what to do.
- Contrast of every token pair is checked (all ≥ 4.5:1 text, ≥ 3:1 controls): T015 evidence `contrast.txt`.
- Dark-mode fills: `base.css` maps Mantine's `--mantine-color-white` to the on-filled colour on elements that
  carry a fill, matched by state (`[data-variant='filled']`, default-variant Button/ActionIcon/Badge/ThemeIcon,
  selected options, active pagination/tabs/nav links, checkbox/radio/progress/indicator/stepper fills, checked
  switch). A new filled component must be checked in dark mode (the T015 probe in
  `docs/tasks/evidence/T015/qa/` renders them) and added there if it shows white on lavender — on the element
  whose CSS reads the variable, not a child.
- Palette colours are `slate`, `red`, `teal` (and `gray`). Mantine's other colours (yellow, blue…) are not tuned
  for this palette and are not used. Do not use the `white` variant (primary text on white fails in dark mode).
- `Avatar.Group` draws a page-coloured ring between overlapping avatars on purpose (a separator, not a
  boundary): contrast checks do not apply to it.
- Shade rule: every Mantine colour shows shade 7 in light and shade 3 in dark (`primaryShade`); new colours
  must put their light-mode token at 7 and their dark-mode token at 3.
- Known limit: an explicit scheme that differs from the OS one can flash on first paint (the CSP forbids the
  inline script that would prevent it).
- New screens: follow this table and layout; critique with screenshots of the dev stack in both schemes and
  at mobile width before calling the work done.

## Navigation and app shell (T009)
- Icons: `lucide-react` only (same set as nudge); decorative icons get `aria-hidden`, icon-only controls an
  `aria-label`.
- `BottomNav` is the app's only navigation: fixed to the bottom on every screen size, `--nav-h` (64 px) plus
  `env(safe-area-inset-bottom)`. The current tab is a slate pill with icon and label; the others show the icon
  only, with the label kept in the DOM as the accessible name. Tabs are declared in `TABS` with the minimum
  role (`none`/`user`/`admin`); the bar is not rendered with fewer than two tabs or while the on-screen
  keyboard is open (`useKeyboardOpen`, ignoring pinch zoom).
- Space under the bar: the shell's content reserves `--nav-h` + safe area + 2 rem at the bottom, and
  `:root:has([data-bottom-nav])` sets `scroll-padding-bottom` so focused fields are never hidden under it.
  Do not override the content's bottom padding (`py` on the container would).
- The top bar holds the brand, language and colour-scheme menus. Account actions (profile, password, log out)
  live on `/profile`.
- Dialogs: name the close button (`closeButtonProps={{ 'aria-label': t('common.close') }}`); a dialog mounted
  on open must give focus back to its trigger on close (or a stable fallback); a failed action moves focus to
  its error alert.
- Badges are sentence case (`tt: 'none'` in the theme); `SegmentedControl` uses a filled indicator.

