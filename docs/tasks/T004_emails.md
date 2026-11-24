# T004 — Transactional emails

**Plan**: docs/plans/template-base.md · **Depends on**: T002

## Context
The OTP login sends codes by email in the user's language. Templates and sending are isolated so
projects can add their own emails.

## Objective
`send_email(to, template, lang, context)` renders text + HTML in en/es/gl with an inline logo and sends
it via SMTP; Mailpit receives it in development.

## Step 1 — Templates
`backend/app/emails/templates/_layout.html` (simple, inline CSS, logo by `cid:logo`), and for
`login_code` and `welcome_signup`: `<lang>.subject.txt`, `<lang>.body.txt`, `<lang>.body.html` for
en, es, gl. Context: `code`, `minutes`, `first_name`, `app_name`, `site_url`. Unknown language → en.
`backend/app/emails/assets/logo.png` (neutral placeholder, replaceable).

## Step 2 — Sender
`app/emails/sender.py`: Jinja2 environment (autoescape for HTML), builds a multipart/related message,
sends with aiosmtplib using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`
(`none`|`starttls`|`ssl`), `EMAIL_FROM`. A `EMAIL_BACKEND=memory` mode stores messages in a list for tests.
Send failures are logged and raised to the caller (the login decides what to answer).

## DoD
1. Tests: each template renders in each language with the expected subject and code; unknown language
   falls back to en; HTML is escaped; memory backend captures the message with the inline logo part.
2. Integration test sends a real message to Mailpit and finds it through Mailpit's API.
3. Lint clean; coverage ≥ 95 %.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make coverage-backend` | `coverage.txt` | all pass, ≥ 95 % |
| 2 | Mailpit | `curl -s localhost:18025/api/v1/messages` after the integration test | `mailpit.txt` | message present |
| 3 | Lint | `make lint-backend` | `lint.txt` | clean |

## Files
| File | Action |
|------|--------|
| `backend/app/emails/**` | CREATE |
| `backend/tests/test_emails.py` | CREATE |
| `.env.example`, `dev/docker-compose.yml` | MODIFY |

## Execution evidence
**Date**: 2026-11-24
**Files**:
- `backend/app/emails/sender.py` — `render()` (Jinja2, autoescape for HTML only, StrictUndefined,
  unknown language → en), `build_message()` (text + HTML, logo inline by `cid:logo`), `send_email()`
  (aiosmtplib with none/starttls/ssl, timeout; `memory` backend keeps an `outbox`; failures logged and raised).
- `backend/app/emails/templates/` — `_layout.html`, `_code.html`, `login_code/` and `welcome_signup/`
  in en/es/gl (subject, text, HTML).
- `backend/app/emails/assets/logo.png` — neutral 96×96 placeholder (indigo square with a ring).
- `backend/app/core/config.py`, `.env.example`, `dev/docker-compose.yml` — email settings; dev sends
  everything to Mailpit; `MAILPIT_API_URL` / `MAILPIT_SMTP_HOST` for the integration test.
- `backend/tests/test_emails.py` — 15 tests.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Tests + coverage ×3 (82 tests, 100 %) | `docs/tasks/evidence/T004/coverage_{1,2,3}.txt` | PASS |
| 2 | Message in Mailpit (integration test) | `docs/tasks/evidence/T004/mailpit.txt` | PASS |
| 3 | Lint | `docs/tasks/evidence/T004/lint.txt` | PASS |

### Decisions
- The Mailpit integration test caught the logo arriving as an attachment (a filename makes the part
  `attachment`); it is now `inline` and the test checks Mailpit's `Inline`/`Attachments` lists.
- `StrictUndefined`: a template missing a context value fails instead of sending a blank code.
- Spanish and Galician texts avoid gendered forms ("Te damos la bienvenida", "Dámosche a benvida").
- Mailpit addresses are test-only environment variables, not app settings.

## QA — RETURNED (round 1)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (ruff check + format check) | `docs/tasks/evidence/T004/qa/lint.txt` | PASS |
| 2 | Targeted tests (`tests/test_emails.py`, 15 passed) | `docs/tasks/evidence/T004/qa/targeted.txt` | PASS |
| 3 | Full suite + coverage ×3 (82 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T004/qa/coverage_{1,2,3}.txt` | PASS |
| 4 | Coverage of the new code (`app/emails/sender.py`, `config.py` 100 %) | `docs/tasks/evidence/T004/qa/coverage_emails.txt` | PASS |
| 5 | Mailpit: integration message present, logo `Inline`, no attachments | `docs/tasks/evidence/T004/qa/mailpit.txt`, `mailpit_message.json` | PASS |
| 6 | Delivered message headers (RFC 5322) | `docs/tasks/evidence/T004/qa/headers.txt`, `mailpit_raw_source.eml` | FAIL |
| 7 | HTML client compatibility (Mailpit HTML check: 92 % supported, 6.4 % partial) | `docs/tasks/evidence/T004/qa/html_check.txt` | PASS |
| 8 | es/gl wording review (manual, against the rendered templates) | templates under `backend/app/emails/templates/` | PASS (see observations) |
| 9 | Builds / production image | N/A — no dependency, Dockerfile or entrypoint change; no frontend yet | N/A |

### Blockers
- **B1**: `backend/app/emails/sender.py:42-45` — `build_message()` sets only `From`, `To` and `Subject`.
  The message leaves the app with **no `Date` header** (required by RFC 5322 §3.6) and **no
  `Message-ID`**: the raw source received by Mailpit has `grep -c '^Date:'` = 0 and its Message-ID is
  `<…@mailpit>`, added by Mailpit, not by the sender (`docs/tasks/evidence/T004/qa/headers.txt`).
  Real relays do not always add them, and missing Date/Message-ID are classic spam signals
  (SpamAssassin `MISSING_DATE`, `MISSING_MID`) — risky for OTP codes that must arrive. Expected:
  `Date` via `email.utils.formatdate(localtime=False)` and `Message-ID` via `email.utils.make_msgid()`
  (domain taken from `EMAIL_FROM`), and the memory-backend test asserting both headers are present.

### Observations (non-blocking)
- **Spanish / Galician wording** — correct and natural overall: "Te damos la bienvenida",
  "Dámosche a benvida", "Se non tentaches entrar" (tentar = intentar, normative), "non te
  rexistraches", "rematar de crear a túa conta", "ningunha conta" are all fine.
  Points worth fixing while on B1:
  - Vocative comma: RAE and RAG norms require "Hola, Ana:" / "Ola, Ana:" (currently "Hola Ana:" /
    "Ola Ana:"). The English "Hello Ana," is acceptable, "Hello, Ana," is the formal form.
  - `minutes=1` would render "1 minutos" / "1 minutes"; fine while the code TTL is always > 1, but
    worth a note if the value becomes configurable.
  - Galician omits the opening "¡" ("Dámosche a benvida a …!"); allowed by the RAG norms (optional),
    so this is a style choice, consistent with the rest of the Galician text.
  - English "ignore this email" reads a bit curt; "you can ignore this email" is the usual wording.
- **HTML for email clients** — inline styles, `cid:logo` (inline disposition, `Content-ID: <logo>`),
  `alt` = app name, explicit `width`/`height`, `role="presentation"` tables: all good. Outlook
  desktop (Word engine) ignores `max-width` and `padding` on `<table>` and `border-radius`: the card
  will stretch to full width with no inner padding there. Moving the 32px padding to the inner `<td>`
  and adding a fixed `width="480"` (or an MSO conditional wrapper) would fix it.
- `test_smtp_failure_is_raised` checks the raise but not the log line the task asks for
  ("failures are logged and raised"); a `caplog` assertion would pin it.
- `test_missing_context_value_is_an_error` catches bare `Exception`; `jinja2.UndefinedError` is the
  specific type.
- `test_message_is_delivered_to_mailpit` reads `MAILPIT_API_URL` / `MAILPIT_SMTP_HOST` and its comment
  says "set by the dev and CI compose files": the CI side does not exist yet — T012 must provide them.
- `.env.example` documents neither `EMAIL_BACKEND` nor `SMTP_TIMEOUT_SECONDS` (defaults are sensible).

### Round 2 (QA round 1: B1)
- **B1**: `build_message()` sets `Date` (UTC) and `Message-ID` (domain from `EMAIL_FROM`); the memory
  test checks both, and Mailpit shows our own values (`docs/tasks/evidence/T004/headers.txt`).
- Observations applied: comma before the name in greetings ("Hello, Ana," / "Hola, Ana:" / "Ola, Ana:"),
  singular/plural of minutes, "you can ignore this email" in English, Outlook-friendly layout (padding
  on cells, fixed width 480 with `max-width`), failure log asserted (without the address), specific
  `UndefinedError`, `EMAIL_BACKEND` and `SMTP_TIMEOUT_SECONDS` in `.env.example`, Mailpit variables noted
  in T012. Galician keeps no opening "!" (allowed by the norm).
- 89 tests, 100 % coverage, three runs.

## QA — APPROVED (round 2)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | B1: `Date` and `Message-ID` set by the sender, in a message actually delivered to Mailpit (`Date: Tue, 24 Nov 2026 19:31:52 +0000`, `Message-ID: <…@example.com>`, one of each, domain from `EMAIL_FROM`) | `docs/tasks/evidence/T004/qa/round2_headers.txt`, `round2_raw_source.eml`, `round2_message.json` | PASS |
| 2 | Lint (ruff check + format check) | `docs/tasks/evidence/T004/qa/round2_lint.txt` | PASS |
| 3 | Targeted tests (`tests/test_emails.py`, 22 passed) | `docs/tasks/evidence/T004/qa/round2_targeted.txt` | PASS |
| 4 | Full suite + coverage ×3 (89 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T004/qa/round2_coverage_{1,2,3}.txt` | PASS |
| 5 | Coverage of the new code (`app/emails/*`, `config.py` 100 %) | `docs/tasks/evidence/T004/qa/round2_coverage_emails.txt` | PASS |
| 6 | Mailpit: integration message present, logo `Inline` (`Content-ID: <logo>`, disposition inline), no attachments | `docs/tasks/evidence/T004/qa/round2_mailpit.txt`, `round2_message.json` | PASS |
| 7 | HTML client compatibility (Mailpit HTML check: 92 % supported, 6.4 % partial, 1.6 % unsupported) | `docs/tasks/evidence/T004/qa/round2_html_check.txt` | PASS |
| 8 | en/es/gl wording after the round-2 changes (manual review of all 18 templates + layout) | templates under `backend/app/emails/templates/` | PASS (see observations) |
| 9 | Builds / production image | N/A — no dependency, Dockerfile or entrypoint change; no frontend yet | N/A |

### Round-1 items re-checked
- **B1** fixed: `sender.py` sets `Date` (`formatdate(usegmt=True)`) and `Message-ID` (`make_msgid(domain=…)`);
  the delivered raw source carries our own values (Mailpit's only addition is `Received`/`Return-Path`);
  the memory test asserts a UTC `Date` within one minute and a Message-ID ending in `@example.com>`.
- Observations applied and verified: vocative comma ("Hello, Ana," / "Hola, Ana:" / "Ola, Ana:", and
  "Hello," / "Hola:" / "Ola:" without a name), minute/minutes agreement (tested for 1 and >1),
  "you can ignore this email", padding moved to the cells, `caplog` assertion (and the address is not
  logged), `UndefinedError`, `EMAIL_BACKEND` / `SMTP_TIMEOUT_SECONDS` in `.env.example`, Mailpit
  variables noted in T012.

### Observations (non-blocking)
- **Outlook width**: the card table has `width="480"` but also inline `style="width:100%;max-width:480px"`.
  Outlook desktop (Word engine) honours the inline CSS `width` and ignores `max-width`, so the card can
  still stretch to full width there; the inline padding fix does work. `style="width:480px;max-width:100%"`
  or an MSO conditional `<table width="480">` wrapper would pin it. Cosmetic only.
- **Wording**: es/gl texts are correct and natural ("Si no has intentado entrar, ignora este correo",
  "Se non te rexistraches, ignora este correo e non se activará ningunha conta"). Galician keeps no
  opening "¡" (optional in the RAG norms, consistent). The plain-text bodies of `welcome_signup` hard-wrap
  one sentence mid-line ("no account\nwill be activated"); harmless in text/plain.
- The greeting test covers only the name case; the no-name greeting ("Hello,") is not asserted.

### After QA approval
- Unwrapped the hard-wrapped sentence in the welcome_signup text bodies; added a test for the greeting
  without a name (92 tests). Outlook full-width card left as is (cosmetic).
