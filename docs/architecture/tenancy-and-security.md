# Tenancy and security architecture

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md)

## Purpose and security boundary

This document defines tenant isolation, actor planes, authorization order,
database grants/RLS, least-privilege service access, and protected external-link
security for v0.0 and v0.1.

A workspace is the tenant and governance boundary. A project is the ordinary
application-visibility boundary. A contract, requirement occurrence, and
evidence target progressively narrow the command scope in v0.1; a package
version, approval requirement, and claim segment narrow it further from **v0.2**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5). No
application check, JWT claim, or RLS policy may substitute for the tenant-safe
relational chain defined in [data-model architecture](data-model.md).

**Two decisions set the version markers below.**
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) moves packages, claim
segments, internal review, the statutory notice apparatus, `commercial_decision`
and the closure-without-evidence bypass to v0.2; where a control below names one
of them and carries no marker, it is a v0.2 control by that fact alone.
[ADR-007](../decisions/ADR-007-pilot-field-client.md) makes the v0.1 field
client a PWA served from `apps/app` — the same origin, the same member session,
and the same BFF authorization boundary as the web product, so it adds no actor
plane, no grant, and no policy shape to this document. It does subtract one
thing: the client-held encrypted pending original, which is a v0.3 native
obligation and is not a v0.1 security control (see
[files-and-storage.md](files-and-storage.md)).

## Implementation status

### What the database actually is

The migration chain in this repository runs to `0040`. It defines 33 application
tables, one API view (`api.me_context`), 27 functions, and five application
roles — `goproceed_app` and `goproceed_app_login` (`0003:8,11`), `goproceed_worker`
(`0008:35`), `goproceed_service` and `goproceed_service_login` (`0034:25,28`).
Migrations `0036`-`0040` add no table, no function, and no role: they retire a
schedule, close an RLS gap, name a principal for the purge functions, withdraw an
inert grant, and add one composite foreign key with its index.

**Approved is not deployed.** Everything ADR-005 introduces — requirement rules
and rule versions, requirement occurrences, work stages, stage closures,
unevidenced closures and their clearances, witness notices, occurrence evidence
decisions, blocked reasons, and statutory acts — has no table. Neither does
internal review, packages, claim segments, external access grants, external
sessions, decision batches, acceptance, or value at risk. Milestones M3-M6 exist
as design in this directory and in `technical/`, and nowhere else. Every control
below that is marked target describes what a future migration must do.

No test result is claimed anywhere in this document. `node_modules` is absent
from this worktree, so nothing in it has been executed to produce a number.

### The v0.0 control set, proved per control

Earlier revisions of this section listed the first six controls below as open
implementation blockers. That list was inherited from
[baseline verification](../../migration/goproceed-canonical-v0.1/baseline-verification.md)
§"Confirmed runtime risks", which was written against migrations `0001`-`0005`
and never updated. It was already wrong when `0009` landed, and it is retracted
here — the defect is finding 7 of the
[package review](../delivery/package-review-2026-08-04.md). Each row now cites
the migration text that decides it.

| # | Control | Status | Evidence |
|---|---|---|---|
| 1 | RLS enabled on all six origin tables | **Delivered** | `0004:3-5` (organizations, legal_entities, memberships); `0006:23-25` (audit_events, idempotency_records, transaction_outbox) |
| 2 | Audit, idempotency, and outbox access tenant-bound | **Delivered** | `0006:29` revokes `select` on audit outright; `0006:30-35` binds audit INSERT to an active membership; `0006:39-45` binds outbox INSERT and forbids a NULL org; `0006:50-59` scopes idempotency to `user:<actor>` |
| 3 | Legal-entity creation capability-aware | **Delivered** | `0006:64-71` drops the any-active-member policy of `0004:26` and requires `role in ('owner','admin')` |
| 4 | First-owner bootstrap serialized between actors | **Delivered** | `0006:78-83` — `app.org_has_members` takes `pg_advisory_xact_lock` *before* the membership check, so the losing claim waits for the winner's commit instead of racing past it under READ COMMITTED |
| 5 | Audit enforced append-only | **Delivered** | `0006:10-19` — `app.reject_mutation` on a `BEFORE UPDATE OR DELETE` trigger, which fires for the table owner too, so a widened grant alone cannot rewrite history |
| 6 | Future object privileges deny-by-default | **Delivered, with one residual the runner cannot close** | `0009:8` revokes `CREATE` on `public`; `0009:28-62` discovers every creator role from `pg_default_acl` rather than assuming one, and revokes tables, sequences, and functions from `anon`/`authenticated`, plus a **global**-scope function revoke because a schema-scoped one cannot subtract the built-in PUBLIC execute (`0009:16-20`). The residual is `supabase_admin`, documented at `0009:21-27` — see Current risks |
| 7 | Reviewed BFF, worker, and service roles with no browser-reachable secret | **Partial** | `goproceed_app`/`goproceed_app_login` (`0003:8,11`) and `goproceed_service`/`goproceed_service_login` (`0034:25,28`) exist with `NOLOGIN`/`NOINHERIT` separation. `goproceed_worker` (`0008:35`) still has **no login role**, so the outbox has no credential. *[2026-09-23, DEV-036: the evidence purge has its own pair, `goproceed_purge_worker`/`goproceed_purge_worker_login` (`0090`), with EXECUTE on five `app.*upload*purge*` functions and nothing else.]* |
| 8 | Live catalog comparison proving no staging/production drift | **Not delivered** | The newest snapshot, `catalog-snapshots/20260731-2102.md`, was taken against `127.0.0.1` and predates `0034`: its `## roles (6)` block contains no `goproceed_service` |

The `0009` design note is worth keeping visible because it is the kind of thing a
later migration will get wrong: a schema-scoped `ALTER DEFAULT PRIVILEGES …
REVOKE` can only subtract privileges the per-schema entry would itself add, and
can never remove the built-in global PUBLIC execute on functions. Any future
default-privilege work repeats both the global-scope revoke and the
`pg_default_acl` discovery loop.

### Controls added after the origin slice

| Control | Status | Evidence |
|---|---|---|
| RLS on every application table | **Delivered** | 33 `enable row level security` statements across the chain; `0037:37` was the last, on `outbox_dead_letters` — the only table that had been left out, tenant-owned, and readable by a `nobypassrls` role (`0037:9-12`) |
| Dead letters unreadable by the worker role | **Delivered** | `0037:42` withdraws the `0008:40` grant as well as enabling RLS, so a future policy cannot silently reopen the path |
| Outbox drain cannot defeat the lease protocol | **Delivered** | `0036:40` unschedules the 30-second job; `0036:53` revokes `execute` on `public.drain_outbox(int)` from `service_role`, leaving only a superuser session able to call it |
| Purge functions reachable by a non-superuser principal | **Delivered** | `0038:42-45` strips the direct `anon`/`authenticated` execute that `0021:108-111` left in place; `0038:47-50` grants the four functions to `goproceed_worker` and `service_role` — deliberately not to `goproceed_app` (cross-tenant system action) and not to `goproceed_service` (upload finalization only). *[Superseded 2026-09-23 by `0090` (DEV-036): moved to `app` and granted to `goproceed_purge_worker` only.]* |
| No false UPDATE affordance on `organizations` | **Delivered** | `0039:31` withdraws the `0003:57` grant that RLS had made inert since `0004` created only `org_select` and `org_insert` |
| `audit_events.project_id` is tenant-safe | **Delivered** | `0040:81-89` — composite FK `(organization_id, project_id) → projects (workspace_id, id)`, `MATCH SIMPLE` so the NULL-project majority stays legal, `NO ACTION` because a referential action would have to UPDATE or DELETE an append-only row and would fail at run time instead of review time |
| Service principal separated from the application principal | **Delivered** | `0034:32-33` makes `goproceed_service` a member of `goproceed_app` and `goproceed_service_login` a member of `goproceed_service`, so SQL injected into an ordinary route runs on a connection that cannot reach the service role; `0035:150` and `0035:167-170` make server-observed facts service-only |

### What v0.0 still owes

The earlier "before domain expansion, v0.0 must" list is superseded by the two
tables above: six of its seven items are delivered and domain expansion happened
anyway across `0010`-`0035`. What remains open from that list is the staging
verification in item 8, and the roles gap in item 7. Both are in Current risks.

## Actor and authority planes

### Workspace governance

Membership governance roles are closed identifiers:

- `owner`;
- `admin`;
- `member`;
- `auditor`.

They govern workspace membership, settings, party administration, and
governance policy. They are not construction job titles and do not by
themselves grant access to every project.

Owner-sensitive commands require a current active owner, expected membership
version, and serialized owner-count check. A command cannot remove/suspend the
last active owner. Initial bootstrap atomically creates the workspace, creator
owner membership, and creator project-admin access where a project is created
in the same flow.

### Project access

`project_access_grants` answer whether an active workspace member may see or act
in a project. Each grant is:

- tenant- and project-bound;
- member-bound;
- capability-scoped;
- time-bounded where applicable;
- revocable and versioned.

Workspace governance and project visibility remain separate. Project creation
atomically creates explicit project administration access for its creator;
later commands never infer project access merely from a party relationship or
responsibility title.

### Project responsibilities

`project_responsibility_assignments` record operational accountability such as
progress recorder, evidence recorder/custodian, requirement owner, package
compiler, internal verifier, submitter, or acceptance liaison. ADR-005 adds the
stage closer, the bypass author, and the clearance author to that vocabulary.
**In v0.1 only the stage closer of those three is reachable**: the bypass and
its clearance move to v0.2 with packages, because the bypass's price is package
ineligibility and v0.1 has no packages
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 — "there is no
bypass in v0.1"). The package compiler, the submitter and the acceptance liaison
are v0.2 responsibilities for the same reason. The internal verifier stays in
v0.1, but only for the evidence decision on one occurrence; the internal
**review** apparatus it is named for — target sets, review heads, and their part
in package eligibility — is v0.2.

A responsibility:

- never grants visibility by itself;
- cannot make an inactive/non-member subject an application actor;
- narrows which already-authorized member may perform a named command;
- is time-bounded and project-bound;
- is retained as accountability history after it expires.

One member may hold multiple responsibilities in v0.1. Separation-of-duties
conflicts produce an explicit warning/fact; they do not silently grant or deny a
different capability. **That warning is v0.2**
([scope-and-boundaries.md](../product/scope-and-boundaries.md)), because it
warns about self-review and the internal review it protects moves to v0.2. The
consequence is stated rather than smoothed over: **until it ships, nothing warns
an authorised actor who waives their own requirement**, and the attributed
visibility of the exception is the only thing carrying that weight in v0.1.

Two ADR-005 separations are hard refusals rather than warnings: the actor who
captured the evidence may not be the actor who accepts it — **v0.1**, and the
one that matters most in a version whose only warning is deferred — and the
actor who recorded an unevidenced closure may not be the actor who clears it —
**v0.2**, with the bypass (`technical/permissions/capabilities.csv`,
`evidence_decisions.decide` and `unevidenced_closures.clear`).

### External capability

An external reviewer is not a workspace member. External authority comes only
from one active `external_access_grant` exchanged into one revocable
`external_session`.

ADR-005 decision 9 adds a **second scope kind**. A grant targets exactly one of:

- **one requirement occurrence** — **the only kind v0.1 issues** — so an external
  `hold` approver, typically технагляд, can decide *before any package version
  exists*. Without it the model is circular: eligibility would wait for a
  decision that only becomes reachable after freeze;
- **one package version** — **v0.2**, the ADR-003 scope, for commercial and
  evidence decisions on packaged scope. v0.1 has no package versions, so no v0.1
  grant, session, or route may target one
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5).

The scope kind is part of the grant's key from the first migration, so adding
the package kind in v0.2 is additive and reinterprets no v0.1 grant. A grant is
bound to one scope kind and never both, and never reaches the other.
Everything else about the protocol is unchanged: hashed token, fragment-only
delivery, POST exchange for a short-lived session, no account, GET never
consumes.

The capability is bounded to:

- one workspace/project/contract chain, terminating in either one
  package/version or one requirement occurrence;
- one recipient/contact claim;
- exact view/decision permissions;
- pinned approval requirements and target scope, or the pinned
  `rule_version_id` and acceptance criterion of the occurrence;
- grant expiry and revocation version;
- package review epoch, for package-scoped grants.

It grants no workspace navigation, project discovery, arbitrary storage
listing, access to another package/version, or access to a sibling occurrence on
the same assignment.

### Service principals

System actors have named, narrow purposes. v0.1 distinguishes at least the six
below. The right-hand column is deliberately blunt about which of them has a
database principal today, because a service capability listed in
`technical/permissions/capabilities.csv` is a target contract, not a deployed
identity.

| Service purpose | Database principal today |
|---|---|
| BFF command/query execution | `goproceed_app` via `goproceed_app_login` (`0003:8,11,14`) |
| Upload finalization and integrity/scan state | `goproceed_service` via `goproceed_service_login` (`0034:25,28,32-33`); execute on `app.finalize_upload_intent` is service-only (`0035:167-170`) |
| Outbox/job claiming and delivery | **None.** `goproceed_worker` exists (`0008:35`) with no login role, and the outbox has no consumer at all — see Current risks |
| Storage byte purge | `goproceed_purge_worker` via `goproceed_purge_worker_login` (`0090`, DEV-036): EXECUTE on `app.expire_upload_intents`, `app.claim_upload_purge`, `app.complete_upload_purge`, `app.fail_upload_purge` and `app.upload_purge_health`, and nothing else; the `public` versions `0038` granted to `goproceed_worker` and `service_role` are dropped. The runner is `apps/app/app/internal/evidence/purge/route.ts`, called by Vercel Cron four times a day (`apps/app/vercel.json`); the bytes are deleted with `SUPABASE_SECRET_KEY` |
| Artifact rendering | **None.** No table to render from, no role, no grant |
| Projection rebuilding | **None.** No projection table exists |
| Scheduled maintenance | **None named.** Two `pg_cron` jobs remain — `idempotency-purge` (`0007:45`) and `upload-intent-expiry` (`0021:132`, repointed to `app.expire_upload_intents` by `0090`) — and both run as the scheduling superuser, not as an application principal |

A service identity is not a generic administrator. Every service command records
its service principal plus the originating user/external command when one
exists. When a worker principal is finally created, its login role, its grants,
and its RLS posture arrive in one migration, with the negative tests that prove
it cannot perform another worker's or the BFF's capability.

## The readiness gate is not an authorization plane

ADR-005 makes readiness a precondition of two commands: recorded stage closure
and package freeze. **v0.1 ships the first and not the second** — package freeze
and `is_package_eligible` move to v0.2 with packages
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5) — and the
rules below bind both, stated once. This is the one place where a security
document has to be explicit about a boundary that is easy to blur, because
implementing the gate as a permission check would be both wrong and
unauditable.

- **A gate refusal is a business refusal, not an authorization denial.** The
  actor is authorized; the facts are not sufficient. It carries a named problem
  code and a `blocked_reason` object naming the requirement, the missing
  evidence, the owed `approver_role`, and the money — never a generic 403.
- **An ineligibility refusal is distinct from a stale-source conflict.**
  Reporting one as the other turns a fixable evidence gap into an apparent
  concurrency error
  ([packages-and-acceptance.md](../domain/packages-and-acceptance.md)).
- **Capabilities never encode the gate's outcome.** `stage_closures.close`
  authorizes attempting a closure; `can_close_stage(s)` decides whether it
  succeeds. `stage_closures.bypass` is a *separate* capability precisely so that
  recording a closure without evidence is an attributed act by someone who holds
  the authority to take it, rather than a fallback branch inside the ordinary
  command. **That capability is v0.2 with the bypass itself.** v0.1's only
  attributed escape is the ADR-005 exception — `waiver` or `accept_risk` by an
  authorised actor, visible afterwards, with `not_applicable` still refused on a
  `hold`. No v0.1 command may offer a second way past a false
  `can_close_stage`.
- **The gate never refuses to record a fact.** Recording performed quantity,
  capturing evidence, and recording that a stage was in fact covered are always
  permitted (ADR-005 decision 1 sub-rule). Authorization checks on those commands
  are unchanged, and no RLS policy may be written that makes an inconvenient
  reality unrecordable.

## Capability evaluation

Capabilities are closed, versioned policy identifiers. UI persona presets map
to capabilities but are not authorization truth. Unknown capability values
deny.

A member command evaluates in this order:

1. authenticate the subject and reject disabled/expired credentials;
2. resolve the active workspace membership from the database;
3. check the workspace-governance capability when applicable;
4. resolve explicit active project access for project-scoped work;
5. check the required active project responsibility, if the command requires
   one;
6. load the resource through the complete
   workspace/project/contract/assignment/occurrence composite key, or — from
   v0.2 — the workspace/project/contract/package key for package-scoped work;
7. validate lifecycle/head version, command idempotency, business invariant,
   and — for stage closure, and from v0.2 for package freeze — the ADR-005
   eligibility predicate;
8. commit domain facts, audit, idempotency, and outbox together.

Steps 1-6 decide *who*. Step 7 decides *whether the facts allow it*. A failure
at step 7 is never reported as a failure at steps 1-6.

**Update, 2026-09-18 (DEV-020, BL-103).** Until this date the routes ran
steps 1-6 inside the callback of `withIdempotency`, which a replay never
reaches, so a caller who had lost the authority got the stored response back
and a different body got a 409. `withIdempotency` now takes a required
`authorize` step that it runs before its lock and lookup on every call, and
migration `0089` lets only an active member read a record that carries a
workspace. A record without one (creating a workspace or an organization,
accepting an invitation) stays fenced by its actor alone; the owner accepted
that residual.

**Update, 2026-09-19 (DEV-022, BL-112).** The request hash a command is
replayed by covered its raw body only, so a key reused with the same body on
another target of the same command replayed the first target's result and left
the second untouched. `commandRoute` now hashes the route's path parameters
(UUIDs lower-cased) with the body (`apps/app/src/lib/request-hash.ts`); the reuse
is 409 `IDEMPOTENCY_CONFLICT`, after the `authorize` step. A retry that spans the
deploy of this change is answered 409 as well (owner, 2026-09-19).

The client never supplies a trusted `workspace_id`, governance role,
responsibility, recipient, package scope, rule version, blocking scope, notice
period, or price/acceptance authority. It supplies an identifier/request; the
server resolves authority from current facts and validates the complete
relational chain. `earliest_proceed_at` on a witness notice is server-computed
for the same reason, in **v0.2**, where the witness notice lands.

**The v0.1 field client is a browser page and changes none of this.** The PWA of
[ADR-007](../decisions/ADR-007-pilot-field-client.md) is an authenticated member
surface on the product origin, evaluated through steps 1-8 exactly as the web
product is. Two consequences bind here rather than in the UI: nothing in the
capture path may be trusted because it claims a camera — an origin label, a
device time, or an EXIF block is client-supplied metadata and is stored as such
— and the client holds no credential, no local decryption key, and no durable
pending original that a security control could rest on.

An external command follows the same last three steps but replaces membership
and responsibility with current grant/session capability and exact approval or
occurrence scope.

## Database access roles

### Browser, field client, and native

No service-role key, database password, HMAC key, or worker credential may
enter browser code, the v0.1 PWA field client, a v0.3 native build, public
environment variables, source maps, logs, or analytics. The field client is a
route set inside `apps/app` on the same origin, so it inherits this rule rather
than needing its own: any service worker or cached asset it ships is client code
on the product origin, receives no service credential, and must not cache
evidence originals or authenticated domain responses.

Authenticated clients call reviewed BFF/API routes. If a Supabase Data API
query is intentionally exposed, it is limited to reviewed `api` views/functions
with explicit grants and RLS. `anon` receives no direct tenant-table access.

### BFF

The BFF uses a dedicated login credential stored only in the deployment secret
manager. Per request it:

- validates the Supabase Auth identity;
- starts a short transaction;
- assumes a `NOLOGIN`, `NOBYPASSRLS` application role;
- sets actor/request context with `SET LOCAL`;
- invokes allowlisted statements/functions;
- commits or rolls back before releasing the pooled connection.

The login role has no inherited broad tenant-table access and no ability to
create roles, schemas, functions, extensions, policies, or grants. Connection
pooling must never leak actor context between requests.

The BFF does not use Supabase `service_role` for routine member commands.
`service_role` bypasses RLS and therefore cannot be the ordinary application
authorization plane.

### The service principal

`goproceed_service` is the server's own identity: everything `goproceed_app` can do,
plus the right to record what the server itself observed. It is reached through
its own login role, and `goproceed_app_login` is a member of `goproceed_app` and
nothing else, so injected SQL on an ordinary route cannot issue the `SET LOCAL
ROLE` that would reach it (`0034:6-17`).

The membership edge is a deliberate least-privilege deviation, reasoned in the
migration (`0034:13-17`): a parallel grant surface was rejected because "every
future table grant had to be made twice — a divergence nobody would notice until
a policy quietly stopped applying".

**What it costs, measured 2026-08-18 rather than described.**
`goproceed_service` holds DIRECT grants on exactly two tables —
`readiness_projection` and `blocked_reasons`, the projections it rebuilds. Through
the membership it inherits the application's entire surface: `select` on **50**
tables, `insert` on 48, `update` on 24, `delete` on 3. Among the reads are
`evidence_objects`, `capture_events`, `upload_intents`,
`requirement_evidence_decisions`, `statutory_acts` and `stage_closures`.

*This paragraph named `evidence_objects` alone until that date, which understated
the deviation by forty-nine tables.*

**What bounds it, which the same paragraph omitted and which decides how much the
breadth matters.** `goproceed_service` is `NOBYPASSRLS` (`0034`), and
`withServiceTx` (`packages/database/src/tx.ts`) carries the CALLER's
`app.actor_user_id` into the service transaction rather than clearing it. Every
policy on those 50 tables therefore evaluates against the acting member, so the
service connection sees exactly the rows that member could already see. The grant
is wide; the reach is not.

That bound is asserted, not asserted-in-prose: `m2-service-principal.test.ts`
reads a real evidence row through the service connection as its entitled actor
(1 row) and as a stranger (0 rows), and the second case goes red if
`goproceed_service` is ever granted `BYPASSRLS`. The positive control is there
deliberately — the first draft of that probe ran against an empty table, where
"no rows visible" proves nothing.

**What remains a deviation** is the grant surface itself: the role could reach
those rows for an actor who is entitled to them, in a transaction that has no
business reading them, and nothing but the command's own code says otherwise.
That is wider than the "cannot review evidence" rule stated for an upload
finalizer below — a rule describing the per-workload `NOLOGIN` worker roles of
the Workers section, not this role. Narrowing it means the parallel grant surface
`0034` rejected, so it is recorded here as accepted-and-bounded rather than
tracked as pending work.

### Workers

Workers use separate `NOLOGIN` capability roles and separate login credentials
per workload. Examples:

- an outbox worker can claim/update outbox/job attempt rows and insert delivery
  results, but cannot edit contracts or decisions;
- a renderer can read one frozen manifest and insert an artifact identity, but
  cannot change package content or submit it;
- an upload finalizer can transition one `intent_authorized` intent — after its
  bytes are uploaded to the staging key — through integrity, authorization, and
  inspection checks, but cannot review evidence;
- a projector can read authoritative facts and replace only rebuildable
  projection rows;
- a purge worker can claim, complete, and fail an upload purge, and can delete
  the corresponding bytes, but reads no domain content.

Use `FOR UPDATE SKIP LOCKED` only for queue/job claiming (`0008:42-58`). It does
not authorize the claimed payload. Every worker revalidates workspace and object
scope before effect.

Two rules that `0036` and `0037` turned from principle into migration text, and
that the next worker migration must not undo:

- **a bookkeeping sweep is not a consumer.** `public.drain_outbox` marked rows
  processed with no lease check and no topic filter, so it could settle a row a
  correct consumer held a live lease on. It is retired, not deleted
  (`0036:20-23,55-62`);
- **a policy that reads as access but returns nothing is worse than no policy.**
  Every policy family in this database keys off `app.current_actor()`, a
  per-request GUC a background worker never sets. `0037:20-27` enables RLS on
  `outbox_dead_letters` with **no** policy for exactly that reason: a worker that
  needs dead letters needs a principal and a policy designed together.

### Privileged functions

`SECURITY DEFINER` is exceptional. Such a function must:

- live in a non-exposed schema;
- use a fixed empty `search_path` and schema-qualified object names;
- validate the calling subject/service and complete tenant chain internally;
- expose one bounded command, not arbitrary SQL;
- revoke `EXECUTE` from `PUBLIC`, `anon`, `authenticated`, and unrelated
  service roles;
- be covered by outsider, cross-tenant, and wrong-scope tests.

The fifth rule needs the emphasis `0038` gave it: revoking from `PUBLIC` does
**not** strip the direct `EXECUTE` the local Supabase stack grants to `anon` and
`authenticated` at function-creation time. `0021:108-111` revoked from `PUBLIC`
only, and all four purge functions stayed browser-reachable until `0038:42-45`.
Every new function revokes from `public, anon, authenticated` explicitly.

## Grants and exposed schemas

Postgres grants decide which objects a role can reach; RLS decides which rows
that role can reach. Both layers are mandatory for every exposed object.

Rules, with their delivery state:

| # | Rule | State |
|---|---|---|
| 1 | Revoke `CREATE` on application schemas from `PUBLIC` | Delivered (`0009:8`) |
| 2 | Revoke existing broad grants from `PUBLIC`, `anon`, `authenticated` | Delivered per slice (`0003:51-54`, `0008:25`, `0038:42-45`) |
| 3 | Alter default privileges for every migration owner discovered from the catalog | Delivered for every role the runner can alter (`0009:28-62`); `supabase_admin` residual remains |
| 4 | Expose only the reviewed `api` schema when compatibility permits | Target. One view exists (`api.me_context`); the exposed-schema list is not narrowed |
| 5 | Grant object/operation-specific privileges in the same migration that adds its RLS policies | Practice since `0011`/`0013`/`0016`; `0039` exists because `0003` granted UPDATE in a migration that added no policy |
| 6 | Fail CI if a new exposed object lacks an owner, grant decision, RLS decision, and security test | Target |
| 7 | Never grant a table-wide UPDATE ahead of the policy and capability that scope it | Delivered as doctrine by `0039:20-25`: a settings command adds a column-scoped grant, an owner/admin policy, and its capability in one migration — never the policy alone |

Conceptual default:

```sql
revoke create on schema public from public;
revoke all on all tables in schema public
  from public, anon, authenticated;
revoke all on all sequences in schema public
  from public, anon, authenticated;
revoke execute on all functions in schema public
  from public, anon, authenticated;

alter default privileges for role <migration_owner> in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role <migration_owner> in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role <migration_owner> in schema public
  revoke all on functions from public, anon, authenticated;
-- global scope, not IN SCHEMA: the only way to drop the built-in PUBLIC
-- execute on this creator's future functions
alter default privileges for role <migration_owner>
  revoke execute on functions from public, anon, authenticated;
```

Replace `<migration_owner>` with every actual creator role discovered from
`pg_class`/`pg_default_acl`; copying the example without catalog verification is
not sufficient, which is why `0009:31-36` iterates the catalog instead of naming
a role.

`service_role` is deliberately absent from the statements above.
`0009:4-6` left it with its defaults: it is server-side only, RLS-bypassing by
design, and Supabase platform tooling depends on it. Narrowing it is a separate
reviewed change, and `0036:53` and `0038:47` show the granularity that change
should have — withdraw or grant one function at a time, with the reason in the
migration.

## Row Level Security

### Coverage rule

Enable ROW LEVEL SECURITY on every tenant table or view reachable by
`anon`, `authenticated`, a BFF application role, or a non-bypass worker role.
Force RLS for application-owned tables when the table owner could otherwise
execute application traffic. Provider/service roles that bypass RLS remain
outside ordinary request paths.

Current state: **all 33 application tables have RLS enabled**, and **none has it
forced**. `0037:29-31` states the reason forcing is not applied: several write
paths, `app.fail_outbox` among them, insert as the table owner inside a
`SECURITY DEFINER` function, and forcing RLS on the owner would break the write
path the table exists for. Forcing therefore cannot be switched on globally as a
hardening sweep — it is a per-table decision that has to be taken together with
the definer functions that write that table.

RLS with **no** policy is a legitimate posture, not an omission: it denies every
row to every non-owner, which is correct for a table the application must not
read at all (`0037:20-27`). A migration that adds RLS with no policy says so in
a table comment, so the next reader does not "fix" it.

An exposed view must either:

- use security-invoker behavior so underlying grants/RLS apply; or
- expose a narrowly granted function that performs the same tenant/capability
  checks.

No security-definer view/function may turn an untrusted filter into a
cross-tenant query.

### Policy shape

Every write policy has both visibility and new-row enforcement:

- `USING` constrains rows that may be selected/updated/deleted;
- `WITH CHECK` constrains rows that may be inserted or produced by an update.

Policies derive the subject once and perform indexed membership/project-access
lookups. Columns used by RLS begin with `workspace_id` in their indexes. For
Supabase JWT helpers, use scalar subqueries such as `(select auth.uid())` so the
value can be initialized once per statement.

Conceptual member read:

```sql
create policy project_rows_read
on public.<project_scoped_table>
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    join public.project_access_grants g
      on g.workspace_id = m.workspace_id
     and g.member_id = m.id
    where m.workspace_id = <project_scoped_table>.workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and g.project_id = <project_scoped_table>.project_id
      and g.is_current
  )
);
```

Production policies use canonical lifecycle/head facts rather than the
illustrative `is_current` field if currentness is projected differently.

RLS is defense in depth, not relational integrity. A row that passes RLS must
still satisfy tenant-safe composite FKs, uniqueness, checks, and serialized
command invariants. `0040` is the worked example: `audit_events.project_id` sat
behind correct RLS for thirty-eight migrations and could still name a project in
another tenant, because no constraint said otherwise.

### RLS for the readiness-gate tables

When the ADR-005 tables are written, three policy shapes are already decided.
The v0.1 set of those tables is requirement occurrences, requirement exceptions,
occurrence evidence decisions, work stages, stage closures, `blocked_reasons`
and `readiness_projection`; notices, attendance outcomes, unevidenced closures
and clearances arrive with the rest of their apparatus in v0.2, and the shapes
below are written once for both.

- **occurrences, closures, and — from v0.2 — notices and bypasses are
  project-scoped reads** under the same `app.has_project_capability` pattern as
  evidence (`0016:160-164`). A member who cannot see the project cannot see what
  is blocking it;
- **an occurrence-scoped external session sees exactly one occurrence.** The
  policy resolves the grant's occurrence identity and nothing wider — not the
  assignment, not sibling occurrences, not the work item's other stages;
- **append-only gate facts get the `0006:10-19` treatment**: a `BEFORE UPDATE OR
  DELETE` trigger that raises for the table owner too. Stage closures,
  requirement exceptions and occurrence evidence decisions are append-only in
  v0.1; unevidenced closures, clearances, notices and attendance outcomes join
  them in v0.2. A grant widened by accident must not be able to rewrite any of
  them.

### Storage RLS

Evidence and package objects live in private buckets. Supabase Storage denies
operations without policies by default; application policies on
`storage.objects` must allow only exact bucket/key prefixes whose metadata
resolves to a currently authorized workspace/object.

- Clients never list a whole tenant bucket.
- Upload intent authorizes only one immutable staging key.
- `upsert`/overwrite is not granted for originals or artifacts, including
  rendered statutory act versions.
- Staged content is not evidence and is not package-visible.
- Available-object download uses a short-lived signed URL or same-origin
  authorized stream after current access revalidation.
- External sessions receive only exact package artifact/evidence access, or —
  for an occurrence-scoped grant — only the evidence objects linked to that one
  occurrence. They do not receive a Storage credential or general
  `storage.objects` grant.
- Storage policies repeat the relevant subject/scope check because Data API
  pre-request hooks do not protect Storage.

## Protected external-link protocol

### Grant creation

An authorized submitter creates one `bearer_email_link` grant for one recipient
and one scope — in **v0.1** a single requirement occurrence with its pinned rule
version and acceptance criterion, and from **v0.2** additionally a package
version with its permission set and exact approval scope. Every step below binds
both kinds identically; only the target differs.

1. Generate 256 random bits with a cryptographically secure random generator.
2. Encode the raw token as base64url without padding.
3. Store only `HMAC-SHA-256(server_key, raw_token)` plus HMAC key identifier.
4. Compare verifiers in constant time.
5. Put the raw token only in the email URL fragment, never path or query.
6. Emit the raw token once; never persist it in application/audit/outbox
   payloads.
7. Expire the initial link after seven days or package supersession, whichever
   occurs first. An occurrence-scoped grant has no package to be superseded by;
   it expires on its own timer and on revocation, and additionally when the
   occurrence's rule-version binding is replaced by a successor contract version.

The grant stores workspace/project/contract identity, its single scope kind and
target, recipient/contact, permissions, expiry, state, revocation version,
reissue lineage, and — for package scope — the package review epoch. Reissue
atomically revokes the old grant and all sessions issued from it.

The authorizing transaction commits the grant, HMAC verifier, audit event, and
only token-free operational facts. After commit, the same BFF command holds the
raw token in memory only long enough for one email-provider send request. The
raw token never enters the generic outbox/job system. If the process crashes or
the provider result is ambiguous, GoProceed cannot reconstruct or retry that
token; an authorized revoke-and-reissue command creates a new grant/token and
invalidates the old grant and sessions.

### Fragment shell and exchange

The email opens a public same-origin shell:

```text
GET /external/review#<raw-token>
→ fragment remains client-side and is absent from the HTTP request
→ shell reads it and immediately calls history.replaceState
→ POST /external/exchange with the raw token in a redacted body
→ atomic grant validation/consumption and session creation
→ render only the exact review scope
```

Ordinary `GET`, email prefetch, link preview, CDN fetch, and health checks never
consume or activate a grant.

The exchange endpoint:

- accepts HTTPS `POST` only with strict content type and same-origin checks;
- suppresses/redacts request bodies in access logs, traces, analytics, error
  serialization, replay tools, and support tooling;
- locks the grant, verifies HMAC/key ID, active state, expiry, recipient scope,
  scope kind, exact package version or occurrence identity, revocation version,
  and review epoch where one applies;
- atomically marks the raw-token exchange consumed and creates one session;
- lets one concurrent exchange win and returns a generic invalid-link response
  to every replay;
- never reveals whether a recipient, package, occurrence, workspace, or grant
  exists.

### External session cookie

Generate the session identifier server-side at exchange and store only its
verifier. Set a cookie such as:

```text
__Host-goproceed_external=<opaque-session>
Path=/
Secure
HttpOnly
SameSite=Lax
```

The `__Host-` cookie has no `Domain` attribute. The session expires after 30
minutes idle and 12 hours absolute. Rotate its identifier after
privilege/scope revalidation. Store grant revocation version and, for
package-scoped sessions, the package review epoch with the session.

Every request checks session expiry, grant state/version, scope kind, package
epoch where one applies, and exact view permission. Package-head advance or
reissue increments/revokes the relevant epoch/version and invalidates old
sessions before old-version work can commit.

### Decision submission

Cookie `SameSite` is not the CSRF defense. Every state-changing endpoint also:

- requires a session-bound synchronizer CSRF token;
- validates `Origin`/same-origin request context;
- rejects unsafe content types and missing CSRF state;
- rechecks grant/session, package version/epoch or occurrence identity, approval
  requirement, target scope, terminal decision uniqueness, and idempotency while
  holding the required decision/partition serialization lock.

The same idempotency key and request hash returns the same receipt. Reusing the
key with a different request fails. A different key cannot override a terminal
same-version decision.

An occurrence-scoped session submits an `evidence_decision` and nothing else. It
cannot submit a `commercial_decision`, because it has no priced scope in view,
and an accepting evidence decision moves no money on its own (ADR-005
decision 9).

### Browser policy

The shell and review surface use:

- strict CSP with no third-party scripts, frames, fonts, images, analytics, or
  error collectors that can receive the token-bearing URL;
- `Referrer-Policy: no-referrer`;
- `Cache-Control: no-store`;
- frame-ancestor denial and MIME-sniffing protection;
- `history.replaceState` before rendering review content;
- no raw token in local/session storage, DOM text, telemetry, or client errors.

### Throttling and privacy

Throttle exchange and decision endpoints by a privacy-preserving combination
of source network, opaque grant prefix, and package/workspace bucket. Apply
separate burst and sustained limits, bounded failure counters, and alerting for
distributed abuse.

IP/network data is security telemetry, not identity proof. Minimize access,
retention, and export of that telemetry. Rate-limit responses and invalid-link
responses remain generic.

### Assurance wording

The link proves possession of the delivered bearer URL. It does not prove
verified legal identity, regulated/qualified signature, or authority outside
the pinned grant. Reviewer name, company, and title are self-declared claims
and are displayed/exported as such.

v0.1 ships `LINK_CONFIRMATION` — email link, IP, server time — and states plainly
in the UI and on any printed page that it **is not an electronic signature**
(ADR-005 assumption d). Qualified electronic signature remains deferred to v0.2;
no surface may present a link confirmation as a qualified signature.

## Audit, secrets, and incident controls

- Secrets live in a managed per-environment store and rotate independently.
  No migration plants a credential: `0003` and `0034:19-22` set no password, and
  local/CI passwords come from a script, never from `seed.sql`.
- Development seed credentials cannot be applied to preview/staging/production.
- HMAC keys and session-verifier keys carry key IDs and rotation runbooks.
- Audit records actor kind (`member`, `external`, `service`, `worker`), subject
  or grant/session identity, workspace, request/command, object, result, reason,
  and timestamp without bearer/session/CSRF secrets.
- An audited project reference is tenant-safe by constraint, not by convention
  (`0040:81-89`). Audit rows that carry no project remain legal under `MATCH
  SIMPLE`, which is why the constraint could be added to an append-only table
  with existing history.
- Security telemetry is access-restricted and retention-bounded before pilot.
- Audit is append-only, but business reconstruction uses domain facts. This is
  sharper under ADR-005: a stage closure, a bypass, and a clearance are **domain
  facts with their own tables**, not audit entries. An audit row must never be
  the only record that a gate was bypassed.
- Revocation, suspicious exchange, repeated CSRF failure, cross-tenant denial,
  and privileged-function denial create security/audit signals without
  disclosing sensitive row contents.

v0.1 has no implicit support-operator tenant access. Any later support plane
requires a separate approved design, explicit tenant grant, expiry, reason,
audit, and non-bypass implementation.

## Current risks

These are the open items as of this revision. Each cites the file that decides
it. None of them is a stale pre-`0006` bullet; the controls those bullets
described are proved delivered in Implementation status above.

1. **The `supabase_admin` default-ACL residual cannot be closed by a
   migration.** `0009:21-27` records why: the migration runner (`postgres`) is
   not a superuser on Supabase and cannot alter another role's default
   privileges. The most recent snapshot shows the shape exactly — `postgres`'s
   three `public`-schema entries carry no `anon`/`authenticated`, while
   `supabase_admin`'s three still grant both on tables, sequences, and functions
   (`catalog-snapshots/20260731-2102.md`, `## default_acls (31)`). The exposure
   is conditional: it applies only to objects `supabase_admin` itself creates in
   `public`, and user migrations never run as `supabase_admin`. The control is
   detection, not prevention — the catalog-snapshot procedure
   (`scripts/snapshot-db-catalog.mjs`) must run on every environment, and a
   change in those three rows is an incident.
2. **The outbox has no consumer.** `0036:40` unscheduled the drain and `0036:53`
   revoked its last non-superuser grant, which removed a mechanism that could
   settle a leased row it did not own. Nothing replaced it. `app.claim_outbox` /
   `app.complete_outbox` / `app.fail_outbox` (`0008:42-58`, `:60`) are the real
   protocol and have no deployed caller, so committed outbox rows stay `pending`
   indefinitely and every effect that depends on them — notification, delivery,
   projection refresh — does not happen. `0036:60-62` says so in the function
   comment rather than leaving it to be discovered.
3. **Three service purposes have no principal at all.** Artifact rendering,
   projection rebuilding, and scheduled maintenance are named in
   `technical/permissions/capabilities.csv` as `service.artifact_render`,
   `service.projection_rebuild`, and the two purge/expiry sweeps, and none has a
   database role, a login credential, or a runtime. The two surviving `pg_cron`
   jobs (`0007:45`, `0021:132`) execute as the scheduling superuser. Until a
   principal exists, "the worker cannot do X" is a statement about a worker that
   does not exist.
4. **Catalog snapshots cover the local stack only, so staging and production
   drift is unverified.** Every snapshot in
   `migration/goproceed-canonical-v0.1/catalog-snapshots/` records
   `Source host: 127.0.0.1`, and the newest (`20260731-2102.md`) predates
   `0034` — its `## roles (6)` block has no `goproceed_service`, its
   `outbox_dead_letters` row still reads `"rowsecurity": false`, and its
   `## cron_jobs (3)` block still lists `outbox-drain`. No snapshot in the
   repository corroborates `0034`-`0040` anywhere. Grants, policies, default
   ACLs, and cron presence on a hosted environment are unproven.
5. **The purge worker's byte-deleting half was wired to no runtime.**
   `0038:29-32` was explicit that granting the four functions did not make the
   purge work. *[Closed in the repository 2026-09-23 by DEV-036 (BL-030): a
   principal of its own (`0090`), a secret-authenticated route, and four daily
   Vercel Cron runs. Not yet true of any environment: `0090`, `PURGE_DB_URL` and
   `CRON_SECRET` must reach one first (`infra/README-staging.md` §3.3).]*

Two further deviations were recorded in `TODOS.md`, now frozen, rather than here. The first,
`service_role` holding `TRUNCATE` on `outbox_dead_letters`, which neither the append-only trigger
nor RLS gates, is closed: migration `0058` (2026-08-18) revoked it, and its default privilege, on every table in `public`.
The second, `goproceed_service` inheriting `select` on `evidence_objects` through `goproceed_app`, wider than
the upload-finalizer rule stated above, was accepted and bounded on 2026-08-18 and is [BL-019](../BACKLOG.md#bl-019). *[Corrected 2026-09-14 (DEV-006): this paragraph called both open single-line fixes with a decided remedy.]*

## Required security tests and gates

*[Added 2026-09-16 ([DEV-013](../tasks/DEV-013-m0-gate11-coverage-checker.md)):
`technical/database/rls-coverage.csv` lists every relation and principal a
tenant-facing role can reach by a direct grant, a grant to PUBLIC, ownership, or
a policy naming it (other inherited reach, such as `goproceed_service` through
`goproceed_app`, is judged by the member-plane row), and for each either cites a positive and a
negative test or names a gap; the validator checks that a cited test exists and
cannot be skipped, and whether it meets the v0.1 read minimum (member plane: an
authorised same-workspace read and a read denial to a member of another
workspace; service plane: the declared workspace reaches the row, another or
none is refused) was judged by review. 53 rows are still gaps (BL-090 to
BL-098); cross-workspace write denial (BL-099) and every other row of this list
are still proved by review.]*

*[Added 2026-09-17 ([DEV-014](../tasks/DEV-014-gate11-workspace-communication.md)):
the workspace-access and communication rows are covered in the v0.1 read
minimum, by files run alone; the unfiltered package run named in
`test-strategy.md` §4 is still owed. 24 rows are still gaps (BL-091 to BL-097),
and the two service-plane projection rows wait on BL-100.]*

*[Added 2026-09-17 ([DEV-015](../tasks/DEV-015-projection-service-policy.md)):
migration `0086` confines `rp_write_server` and `br_write_server` to
`app.service_workspace()`; 0045's `using (true)` had admitted every workspace to
the service plane, reads included (BL-100). 22 rows are still gaps. An
actor-bearing service transaction is still not confined (BL-101).]*

*[Added 2026-09-17 ([DEV-016](../tasks/DEV-016-gate11-remaining-gaps.md)):
73 rows are covered in the v0.1 read minimum — this task's 21 by six files run
alone, the rest by the earlier tasks' runs; one is still a
gap: `capture_events` for `goproceed_service`, whose policy ignores the declared
workspace (BL-102). `idempotency_records` is fenced by the actor, not by
membership (BL-103).]*

*[Added 2026-09-18 ([DEV-017](../tasks/DEV-017-capture-event-service-workspace.md)):
migration `0087` confines `ce_insert_server` to `app.service_workspace()` and
binds the intent through the definer `app.upload_intent_scope_matches`, so no
row of the registry is a gap (74 covered, 7 exempt). An actor-bearing service
transaction is still not confined in general (BL-101, BL-019), and the gate's
own evidence run is still owed.]*

*[Added 2026-09-18 ([DEV-018](../tasks/DEV-018-gate11-closure.md)): the evidence
run is no longer owed — the unfiltered `pnpm --filter @goproceed/testing test`
passed 786 tests in 55 files with none skipped, against a database it rebuilt to
`0087`, and M0 readiness gate 11 closed on it (`docs/delivery/version-0.1.md`
§M0). The closure covers the v0.1 read minimum only: the other rows of the list
below are not proved by it, and no dated record proves them.]*

Every exposed table/function/storage path and command needs positive and
negative tests for:

- unauthenticated and wrong-role denial;
- same-user membership in another workspace;
- active membership without project access;
- responsibility without visibility, and visibility without required
  responsibility;
- expired/revoked project access and responsibility;
- cross-workspace/project/contract/package/occurrence composite-reference
  injection;
- direct table/function access outside the grant allowlist, including the
  `anon`/`authenticated` direct-execute path that `revoke … from public` does
  not cover;
- RLS `SELECT`, `INSERT`, `UPDATE`, and delete-denial behavior;
- table-owner/application-role behavior under forced RLS where applicable, and
  the owner-write path through `SECURITY DEFINER` where RLS is enabled with no
  policy;
- security-definer `search_path`, direct-execute, and wrong-scope denial;
- worker inability to perform another worker/BFF capability;
- storage listing, overwrite, staging-read, and cross-tenant denial;
- token absence from server GET logs and email-prefetch non-consumption;
- exchange replay/concurrency, expiry, HMAC key rotation, and generic failures;
- cookie flags, idle/absolute TTL, session rotation, CSRF, CSP, and no-referrer;
- grant reissue and package-head epoch invalidation;
- terminal decision/idempotency race and old-version commit denial;
- default-privilege checks proving a newly created table/function/sequence is
  inaccessible until explicitly granted.

ADR-005 adds these, all of them negative tests about a refusal rather than about
a permission. **v0.1:**

- an occurrence-scoped grant cannot read or decide on any package version;
- an occurrence-scoped session cannot reach a sibling occurrence on the same
  assignment, the assignment, or the work item;
- an occurrence-scoped session cannot submit a `commercial_decision`;
- an authorized actor is refused stage closure when `can_close_stage` is false,
  and the refusal carries the requirement, the missing evidence, the owed role,
  and the money — not a generic authorization error;
- recording performed quantity, capturing evidence, and recording that a stage
  was covered all succeed while the same scope is blocked;
- a `not_applicable` exception on a `hold` occurrence is refused by the command,
  while `waiver` and `accept_risk` by an authorised actor succeed and stay
  visible;
- the actor who captured an evidence object cannot be the actor who accepts it.

**v0.2**, with the objects they exercise:

- a package-scoped grant cannot decide on an occurrence;
- an authorized actor is refused package freeze for ineligible scope, and the
  refusal is distinguishable from a stale-source conflict;
- an unevidenced closure is recordable, its frozen unmet set does not change when
  the occurrences are later satisfied, and no update or delete can remove it;
- a clearance by the actor who authored the bypass is refused.

A test written against the v0.2 shape of a v0.1 command does not prove the v0.1
refusal; it pins the wrong one and passes.

Pilot data is blocked until privacy notice, telemetry/retention choices,
export/manual deletion, backup/restore verification, external-link assurance
copy, and incident handling are approved and tested.

## Official implementation references

- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
  — grants, RLS, dedicated API schemas, default privileges, and pre-request
  limitations.
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
  — policy behavior and performance guidance.
- [Supabase: Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
  — `storage.objects` RLS and operation-specific policies.
- [PostgreSQL: Row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL: Roles and privileges](https://www.postgresql.org/docs/current/user-manag.html)
- [PostgreSQL: ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)
  — schema-scoped versus global scope, and what a non-superuser may alter.
