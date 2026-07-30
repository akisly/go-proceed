# Jobs, events, and audit

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Purpose

This document defines how GoProceed performs asynchronous work without turning
queues, logs, or provider responses into business authority.

It should be read with the [system overview](system-overview.md), [canonical
domain model](../domain/domain-model.md), [execution/evidence
rules](../domain/execution-and-evidence.md), [package/acceptance
rules](../domain/packages-and-acceptance.md), and [VaR
definition](../domain/value-at-risk.md).

The delivery guarantee is **at least once**. GoProceed does not claim exactly-once
execution across PostgreSQL, object storage, and external providers. It obtains
one effective business result through transactional source facts, immutable
effect identities, idempotent consumers, and reconciliation after ambiguous
failures.

## Record types and authority

| Record | Meaning | Authority and mutability |
|---|---|---|
| Domain fact or snapshot | What happened in the product: progress adjustment, evidence receipt, frozen package, decision, prior acceptance reference | Canonical relational authority. Append-only or immutable where the domain model requires it. |
| Domain event | Versioned semantic statement that a committed domain transition occurred | Describes a domain fact and its causal identity. It is not a second mutable truth and does not require a separate `domain_events` table; it may be the immutable semantic envelope referenced by an outbox record. |
| Audit event | Who attempted or completed an authorized command, against what scope, and with what result | Append-only accountability evidence. It never replaces domain history or reconstructs missing business facts. |
| Transactional outbox record | Committed intent to deliver a domain event or start an external/asynchronous effect | Operational handoff written in the same transaction as its source fact. Immutable topic, payload version, causal references, and payload checksum; claim/delivery state is operational. |
| Job | Schedulable unit of asynchronous work | Operational identity and current execution projection. It cannot approve, accept, or mutate frozen meaning outside an authorized command contract. |
| Job attempt | One lease-bound execution of a job | Append-only attempt evidence, including worker, lease/fence, timing, normalized outcome, and sanitized error. |
| Dead letter | Exhausted or permanently invalid work requiring explicit action | Append-only failure record linked to the source job/outbox event and every replay. |
| Notification | In-product fact that a named recipient should be informed about a source fact | User-visible product record, distinct from channel delivery. |
| Message delivery | One email/channel delivery request and normalized provider result | Operational delivery evidence. Provider acceptance is not proof that a human read or acted on the message. |
| Projection | Rebuildable current view such as readiness, acceptance, VaR, queue, or delivery status | Derived from authoritative facts. It carries source watermark, algorithm version, calculation time, and stale/error state. |

Audit, domain event, and outbox must never be collapsed into one generic “event”
table:

- the **domain event** names business meaning;
- the **audit event** names command accountability;
- the **outbox record** guarantees post-commit handoff.

One command may legitimately create all three, linked by the same correlation and
causation identities.

## Transactional write pattern

Every command that needs later work follows this order:

1. authenticate the effective actor and authorize exact tenant/resource scope;
2. acquire required aggregate/allocation/review locks;
3. claim or validate the bounded request idempotency key;
4. append domain facts or create the immutable snapshot;
5. update only approved current-head/projection rows under expected versions;
6. append the command audit event;
7. insert one or more transactional outbox records;
8. commit once.

If the transaction rolls back, none of its facts, audit-success record, or
outbox work becomes visible. A failure audit may be recorded separately only
when it truthfully states that the business transaction did not commit.

Workers and providers are never called while the authorizing database
transaction is open. This avoids holding business locks across network calls and
prevents an external side effect from appearing authorized by a rolled-back
fact.

### Outbox envelope

An outbox record carries or references:

- workspace identity and globally unique event/outbox identity;
- topic and payload schema version;
- aggregate type, aggregate identity, and aggregate/source version;
- source fact/snapshot identity;
- correlation identity and immediate causation identity;
- originating actor reference where permitted;
- immutable payload or minimum source references plus checksum;
- creation time and `available_at`;
- delivery/claim projection, lease metadata, and last normalized outcome.

Payloads use stable identifiers and minimal data. Consumers re-read
authoritative source rows under tenant-safe constraints when freshness or
sensitive content matters. Raw authentication tokens, bearer review links,
authorization headers, signed storage URLs, file bytes, full provider responses,
and secrets are forbidden in outbox payloads.

Protected-link delivery follows a dedicated one-time post-commit protocol rather
than a generic email job:

1. the BFF command generates the raw token;
2. its database transaction stores only the HMAC verifier, grant facts, audit,
   and any token-free operational outbox record;
3. after commit, that same BFF command keeps the raw token in memory only long
   enough for one provider send request;
4. success records normalized delivery evidence without the token;
5. crash, timeout, or ambiguous provider result cannot replay the old token and
   requires an authorized revoke-and-reissue command.

Reissue creates a new token/grant lineage and invalidates the old grant and its
sessions. A token-free outbox event may create a `delivery_attention`
notification or operations task, but a generic outbox/job never persists,
reconstructs, or retries the raw bearer token.

## Outbox claim and job creation

A dispatcher claims eligible outbox records with a short database transaction
using `FOR UPDATE SKIP LOCKED` or an equivalent atomic claim. Claiming:

1. selects pending records whose `available_at` has passed;
2. records claimant, lease/fencing token, and lease expiry;
3. creates or returns the deterministic job identity for
   `(consumer, outbox_event_id, effect_kind)`;
4. commits before work begins.

Concurrent dispatchers may race but cannot create two effective jobs because the
consumer/effect identity is unique. An expired dispatcher lease may be reclaimed.
The outbox payload remains immutable; operational delivery state may be advanced
or rebuilt from job/attempt records.

No global event ordering is promised. Where ordering matters, the event includes
the aggregate/source version and the consumer rejects or delays a gap. Consumers
must tolerate duplicate, delayed, and out-of-order delivery.

## Job lifecycle

Canonical job projection transitions are:

```text
queued → running
running → succeeded
running → retry_wait
retry_wait → queued
running/retry_wait → dead_letter
```

`cancelled` is allowed only for work whose domain contract defines a safe,
authorized cancellation. Cancellation never deletes prior attempts or reverses
an already committed external/domain effect.

### Lease, heartbeat, and fencing

A worker claims a job in one short transaction and appends a `job_attempt` with:

- job and attempt identity;
- workspace and effect identity;
- worker/service identity;
- monotonically advancing attempt/fence value and random lease token;
- `started_at`, `lease_expires_at`, and heartbeat time;
- payload/schema/handler versions;
- originating event, actor, and correlation references.

Only the worker holding the current lease token/fence may heartbeat, report
progress, schedule retry, or finalize the job. Heartbeat extends a bounded lease;
it does not extend the job's absolute execution/retention policy indefinitely.

If a worker stops heartbeating, another worker may reclaim the job after lease
expiry and append a new attempt. The old attempt becomes abandoned/expired. A
late old worker fails the fence check and cannot finalize current job state.
Because it may already have contacted an external system, the effect itself must
also be idempotent.

### Attempt outcomes

Every attempt ends with one normalized outcome:

- `succeeded`;
- `retryable_failure`;
- `permanent_failure`;
- `lease_expired`;
- `cancelled_before_effect`;
- `ambiguous_external_result`.

Attempt records are append-only. Error data uses a bounded code, safe summary,
provider status class, and diagnostic correlation reference. Stack traces,
provider bodies, recipient contents, tokens, credentials, and sensitive evidence
metadata do not enter the attempt or audit payload.

## Retry and backoff

Each job type pins a versioned retry policy:

- maximum attempts;
- maximum job age;
- base and maximum delay;
- exponential multiplier;
- bounded random jitter;
- retryable/permanent error classification;
- provider-specific retry hints that may safely override the next time.

A typical retry delay is:

```text
min(max_delay, base_delay × 2^retry_number) + bounded_jitter
```

The calculated `available_at` is stored so restart does not reset backoff.
Provider `Retry-After` is treated as untrusted bounded input. Immediate,
unbounded, or process-local retry loops are forbidden.

Typical retryable failures include timeout, connection loss, provider rate
limit, transient 5xx, lease loss before effect, and temporary storage
unavailability. Typical permanent failures include unsupported payload/schema,
missing immutable source, revoked authorization where the job requires it,
invalid recipient after policy validation, deterministic renderer failure, and
integrity mismatch requiring human/source correction.

An ambiguous provider response is retried only through the provider/effect
idempotency identity or reconciled by provider status lookup. It is never treated
as “definitely failed” merely because the client lost the response.

## Idempotent effects

Each consumer has a database-enforced effect identity. Repeating an attempt with
the same inputs returns or reconciles the existing result; the client/worker does
not invent a second business fact.

Required identities include:

| Effect | Idempotency identity and rule |
|---|---|
| Artifact rendering | Frozen package version + artifact kind + renderer/configuration version. Same inputs return/verify the same artifact record and content hash; different renderer/config creates a new immutable identity/key. |
| Projection refresh | Projection kind + source watermark + algorithm version + scope. Replaying the same watermark is deterministic; older watermarks cannot overwrite a newer result. |
| Notification creation | Recipient + notification kind + source fact/event. Duplicate consumption returns the same in-product notification. |
| Message delivery | Notification/message identity + channel + delivery generation. Provider idempotency key is reused when supported; ambiguous responses are reconciled before a new generation. |
| Evidence inspection/finalization | Upload intent + content hash + inspection policy version. Staged bytes alone never create a second evidence object. |
| Orphan purge | Storage object identity + purge-policy generation. Missing-already is a successful reconciled result. |
| Outbox consumption | Consumer + outbox event + effect kind. A unique effect receipt prevents duplicate job/effect creation. |

Idempotency keys are bounded, scoped, retained for the declared replay window,
and reject the same key with a different request/payload hash.

## Dead letters and replay

Work moves to `dead_letter` when:

- the retry policy is exhausted;
- maximum job age is exceeded;
- payload/schema or immutable source is permanently invalid;
- a policy/security condition requires explicit review;
- repeated ambiguous external results cannot be reconciled safely.

The dead-letter record includes workspace, job/outbox/effect identity, final
attempt, safe reason code, handler/payload version, checksum, first/last failure
time, and operational owner. It contains no secret payload.

Dead letters are visible in an operational queue and alert. They are not silently
dropped, reset to queued, or deleted to make a dashboard green.

Replay is an authorized command:

1. operator records reason and, where applicable, the corrected configuration or
   source version;
2. server verifies the original effect did not already complete;
3. server creates a new job/replay generation linked to the original dead letter;
4. audit and outbox/replay records commit together;
5. the old job, attempts, and dead letter remain unchanged.

Replay reuses the original effect identity when reconciling the same intended
effect. It uses a new effect generation only when the domain/operations policy
explicitly authorizes a distinct delivery or artifact.

## Worker families

### Artifact generation

Artifact jobs load one frozen snapshot and pinned template/renderer
configuration. They write to an immutable versioned private key, calculate and
verify the content hash, then create/return the `package_artifact` fact.

If object upload succeeds but the artifact transaction fails, reconciliation
either adopts the exact expected object after hash verification or purges it as
an orphan. It never overwrites an unrelated key.

### Notifications and email

Notification creation and channel delivery are separate:

- `notifications` records what a user/recipient should be told and why;
- `message_deliveries` records template version, channel, delivery generation,
  normalized provider identifier/status, attempt linkage, and timestamps.

An email provider's accepted response means only that the provider accepted the
request. Delivered/opened telemetry, when available and permitted, is labeled
as telemetry rather than proof of human receipt or identity.

Recipient addresses and template data are minimized. Logs, audit, metrics,
traces, and dead letters contain references or redacted values, not full message
bodies or bearer links.

### Projection refresh

Readiness, acceptance, VaR, queues, and delivery summaries are rebuildable.
Projection jobs:

- read authoritative facts through one source watermark/transaction position;
- pin the projection algorithm version;
- calculate deterministically;
- write under expected scope/watermark;
- expose `calculated_at`, source watermark, stale/error state, and algorithm
  version;
- never allow an older calculation to overwrite a newer one.

If freshness is required to authorize a command, the command revalidates source
facts synchronously; it does not trust a stale projection merely because a job
has not caught up.

### Evidence inspection and orphan cleanup

Inspection jobs operate only on intent-bound staged content. `scan_pending`,
`available`, `scan_blocked`, and `orphaned_for_purge` remain distinct.
Availability is committed only after the required hash, authorization, and
inspection checks succeed.

The bounded v0.1 orphan-purge job is an operational storage safeguard. It does
not implement general customer-data retention or legal hold; automated
retention/legal-hold workflows remain later-version capabilities.

## Audit actor and append-only rules

### Effective actor

Every audit event derives the actor from the authenticated server context, never
from client-supplied display fields:

- member command: Auth subject, membership, workspace, and relevant project
  access/permission;
- external command: external session, grant, package version, assurance label,
  and self-declared reviewer claims kept distinct;
- service command: allowlisted service principal and exact job/attempt;
- system maintenance: named system principal and authorized operational command.

A service-generated audit event also records causation back to the originating
member/external command or domain event. It must not make the service look like
the human who authorized the work.

Actor, target, and workspace consistency is database-enforced. An audit event
cannot name an actor/resource chain from another workspace. External and system
actors use their explicit scoped identity rather than a fake workspace
membership.

### Audit payload

An audit event records:

- immutable audit identity and workspace/scope;
- action and normalized outcome;
- actor kind and authoritative actor reference;
- target kind and identity/version;
- command/idempotency, correlation, causation, and request identities;
- server timestamp;
- changed-field names or safe structured summary where useful;
- security assurance label where material.

Audit excludes passwords, access/refresh tokens, bearer-link fragments, raw
headers/cookies, signed URLs, evidence bytes, full file/form contents, full email
body, and unrestricted IP/device metadata. Security telemetry has its own access,
purpose, and retention boundary and is not identity proof.

### Append-only enforcement

Application, BFF, and worker roles may insert permitted audit rows but cannot
update or delete them. Database permissions and append-only enforcement reject
mutation. A correction or additional context is a new linked audit event.

Audit does not:

- replace a progress/evidence/decision fact;
- make an unauthorized command authorized;
- become a mutable package or acceptance status;
- prove that an email recipient is the intended legal person;
- hide operational failure by rewriting an earlier outcome.

## Observability and operating gates

Metrics and alerts cover:

- oldest pending outbox age and claim lag;
- queued/running/retry-wait job counts and age by type;
- lease expiry, heartbeat loss, and fence rejection;
- attempt/retry rate and normalized failure class;
- dead-letter count, age, owner, and replay result;
- email/provider error and ambiguous-result counts;
- artifact generation latency, hash mismatch, and orphan count;
- projection lag/stale/error count by algorithm version;
- orphan-purge age and purge failure.

Logs and traces use job, attempt, event, effect, correlation, and workspace-safe
opaque identifiers. They do not duplicate sensitive payloads.

Before real pilot data, verification must demonstrate:

- rollback leaves neither source fact nor outbox work partially committed;
- duplicate outbox delivery creates one effective job/effect;
- worker crash before and after an external call is safely reclaimed;
- stale worker finalization fails its fence;
- backoff survives restart and exhausted work reaches dead letter;
- replay preserves old attempts/dead letter and remains idempotent;
- artifact retries cannot overwrite immutable keys;
- projection replay at one watermark is deterministic;
- audit actor/target/workspace mismatch is rejected;
- audit update/delete is rejected for application and worker roles;
- notification/email failures are visible and owned.
