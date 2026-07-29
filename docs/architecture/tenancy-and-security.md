# Tenancy and security architecture

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md)

## Purpose and security boundary

This document defines tenant isolation, actor planes, authorization order,
database grants/RLS, least-privilege service access, and protected external-link
security for v0.0 and v0.1.

A workspace is the tenant and governance boundary. A project is the ordinary
application-visibility boundary. A contract, package version, approval
requirement, claim segment, and evidence target progressively narrow the
command scope. No application check, JWT claim, or RLS policy may substitute
for the tenant-safe relational chain defined in
[data-model architecture](data-model.md).

## Current baseline versus approved security target

### Current migration-derived baseline

The current runtime represented by migrations contains six tables:
`organizations`, `legal_entities`, `memberships`, `audit_events`,
`idempotency_records`, and `transaction_outbox`.

Current strengths include parameterized SQL, outsider-negative RLS tests,
advisory-lock idempotency, and `SKIP LOCKED` outbox claiming. Current risks
remain implementation blockers:

- RLS protects only organizations, legal entities, and memberships;
- audit/idempotency access and outbox insertion are not tenant-safe;
- legal-entity creation is not capability-aware;
- first-owner bootstrap is not safely serialized between actors;
- audit is not enforced append-only;
- future object privileges are not deny-by-default;
- the existing app/login roles and outbox drain are a foundation slice, not the
  approved final BFF/worker model;
- no live catalog snapshot has verified staging/production drift.

The exact evidence is in
[baseline verification](../../migration/goproceed-canonical-v0.1/baseline-verification.md).
This document does not treat target controls as implemented until migrations,
catalog inspection, and security tests prove them.

### Approved target

Before domain expansion, v0.0 must:

- make all six baseline tables tenant-safe or remove their exposure;
- serialize owner bootstrap;
- remove legal identity from workspace authority through an additive party
  migration;
- replace mixed membership job titles with four governance roles;
- revoke unsafe existing and future grants;
- make audit append-only and outbox/idempotency tenant-bound;
- establish reviewed BFF and worker roles with no browser-accessible secrets.

v0.1 then adds project access, project responsibilities, protected external
capabilities, and exact package/decision scopes under the same deny-by-default
model.

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
compiler, internal verifier, submitter, or acceptance liaison.

A responsibility:

- never grants visibility by itself;
- cannot make an inactive/non-member subject an application actor;
- narrows which already-authorized member may perform a named command;
- is time-bounded and project-bound;
- is retained as accountability history after it expires.

One member may hold multiple responsibilities in v0.1. Separation-of-duties
conflicts produce an explicit warning/fact; they do not silently grant or deny a
different capability.

### External capability

An external reviewer is not a workspace member. External authority comes only
from one active `external_access_grant` exchanged into one revocable
`external_session`.

The capability is bounded to:

- one workspace/project/contract/package/version chain;
- one recipient/contact claim;
- exact view/decision permissions;
- pinned approval requirements and target scope;
- grant expiry and revocation version;
- package review epoch.

It grants no workspace navigation, project discovery, arbitrary storage
listing, or access to another package/version.

### Service principals

System actors have named, narrow purposes. v0.1 distinguishes at least:

- BFF command/query execution;
- upload finalization and integrity/scan state;
- artifact rendering;
- outbox/job claiming and delivery;
- projection rebuilding;
- scheduled maintenance explicitly approved for v0.1.

A service identity is not a generic administrator. Every service command
records its service principal plus the originating user/external command when
one exists.

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
6. load the resource through the complete workspace/project/contract/package
   composite key;
7. validate lifecycle/head version, command idempotency, and business invariant;
8. commit domain facts, audit, idempotency, and outbox together.

The client never supplies a trusted `workspace_id`, governance role,
responsibility, recipient, package scope, or price/acceptance authority. It
supplies an identifier/request; the server resolves authority from current
facts and validates the complete relational chain.

An external command follows the same last three steps but replaces membership
and responsibility with current grant/session capability and exact approval
scope.

## Database access roles

### Browser and mobile

No service-role key, database password, HMAC key, or worker credential may
enter browser/mobile code, public environment variables, source maps, logs, or
analytics.

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

### Workers

Workers use separate `NOLOGIN` capability roles and separate login credentials
per workload. Examples:

- an outbox worker can claim/update outbox/job attempt rows and insert delivery
  results, but cannot edit contracts or decisions;
- a renderer can read one frozen manifest and insert an artifact identity, but
  cannot change package content or submit it;
- an upload finalizer can transition one staged intent after integrity,
  authorization, and scan checks, but cannot review evidence;
- a projector can read authoritative facts and replace only rebuildable
  projection rows.

Use `FOR UPDATE SKIP LOCKED` only for queue/job claiming. It does not authorize
the claimed payload. Every worker revalidates workspace and object scope before
effect.

### Privileged functions

`SECURITY DEFINER` is exceptional. Such a function must:

- live in a non-exposed schema;
- use a fixed empty `search_path` and schema-qualified object names;
- validate the calling subject/service and complete tenant chain internally;
- expose one bounded command, not arbitrary SQL;
- revoke `EXECUTE` from `PUBLIC`, `anon`, `authenticated`, and unrelated
  service roles;
- be covered by outsider, cross-tenant, and wrong-scope tests.

## Grants and exposed schemas

Postgres grants decide which objects a role can reach; RLS decides which rows
that role can reach. Both layers are mandatory for every exposed object.

Target migrations:

1. revoke `CREATE` on application schemas from `PUBLIC`;
2. revoke existing broad grants from `PUBLIC`, `anon`, `authenticated`, and
   `service_role`;
3. alter default privileges for every migration owner so future tables,
   sequences, and functions receive no automatic application-role grants;
4. expose only the reviewed `api` schema when compatibility permits;
5. grant object/operation-specific privileges in the same migration that adds
   its RLS policies;
6. fail CI if a new exposed object lacks an owner, explicit grant decision, RLS
   decision, and security test.

Conceptual default:

```sql
revoke create on schema public from public;
revoke all on all tables in schema public
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema public
  from public, anon, authenticated, service_role;
revoke execute on all functions in schema public
  from public, anon, authenticated, service_role;

alter default privileges for role <migration_owner> in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;
alter default privileges for role <migration_owner> in schema public
  revoke usage, select on sequences
  from anon, authenticated, service_role;
alter default privileges for role <migration_owner> in schema public
  revoke execute on functions
  from public, anon, authenticated, service_role;
```

Replace `<migration_owner>` with every actual creator role discovered from
`pg_class`/`pg_default_acl`; copying the example without catalog verification is
not sufficient.

## Row Level Security

### Coverage rule

Enable ROW LEVEL SECURITY on every tenant table or view reachable by
`anon`, `authenticated`, a BFF application role, or a non-bypass worker role.
Force RLS for application-owned tables when the table owner could otherwise
execute application traffic. Provider/service roles that bypass RLS remain
outside ordinary request paths.

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
command invariants.

### Storage RLS

Evidence and package objects live in private buckets. Supabase Storage denies
operations without policies by default; application policies on
`storage.objects` must allow only exact bucket/key prefixes whose metadata
resolves to a currently authorized workspace/object.

- Clients never list a whole tenant bucket.
- Upload intent authorizes only one immutable staging key.
- `upsert`/overwrite is not granted for originals or artifacts.
- Staged content is not evidence and is not package-visible.
- Available-object download uses a short-lived signed URL or same-origin
  authorized stream after current access revalidation.
- External sessions receive only exact package artifact/evidence access; they
  do not receive a Storage credential or general `storage.objects` grant.
- Storage policies repeat the relevant subject/scope check because Data API
  pre-request hooks do not protect Storage.

## Protected external-link protocol

### Grant creation

An authorized submitter creates one `bearer_email_link` grant for one recipient,
package version, permission set, and exact approval scope.

1. Generate 256 random bits with a cryptographically secure random generator.
2. Encode the raw token as base64url without padding.
3. Store only `HMAC-SHA-256(server_key, raw_token)` plus HMAC key identifier.
4. Compare verifiers in constant time.
5. Put the raw token only in the email URL fragment, never path or query.
6. Emit the raw token once; never persist it in application/audit/outbox
   payloads.
7. Expire the initial link after seven days or package supersession, whichever
   occurs first.

The grant stores workspace/project/contract/package/version identity,
recipient/contact, permissions, expiry, state, revocation version, reissue
lineage, and package review epoch. Reissue atomically revokes the old grant and
all sessions issued from it.

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
  exact package version, revocation version, and review epoch;
- atomically marks the raw-token exchange consumed and creates one session;
- lets one concurrent exchange win and returns a generic invalid-link response
  to every replay;
- never reveals whether a recipient, package, workspace, or grant exists.

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
privilege/scope revalidation. Store grant revocation version and package review
epoch with the session.

Every request checks session expiry, grant state/version, package epoch, and
exact view permission. Package-head advance or reissue increments/revokes the
relevant epoch/version and invalidates old sessions before old-version work can
commit.

### Decision submission

Cookie `SameSite` is not the CSRF defense. Every state-changing endpoint also:

- requires a session-bound synchronizer CSRF token;
- validates `Origin`/same-origin request context;
- rejects unsafe content types and missing CSRF state;
- rechecks grant/session, package version/epoch, approval requirement, target
  scope, terminal decision uniqueness, and idempotency while holding the
  required decision/partition serialization lock.

The same idempotency key and request hash returns the same receipt. Reusing the
key with a different request fails. A different key cannot override a terminal
same-version decision.

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

## Audit, secrets, and incident controls

- Secrets live in a managed per-environment store and rotate independently.
- Development seed credentials cannot be applied to preview/staging/production.
- HMAC keys and session-verifier keys carry key IDs and rotation runbooks.
- Audit records actor kind (`member`, `external`, `service`, `worker`), subject
  or grant/session identity, workspace, request/command, object, result, reason,
  and timestamp without bearer/session/CSRF secrets.
- Security telemetry is access-restricted and retention-bounded before pilot.
- Audit is append-only, but business reconstruction uses domain facts.
- Revocation, suspicious exchange, repeated CSRF failure, cross-tenant denial,
  and privileged-function denial create security/audit signals without
  disclosing sensitive row contents.

v0.1 has no implicit support-operator tenant access. Any later support plane
requires a separate approved design, explicit tenant grant, expiry, reason,
audit, and non-bypass implementation.

## Required security tests and gates

Every exposed table/function/storage path and command needs positive and
negative tests for:

- unauthenticated and wrong-role denial;
- same-user membership in another workspace;
- active membership without project access;
- responsibility without visibility, and visibility without required
  responsibility;
- expired/revoked project access and responsibility;
- cross-workspace/project/contract/package composite-reference injection;
- direct table/function access outside the grant allowlist;
- RLS `SELECT`, `INSERT`, `UPDATE`, and delete-denial behavior;
- table-owner/application-role behavior under forced RLS where applicable;
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
