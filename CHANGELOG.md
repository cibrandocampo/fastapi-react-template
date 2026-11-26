# Changelog

All notable changes to this template. Versions follow [Semantic Versioning](https://semver.org/);
a published GitHub release `vX.Y.Z` publishes the image tags `X.Y.Z` and `stable`.

## 1.0.0 — 2026-11-26

First release of the template.

### Backend
- FastAPI + SQLAlchemy (async) + PostgreSQL 18 with Alembic migrations.
- Sign-in with an emailed one-time code or a password; optional self sign-up with accounts waiting for
  access; roles `none` / `user` / `admin`; first administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Sessions: 15-minute access tokens, rotating refresh tokens in an HttpOnly SameSite=Strict cookie with
  reuse detection; password lockout; per-address and per-account rate limits; disposable-email blocking
  with a weekly list sync.
- Users administration API with search, filters, pagination and guards (last admin, self-delete).
- Per-user language, colour scheme and IANA time zone (UTC until chosen), validated on the server.
- Transactional emails in English, Spanish and Galician (text + HTML).
- Error envelope with stable codes; security headers and CSP; no personal data in logs.

### Frontend
- React 19, Vite 8, Mantine 9, TanStack Query, i18next (en / es / gl).
- Sign-in, onboarding, waiting page, profile and users administration; bottom navigation whose
  highlight slides between tabs.
- Progressive disclosure: rare actions open on demand (name and password in the profile, user actions
  in a "⋯" menu, filters in a popover); every screen fits a phone without sideways scrolling.
- Visual system from nudge's palette, light and dark, WCAG AA contrast, lucide icons.

### Operations
- One production image (API + built SPA), non-root and read-only; `docker-compose.yml` with PostgreSQL
  for Synology or any Docker host; `docs/configuration.md`.
- Playwright end-to-end suite against the production image (`make e2e`).
- GitHub Actions: lint, tests, end-to-end, image build; Docker Hub publishing gated on secrets; weekly
  rebuilds; Dependabot.
- Claude Code workflow (`CLAUDE.md`, `.claude/`) with skills describing this stack.
