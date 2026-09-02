# Erasure and retention of Telegram conversation identity — design

**Date:** 2026-09-02

**Status:** approved by the owner in conversation, section by section (scope,
semantics, invocation, guard approach, components, data flow, failure handling
and tests — each answered on 2026-09-02)

**Applies to:** the Telegram project channel on `claude/d3-0-decision-slice`
(migrations `0061`–`0080`); M0 gates 1 and 2

**Read with:**
[`2026-08-28-telegram-project-channel-design.md`](2026-08-28-telegram-project-channel-design.md)
(§10 «Security and privacy», :475-477),
[`../../delivery/production-readiness.md`](../../delivery/production-readiness.md)
(gate 2: «documented retention periods and a manual closure/deletion
procedure, exercised once end to end on synthetic data»),
[`../../architecture/tenancy-and-security.md`](../../architecture/tenancy-and-security.md),
[`../../architecture/jobs-events-and-audit.md`](../../architecture/jobs-events-and-audit.md),
[`../../../technical/data-retention-catalog.csv`](../../../technical/data-retention-catalog.csv)
(rows 3–14),
[`../../../technical/database/invariant-catalog.csv`](../../../technical/database/invariant-catalog.csv)
(INV-094, INV-096–098)

## 1. Purpose

A person who wrote in a project's Telegram group leaves a record GoProceed
cannot currently forget. `communication_messages` keeps their text, Telegram
user id, first and last name and username for as long as the row exists; the
row exists for as long as the workspace does; and the trigger
`app.guard_communication_message` (0070:419-454) raises on `DELETE` and on any
change to those four columns. Edit history in `communication_message_events`
is guarded the same way by `app.reject_mutation`. `telegram_member_links` has
`revoked_at` and nothing else. No code in the repository erases,
pseudonymises, exports or purges any of it; every foreign key in the family is
`NO ACTION`.

That is the `/cso` finding #1 of 2026-09-02 (MEDIUM, 9/10, VERIFIED), and it
is also what the channel's own design already promised to close before a
pilot: «Chat text and participant identifiers are customer data and follow
the approved retention/export/deletion policy. No real pilot data enters
before the existing M0 retention and privacy gates are satisfied»
(`2026-08-28-telegram-project-channel-design.md:475-477`). The
`data-retention-catalog.csv` rows for all fourteen telegram/communication
tables read `retain_until_approved_m0_schedule` / `duration_external_gate`.

This design gives the product two things it does not have: a way to forget
one person on request, and a way to forget by age once the owner names the
durations. It gives them without weakening the property the guard exists
for — a message, once recorded, is not silently rewritten — because the guard
learns to recognise exactly one transformation and nothing else.

## 2. Owner-approved decisions

| # | Decision |
|---|---|
| 1 | **Scope of this slice is A + B**: erasure of one identity on request, and time-based retention. Workspace off-boarding (C) and a communication export (D) are separate slices. |
| 2 | **Erasure semantics — pseudonym plus redaction.** The row and its relations (attachments, cards, decisions, timestamps) stay. `provider_user_id` becomes a stable surrogate; display-name and username snapshots become NULL; `text` becomes a fixed marker where it was set and stays NULL where it was NULL. Edit history is redacted the same way. |
| 3 | **Invocation is an operator procedure**, not a `/v1` operation: a documented script that calls a SECURITY DEFINER, with an audit row, exercised once on synthetic data. This is what M0 gate 2 asks for. A member-plane route may be built later on top of the same definer. |
| 4 | **The guard recognises the transformation** (approach 1). No bypass flag: the trigger admits an UPDATE only when the changed columns and their new values are exactly the redaction and a transaction-local marker names the subject. Anything else raises as today. |
| 5 | **Components**: registry and policy tables in schema `app`, two definers, one guard branch each on messages and events, an operator script that holds the HMAC pepper, a pg_cron job in the `0007` pattern, and the paperwork (README procedure, M0 record, INV-099, catalog rows). |
| 6 | **Data flow** as in §6: messages → edit events → member links, in that order; both marker GUCs reset before the definer returns; retention rows in the registry carry no HMAC. |
| 7 | **Failure handling**: zero matches is not an error; pending inbox updates for the subject produce a warning and a re-run instruction, not a refusal; any guard raise rolls the whole erasure back; `communication_attachments.filename_snapshot` of the subject's messages is cleared too. |
| 8 | **Marker text** is `[текст стерто на запит]`, the same on both paths. |

## 3. Approaches considered

**Guard recognises the transformation** — *chosen.* One additional branch in
`app.guard_communication_message()` and one in `app.reject_mutation()` for
`communication_message_events`. The branch admits an UPDATE iff the row
belongs to the subject named in a transaction-local GUC, the new values are
exactly the redaction values, and every other guarded column is unchanged.
Immutability stays mechanical: a definer that tried to touch any other column
would raise on the same guard, and the test suite pins that.

**Transaction-local bypass** (`app.communication_guard_mode = 'erasure'`
silences the guard) — *rejected.* Ten lines shorter and one property weaker:
any service-plane transaction that set the flag could rewrite anything, and
the guard would become advisory for the role that runs the workers.

**Tombstone by moving rows to a shadow table** — *rejected.* Requires
`DELETE`, and 61 foreign keys in the family are `NO ACTION`: attachments,
cards, evidence decisions and delivery attempts point at the message. Not
viable without re-pointing the model.

Two smaller choices, decided the same way:

- **Surrogate, not NULL, for `provider_user_id`.** A stable negative surrogate
  per (workspace, subject) keeps the erased person's messages linked to each
  other — «the same unnamed sender wrote these three» is evidence — while
  linking them to no real account. `telegram_member_links.telegram_user_id`
  is `NOT NULL` with `unique (workspace_id, telegram_user_id)`; a surrogate
  satisfies both.
- **A policy table, not constants**, for retention durations. The owner owes
  the durations to M0 (catalog rows say `duration_external_gate`); a table
  seeded with NULL lets the mechanism ship inert and lets each duration land
  as one row, not one function.

## 4. Scope

**In scope**

- `app.erase_telegram_identity(workspace, telegram_user_id, subject_hmac)` and
  the registry `app.telegram_erasures`.
- The recognised transformation in the two guards.
- `app.retention_policy`, `app.apply_communication_retention(batch)` and the
  `communication-retention` cron job.
- `apps/app/scripts/telegram-erase-identity.mjs` — the operator entry.
- Tests in `packages/testing` (§13), one unit test for the script.
- Paperwork: README-staging procedure, `version-0.1.md` §M0 gate-2 entry after
  the synthetic exercise, `invariant-catalog.csv` INV-099,
  `data-access-surface.csv` rows for the two `app` tables,
  `data-retention-catalog.csv` pointer to the policy table.

**Out of scope, deliberately**

- Workspace or project deletion (C). Cross-cutting; its own ADR.
- Export of `communication_*` (D). M0 gate 3; no export exists for any table
  yet.
- `telegram_inbox_updates` rows in `pending`/`leased`. Their raw payload is
  the source the processor reads; rewriting it would corrupt processing. The
  procedure warns and asks for a re-run (§11).
- `telegram_evidence_decision_attempts.reason`. Typed by the deciding member,
  not by the subject; service-only, no member read.
- `telegram_chat_bindings.title_snapshot`. A group title is not personal data.
- A `/v1` route. Decision 3. The definer is shaped so one can sit on it later.

## 5. Current-state prerequisite

The branch is `claude/d3-0-decision-slice` at or after `7817abe` with
`0080_the_choice_session_the_service_could_not_reach.sql` (PR #62) applied —
the next migration number is `0081`. Every fact below about guards, columns
and grants was read from `0062`, `0067`–`0070`, `0078` and confirmed on the
local stack on 2026-09-02:

- `app.guard_communication_message` guards 27 columns (0070:426-451), four of
  which erasure changes: `text`, `provider_user_id`,
  `provider_display_name_snapshot`, `provider_username_snapshot`.
- `app.reject_mutation` on `communication_message_events` raises on any
  UPDATE or DELETE (0062:350-358); `event_kind = 'edited'` rows carry `text`.
- `telegram_member_links`: `telegram_user_id bigint not null`,
  `unique (workspace_id, telegram_user_id)`, `revoked_at` (0062:72-95).
- `communication_attachments.filename_snapshot` is unguarded and
  member-readable (0062:564-567).
- `app.record_service_audit(p_workspace_id, p_actor_type, p_action,
  p_object_type, p_object_id, p_request_id, p_details, p_object_version,
  p_reason_code)` forces `actor_user_id` NULL and requires
  `p_workspace_id = app.service_workspace()` (0078:85-111).
- `scripts/validate-canonical-docs.mjs` counts tables from
  `create table public.…` only (`deployedTables`, :514-517). No table exists
  in schema `app` today; the two below are the first, and the reason they are
  there is §10.
- The purge pattern the repository already runs: `0007_idempotency_expiry.sql`
  schedules `cron.schedule('idempotency-purge', '17 3 * * *', 'select
  app.purge_expired_idempotency(5000)')` behind a pg_cron availability check.

## 6. Architecture

```
operator ──► telegram-erase-identity.mjs ──► SERVICE_DB_URL
              (env: TELEGRAM_LINK_PEPPER)      begin; set local role goproceed_service;
              computes subject_hmac            select * from app.erase_telegram_identity($1,$2,$3);
                                               commit;
                                                  │
                                                  ▼
                                   app.erase_telegram_identity  (SECURITY DEFINER)
                                     1. pg_has_role(session_user,'goproceed_service') or raise
                                     2. upsert app.telegram_erasures (workspace, hmac) → surrogate
                                     3. set_config app.erasure_subject / app.erasure_surrogate (tx-local)
                                     4. UPDATE communication_messages        ── guard branch admits
                                     5. UPDATE communication_message_events  ── guard branch admits
                                     6. UPDATE telegram_member_links
                                     7. UPDATE communication_attachments.filename_snapshot
                                     8. app.record_service_audit('telegram_identity.erased', …)
                                     9. set_config both GUCs to '' ; return counts + pending warning

pg_cron 23 3 * * * ──► app.apply_communication_retention(5000)
                         reads app.retention_policy; NULL duration ⇒ class skipped
                         customer_communication: same transformation, by age, batched
                         customer_identity:      revoked member links older than duration
                         operational_security:   DELETE terminal inbox rows / spent intents
```

Three properties hold by construction:

1. **The original identifier is stored nowhere after erasure.** The registry
   keeps `subject_hmac`, an HMAC-SHA256 under `TELEGRAM_LINK_PEPPER` computed
   by the script; the pepper never reaches the database. Retention-driven
   rows keep no HMAC at all.
2. **The guard branch cannot be reached without the definer.** It requires
   `app.erasure_subject` to equal the row's old `provider_user_id` and
   `app.erasure_surrogate` to equal the new one; both are set inside the
   definer with `is_local = true` and reset to `''` before it returns, so the
   calling transaction cannot append an UPDATE of its own under the marker.
3. **Nothing partial.** One transaction; any raise from either guard rolls
   back the registry row, every update and the audit row together.

## 7. Data model

### 7.1 `app.telegram_erasures`

```sql
create table app.telegram_erasures (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.organizations(id),
  subject_hmac      text check (subject_hmac ~ '^[0-9a-f]{64}$'),
  surrogate_user_id bigint not null check (surrogate_user_id < 0),
  origin            text not null check (origin in ('data_subject_request', 'retention')),
  erased_at         timestamptz not null default now(),
  messages_count    integer not null default 0,
  events_count      integer not null default 0,
  links_count       integer not null default 0,
  attachments_count integer not null default 0,
  unique (workspace_id, surrogate_user_id),
  unique (workspace_id, subject_hmac),
  check ((origin = 'data_subject_request') = (subject_hmac is not null))
);
alter table app.telegram_erasures enable row level security;
revoke all on table app.telegram_erasures from public, anon, authenticated, goproceed_app, goproceed_service;
```

No policy, no grant: reachable through the definer only, like
`telegram_inbox_updates` (0062:615-627). The surrogate is
`-(1 + (random() * 4611686018427387903)::bigint)`, regenerated on a unique
violation inside the definer's loop.

### 7.2 `app.retention_policy`

```sql
create table app.retention_policy (
  data_class text primary key
    check (data_class in ('customer_communication', 'customer_identity', 'operational_security')),
  duration   interval check (duration is null or duration > interval '0'),
  updated_at timestamptz not null default now()
);
insert into app.retention_policy (data_class, duration) values
  ('customer_communication', null), ('customer_identity', null), ('operational_security', null);
alter table app.retention_policy enable row level security;
revoke all on table app.retention_policy from public, anon, authenticated, goproceed_app, goproceed_service;
```

The three classes are the catalog's `allowed_classes` for these tables
(`data-retention-catalog.csv` rows 3–14). A duration lands by a migration
that updates one row; until then every class is NULL and the job returns
zeros.

### 7.3 `app.erase_telegram_identity`

```sql
create or replace function app.erase_telegram_identity(
  p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$ … $$;
revoke all on function app.erase_telegram_identity(uuid, bigint, text) from public;
grant execute on function app.erase_telegram_identity(uuid, bigint, text) to goproceed_service;
```

Body, in order:

1. `if not pg_has_role(session_user, 'goproceed_service', 'member') then raise`
   — the sibling guard (0062:516, 0078:40).
2. `perform set_config('app.organization_id', p_workspace::text, true)` so
   `app.record_service_audit` accepts the workspace (0078:95-97).
3. Registry: `insert … on conflict (workspace_id, subject_hmac) do update set
   erased_at = now() returning surrogate_user_id, (xmax <> 0) as
   already_erased` — a fresh surrogate on first sight, the same one on every
   re-run.
4. `set_config('app.erasure_subject', p_telegram_user_id::text, true)` and
   `set_config('app.erasure_surrogate', surrogate::text, true)`.
5. Messages:
   ```sql
   update public.communication_messages
      set provider_user_id = surrogate,
          provider_display_name_snapshot = null,
          provider_username_snapshot = null,
          text = case when text is null then null else '[текст стерто на запит]' end
    where workspace_id = p_workspace and provider_user_id = p_telegram_user_id;
   ```
6. Edit events, for the messages just rewritten:
   ```sql
   update public.communication_message_events e
      set text = '[текст стерто на запит]'
     from public.communication_messages m
    where e.message_id = m.id and m.workspace_id = p_workspace
      and m.provider_user_id = surrogate
      and e.event_kind = 'edited' and e.text is distinct from '[текст стерто на запит]';
   ```
7. Member links:
   ```sql
   update public.telegram_member_links
      set telegram_user_id = surrogate, display_name_snapshot = null,
          username_snapshot = null, revoked_at = coalesce(revoked_at, now())
    where workspace_id = p_workspace and telegram_user_id = p_telegram_user_id;
   ```
8. Attachment filenames of those messages: `set filename_snapshot = null`.
9. Pending warning: count of `telegram_inbox_updates` rows in
   `('pending','leased')` whose sender is the subject —
   `coalesce(payload #>> '{message,from,id}', payload #>> '{edited_message,from,id}',
   payload #>> '{callback_query,from,id}', payload #>> '{my_chat_member,from,id}')
   = p_telegram_user_id::text` — the four shapes `allowed_updates` admits
   (`api.ts:153`).
10. Counts written back to the registry row; audit:
    `app.record_service_audit(p_workspace, 'system',
    'telegram_identity.erased', 'telegram_identity', surrogate::text,
    gen_random_uuid()::text, jsonb_build_object('surrogate', surrogate,
    'messages', …, 'events', …, 'links', …, 'attachments', …, 'origin',
    'data_subject_request'), null, 'data_subject_request')`. The details carry
    the surrogate and counts and never the original id.
11. `set_config('app.erasure_subject', '', true)`, the same for the surrogate.

### 7.4 The recognised transformation

`app.guard_communication_message()` (0070:419-454) gains one branch before
its column comparison:

```sql
if tg_op = 'UPDATE'
   and current_setting('app.erasure_subject', true) <> ''
   and old.provider_user_id is not null
   and old.provider_user_id::text = current_setting('app.erasure_subject', true)
   and new.provider_user_id::text = current_setting('app.erasure_surrogate', true)
   and new.provider_display_name_snapshot is null
   and new.provider_username_snapshot is null
   and new.text is not distinct from
       (case when old.text is null then null else '[текст стерто на запит]' end)
   and old.id is not distinct from new.id
   and … (the remaining 22 guarded columns, each `is not distinct from`) …
then
  return new;
end if;
```

Everything after the branch is the trigger as it stands. Outbound messages
authored by members have `provider_user_id` NULL and never match the branch.

`app.reject_mutation()` is shared by three tables (0062:350-358); the branch
is added only where `tg_table_name = 'communication_message_events'`:

```sql
if tg_op = 'UPDATE' and tg_table_name = 'communication_message_events'
   and current_setting('app.erasure_surrogate', true) <> ''
   and old.event_kind = 'edited'
   and new.text = '[текст стерто на запит]'
   and exists (select 1 from public.communication_messages m
                where m.id = old.message_id
                  and m.provider_user_id::text = current_setting('app.erasure_surrogate', true))
   and old.id is not distinct from new.id
   and … (every other column `is not distinct from`) …
then
  return new;
end if;
```

The parent is checked by surrogate, which is why messages are rewritten
before events (§6, step 4 then 5).

### 7.5 `app.apply_communication_retention`

```sql
create or replace function app.apply_communication_retention(p_batch integer default 5000)
returns table (data_class text, affected bigint)
language plpgsql security definer set search_path = '' as $$ … $$;
revoke all on function app.apply_communication_retention(integer) from public;
```

Called by pg_cron as the database owner; no role holds EXECUTE. For each
class with a non-NULL duration:

- `customer_communication`: select up to `p_batch` distinct
  `(workspace_id, provider_user_id)` from `communication_messages` where
  `provider_user_id > 0` and `server_received_at < now() - duration`; for
  each, run steps 3–11 of §7.3 with `origin = 'retention'` and no HMAC
  (`subject_hmac` NULL; conflict target `(workspace_id, surrogate_user_id)`
  is irrelevant — a new surrogate per subject), reason code `'retention'`.
- `customer_identity`: `telegram_member_links` where `revoked_at < now() -
  duration` and `telegram_user_id > 0` — the same link rewrite (§7.3 step 7).
  Active links are operational and are never aged out.
- `operational_security`: `delete from public.telegram_inbox_updates where
  state in ('processed','failed') and processed_at < now() - duration`, and
  `delete from public.telegram_binding_intents / telegram_member_link_intents
  where coalesce(consumed_at, expires_at) < now() - duration`, each limited
  to `p_batch` by ctid subselect.

[Clarified 2026-09-03, during execution. «Steps 3–11» above means the class's
own tables. `customer_communication` runs steps 3–6 and 8–11 — messages, edit
events, attachment filenames, registry row, audit — and never step 7: the
link belongs to `customer_identity`, and an active link is never aged out, as
the next bullet says. `customer_identity` runs steps 3, 7, 10 and 11 — the
link rewrite, registry row, audit — and never touches a message. So a NULL
duration leaves a class's tables alone whatever the other classes do. The
internal function takes a scope argument (`all` on the request path,
`communication` / `identity` here) so each branch states what it may reach.
Found when the Task 5 review reproduced an active link revoked under a
message-text duration; recorded in the plan's ledger as a ruling. One
consequence, accepted: «a new surrogate per subject» above is per subject
*per class* — a stale subject's messages and its revoked link may carry two
different surrogates, because retention rows have no HMAC to find each other
by. Retention intends to sever that link; the request path, which runs every
step under one surrogate, does not have this property.]

Scheduled as in `0007`: `cron.schedule('communication-retention', '23 3 * * *',
'select app.apply_communication_retention(5000)')` inside the same
pg_cron-availability block, unscheduling first so re-running the migration is
safe.

## 8. User flows

### 8.1 Erasure on request (the M0 gate-2 procedure)

1. The request arrives (a person, or the partner on their behalf). The
   operator identifies the workspace and the Telegram user id — from the
   partner's group, or from `telegram_member_links` via the member.
2. On a machine with `SERVICE_DB_URL` and `TELEGRAM_LINK_PEPPER` for the
   target environment:
   ```bash
   pnpm --filter @goproceed/app exec node scripts/telegram-erase-identity.mjs \
     --workspace <uuid> --telegram-user-id <id>
   ```
3. The script refuses to start without a pepper of at least 32 characters
   (the same bound `config.ts:19` applies), computes
   `subject_hmac = HMAC-SHA256(pepper, 'erasure:' || workspace || ':' || id)`
   — the `erasure:` prefix separates the domain from the intent-token HMACs in
   `tokens.ts` — and calls the definer in one transaction.
4. It prints the result as one JSON line: surrogate, the five counts,
   `already_erased`, and `pending_updates_for_subject`. If the last is
   non-zero it prints «re-run after `/internal/telegram/jobs` has drained the
   inbox» and exits 0 — the erasure that ran is complete; the re-run is for
   what arrives after it.
5. The operator records the run (date, workspace, surrogate, counts — never
   the id) where the partner's requests are tracked. The audit row is the
   database's own record.

### 8.2 Retention by age

Nothing to do. The job runs daily; while every duration is NULL it returns
`(class, 0)` three times. When the owner lands a duration, the job starts
converging the backlog at `p_batch` subjects per night.

## 9. Web app

None in this slice. What a member sees after an erasure: the message row in
the communication timeline with the marker as its text and no display name —
`communications/route.ts:183` returns the snapshot as `author.displayName`,
so a NULL snapshot arrives as no name. Whether the dashboard renders that as
an empty string or a placeholder is the dashboard's existing behaviour for a
NULL snapshot, unchanged here. No new copy key: the marker is stored, not
rendered from a catalog, because it must be identical in the database on both
paths.

## 10. Security and privacy

- **Why schema `app`.** The registry and the policy table are not tenant
  data and must never be member-readable. Schema `app` is where the service
  plane's functions already live; no `public` grant, policy or catalog row
  is involved, and the validator's table guards (`deployedTables`,
  `validate-canonical-docs.mjs:514-517`) match `create table public.` only.
  They are the first tables in `app`; the entity catalog stays a catalog of
  `public`. Both are recorded in `data-access-surface.csv` as
  `service_definer_only` so the surface is written down.
- **The pepper stays in the application.** The database sees an HMAC and an
  id; the id is in the call's parameters and in `pg_stat_statements`-class
  telemetry only if that is enabled — which the M0 gate-4 review must note.
  The registry stores the HMAC; nothing stores the id after the transaction.
- **Domain separation.** `erasure:` prefix in the HMAC input, so an
  intent-token hash and an erasure hash of the same bytes never collide.
- **GUC hygiene.** Both markers are `is_local = true` and are cleared before
  return; a raise aborts the transaction and the markers with it. The guard
  branch also requires `old.provider_user_id::text = subject`, so even a
  caller that re-set the marker could rewrite only that subject's rows into
  the redaction shape — never other rows, never other values.
- **INV-099 (new, P0):** «An erased Telegram identity is unrecoverable from
  any table or column the member plane can read: the subject's messages,
  edit events, member link and attachment filenames carry the surrogate or
  NULL, and no table stores the original identifier or an unpeppered hash of
  it.» Pinned by the tests in §13.
- **Unchanged:** DA-148 and INV-094 (provider file handles) — the
  transformation never touches `communication_attachments.provider_*`.
- **Not a member action.** No `/v1` route, no capability; `goproceed_app`
  holds no EXECUTE on either definer.

## 11. Failure handling

| Case | Behaviour |
|---|---|
| Unknown workspace | `record_service_audit` raises on the workspace check (0078:95-97); transaction rolls back; script exits 1 with the message. |
| Subject never wrote in the workspace | Registry row with zero counts, audit row, exit 0. Not an error. |
| Pending or leased inbox rows for the subject | Counted and reported; the erasure that ran is complete. The operator re-runs after the worker drains; the HMAC yields the same surrogate. |
| A guard raises inside the definer | Whole transaction rolls back — registry, updates, audit. The script prints the guard's message; nothing is half-erased. |
| Script started without pepper or with a short one | Refuses before connecting (fail closed, as `config.ts` does). |
| Unique violation generating a surrogate | Regenerate and retry inside the definer, bounded to 8 attempts, then raise. |
| Retention duration NULL | Class skipped; `affected = 0`. |
| Retention batch larger than `p_batch` | Converges over successive nights; nothing is skipped, only deferred. |
| pg_cron absent | `raise notice` and no schedule, as `0007:47` does; the definer remains callable by hand. |

## 12. API surface

None. No row in `scope-v0.1.csv`, no capability, no event in
`event-catalog.csv` beyond the audit action `telegram_identity.erased`
recorded in `audit_events` through the existing service-audit path. If a
member-plane route is wanted later it is its own slice with its own dated
authorisation (ADR-009:226-228 / ADR-010:134-136).

## 13. Testing and verification

All database tests live in `packages/testing/src/` and use the
workspace-scoped fixtures (`adminClient`, `asService`, `dropWorkspaces`),
never `truncate`, so they run against the local stack and in CI alike.

1. **`telegram-erasure.test.ts`** — the synthetic exercise M0 gate 2 asks for.
   Seed WS_A with senders X and Y: messages from both (some with NULL text),
   an `edited` event for X, a member link for X, an attachment with a
   filename on X's message. Call the definer via `asService` with an HMAC
   computed in the test under a test pepper. Assert: every X row carries one
   negative surrogate; snapshots NULL; `text` is the marker where it was set
   and NULL where it was NULL; the edit event's text is the marker; the link
   is revoked and carries the surrogate; the filename is NULL; **Y is byte-
   identical to before**; the registry row holds the HMAC and the surrogate;
   the audit row has action `telegram_identity.erased`, `actor_type =
   'system'`, `actor_user_id` NULL, details with counts and surrogate and
   **no occurrence of the original id anywhere in `audit_events`**; a second
   call returns `already_erased = true`, the same surrogate, zero counts.
2. **Guard mutation pins.** Under both GUCs set by hand via `asService`: an
   UPDATE setting `text` to anything but the marker raises; an UPDATE that
   also changes `kind` raises; an UPDATE of a message whose
   `provider_user_id` is not the subject raises; the redaction-shaped UPDATE
   with the GUCs **unset** raises. The same four for
   `communication_message_events`. Each asserts the guard's message text, not
   just an error.
3. **Retention.** With all durations NULL, `apply_communication_retention`
   returns three zeros and changes nothing (assert row-for-row equality on
   WS_A). Set `customer_communication` to `'1 second'` as admin, wait, run,
   assert X and Y are both rewritten with `origin = 'retention'` and no HMAC;
   reset to NULL in `finally`. Then `operational_security`: seed a
   `processed` inbox row and a consumed intent dated in the past, run, assert
   both gone and a `pending` row untouched.
4. **`m5-external-rls.test.ts`** gains one case: `app.telegram_erasures` and
   `app.retention_policy` answer `42501` to `goproceed_app` and to
   `goproceed_service`; the two definers grant EXECUTE only as §7 says
   (catalog query on `pg_proc` / `aclexplode`).
5. **`telegram-erase-identity.test.ts`** (`apps/app/scripts`, no database):
   argument parsing, the HMAC input format with the `erasure:` prefix, refusal
   without a pepper, refusal with a 31-character pepper, the JSON line shape.
6. **`validate-canonical-docs.mjs`** stays green: no `public` table is added;
   the new catalog rows resolve.

The CI run that executes test 1 is the evidence entry for M0 gate 2 in
`version-0.1.md` §M0, dated, with the run id.

## 14. Rollout and observability

- One migration, `0081_the_identity_that_asked_to_be_forgotten.sql`, its own
  commit naming `telegram-erasure.test.ts`, per CLAUDE.md (2026-09-02):
  tables, definers, both guard branches, the cron schedule, in that order.
- The script and its unit test, one commit.
- Tests 1–4, one commit each where they touch different files.
- Paperwork, one commit: `infra/README-staging.md` gains §«Manual erasure
  procedure» (the eight lines of §8.1); `invariant-catalog.csv` INV-099;
  `data-access-surface.csv` two rows; `data-retention-catalog.csv` `notes`
  on rows 3–14 point at `app.retention_policy`; `version-0.1.md` §M0 gate 2
  entry after the first CI run.
- Observability: the audit row per erasure; the cron job's return value is
  visible in `cron.job_run_details`. No metric is added — the job's counts
  are the metric until M0 gate 8 decides where counts go.
- Rollback: dropping the two definers, the cron job, the two guard branches
  and the two tables restores the previous schema. Rows already erased are
  not restorable, by design.

## 15. Success criteria

- A synthetic person's identity, once erased, is not present in any member-
  readable column of WS_A, and the audit trail proves the erasure without
  naming them — test 1 green in CI, run id recorded in `version-0.1.md` §M0.
- Every immutability property the guards had on 2026-09-02 still holds —
  test 2 green.
- With every duration NULL the nightly job is a no-op; with one duration set
  it converges — test 3 green.
- `/cso` finding #1 of 2026-09-02 is closed with a fix, not a deferral, and
  M0 gate 2's «manual closure/deletion procedure, exercised once end to end
  on synthetic data» has its artifact.
