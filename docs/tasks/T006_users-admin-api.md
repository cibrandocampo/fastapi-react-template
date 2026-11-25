# T006 — User management API

**Plan**: docs/plans/template-base.md · **Depends on**: T003

## Context
Admins grant access to sign-ups (role `none` → `user`) and manage accounts from the UI (T009).

## Objective
Admin-only `/api/users` endpoints with guards that keep at least one active admin.

## Step 1 — Endpoints (admin only)
- `GET /api/users?q=&role=&active=&page=&size=` → paginated list (`items`, `total`), search by email/name.
- `POST /api/users {email, first_name, last_name, role, auth_method, password?, language?}` → creates an
  active user with `email_verified_at` set (the admin vouches for it, so the unverified-sign-up
  clean-up never deletes it) (password required for the password method, rules from T003).
- `GET /api/users/{id}`, `PATCH /api/users/{id}` (names, role, is_active, auth_method, language).
- `POST /api/users/{id}/set-password {password}` (sets method `password`, revokes their sessions).
- `DELETE /api/users/{id}`.
- Deactivating, demoting or deleting a user revokes their sessions.
- Guards: the last active admin cannot be demoted, deactivated or deleted (409 `last_admin`); an admin
  cannot delete themselves (409 `cannot_delete_self`). Duplicate email → 409 `email_taken`.

## DoD
1. Tests for each endpoint, each guard, 403 for `user`/`none`, 401 without token, session revocation.
2. Lint clean; coverage ≥ 95 %.

## Evidence
| # | Check | Command | File | PASS when |
|---|-------|---------|------|-----------|
| 1 | Tests | `make coverage-backend` | `coverage.txt` | all pass, ≥ 95 % |
| 2 | Lint | `make lint-backend` | `lint.txt` | clean |

## Files
| File | Action |
|------|--------|
| `backend/app/users/router.py`, `backend/app/users/schemas.py`, `backend/app/users/service.py` | CREATE |
| `backend/app/main.py` | MODIFY |
| `backend/tests/test_users_admin.py` | CREATE |

## Execution evidence
**Date**: 2026-11-24
**Files**:
- `backend/app/users/router.py` — `/api/users` list/create/get/update/set-password/delete, admin only.
- `backend/app/users/service.py` — rules: case-insensitive duplicate check (and IntegrityError for
  concurrent creates), password rules, last-admin guard with the active admins' rows locked, session
  revocation on deactivate/demote/set-password, cascade delete.
- `backend/app/users/schemas.py` — `UserCreate`, `UserUpdate` (`extra=forbid`), `SetPassword`, `UserPage`.
- `backend/app/main.py` — router registered.
- `backend/tests/test_users_admin.py` — 46 tests.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Tests + coverage ×3 (225 tests, 100 %) | `docs/tasks/evidence/T006/coverage_{1,2,3}.txt` | PASS |
| 2 | Lint | `docs/tasks/evidence/T006/lint.txt` | PASS |

### Decisions
- **Concurrency of the last-admin guard**: the active admins' rows are locked (`FOR UPDATE`, ordered by
  id) before counting, until commit. Without it two admins demoting or deleting each other at the same
  moment would both see "another admin remains" and leave none. Tests run both races for real.
- Promotion keeps sessions; any drop in role level, deactivation and set-password end them (the role is
  read from the database on every request, so a promotion is effective at once).
- Switching a user to `otp` drops their password hash; switching to `password` needs a password first
  (`password_required`, use set-password).
- Created users default to role `user` and method `otp`; names are optional (the admin may not know them).
- List ordered by email; search matches email or "first last" (case-insensitive); size 1–100.
- An inactive admin cannot act at all (401 from the session check), so they never count as "another admin".

## QA — RETURNED (round 1)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/lint.txt` | PASS |
| 2 | Targeted tests (`tests/test_users_admin.py`, 46) | `docs/tasks/evidence/T006/qa/targeted.txt` | PASS |
| 3 | Full suite + coverage ×3 (225 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T006/qa/coverage_{1,2,3}.txt` | PASS |
| 4 | Authorisation live: 6 endpoints × {none, user} → 403, anonymous / garbage token → 401; no role change via `/auth/me` | `docs/tasks/evidence/T006/qa/authz.txt` | PASS |
| 5 | Crafted bodies: `extra=forbid` rejects `id`, `password_hash`, `is_active` (create), `email`, `theme`; unknown roles 422; null 400; duplicate email (any case) 409 | `docs/tasks/evidence/T006/qa/input-validation.txt` | PASS |
| 6 | Session revocation live: deactivate, demote, set-password, delete end refresh tokens; promotion / same role keep them | `docs/tasks/evidence/T006/qa/sessions.txt` | PASS |
| 7 | Last-admin guard under real concurrency (dev backend, parallel curl): mutual demote ×20, mutual deactivate ×20, both step down ×20, delete vs demote ×10, mutual delete ×10, 3-way demote cycle ×10 — never zero active admins, loser always 409 `last_admin` | `docs/tasks/evidence/T006/qa/race-last-admin.txt` | PASS |
| 8 | Input validation at the boundary: path ids, `page`, NUL bytes | `docs/tasks/evidence/T006/qa/input-validation.txt`, `docs/tasks/evidence/T006/qa/500s.txt` | FAIL |
| 9 | Cleanup: QA users deleted, admin@example.com active admin, password login 200, `failed_logins` empty | `docs/tasks/evidence/T006/qa/cleanup.txt` | PASS |

### Blockers
- **B1**: `backend/app/users/router.py:41,46,52,58` — `user_id: int` is unbounded while `users.id` is an
  `INTEGER` column. Expected 404 `user_not_found` (or 422) for any id; found **500** for
  `GET|PATCH|DELETE /api/users/2147483648` and `GET /api/users/99999999999999999999`
  (`asyncpg DataError: value out of int32 range`). Bound the path parameter (e.g. `Path(ge=1, le=2**31-1)`) and add a test.
- **B2**: `backend/app/users/router.py:26` — `page` has `ge=1` but no upper bound. Expected 422 (or an
  empty page); found **500** for `GET /api/users?page=999999999999999999999` (`OFFSET` out of int64 range).
  Add `le=` and a test (the `test_list_rejects_invalid_parameters` parametrisation is the natural place).
- **B3**: `backend/app/users/router.py:23` (`q`) and `backend/app/users/schemas.py:38` (`OptionalName`, used by
  `UserCreate` / `UserUpdate` names) accept the NUL character. Expected 422; found **500**
  (`CharacterNotInRepertoireError: invalid byte sequence for encoding "UTF8": 0x00`) for
  `GET /api/users?q=%00`, `POST /api/users {"first_name":"nul\u0000byte",…}` and
  `PATCH /api/users/{id} {"last_name":"nul\u0000byte"}`. Reject control characters at the boundary and test it.

### Observations (non-blocking)
- The same NUL-byte 500 exists on the T003 endpoint `PATCH /api/auth/me` (`Name`, `schemas.py:10`),
  shown in `500s.txt`; it shares the fix of B3, worth covering at the same time.
- `service.py:103,135`: whether the target "is an active admin" is decided from the row read by `get_user`
  *before* the admins are locked. If another request promotes the target between that read and the
  lock, a deactivate/delete of the target skips the guard; combined with a third admin stepping down
  this could leave zero admins. Not reproducible on demand (the window is one request's read→write),
  but locking the target row first (or re-evaluating after `with_for_update` with `populate_existing`)
  closes it.
- The acting admin's role is checked at request start, not under the lock: in the 3-way race an admin
  being demoted can still complete a concurrent action. The ≥1-admin invariant held in every round.
- `service.py:29`: `%` and `_` in `q` are LIKE wildcards (`q=%` matches everyone). Admin-only, no
  exposure, but search is not literal.
- `POST /api/users` with `auth_method: "otp"` and a `password` silently ignores the password.
- Switching a user to `otp` drops the password hash but keeps their sessions (not required by the task).
- The 401-without-token test covers only `GET /api/users`; the live probe confirms all six endpoints answer 401.
- `is_active: "yes"` is accepted as `true` (Pydantic lax booleans).

### Round 2 (QA round 1: B1, B2, B3)
- **B1**: user ids are `IdPath` (1…2 147 483 647); **B2**: `page` ≤ 100 000; **B3**: `app/core/types.py`
  defines `Name`, `OptionalName`, `Secret`, `Code` (no NUL, length limits) used by every body in
  users and auth (also `PATCH /me` and passwords), and `q` rejects NUL. Tests for each; live check:
  `docs/tasks/evidence/T006/former_500s.txt` (all 422).
- Observations applied: the last-admin guard now locks the active admins first, re-reads the target and
  checks the acting admin is still an active admin under the lock (403 otherwise; test with a demotion
  while the request waits). With that check the delete can never remove the last admin (the actor
  remains), so its separate last-admin check was removed. Search escapes `%` and `_` (test); creating
  a code-login user with a password answers `password_not_allowed` (test); the 401 test covers all six
  endpoints.
- 252 tests, 100 % coverage, three runs.

## QA — RETURNED (round 2)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Round-1 B1/B2/B3 live: ids 2147483648 / 10^20 / 0 / -1 → 422 on all four id routes, 2147483647 → 404; `page` > 100 000 and 10^21 → 422; NUL in `q`, names (create, PATCH, `/auth/me`), passwords (create, set-password, change-password, login) and codes → 422 | `docs/tasks/evidence/T006/qa/round2_former-500s.txt` | PASS |
| 2 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round2_lint.txt` | PASS |
| 3 | Targeted tests (users admin, auth login, auth session: 127) | `docs/tasks/evidence/T006/qa/round2_targeted.txt` | PASS |
| 4 | Full suite + coverage ×3 (252 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T006/qa/round2_coverage_{1,2,3}.txt` | PASS |
| 5 | Input fuzz of `/api/users` and `/api/auth` (body shapes, invalid JSON, content types, 5 MB / deeply nested bodies, lone surrogates, control and bidi characters, 100/101-char and multibyte names, 1024+ passwords, odd emails, enum/type/null fields, duplicate keys, query params incl. invalid UTF-8, path oddities, methods, Authorization headers, refresh cookies, login bodies): no 5xx | `docs/tasks/evidence/T006/qa/round2_fuzz.txt` | PASS |
| 6 | Authorisation live: 6 endpoints × {none, user} → 403, anonymous / garbage token → 401 | `docs/tasks/evidence/T006/qa/round2_authz.txt` | PASS |
| 7 | Reworked last-admin guard under real concurrency: mutual demote ×20, mutual deactivate ×20, both step down ×20, 3-way demote cycle ×15, three self-deactivations ×15, promote X ‖ deactivate X ‖ demote the deactivator ×15, mutual delete ×5, delete ‖ demote ×5 — never zero active admins; loser 403 `forbidden` (actor no longer an active admin under the lock) or 409 `last_admin` | `docs/tasks/evidence/T006/qa/round2_race-last-admin.txt` | PASS |
| 8 | Concurrent change of a user that another admin deletes at the same moment | `docs/tasks/evidence/T006/qa/round2_race-deleted-target.txt`, `docs/tasks/evidence/T006/qa/round2_race-deleted-target-http.txt` | FAIL |
| 9 | Cleanup: QA users deleted, admin@example.com active admin (names empty), password login 200, `failed_logins` empty | `docs/tasks/evidence/T006/qa/round2_cleanup.txt` | PASS |

### Blockers
- **B4**: `backend/app/users/service.py:105` (`await db.refresh(target)` in `_lock_admins`), `:134` (`await db.refresh(user)`
  after the commit in `update_user`) and `:140` (`set_password` commit) — the target is read by `get_user` before
  the lock and nothing handles it disappearing meanwhile. Expected 404 `user_not_found` (or the 204/200 of the
  winner and a clean 4xx for the loser); found **500** with plain HTTP requests, no tooling:
  two admins `DELETE /api/users/X` at once → the second gets 500 in 20/20 rounds; `DELETE X` ‖ `PATCH X {"role":"user"}`
  → 500 in 17/20; `DELETE X` ‖ `PATCH X {"is_active":false}` → 500 in 14/20; `DELETE X` ‖ `POST X/set-password`
  → 500 in 10/10. Exceptions: `sqlalchemy.exc.InvalidRequestError: Could not refresh instance` (service.py:105, and
  :134 when the PATCH committed first; that request then answers 500 although its change was saved) and
  `sqlalchemy.orm.exc.StaleDataError: UPDATE statement on table 'users' expected to update 1 row(s); 0 were matched`
  (set-password). Deterministic reproduction: a transaction that holds the active admins' locks and deletes X makes
  every one of PATCH role / PATCH is_active / DELETE on X answer 500 (`round2_race-deleted-target.txt`). The
  `refresh(target)` is new in this round (the round-1 code did not re-read the target); the double-delete and
  set-password paths were not probed in round 1. Re-read the target under the lock in a way that can report "gone"
  (e.g. `select(User).where(User.id == id).with_for_update()` / `db.get(..., populate_existing=True)` → 404) and handle
  the 0-row update in set-password; add a test for each (deleted while waiting for the lock, double delete, set-password
  on a deleted user).

### Guard review (non-blocking, confirmed)
- Lock first, then check the actor: the actor's row is locked as an active admin until commit, so nothing can demote,
  deactivate or delete them meanwhile; a demoted or deleted actor gets 403 under the lock (seen in S1, S2, S5, S8, S9).
- Removed delete-specific last-admin check: correct. `cannot_delete_self` rules out actor = target, and the actor stays
  locked as an active admin, so after the delete at least the actor remains. The same reasoning makes the PATCH guard
  needed only for self-demotion/deactivation, which is what `admins == {user.id}` covers.
- The `FOR UPDATE` scan can only under-count (an admin promoted by a transaction that commits while we wait is not
  returned in READ COMMITTED), which can only produce a spurious 409, never zero admins.

### Observations (non-blocking)
- Only NUL is rejected in names: other C0 controls (`\u0001`, `\u001f`) and bidi overrides (`‮`) are stored as
  given (`round2_fuzz.txt`). No crash; worth rejecting `Cc` (and maybe `Cf`) characters in `Name`/`OptionalName` before
  the admin UI (T009) shows names.
- Lax parsing remains: `/api/users/%201` and `/api/users/1.0` resolve to user 1; `is_active: "yes"` and `active=1` are booleans.
- Internationalised emails are stored in Unicode form (`qa-r2-ü@exämple.com`), not punycode; duplicate detection
  between both spellings was not checked.
- `allow_self_signup` is `true` in the running dev backend although `.env.example` says `false`: `POST /auth/login/start`
  for an unknown address created a `none` account (deleted in cleanup).
- The dev database keeps users 2–11 and 132 from earlier tasks' QA (not created by this round; left untouched).
- QA side effect, restored: probes with ids `" 1"` / `1.0` hit admin@example.com (renamed and set-password); it was
  reset through the API to the original password (new hash, its refresh sessions revoked) and `last_name` back to empty.
- Tests asserting race outcomes accept two codes (`in (401, 403)`, `([200, 403], [200, 409])`): justified by the
  race; the invariant assertion that follows is specific.

### Round 3 (QA round 2: B4)
- **B4**: every write locks the target's row and reads it fresh (`_lock_user`, `FOR UPDATE` with
  `populate_existing`), after `_lock_admins` when the change touches admin rights (one lock order for
  every transaction, so no deadlock). A target deleted by a concurrent request answers 404
  `user_not_found` and nothing is written; no refresh after commit. Service functions take the user id.
- Tests (deterministic: the target's row is held, the request starts, the target is deleted): PATCH name,
  PATCH role, PATCH is_active, set-password and DELETE all answer 404; two admins deleting the same user
  get 204 and 404. Live probe: 50 parallel rounds of delete vs delete/demote/deactivate/set-password/rename,
  no 5xx — `docs/tasks/evidence/T006/race_deleted_target_live.txt`.
- Observation applied: names reject control characters and bidirectional overrides (`PLAIN_TEXT`), keep
  accents and other scripts (tests). Lax parsing of path ids (`%201`, `1.0`) and booleans (`"yes"`)
  accepted as FastAPI/Pydantic behaviour. Dev sign-up is open on purpose (`dev/docker-compose.yml`).
- Dev database cleaned: only admin@example.com remains.
- 264 tests, 100 % coverage, three runs.

## QA — RETURNED (round 3)

**Date**: 2026-11-24

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round3_lint.txt` | PASS |
| 2 | Targeted tests (users admin, auth login, auth session: 139) | `docs/tasks/evidence/T006/qa/round3_targeted.txt` | PASS |
| 3 | Full suite + coverage ×3 (264 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T006/qa/round3_coverage_{1,2,3}.txt` | PASS |
| 4 | B4 live, admin requests on a user deleted concurrently (parallel curl, 20 rounds each): DELETE ‖ DELETE, ‖ demote, ‖ deactivate, ‖ set-password, ‖ rename, ‖ `auth_method=otp`, ‖ promote, ‖ GET, DELETE ‖ DELETE ‖ demote, DELETE ‖ set-password ‖ deactivate+rename — 0 × 5xx in 200 rounds; loser 404 `user_not_found` | `docs/tasks/evidence/T006/qa/round3_race-deleted-target.txt` | PASS |
| 5 | Deletes combined with last-admin races (participants the only active admins, 15 rounds each): mutual delete; delete X ‖ X demotes A3 ‖ A3 self-demotes; delete A3 ‖ A3 self-deactivates ‖ A2 self-demotes; delete X ‖ promote X ‖ demote A2 ‖ A2 self-deactivates; 3-way delete cycle; delete A3 ‖ A3 set-password A2 ‖ A3 deactivates A2 — 0 × 5xx, never zero active admins; losers 403 `forbidden` / 409 `last_admin` / 404 | `docs/tasks/evidence/T006/qa/round3_race-last-admin.txt` | PASS |
| 6 | Admin set-password / deactivation ‖ the user's own refresh (20 + 20): 0 live refresh tokens afterwards, the cookie issued by the racing refresh answers 401 | `docs/tasks/evidence/T006/qa/round3_race-revoke-vs-refresh.txt` | PASS |
| 7 | Lock order: DELETE X ‖ 8 refreshes of X's sessions (20 rounds) — **27 `deadlock detected`** in the Postgres log, 5xx in 14/20 rounds | `docs/tasks/evidence/T006/qa/round3_race-refresh-storm.txt`, `docs/tasks/evidence/T006/qa/round3_db-log.txt`, `docs/tasks/evidence/T006/qa/round3_backend-errors.txt` | FAIL |
| 8 | Admin DELETE X ‖ X's own requests (20 rounds each): login 500 20/20, change-password 500 20/20, `PATCH /auth/me` 500 2/20; refresh ×1 / ×3 OK | `docs/tasks/evidence/T006/qa/round3_race-auth.txt`, `docs/tasks/evidence/T006/qa/round3_backend-errors.txt` | FAIL |
| 9 | Fuzz of `/api/users` and `/api/auth` (263 requests: body shapes, content types, 5 MB / deep bodies, surrogates, control/bidi/zero-width characters, emails, enums, query params, path oddities, methods, Authorization headers, refresh cookies, login bodies): no 5xx | `docs/tasks/evidence/T006/qa/round3_fuzz.txt` | PASS |
| 10 | Cleanup: QA users deleted, only admin@example.com (active admin, names empty), password login 200, `failed_logins` empty, no orphan tokens | `docs/tasks/evidence/T006/qa/round3_cleanup.txt` | PASS |

### Blockers
- **B5** (deadlock): `backend/app/users/service.py:173-174` (`delete_user`: `_lock_user` takes the user's row `FOR UPDATE`,
  then `db.delete` cascades into `refresh_tokens`) against `backend/app/auth/sessions.py:68-83` (`rotate`: claims the
  token row with an `UPDATE`, then inserts the new token, whose foreign-key check needs a `KEY SHARE` lock on the same
  user row). The two transactions take `users` and `refresh_tokens` in opposite orders. Expected: the delete 204 and the
  refresh 200/401, no 5xx. Found: Postgres `deadlock detected` 27 times (`Process A: DELETE FROM users …` waits for
  `Process B: INSERT INTO refresh_tokens …` and vice versa, `round3_db-log.txt`); `DELETE /api/users/X` answered 500
  in 12/20 rounds (user **not** deleted) and a refresh 500 in 8 rounds (`round3_race-refresh-storm.txt`). A single
  parallel refresh was not enough (20/20 clean), but a user with several open tabs/devices refreshing while an admin
  deletes them hits it. Take the locks in one order in both paths, e.g. `rotate` locks the user's row (`FOR KEY SHARE`,
  → 401 if gone) before claiming the token, or `delete_user` revokes/locks the user's tokens before deleting the user;
  add a test that runs a refresh and a delete of the same user at once (several sessions).
- **B6** (500 for the deleted user's own requests): with deletion now possible (`DELETE /api/users/{id}`), the user's
  in-flight requests answer 500 instead of 401: `POST /api/auth/login/verify` — `ForeignKeyViolationError` in
  `sessions.issue` (`backend/app/auth/router.py:140` → `sessions.py:47`) 20/20 rounds; `POST /api/auth/change-password`
  — `StaleDataError` at `router.py:229` 20/20; `PATCH /api/auth/me` — `StaleDataError` at `router.py:212` 2/20
  (`round3_race-auth.txt`, `round3_backend-errors.txt`). Same class as B4 on the other side of the delete. Expected
  401 `unauthorized` (or `invalid_credentials` for login). Lock or re-read the user's row before writing (or catch the
  0-row update / FK violation) and add a test per endpoint with a user deleted while the request runs.

### Round-2 blocker
- **B4**: fixed for every admin request (check 4, 0 × 5xx in 200 rounds; test `test_a_user_deleted_while_the_request_waits_answers_404`
  parametrised over the five writes, plus double delete).

### Lock-order review (users ↔ users)
- `_lock_admins` (active admins by id) then `_lock_user`: when the target is an admin it is already locked; otherwise it
  comes after every admin row, so two admin writes always lock in ascending order. Writes that lock only the target
  (rename, set-password) hold one row and wait for nothing else. Login (`_check_password`, `FOR NO KEY UPDATE` on the
  user, then `failed_logins`) also takes the user first. No deadlock among admin requests in checks 4–6
  (`pg_stat_database.deadlocks` was 0 before check 7). The cycle is only with `rotate` (B5).

### Observations (non-blocking)
- Names accept zero-width and format characters: `U+200B` and `U+FEFF` are stored (`round3_fuzz.txt`); `PLAIN_TEXT`
  rejects C0, DEL and bidi controls only. Worth extending to `Cf` before the admin UI (T009).
- `round3_race-auth.txt` has harmless stderr lines from the probe (wrong temp file name for the error-code suffix);
  the status codes come straight from curl.
- A first run of the last-admin probe was discarded and re-run: QA admins from the deleted-target run were still active,
  so the participants were not the only admins; the evidence file is the re-run (guarded against that).

### Round 4 (QA round 3: B5, B6)
- **One lock order for everything that touches a user**: the user's row first, then their tokens or
  codes — the same order as an admin delete (row, then tokens by cascade). `sessions.lock_user()`
  (FOR NO KEY UPDATE, or FOR KEY SHARE for refreshes so a user's sessions refresh in parallel).
- **B5**: `rotate()` looks up the token's owner, locks the owner's row (KEY SHARE), then claims the token;
  a user deleted meanwhile → 401. Test with 8 sessions refreshing while the user is deleted; live:
  20 rounds, no 5xx, no deadlock in the Postgres log — `docs/tasks/evidence/T006/race_refresh_storm_live.txt`.
- **B6**: login/verify locks the user's row before checking the code or password and keeps it until the
  session is stored (the OTP code is now consumed in that same transaction); a user deleted meanwhile →
  `invalid_credentials`. `PATCH /me` and change-password lock the caller's row first (401 if deleted or
  disabled); change-password revokes other sessions and issues the new one in one transaction.
  `sessions.issue()` answers 401 on a foreign-key violation as a last line. Deterministic tests for each.
- `_check_password` no longer takes its own lock (the caller holds it); the lockout tests still pass
  (12 concurrent wrong passwords → exactly 5 checks).
- Names also reject zero-width characters and U+FEFF. The test that listed bidi characters had them
  as raw invisible characters in the source (a "trojan source" pattern); now written as escapes and the
  source tree is checked clean.
- 273 tests, 100 % coverage, three runs. One branch only reachable when the clean-up deletes a token
  between two reads is marked `pragma: no cover` with that reason.

## QA — RETURNED (round 4)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round4_lint.txt` | PASS |
| 2 | Targeted tests (users admin, auth login, auth session, auth concurrency: 153) | `docs/tasks/evidence/T006/qa/round4_targeted.txt` | PASS |
| 3 | Full suite + coverage ×3 (273 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T006/qa/round4_coverage_{1,2,3}.txt` | PASS |
| 4 | B5 live: DELETE X ‖ 8 refreshes of X's sessions ×20 and ‖ 16 refreshes ×10 — 0 × 5xx, delete always 204, no tokens left; Postgres log: 0 `deadlock detected` since round 4 started, `pg_stat_database.deadlocks` still 27 (all from round 3) | `docs/tasks/evidence/T006/qa/round4_race-refresh-storm.txt`, `docs/tasks/evidence/T006/qa/round4_db-log.txt` | PASS |
| 5 | B6 live, admin DELETE / deactivate / set-password X ‖ X's refresh (×1, ×3 same token), password login, code login, `PATCH /auth/me`, change-password (13 scenarios × 20) — 0 × 5xx, losers 401 `unauthorized` / 400 `invalid_credentials` | `docs/tasks/evidence/T006/qa/round4_race-auth.txt`, `docs/tasks/evidence/T006/qa/round4_race-auth-code.txt` | PASS |
| 6 | Sessions ended by "log out everywhere" operations while X's sessions refresh (8 sessions, refreshes staggered 0–0.84 s, 10 rounds each) | `docs/tasks/evidence/T006/qa/round4_race-revoke-vs-refresh.txt`, `docs/tasks/evidence/T006/qa/round4_race-auth.txt` | FAIL |
| 7 | `POST /auth/login/start` ‖ DELETE of the same user, and two sign-ups of one new address | `docs/tasks/evidence/T006/qa/round4_race-login-start.txt`, `docs/tasks/evidence/T006/qa/round4_backend-errors.txt` | FAIL |
| 8 | Security, login path under concurrency: 12 parallel wrong passwords → exactly 5 checked (5 × 400, 7 × 429), 5 `failed_logins`, right password then 429; 4 wrong + (6 wrong ‖ right) → still 5 rows, no session; 12 parallel wrong codes → `attempts` = 5 and the right code then refused; right code ×10 in parallel → exactly one 200, one session, code consumed; wrong ‖ right codes → one 200; superseded code refused; method mismatch and disabled accounts never count a failure | `docs/tasks/evidence/T006/qa/round4_security-login.txt` | PASS |
| 9 | Fuzz of `/api/users` and `/api/auth` (263 requests) — no 5xx | `docs/tasks/evidence/T006/qa/round4_fuzz.txt` | PASS |
| 10 | Cleanup: every qa-r4 user deleted (including the sign-ups the login/start probe created), only admin@example.com (active admin, password method, names empty), password login 200, `failed_logins` empty, no orphan tokens/codes | `docs/tasks/evidence/T006/qa/round4_cleanup.txt` | PASS |

Probe scripts: `docs/tasks/evidence/T006/qa/round4_scripts/`.

### Blockers
- **B7** (revoked sessions survive; regression of round 4): `backend/app/users/service.py:163-164` (`set_password`: commit,
  then `revoke_all` in a **second** transaction, after the row lock is released) and `:150-152` (`update_user`, same for a
  demotion). Since round 4 `rotate()` waits for the user's row (`lock_user(share=True)`, `sessions.py:93`) and is released
  exactly at the admin's commit, so it claims the old token and inserts a new one while the separate `revoke_all` runs;
  the new token is not in that UPDATE's snapshot and stays live. Expected: after set-password / demotion, 0 live refresh
  tokens and every cookie handed out by a racing refresh refused. Found: admin set-password ‖ 8 refreshes → **10/10 rounds**
  with 1–3 live tokens whose cookies keep refreshing (200); demotion → 4/10; admin set-password ‖ one refresh → 11/20
  (`round4_race-auth.txt`; it was 0/20 in round 3, `round3_race-revoke-vs-refresh.txt`). Deactivation is not affected
  (rotate re-reads `is_active`). An admin resetting a compromised account's password does not reliably end the attacker's
  session. Revoke inside the transaction that holds the user's `FOR UPDATE` lock (`revoke_all(commit=False)` before the
  commit) so a waiting rotate finds its token revoked → 401; add a test that runs set-password / demotion while several
  sessions refresh and asserts 0 live tokens.
- **B8** (B6 not complete — login/start of a user being deleted): `backend/app/auth/router.py:111` → `_send_code`
  (`:70`) → `backend/app/auth/otp.py:29` (`issue_code` commit). The user is read without a lock and the code inserted
  later; if the admin delete commits in between → `IntegrityError` (FK `fk_login_codes_user_id_users`) → **500**. Found in
  3/30 rounds (all the rounds where start was not delayed). Expected 404 `user_not_found` (or 200 if it won). Lock the user's
  row (`sessions.lock_user`) before issuing the code, or map the FK violation, and add a test with the user deleted while
  the request waits.
- **B9** (two sign-ups of one new address): `backend/app/auth/router.py:102-103` (`db.add(user)`, `commit`) — two parallel
  `POST /auth/login/start` for the same unknown address (a double click on "send code") → one 200, the other **500**
  `UniqueViolationError uq_users_email_lower` in **30/30** rounds (one account created). Code from T003, untouched by
  T006, but a reproducible 5xx on the login path. Expected: both 200 (the loser re-reads the user and sends/skips the code)
  or a clean 4xx; catch the `IntegrityError` as `create_user` does and add a test.

### Round-3 blockers
- **B5**: fixed — 0 deadlocks and 0 × 5xx in 30 storm rounds (check 4) plus the delete scenarios of check 5.
- **B6**: fixed for login/verify (password and code), `PATCH /auth/me` and change-password (check 5, 0 × 5xx); the
  remaining login/start path is B8.

### Lock-order review (users, tokens, codes, failed logins)
Order everywhere: the user's row first, then that user's tokens / codes / failed logins.
- Admin writes: active admins (`FOR UPDATE`, by id) → target (`FOR UPDATE`) → delete cascades to tokens, codes,
  failed logins. `revoke_all` after the commit takes token rows only (B7 is about visibility, not a lock cycle).
- `rotate`: unlocked owner read → user `FOR KEY SHARE` → claim token (row lock) → insert (FK `KEY SHARE` on the user,
  already held). `_on_reuse` / `_revoke_family`: tokens of one family, user already held.
- login/verify: user `FOR NO KEY UPDATE` → code `FOR UPDATE` or `failed_logins` count/insert/delete → token insert.
- `PATCH /auth/me`, change-password: user `FOR NO KEY UPDATE` → (`revoke_all`) tokens → token insert.
- logout: tokens of one family only; updates `revoked_at` (not a key column), so it never waits for a user row. No cycle.
- login/start: no lock; one FK `KEY SHARE` at the code insert (a single lock, no cycle; the 500 is B8).
- Scheduler `cleanup`: one transaction deleting expired codes → old failed logins → tokens expired > 7 days → never-confirmed
  sign-ups (cascade). Formally token/code rows before user rows, but no reachable cycle: the deleted users never logged in
  (no tokens), `verify_code` locks only unexpired codes, and a user whose >7-day-expired token `rotate` may claim has
  logged in, so is never a clean-up target.
- No remaining pair takes locks in opposite order on the same rows; no deadlock in any round-4 probe.

### Observations (non-blocking)
- change-password ‖ refreshes of the user's other sessions: 0/10 survivors in the probe, but the window exists in theory:
  `lock_user` without `share` is `FOR NO KEY UPDATE`, which does not conflict with rotate's `FOR KEY SHARE`, so a refresh that
  claims its token just before the `revoke_all` statement and commits after it keeps its new token. Taking `FOR UPDATE` in
  change-password (or locking with B7's fix pattern) would make it airtight.
- The scheduler clean-up would follow the documented order literally if it deleted the sign-ups first (or in its own
  transaction).
- `round4_race-auth.txt`'s code-login scenario sent an empty code (the probe's mail helper failed); it was re-run with real
  codes in `round4_race-auth-code.txt` (19 × 200 / 1 × 400, 0 × 5xx).
- The login/start probe re-created deleted users through open sign-up (dev); they were deleted in cleanup.

### Round 5 (QA round 4: B7, B8, B9)
- **B7** (regression from round 4): admin set-password and demotion revoke the user's sessions inside the
  locked transaction (`revoke_all(commit=False)` before the commit). Refreshes now lock the user's row
  FOR SHARE (was KEY SHARE): they still run in parallel with each other, but wait for any request that
  changes the user — admin writes (FOR UPDATE / NO KEY UPDATE), change-password and the password check
  (NO KEY UPDATE) — and then find their token revoked. This also closes the change-password observation.
  Trade-off accepted: a refresh waits for a running password check of the same user (~0.3 s); the
  round-1 O8 test that asserted the opposite is replaced. Tests: a refresh waiting on a user change sees
  the revocation; 8 refreshing sessions during set-password and during demotion leave no live token.
  Live: 0/10 rounds each — `docs/tasks/evidence/T006/round5_live.txt`.
- **B8**: login/start locks the user's row before storing the code; an account deleted meanwhile → 404
  `user_not_found` (test).
- **B9**: a parallel sign-up of the same address (double click) catches the unique violation and continues
  as an existing account: every request answers `{"method": "otp"}`, one account (test; live 5 × 200).
- Scheduler order (tokens/codes before users) noted by QA: no request holds a token lock while waiting
  for a user row the clean-up holds, so no cycle; left as is.
- 277 tests, 100 % coverage, three runs.

## QA — RETURNED (round 5)

**Date**: 2026-11-25

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round5_lint.txt` | PASS |
| 2 | Targeted tests (users admin, auth login, auth session, auth concurrency: 157) | `docs/tasks/evidence/T006/qa/round5_targeted.txt` | PASS |
| 3 | Full suite + coverage ×3 (277 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T006/qa/round5_coverage_{1,2,3}.txt` | PASS |
| 4 | B7 live: admin set-password / deactivate / demote ‖ 8 refreshes of X (staggered 0–0.84 s) and X's change-password ‖ 8 refreshes, 10 rounds each — 0/40 survivors: live tokens 0 (1 after change-password, its own), no racing cookie refreshes | `docs/tasks/evidence/T006/qa/round5_race-revoke-vs-refresh.txt` | PASS |
| 5 | Admin DELETE / deactivate / set-password X ‖ X's refresh (×1, ×3), password login, code login, login/start, `PATCH /auth/me`, change-password (13 scenarios × 20) + code login re-run ×20 — 0 × 5xx, 260/260 rounds with 0 live tokens after a delete / deactivate / set-password | `docs/tasks/evidence/T006/qa/round5_race-auth.txt`, `docs/tasks/evidence/T006/qa/round5_race-auth-code.txt` | PASS |
| 6 | B8 / B9 live: DELETE X ‖ login/start (start delayed 0–90 ms) ×30 → 27 × 200, 3 × 404 `user_not_found`, 0 × 5xx; 2 × login/start of one new address ×30 → 30/30 both 200, one account | `docs/tasks/evidence/T006/qa/round5_race-login-start.txt` | PASS |
| 7 | B5 regression: DELETE X ‖ 8 refreshes ×20 — delete always 204, 0 × 5xx, no tokens left, no deadlock | `docs/tasks/evidence/T006/qa/round5_race-refresh-storm.txt` | PASS |
| 8 | FOR SHARE mix on one user: 8 refreshes ‖ 3 wrong + 1 right password ‖ `PATCH /me` ‖ login/start ‖ admin rename ‖ admin PATCH role+language, 10 rounds — 0 × 5xx, 0 deadlocks; refreshes wait up to 1.46 s behind the password checks | `docs/tasks/evidence/T006/qa/round5_race-share-mix.txt` | PASS |
| 9 | Security, login path under concurrency: 12 parallel wrong passwords → exactly 5 checked (5 × 400, 7 × 429), right password then 429; 4 wrong + (6 wrong ‖ right) → 5 rows, no session; 12 parallel wrong codes → `attempts` 5, right code refused; right code ×10 → one 200, one session, code consumed; wrong ‖ right codes → one session; superseded code refused; method mismatch / disabled never count | `docs/tasks/evidence/T006/qa/round5_security-login.txt` | PASS |
| 10 | Lock-order review + Postgres log: no deadlock from any request probe (`pg_stat_database.deadlocks` 27 → 27 through checks 4–9); the scheduler clean-up against an admin DELETE of a stale sign-up deadlocks (6 of 9 timed runs; admin DELETE **500** in 3/3 of the variant where the clean-up reaches `users` quickly, as the real function does) | `docs/tasks/evidence/T006/qa/round5_race-cleanup-vs-delete.txt`, `docs/tasks/evidence/T006/qa/round5_race-cleanup-vs-delete-b.txt`, `docs/tasks/evidence/T006/qa/round5_db-log.txt`, `docs/tasks/evidence/T006/qa/round5_backend-errors.txt` | FAIL |
| 11 | Fuzz of `/api/users` and `/api/auth` (263 requests) — 0 × 5xx (backend log: 0 × 5xx during the run) | `docs/tasks/evidence/T006/qa/round5_fuzz.txt` | PASS |
| 12 | Cleanup: every qa-r5 user deleted (28 re-created sign-ups / fuzz target deleted through the API), only admin@example.com (active admin, password method, names empty), password login 200, `failed_logins` empty, no orphan tokens / codes | `docs/tasks/evidence/T006/qa/round5_cleanup.txt` | PASS |

Probe scripts: `docs/tasks/evidence/T006/qa/round5_scripts/` (round-4 scripts with qa-r5 names, plus `race_share_mix.sh` and `cleanup_vs_delete.sh`).

### Blockers
- **B10** (deadlock: scheduler clean-up ‖ admin DELETE of a stale sign-up): `backend/app/core/scheduler.py:28-38` (`cleanup`: one
  transaction deleting expired `login_codes` first, then the never-confirmed sign-ups in `users`) against
  `backend/app/users/service.py:173-175` (`delete_user`: target row `FOR UPDATE`, then `DELETE`, whose `ON DELETE CASCADE` deletes the
  user's codes). The clean-up takes code rows → user row; the admin delete takes user row → code rows. This breaks the order the
  round-4/5 notes and `sessions.lock_user` document ("the user's row first, then their tokens or codes"), and the round-5 note's
  argument ("no request holds a token lock while waiting for a user row the clean-up holds") checks only one direction: here the
  request holds the user row and waits for code rows the clean-up holds. Reproduction (`cleanup_vs_delete.sh`): a self sign-up made
  stale (created 8 days ago, code expired), the clean-up's exact SQL replayed in one transaction, admin `DELETE /api/users/{id}` in
  between → Postgres `deadlock detected` in 6 of 9 runs (the other 3, with the delete sent after the clean-up had reached `users`, answered 404 cleanly) (`Process A: DELETE FROM users WHERE email_verified_at IS NULL …` ↔
  `Process B: DELETE FROM users WHERE users.id = $1`, `round5_db-log.txt`). With the clean-up's statements close together, as in
  the real function, the admin request is the victim: **500** `DBAPIError: deadlock detected` at `service.py:175`, 3/3
  (`round5_race-cleanup-vs-delete-b.txt`, `round5_backend-errors.txt`); otherwise the clean-up transaction is aborted. The window
  is narrow (the hourly clean-up's few milliseconds), but it is a real lock-order inversion between T006's delete and the clean-up,
  not reachable before T006 added `DELETE /api/users/{id}`. Expected: the same order everywhere — e.g. delete the stale sign-ups
  **first** in `cleanup()` (users, then codes / failed logins / tokens), or commit each statement separately — and a test that runs
  an admin delete of a stale sign-up together with the clean-up (row held, as in `_delete_while_waiting`).

### Round-4 blockers
- **B7**: fixed — 0/40 surviving sessions (check 4; round 4: 10/10 set-password, 4/10 demotion), 0 live tokens in 260 admin-vs-own
  rounds (check 5). change-password ‖ refreshes: exactly its own token live in 10/10 (the round-4 observation is closed).
- **B8**: fixed — login/start of a user deleted meanwhile answers 404 `user_not_found` (3/30) or 200, never 500 (check 6, check 5).
- **B9**: fixed — two parallel sign-ups of one address: both 200, one account, 30/30; the unique violation now only appears in the
  Postgres log as a caught error (29 lines).

### Lock-order review (round 5: refreshes FOR SHARE)
Row-lock conflicts on `users`: `FOR SHARE` (rotate) conflicts with `FOR NO KEY UPDATE` (login/verify, login/start, `PATCH /me`,
change-password) and `FOR UPDATE` (admin writes), not with itself or with the `KEY SHARE` of a foreign-key check.
- rotate: unlocked owner read → user `FOR SHARE` → claim token → insert (FK `KEY SHARE`, compatible with its own share lock). It never
  writes the user row, so there is no share → exclusive upgrade (the classic two-readers-upgrade deadlock). `_on_reuse` /
  `_revoke_family` touch one family's tokens with the user already held; two rotates of one user share the row and wait on token rows
  only in one direction.
- Writers (admin PATCH / set-password / DELETE, change-password, `PATCH /me`, login/verify, login/start) all take the user row first,
  then tokens / codes / failed logins; a refresh that arrives meanwhile waits on the row and then finds its token revoked (B7).
- Admin writes on several rows: active admins `FOR UPDATE` by id → target; a refresh holds only one user row and never waits for a
  second one, so it cannot close a cycle with them.
- logout: tokens of one family, no user lock, waits for nothing else.
- login/start: user `NO KEY UPDATE` → code insert, committed before the e-mail is sent (no lock held during SMTP).
- Scheduler `cleanup`: the remaining inversion (B10). Its tokens/failed-logins statements do not close a cycle: a user with tokens
  has `last_login_at` set and a sign-up has no failed logins (code method), so the final `DELETE FROM users` never waits for those
  holders.
- Postgres log over all request probes (checks 4–9, 11): 0 `deadlock detected`; the only ERROR lines are the 29 caught sign-up unique
  violations and the 6 deadlocks of the clean-up probe.

### Observations (non-blocking)
- FOR SHARE trade-off measured: a refresh waits behind the same user's password checks (up to 1.46 s behind 4 checks in
  `round5_race-share-mix.txt`). Unauthenticated wrong-password requests for a victim's address can therefore delay the victim's
  refreshes, bounded by the lockout (5 checks per window, then 429 without hashing) and the per-IP limit. Acceptable; worth a line in
  the security notes of T013.
- `round5_race-auth-code.txt` keeps the round-4 script's header line "(re-run of the code-login scenario …)"; in round 5 it is a
  plain second run with real codes (19 × 200, 1 × 400, 0 × 5xx).
- The fuzz script still names its target `qa-r3-fuzz-target@example.com` (inherited); deleted in cleanup.
- The clean-up probe replays the clean-up's SQL in psql (with a pause after its first statement to make the window reproducible)
  and edits two QA rows (`created_at`, `expires_at`) to make a stale sign-up; it ran only on the dev database, every row deleted.

### Round 6 (QA round 5: B10)
- **B10**: `cleanup()` deletes stale sign-ups first, then codes, failed logins and tokens, each statement in
  its own transaction: it never holds code or token locks while waiting for a user's row, the same rule
  every request follows. Test: 10 rounds of the clean-up running together with an admin delete of a stale
  sign-up that has expired codes — no error, the delete answers 204 or 404.
- 278 tests, 100 % coverage, three runs.

## QA — RETURNED (round 6)

**Date**: 2026-11-25

Focused round: the diff since round 5 is `backend/app/core/scheduler.py` and `backend/tests/test_scheduler.py` only.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round6_lint.txt` | PASS |
| 2 | Full suite + coverage ×3 (278 passed, 100 %, threshold 95 %) | `docs/tasks/evidence/T006/qa/round6_coverage_{1,2,3}.txt` | PASS |
| 3 | New test is not vacuous: `test_scheduler.py` run against the round-5 `cleanup()` (git HEAD, on a copy in the container) fails 3/3 (`deadlock detected`, `app_test` deadlocks 0 → 3) | `docs/tasks/evidence/T006/qa/round6_mutation.txt` | PASS |
| 4 | B10 re-check, new clean-up replayed (users first, one autocommit statement each, 1 s pause between statements) ‖ admin `DELETE` of a stale sign-up with an expired code, 5 timings × 3 rounds: 204 (delete first, clean-up `DELETE 0`) or 404 `user_not_found` (clean-up first), 0 × 5xx, deadlocks 33 → 33 | `docs/tasks/evidence/T006/qa/round6_race-cleanup-vs-delete.txt` | PASS |
| 5 | B10 re-check, other direction: `delete_user()`'s locks held 2 s in psql (admins → target → `DELETE`, cascade to codes) while the **real** `scheduler.cleanup()` runs, 5 rounds: the clean-up waits (≈2.1 s) and returns, both stale sign-ups and their codes gone, deadlocks 33 → 33 | `docs/tasks/evidence/T006/qa/round6_race-cleanup-vs-held-delete.txt` | PASS |
| 6 | Lock-order review, clean-up's multi-row `DELETE FROM users` ‖ `_lock_admins`: a never-confirmed sign-up P promoted to admin, admin 1 `DELETE` of another stale sign-up F → deadlock 6/6 (3 clean-up victim; 3 **500** on the admin request at `service.py:173` `_lock_user`) | `docs/tasks/evidence/T006/qa/round6_race-cleanup-vs-delete-promoted.txt`, `docs/tasks/evidence/T006/qa/round6_race-cleanup-vs-delete-promoted-b.txt`, `docs/tasks/evidence/T006/qa/round6_backend-errors.txt`, `docs/tasks/evidence/T006/qa/round6_db-log.txt` | FAIL |
| 7 | The clean-up deletes a promoted pending sign-up, bypassing the last-admin guard: P promoted, admin 1 steps down (200, guard counts P), real `cleanup()` → 0 active admins, admin API 403 for everyone (user 1 restored with SQL afterwards) | `docs/tasks/evidence/T006/qa/round6_cleanup-deletes-admin.txt` | FAIL |
| 8 | Lock-order review, the clean-up's `login_codes` statement (seq scan, heap order) ‖ admin delete cascade (index scan on `ix_login_codes_user_active`, `expires_at` order) when one user's code rows are in different heap and index order → deadlock 3/3 (replay with the cascade's index plan forced) | `docs/tasks/evidence/T006/qa/round6_race-codes-order.txt` | FAIL |
| 9 | Regression: FOR SHARE mix on one user (`race_share_mix.sh`), 10 rounds — 0 × 5xx, deadlocks 39 → 39 | `docs/tasks/evidence/T006/qa/round6_race-share-mix.txt` | PASS |
| 10 | Regression: fuzz of `/api/users` and `/api/auth` (263 requests) — 0 × 5xx; backend log 0 × 5xx and Postgres log 0 errors in the share-mix + fuzz window | `docs/tasks/evidence/T006/qa/round6_fuzz.txt`, `docs/tasks/evidence/T006/qa/round6_backend-errors.txt`, `docs/tasks/evidence/T006/qa/round6_db-log.txt` | PASS |
| 11 | Cleanup: every qa-r6 user deleted, only admin@example.com (active admin, password method), password login 200, `failed_logins` empty, no orphan tokens / codes | `docs/tasks/evidence/T006/qa/round6_cleanup.txt` | PASS |

Probe scripts: `docs/tasks/evidence/T006/qa/round6_scripts/` (`cleanup_vs_delete.sh` adapted to the new clean-up,
`cleanup_vs_held_delete.sh`, `cleanup_vs_delete_promoted.sh`, `cleanup_deletes_admin.sh`, `codes_order.sh`; `race_share_mix.sh`
and `fuzz.sh` unchanged with qa-r6 names).

### Round-5 blockers
- **B10**: fixed for the reported cycle — the clean-up no longer holds code rows while waiting for a user row (checks 4, 5), the
  new test fails on the old order (check 3). The same family of inversion remains in the two cases below (B11, B13).

### Blockers
- **B11** (deadlock: clean-up's stale-sign-up statement ‖ admin writes that lock the admins): `backend/app/core/scheduler.py:33-39`
  locks every stale sign-up row in one statement, in heap-scan order; `backend/app/users/service.py:172-173` (`delete_user`) and
  `:130-131` (`update_user` with `role` / `is_active`) lock all active admins by id, then the target. A never-confirmed self sign-up
  that an admin promoted (`PATCH role=admin` leaves `email_verified_at` / `last_login_at` empty) is both an active admin and a stale
  sign-up: clean-up F → P, admin request P (via `_lock_admins`) → F. Reproduced 6/6 with the clean-up's exact statement and a pause
  on row P (`round6_race-cleanup-vs-delete-promoted*.txt`); when the clean-up reaches P before the admin's `deadlock_timeout`
  check, the admin request is the victim: **500** `DBAPIError: deadlock detected` at `service.py:173` → `:113`, 3/3
  (`round6_backend-errors.txt`). Expected: the clean-up never waits on a user row while holding another, e.g. lock with
  `FOR UPDATE SKIP LOCKED` in a sub-select (`DELETE … WHERE id IN (SELECT id … FOR UPDATE SKIP LOCKED)`: rows an admin holds are left
  for the next run) or delete one sign-up per transaction; fixing B12 by excluding non-`none` roles also removes this cycle
  (only active admins are locked in bulk). Test: a promoted stale sign-up + admin delete of another stale sign-up ‖ clean-up.
- **B12** (the clean-up deletes accounts an admin acted on, including the last active admin): `backend/app/core/scheduler.py:33-39`
  has no role condition, so a pending sign-up an admin gave a role (`PATCH /api/users/{id}` role `user` / `admin`) is deleted after
  `unverified_signup_days` like any abandoned sign-up. With `admin`, it bypasses the DoD guard "the last active admin cannot be …
  deleted": admin 1 can step down because the guard counts P (`service.py:137`), then the real `cleanup()` deletes P → **0 active
  admins**, `GET /api/users` 403 for everyone, and `ensure_admin` does not recover at the next start (ADMIN_EMAIL belongs to an
  existing non-admin user → "not changed") (`round6_cleanup-deletes-admin.txt`). Step 1 already states the intent for
  `POST` ("the admin vouches for it, so the unverified-sign-up clean-up never deletes it"); a role change by an admin is the same
  vouching. Expected: the clean-up only deletes role `none` (or the role change marks the user verified), with a test that a promoted
  pending sign-up survives the clean-up.
- **B13** (deadlock: clean-up's `login_codes` statement ‖ admin delete cascade, one user's code rows): `scheduler.py:40` deletes
  expired codes by a seq scan (heap order); `delete_user`'s cascade (`DELETE FROM ONLY login_codes WHERE user_id = $1`) uses
  `ix_login_codes_user_active (user_id, consumed_at, expires_at)` (`backend/app/auth/models.py:32`) once the table is not tiny, so it
  visits a user's codes in `expires_at` order. When those differ (any row placed by free-space reuse, or moved by an update) and the
  user has ≥ 2 expired codes, the two statements lock the same rows in opposite order: deadlock 3/3 in the replay with the
  cascade's index plan (`round6_race-codes-order.txt`, plans recorded there; on the dev table's size the planner picks a seq scan
  and the orders agree). `failed_logins` has the same shape (clean-up by `ix_failed_logins_created_at`, cascade by
  `ix_failed_logins_user_id`); `refresh_tokens` does not (both visit a user's rows in heap order). Expected: the clean-up's child-table
  statements never wait while holding rows, e.g. the same `SKIP LOCKED` sub-select (rows a request holds are left for the next
  run), with a test that holds a user's codes in a transaction while the clean-up runs.

### Lock-order review (round 6: new clean-up)
- Statement 1 (`users`, own transaction): locks stale sign-up rows, then (end of statement) their codes / tokens / failed logins
  through the cascades. Every request on a single non-admin user takes that user's row first, then its child rows (login/start,
  login/verify, admin PATCH / set-password / DELETE, cascade) → no cycle with one stale row. Multi-row: the only request that locks
  several user rows is `_lock_admins` → cycle when a stale sign-up is an active admin (B11).
- Statements 2–4 (codes, failed logins, tokens; each its own transaction): hold only rows of their own table, never a user row.
  A cycle needs two multi-row locks on the same table in different orders: codes (B13) and failed logins (same shape, by reasoning);
  tokens: clean-up seq scan and cascade / `revoke_all` / `_revoke_family` (`ix_refresh_tokens_user_id` / `family_id`, equal keys in
  TID order) visit a user's rows in heap order — no inversion found.
- Refresh (`FOR SHARE`), `PATCH /me`, change-password: only users with a session, never stale sign-ups; token rows they touch are
  live (not expired 7 days) — no overlap with statement 4.
- Postgres log: 0 deadlocks from the B10 re-check (checks 4–5) and the regressions (9–10); the 9 `deadlock detected` lines in
  `round6_db-log.txt` are the 3 mutation-test runs (`app_test`) and the 6 of check 6; check 8 ran afterwards (+3, `app` 39 → 42).

### Observations (non-blocking)
- The inherited fuzz script creates `QA-R3-FUZZ-TARGET@EXAMPLE.COM` (upper case, missed by the qa-r6 rename) instead of hitting a
  duplicate, so its case-insensitive-duplicate probe was a plain create this round (201); deleted in cleanup. The code it probes is
  unchanged since round 5 (passed there).
- The probes replay the clean-up's SQL in psql with pauses (per statement or on one row) to make the windows reproducible, force the
  cascade's index plan in check 8, edit `created_at` / `expires_at` / `attempts` of QA rows, and in check 7 demote user 1 through
  the API and restore it with SQL; dev database only, every row deleted, user 1 verified afterwards.

### Round 7 (QA round 6: B11, B12, B13)
- **B12**: the clean-up only deletes stale sign-ups with role `none`: a sign-up an admin gave any role is
  vouched for and never deleted, so it can no longer remove an admin (tests for `user` and `admin`).
- **B11, B13**: every clean-up statement deletes only rows nobody else holds
  (`DELETE … WHERE id IN (SELECT id … FOR UPDATE SKIP LOCKED)`): the clean-up never waits for a lock, so it
  cannot take part in a deadlock whatever order the other side locks in; skipped rows go next hour.
  Test: with a stale user row and a code row held by another transaction, the clean-up returns at once
  and leaves both.
- 281 tests, 100 % coverage, three runs.

## QA — RETURNED (round 7)

**Date**: 2026-11-25

Focused round: the diff since round 6 is `backend/app/core/scheduler.py` and `backend/tests/test_scheduler.py` only.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round7_lint.txt` | PASS |
| 2 | Full suite + coverage ×3 (281 passed, 100 %, threshold 95 %; `app_test` deadlocks 3 → 3) | `docs/tasks/evidence/T006/qa/round7_coverage_{1,2,3}.txt`, `docs/tasks/evidence/T006/qa/round7_db-log.txt` | PASS |
| 3 | B12 re-check, **real** `cleanup()`: self sign-ups 8 days old, P → admin, U → user, N stays `none`; admin 1 steps down (200); after the clean-up P and U survive, N deleted, P still the active admin (user 1 restored with SQL) | `docs/tasks/evidence/T006/qa/round7_cleanup-keeps-promoted.txt` | PASS |
| 4 | B11 re-check, the new users statement replayed verbatim (`DELETE … WHERE id IN (SELECT id … FOR UPDATE SKIP LOCKED)`, pause on P) ‖ admin `DELETE` of stale sign-up F while P is a promoted admin, 3 rounds; plus 3 rounds **without** the role filter (SKIP LOCKED alone): always 404 `user_not_found` (clean-up first, P skipped), 0 × 5xx, deadlocks 42 → 42 | `docs/tasks/evidence/T006/qa/round7_race-cleanup-vs-delete-promoted.txt` | PASS |
| 5 | B13 re-check, the new codes statement replayed (pause on c1 in the sub-select) ‖ admin delete with the cascade's index plan, 5 rounds: clean-up `DELETE 1` (skips c1), admin delete commits, deadlocks 42 → 42 | `docs/tasks/evidence/T006/qa/round7_race-codes-order.txt` | PASS |
| 6 | `delete_user()`'s locks held 4 s in psql while the **real** `cleanup()` runs, 3 rounds: returns in 0.07–0.11 s (no wait), the other stale sign-up deleted, deadlocks 42 → 42 | `docs/tasks/evidence/T006/qa/round7_race-cleanup-vs-held-delete.txt` | PASS |
| 7 | "The clean-up never waits for a lock": the token statement's `ON DELETE SET NULL` self-FK update waits on a predecessor token held by an admin delete's cascade → **deadlock 12/12** with the **real** `cleanup()` (6 × the admin delete is the victim, 6 × the clean-up) | `docs/tasks/evidence/T006/qa/round7_race-token-setnull.txt`, `docs/tasks/evidence/T006/qa/round7_token-heap-order.txt`, `docs/tasks/evidence/T006/qa/round7_db-log.txt` | FAIL |
| 8 | Regression: FOR SHARE mix on one user (`race_share_mix.sh`), 10 rounds — 0 × 5xx, deadlocks 54 → 54 | `docs/tasks/evidence/T006/qa/round7_race-share-mix.txt` | PASS |
| 9 | Regression: fuzz of `/api/users` and `/api/auth` (263 requests) — 0 × 5xx (case-insensitive duplicate now 409 `email_taken`); backend log 0 × 5xx / 0 tracebacks, Postgres 0 errors in the share-mix + fuzz window | `docs/tasks/evidence/T006/qa/round7_fuzz.txt`, `docs/tasks/evidence/T006/qa/round7_backend-errors.txt`, `docs/tasks/evidence/T006/qa/round7_db-log.txt` | PASS |
| 10 | Cleanup: every qa-r7 user deleted, only admin@example.com (active admin, password method), password login 200, `failed_logins` empty, no orphan tokens / codes | `docs/tasks/evidence/T006/qa/round7_cleanup.txt` | PASS |

Probe scripts: `docs/tasks/evidence/T006/qa/round7_scripts/` (round-6 scripts adapted to the new statements and qa-r7 names;
new: `token_setnull.sh`, `token_heap_order.sh`).

### Round-6 blockers
- **B11**: fixed — the role filter keeps promoted sign-ups out of the users statement, and SKIP LOCKED alone also breaks the
  cycle (check 4, both variants).
- **B12**: fixed — a sign-up an admin gave any role survives the real clean-up; the last admin can no longer be removed this way
  (check 3).
- **B13**: fixed for the codes statement (check 5); `failed_logins` has the same shape and no RI action on its rows, so it cannot
  wait either.

### Blockers
- **B14** (deadlock: clean-up's token statement ‖ admin delete cascade, through the `replaced_by_id` self-FK):
  `backend/app/core/scheduler.py:53` + `backend/app/auth/models.py:23-25`. SKIP LOCKED only covers the sub-select. Deleting a
  token X fires `fk_refresh_tokens_replaced_by_id_refresh_tokens` (`ON DELETE SET NULL`): an `UPDATE refresh_tokens SET
  replaced_by_id = NULL WHERE replaced_by_id = X` at the end of the statement, which **waits** like any update. X's predecessor W
  (rotated into X) is expired too, so it is normally in the same set, but when an admin delete of the user holds W (its cascade
  `DELETE FROM ONLY refresh_tokens WHERE user_id = $1` visits tokens in TID order) the clean-up skips W, locks X, and then waits on
  W, while the cascade waits on X. A predecessor before its successor in TID order is the normal case for real chains (HOT update
  keeps W on its page while X is inserted on another: 3 of 6 pairs in a chain made only through the API,
  `round7_token-heap-order.txt`). Replay (psql reproduces `delete_user()`'s locks with the cascade's first row W deleted, then the
  rest of the cascade) ‖ the **real** `scheduler.cleanup()`: deadlock 12/12 (`app` 42 → 54). When the cascade continues after the
  clean-up's `deadlock_timeout` check, the admin delete is the victim (`CONTEXT: while deleting tuple … in relation
  "refresh_tokens"`, `STATEMENT: DELETE FROM users …`) — in the app that is `service.py:174-175` raising an unhandled
  `DBAPIError` → **500**, as in round 6 check 6; otherwise the clean-up is the victim (`cleanup() RAISED … deadlock detected`,
  `CONTEXT: while updating tuple … in relation "refresh_tokens"`). Before the cycle forms the clean-up sits blocked for as long as
  the other transaction lasts (≈ 19 s in run A). The docstring "The clean-up never waits for a lock" (`scheduler.py:22-26`) is
  therefore not true. Expected: the clean-up never waits on a row lock, e.g. a short `SET LOCAL lock_timeout` on its transactions
  (below `deadlock_timeout`, so it gives up before any request can become the victim, and the rows go next hour), and/or the
  token statement deletes only rows whose referencing rows it also holds, or `replaced_by_id` without the FK action. Test: a
  transaction holding a predecessor token (W) of an expired chain while `cleanup()` runs must neither block it nor deadlock.

### Lock-wait review (round 7: SKIP LOCKED clean-up)
- Sub-selects (`FOR UPDATE SKIP LOCKED`) never wait; the outer `DELETE` touches only the rows it already locked.
- Statement 1 (`users`): its cascades delete the stale sign-ups' codes / failed logins / tokens without SKIP LOCKED, so they can
  wait on a child row held by someone who does not hold the user row. Every request locks the user row first (`lock_user`,
  `_lock_user`) or inserts a child row (FK check `FOR KEY SHARE` on the user, which makes the clean-up skip the user), and stale
  sign-ups have no tokens (`last_login_at IS NULL`): no such holder found, no cycle. Not "never waits", but no deadlock by reasoning.
- Statements 2–3 (`login_codes`, `failed_logins`): nothing references these tables, no RI action → never wait.
- Statement 4 (`refresh_tokens`): the self-FK `SET NULL` action waits → B14. `users` and child tables have no other FK actions.

### Observations (non-blocking)
- `token_setnull.sh` run A polled `pg_stat_activity` without `pg_stat_clear_snapshot()`, so it never saw the clean-up waiting and
  went on after its 20 s timeout; the 6 deadlocks of that run are real (admin replay victim), and run B is the corrected script.
- The probes replay the clean-up's SQL (checks 4–5) or `delete_user()`'s locks (checks 6–7) in psql with pauses to make the
  windows reproducible, insert expired token chains with SQL (check 7), and in check 3 demote user 1 through the API and restore it
  with SQL; dev database only, every row deleted, user 1 verified afterwards.

### Round 8 (QA round 7: B14)
- **B14**: `refresh_tokens.replaced_by_id` no longer has a foreign key (migration
  `…_refresh_token_replaced_by_without_.py`): the column is informative (the reuse grace only checks it
  is set) and its `ON DELETE SET NULL` made deleting a token update — and wait on — its predecessor.
- General guard, so "the clean-up never waits" does not depend on finding every foreign key action:
  each clean-up statement runs with `SET LOCAL lock_timeout = '200ms'` (below `deadlock_timeout`, 1 s);
  a statement that times out (SQLSTATE 55P03) is rolled back, logged and retried next run, and the
  remaining statements still run. Other database errors are raised. Tests: a stale sign-up whose token
  another transaction holds — the clean-up returns at once, keeps that user and still deletes expired
  codes; a non-lock error propagates.
- 283 tests, 100 % coverage, three runs; migration down/up and `alembic check` clean.

## QA — APPROVED (round 8)

**Date**: 2026-11-25

Focused round: the diff since round 7 is `backend/app/auth/models.py`, `backend/app/core/scheduler.py`, migration
`20261125_635713930009_refresh_token_replaced_by_without_.py` and `backend/tests/test_scheduler.py`.

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Migration: `alembic current` = `635713930009`; downgrade −1 restores `fk_refresh_tokens_replaced_by_id_refresh_tokens` (`ON DELETE SET NULL`), upgrade drops it again; `alembic check`: no new operations | `docs/tasks/evidence/T006/qa/round8_migration.txt` | PASS |
| 2 | Nothing relied on the FK: `replaced_by_id` is only written in `rotate()` (`sessions.py:115`), read as "is set" in `_on_reuse()` (`sessions.py:127`) and asserted in `test_sessions.py:43`; no relationship / join / ORM cascade on it | `docs/tasks/evidence/T006/qa/round8_migration.txt` | PASS |
| 3 | Lint (`ruff check`, `ruff format --check`) | `docs/tasks/evidence/T006/qa/round8_lint.txt` | PASS |
| 4 | Full suite + coverage ×3: 283 passed each, 100 % (threshold 95 %); `app_test` deadlocks 3 → 3 | `docs/tasks/evidence/T006/qa/round8_coverage_{1,2,3}.txt` | PASS |
| 5 | B14 re-check with the round-7 probe (`token_setnull.sh`, qa-r8 names): expired chain W → X, psql replays `delete_user()` holding W ‖ **real** `cleanup()`, 6 rounds GAP 0.5 s + 6 rounds GAP 2 s: the clean-up never blocks (poll: `blocked on a lock: f` 12/12), returns in 0.16–0.31 s, admin replay `COMMIT` 12/12, all rows gone, `app` deadlocks 54 → 54 (round 7: 12/12 deadlocks) | `docs/tasks/evidence/T006/qa/round8_race-token-setnull.txt` | PASS |
| 6 | lock_timeout guard, **real** `cleanup()` (new probe): stale sign-ups S and Y, S's refresh token held `FOR UPDATE` 4 s, 3 rounds: users statement cancelled (`canceling statement due to lock timeout`, cascade on `refresh_tokens`), "skipped busy rows" logged, `cleanup()` returns in 0.39–0.40 s, S and Y kept, their expired codes deleted (later statements ran); the next run after the hold deletes S and Y; deadlocks 54 → 54 | `docs/tasks/evidence/T006/qa/round8_cleanup-lock-timeout.txt`, `docs/tasks/evidence/T006/qa/round8_db-log.txt` | PASS |
| 7 | Regression: FOR SHARE mix (`race_share_mix.sh`), 10 rounds: 0 × 5xx, deadlocks 54 → 54 | `docs/tasks/evidence/T006/qa/round8_race-share-mix.txt` | PASS |
| 8 | Regression: 5xx fuzz of `/api/users` and `/api/auth` (263 requests): 0 × 5xx, case-insensitive duplicate 409 `email_taken`; backend log 0 × 5xx / 0 tracebacks, Postgres 0 errors in the share-mix + fuzz window; 0 `deadlock detected` in the whole round | `docs/tasks/evidence/T006/qa/round8_fuzz.txt`, `docs/tasks/evidence/T006/qa/round8_backend-errors.txt`, `docs/tasks/evidence/T006/qa/round8_db-log.txt` | PASS |
| 9 | Cleanup: every qa-r8 user deleted (plus the stray one from fuzz run 1, see observations), only admin@example.com (active admin, password method), password login 200, `failed_logins` empty, no orphan tokens / codes | `docs/tasks/evidence/T006/qa/round8_cleanup.txt` | PASS |

Probe scripts: `docs/tasks/evidence/T006/qa/round8_scripts/` (round-7 scripts with qa-r8 names; new: `cleanup_lock_timeout.sh`).

### Round-7 blockers
- **B14**: fixed. Without the self-FK, deleting a token no longer touches its predecessor, so the clean-up's token statement
  cannot wait on a row an admin delete holds (check 5, 0/12 deadlocks vs 12/12 in round 7). Any other wait (e.g. the users
  statement's cascade reaching a held token) now gives up after 200 ms, below `deadlock_timeout` (1 s), so a request can never
  be picked as the victim, and the rest of the clean-up still runs (check 6).

### Observations (non-blocking)
- A single busy row rolls back the whole statement it belongs to: every stale sign-up (or every expired code / token) of that
  statement waits for the next hourly run, as Y did in check 6. Acceptable for a clean-up; noted for capacity reasoning only.
- `_skip_locked`'s docstring still says "The clean-up never waits for a lock"; it can now wait up to `LOCK_TIMEOUT_MS` (the
  `cleanup()` docstring states this correctly).
- Fuzz run 1 (`round8_fuzz_run1-stale-uppercase.txt`) used a stale upper-case `QA-R7-…` e-mail in the duplicate probe — a QA
  script slip, not a product issue: it created user 2525 (201, correct for a new address), which was deleted; the script was
  fixed and re-run (`round8_fuzz.txt`: 409 `email_taken`). Both runs: 0 × 5xx.
- The probes insert expired token chains and backdate sign-ups with SQL on the dev database only; every row was deleted and
  user 1 verified afterwards.

### After QA approval
- `_skip_locked` docstring corrected (remaining waits are cut by the lock timeout). Accepted: one busy row
  postpones that whole statement to the next hourly run.
