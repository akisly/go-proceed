# ADR-003: Evidence packages and acceptance authority

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-002](ADR-002-tenancy-parties-and-contracts.md),
[ADR-004](ADR-004-roadmap-demo-and-documentation.md)

## Context

The legacy target stores overlapping internal reviews, package decisions,
external decisions, and acceptance records. Package-wide outcomes cannot
unambiguously represent partial quantities, multiple required approvers, or a
returned evidence object that has no automatic monetary effect.

Protected-link review also needs a durable server session. Treating a GET as
token consumption is unsafe because email scanners and previews may open links
before the intended reviewer.

## Decision

### Immutable facts and projections

Performed-quantity entries, requirement exceptions, review decisions, evidence
content, frozen package versions, external decision batches, and prior
acceptance references are append-only or immutable facts.

Corrections reference and supersede earlier facts. Current readiness,
acceptance, and value at risk are projections and are not editable authorities.
Audit events prove command activity but do not replace domain facts.

### Package and decision grain

A package is a stable container for one contract, series, and period. Each
frozen package version is immutable and pins all material inputs, templates,
approval requirements, renderer version, author, and timestamps.

A package line is acceptance-homogeneous: one contract work item, location or
equivalent scope, unit price, currency, and tax basis.

`package_line_claim_segments` are the canonical quantity-decision grain. Each
segment traces to exact progress sources. A partial decision atomically
partitions a pending segment into non-overlapping child segments whose
quantities reconcile to the parent.

### Review authority

- internal review decides whether exact evidence and requirement facts are
  ready for packaging;
- immutable external decision batches record what an external reviewer
  submitted;
- external quantity decisions target an approval requirement and exact claim
  segment;
- external evidence decisions target an approval requirement and exact
  evidence/requirement occurrence;
- current acceptance is derived from required quantity decisions.

Evidence return never changes money automatically. A financial effect requires
an explicit quantity decision.

Every required quantity approver whose scope covers a segment must accept it.
Return by any required quantity approver blocks that segment. Observers cannot
decide. Unaddressed scope remains pending.

### Protected external link

An external reviewer does not need a workspace account or a separately entered
code. Access uses a personal high-entropy email link with assurance label
`bearer_email_link`.

The server stores only a grant token hash. The email link carries the bearer
token in the URL fragment, not in the path or query. Fragments are not sent in
the HTTP request and therefore do not enter ordinary CDN or server access logs.
The public exchange shell reads the fragment only after load, immediately
removes it from browser history with `history.replaceState`, and sends the token
once in an HTTPS POST body to the same origin.

Ordinary GET requests do not receive, consume, or activate the grant. The POST
exchanges a valid grant for a short-lived, revocable `external_session` and sets
an `HttpOnly`, `Secure`, `SameSite` cookie. Request-body logging, tracing,
analytics capture, error serialization, and support tooling must redact or omit
the bearer token. Raw tokens never enter application logs, metrics, audit-event
payloads, URLs, or browser storage.

The review surface uses strict CSP and `Referrer-Policy: no-referrer`, loads no
third-party resource that can receive the token URL, protects state-changing
requests against CSRF, and rechecks grant, version, expiry, revocation,
permission, and idempotency at decision submission.

Reissue revokes the old grant and all sessions. The link proves possession, not
verified legal identity or qualified signature. Self-declared name, company,
and title are recorded as claims; IP address remains security telemetry.

### Resubmission

An external decision remains bound to the exact package version reviewed. A v1
decision is never copied or represented as a v2 decision.

When v2 follows a return, an unchanged accepted segment may be excluded from the
new claim and linked with a `prior_acceptance_reference`. Re-review may be
skipped only when stable segment identity and `approval_scope_hash` prove that
all approval-material facts are unchanged.

The hash includes quantity, relevant price/currency/tax basis, applicable
evidence, contract terms, and approval policy. Material change requires a new
decision.

### Value at risk

Acceptance and risk use disjoint segment states with explicit precedence:

1. accepted;
2. returned;
3. submitted pending;
4. packaged not submitted;
5. internal review;
6. evidence blocked;
7. ready not packaged.

Values derive from canonical quantity, price, currency, tax basis, precision,
and rounding rules. Child rounded values reconcile to the line total.
Currencies remain separate; missing price, zero price, and over-contract
exposure remain distinct.

## Required invariant tests

- child segments reconcile to their parent;
- a progress source cannot be overclaimed across active package lineage;
- multi-approver aggregation addresses the same exact segment;
- decisions are idempotent;
- expired, revoked, replaced, or out-of-scope grants cannot decide;
- email prefetch cannot consume access;
- prior acceptance never becomes a decision on a new version;
- published package content and artifacts cannot be mutated or overwritten;
- rounded child values reconcile to canonical line value;
- evidence outcomes cannot silently alter accepted quantity or value.

## Consequences

The model uses more explicit facts than a single package-status field, but every
business outcome becomes traceable. Table count is an outcome of identities,
lifecycles, constraints, queries, and retention needs—not a target to minimize
or inflate.
