# v0.1-M2 service principal — design

**Date:** 2026-08-01
**Branch:** `claude/m2-service-principal`, stacked on
`claude/m2-superpowers-brainstorm-6e5ec1` (PR #5)
**Closes:** the two P1 items in `TODOS.md` that the M2-A gate record names as
known limitations — "nothing proves inspection ran" and "`capture_events`
cannot tell the server's assertion from a member's".

## The problem, stated precisely

Two columns claim to record what the server observed. Neither can, because in
v0.1-M2-A the server and the member reach PostgreSQL as the same role.

- **`evidence_objects.inspection_status`.** `app.finalize_upload_intent` takes
  the verdict as a parameter. The function is `SECURITY DEFINER` and runs as its
  owner, but the *value* comes from the caller. A holder of `evidence.record`
  who can execute SQL authorizes an intent, uploads nothing anyone looked at,
  and passes `'passed'`.
- **`capture_events.event_source = 'server'`.** Policy `ce_insert` (migration
  `0030`) requires `project.view`, `evidence.record`, and that the caller
  created the intent. It never asks who is claiming to be the server, so a
  member writes `'server'` on their own upload.

Migration `0032` closed the adjacent hole — evidence can no longer be written
for bytes that are not in the bucket — but that is a fact about storage. Whether
anyone *inspected* those bytes is still an assertion, and it is made by the
party the column exists to distinguish from.

`technical/permissions/capabilities.csv` already anticipates this: row 31,
`service.upload_finalize`, scoped `v0.1-M2`, "Transition staged uploads after
integrity authorization and scan checks".

## What makes a second role enforceable here

`aktflow_app_login` is a member of `aktflow_app` and nothing else:

```
aktflow_app_login -> aktflow_app
```

So a connection authenticated as that login cannot `SET ROLE` to any other
role. A service principal with its own login is therefore a real boundary, not
a convention — SQL injected into an ordinary route runs on the application
connection and cannot reach it.

`aktflow_worker` (migration `0008`, `nologin nobypassrls`) is the precedent for
a non-login service role in this codebase. This design follows its shape and
adds the login half that the finalize path needs.

## Approaches considered

**A — separate login, separate pool.** *Chosen.* A `aktflow_service` role and an
`aktflow_service_login` with its own password; the finalize path uses a second
connection pool. Injection through any ordinary route cannot assume the role,
because role membership forbids it. `SECURITY DEFINER` does not change
`session_user`, so the finalization command can require it.

**B — same login, `SET LOCAL ROLE`.** Rejected. It buys nothing against the
threat described: injected SQL on that connection issues the same `SET LOCAL
ROLE` the application would.

**C — inspection in a separate process behind a queue.** Rejected for v0.1-M2,
kept as the direction. Strictly stronger — compromising the web process would
not yield service credentials — but finalization becomes asynchronous and the
client stops receiving a receipt in the response. That is a change to the upload
protocol and to the product, not plumbing. Approach A does not foreclose it: the
purge worker (`service.orphan_purge`) needs the same role and is the natural
first tenant of a separate process.

## Design

### 1. The role

A migration creates:

- `aktflow_service` — `nologin nobypassrls`, matching `aktflow_worker`.
- `aktflow_service_login` — a login role, member of `aktflow_service` only.

The password is set by the same local-host-only script that sets the
application role's (`scripts/set-local-app-password.mjs`), never by `seed.sql`
and never by a migration. `infra/README-staging.md` already documents why: a
default `supabase db push` must not carry a credential.

### 2. The connection

`packages/database` gains a second pool keyed on `SERVICE_DB_URL` and a
`withServiceTx(ctx)` that mirrors `withTenantTx` except for `SET LOCAL ROLE
aktflow_service`.

The service connection still sets the actor GUC. This is the server acting *on
behalf of* a member, so ownership and capability checks continue to apply — the
service principal authorizes nothing on its own; it only vouches for what the
server observed.

### 3. What becomes impossible

- **`app.finalize_upload_intent` requires the service principal.** The function
  raises unless `session_user` is the service login. `SECURITY DEFINER` leaves
  `session_user` as the connecting role, which is what makes the check possible;
  this is verified empirically in the plan rather than assumed from the
  documentation.
- **`ce_insert` splits in two.** `event_source = 'device'` stays writable by
  `aktflow_app` under the existing conditions. `event_source = 'server'` becomes
  writable only by `aktflow_service`.

### 4. The route boundary

`apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts` uses:

- the **application** pool to read the intent and authorize the caller;
- the **service** pool for everything after the server has looked at the bytes.

The rule is that boundary, not a list of statements: once the server has read
the object and formed a verdict, every write recording that verdict speaks for
the server. That covers the finalization command, the `server_confirmed`
capture event, the `failed` capture events on an integrity mismatch or a block,
and the `app.fail_upload_intent` / `app.block_upload_intent` calls beside them —
those record what the server concluded, even though they do not write
`event_source` themselves.

Drawing it at "after inspection" rather than at "statements that touch
`event_source`" means the next write added to that path inherits the boundary
instead of quietly landing on the wrong side of it.

## What this does not buy

Both statements go in the gate record in these words, not softer ones.

- **A compromised application process holds both credentials.** This closes SQL
  injection and a member with database access. It does not close code execution
  in the web process. Approach C is what closes that, and it is not this slice.
- **It does not prove inspection ran correctly.** It proves the row was written
  from the server's own connection rather than a member's. `inspection_status =
  'passed'` continues to mean "the magic bytes matched the declared type", and
  v0.1 still ships no scanner.

## Out of scope

- `service.orphan_purge` and the purge worker's deployment. Same mechanism, a
  different capability and a different slice.
- The other four `service.*` rows in the capability catalog, scoped to M3, M4
  and v0.0.
- Any change to what inspection actually does.

## Testing posture

Every guarantee gets an attack test that attempts the exact write it forbids,
run as `aktflow_app`:

- finalize called on an application connection is refused;
- `event_source = 'server'` inserted by `aktflow_app` is refused;
- `event_source = 'device'` by `aktflow_app` still succeeds;
- the service login cannot `SET ROLE aktflow_app`, and vice versa;
- the finalize route still returns the same receipt end to end.

Each is mutation-checked: the assertion must fail when the mechanism it tests is
removed. The M2-A branch produced three tests that asserted the defect they were
meant to forbid, so a passing test is not evidence until it has been shown to
fail for the right reason.
