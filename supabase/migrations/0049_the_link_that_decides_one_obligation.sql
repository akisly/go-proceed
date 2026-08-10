-- 0049: v0.1-M5 — protected external access.
--
-- WHAT THIS BUILDS
--   public.external_access_grants     the revocable, expiring bearer-link permission
--   public.external_sessions          the short-lived server session it exchanges into
--   public.external_decision_batches  the immutable receipt one submit produces
--   the EXTERNAL ACTOR PLANE: one GUC, one scope resolver, and the policies that
--   let a session holding no account read exactly one requirement occurrence and
--   decide exactly that one.
--
-- AND WHAT IT UNSHUTS. 0045:690-698 built three columns on
-- public.requirement_evidence_decisions — external_session_id,
-- external_access_grant_id, decision_batch_id — and shut them with
-- requirement_evidence_decisions_v01_internal_only_check, saying in terms:
-- «M5 drops exactly this constraint and adds the three foreign keys in the same
-- statement; nothing else here is in its way.» §6 is that statement, and nothing
-- else in 0045 was in its way.
--
-- ROLLBACK (dev only, and only before a link has been sent):
--   drop table public.external_decision_batches;   -- FKs from decisions first
--   drop table public.external_sessions;
--   drop table public.external_access_grants;
--   alter table public.requirement_evidence_decisions
--     add constraint requirement_evidence_decisions_v01_internal_only_check
--     check (decided_by_member_id is not null);
--   drop function app.exchange_external_grant(...); app.resolve_external_session(...);
--     app.external_session_scope(); app.external_session_occurrence();
--     app.external_session_may_decide(); app.external_session_workspace();
--     app.current_external_session(); app.guard_external_grant();
--     app.guard_external_session();
--   drop policy ro_external_select on public.requirement_occurrences;  -- and the
--     eight other *_external_* policies §10 creates
--   alter table public.project_access_grants
--     drop constraint project_access_grants_capability_check;
--   alter table public.project_access_grants
--     add constraint project_access_grants_capability_check
--     check (capability = any (array[
--       'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
--       'assignments.manage','progress.record','progress.adjust','evidence.record',
--       'rule_bindings.manage','requirements.assign',
--       'requirement_exceptions.decide','evidence_decisions.decide','stage_closures.close',
--       'readiness.view','statutory_acts.compose']));
--
--   ONCE ONE EXTERNAL DECISION HAS BEEN SUBMITTED THERE IS NO ROLLBACK.
--   public.requirement_evidence_decisions rows carrying an external_session_id are
--   the технагляд's own recorded decision; dropping public.external_sessions
--   destroys the authority those rows name, and the decision would then be a
--   decision by nobody. Narrowing the capability CHECK back also fails while any
--   grant row carries 'packages.submit', because a revoke sets revoked_at rather
--   than removing the row. Staging and production take a corrective forward
--   migration instead.
--
-- WHAT WAS NOT CHECKED
--   NOTHING HERE WAS EXECUTED. No psql, no supabase, no migration run, no test.
--   Static reading of 0001-0003, 0006, 0010-0011, 0015-0017, 0034-0035, 0043,
--   0045, 0046 and 0048 against technical/database/schema-v0.1.sql:2008-2157,
--   entity-catalog.csv:67-69, invariant-catalog.csv (INV-007, INV-009, INV-010,
--   INV-031, INV-044, INV-056, INV-057, INV-058, INV-074, INV-075),
--   docs/architecture/tenancy-and-security.md §"Protected external-link protocol",
--   technical/permissions/capabilities.csv:34,:37,:39 and
--   technical/events/event-catalog.csv:32-35,:38,:42 is the only check performed.
--
-- ===========================================================================
-- 0. THE ONE THING A READER MUST HOLD IN MIND
--
-- Every RLS policy in this database keys off app.current_actor(), a GUC carrying
-- the Supabase user id. An external reviewer HAS NO USER. The plane this
-- migration adds is therefore a SECOND subject, carried by a second GUC
-- (app.external_session_id), and the two are MUTUALLY EXCLUSIVE BY
-- CONSTRUCTION: app.current_external_session() returns NULL whenever an actor
-- GUC is set (§7). A transaction that somehow carried both would behave as an
-- ordinary MEMBER transaction — which requires a real active membership to see
-- anything at all — rather than as an external one, so the collapse is towards
-- the plane that needs an identity, not away from it.
--
-- Every table this migration does not name has NO external policy, and RLS with
-- no matching policy denies every row. That is the whole of «it grants no
-- workspace navigation, project discovery, arbitrary storage listing, access to
-- another package/version, or access to a sibling occurrence on the same
-- assignment» (tenancy-and-security.md §"External capability"): the external
-- session cannot see public.work_items, so it has NO PRICED SCOPE IN VIEW, which
-- is the structural half of «an occurrence-scoped session cannot submit a
-- commercial_decision» (INV-075, ADR-005 decision 9).
-- ===========================================================================

-- ===========================================================================
-- 1. The capability vocabulary, third place
--
-- technical/permissions/capabilities.csv:34 governs BOTH member M5 operations —
-- occurrence_grants.issue and external_grants.revoke_reissue — with
-- `packages.submit`. The name is package-shaped and the catalog row says why it
-- is not renamed here: «renaming it is an API change owned by
-- technical/openapi/scope-v0.1.csv». No value is invented; the id is the
-- catalog's own.
--
-- The other two places move IN THIS SAME COMMIT (owed item 1 of §11): the
-- `projectCapability` enum in packages/contracts/src/project-access.ts and
-- `ProjectCapability` in packages/domain/src/authz.ts. 0044:48-55 records what
-- happens when they do not.
--
-- WIDENING ONLY. Seventeen values where 0047 left sixteen, so validation against
-- existing grant rows cannot fail.
-- ===========================================================================
alter table public.project_access_grants
  drop constraint project_access_grants_capability_check;
alter table public.project_access_grants
  add constraint project_access_grants_capability_check
  check (capability = any (array[
    'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
    'assignments.manage','progress.record','progress.adjust','evidence.record',
    'rule_bindings.manage','requirements.assign',
    'requirement_exceptions.decide','evidence_decisions.decide','stage_closures.close',
    'readiness.view',
    'statutory_acts.compose',
    -- v0.1-M5
    'packages.submit']));

-- ===========================================================================
-- 2. The composite unique the grant's occurrence pin needs
--
-- The target DDL (schema-v0.1.sql:2042-2043) pins the grant to its occurrence on
-- three columns. This one pins on FOUR, adding contract_id, because the grant
-- carries contract_id NOT NULL and the narrower key would let a grant name
-- contract A while its occurrence belongs to contract B inside the same project.
-- Same move as 0043:293-324 and 0045:350-392: the key is declared before the
-- table that uses it, on a table this chain created and which no deployed
-- database holds rows in yet.
-- ===========================================================================
alter table public.requirement_occurrences
  add constraint requirement_occurrences_contract_scope_key
  unique (workspace_id, project_id, contract_id, id);

-- ===========================================================================
-- 3. external_access_grants — one recipient, one scope, one token nobody stores
--
-- THE EXCLUSIVE ARC (INV-074) IS TRANSCRIBED UNCHANGED from
-- schema-v0.1.sql:2049-2055. In v0.1 only the requirement_occurrence branch is
-- reachable — v0.1 has no public.package_versions at all, so the package branch
-- cannot be satisfied by any row and the CHECK is what makes v0.2 ADDITIVE
-- rather than a reinterpretation of a v0.1 grant.
--
-- FIVE DEPARTURES FROM THE TARGET DDL, each named where it sits:
--   D1  recipient_email        — the address the link is delivered to
--   D2  decide_role            — generated; turns «decide in the role the
--                                obligation names» into a foreign key
--   D3  decides_evidence       — generated; turns INV-031 into a foreign key
--   D4  the permissions SHAPE CHECK, so the v0.1 permission object is a closed
--                                two-key vocabulary and not free-form jsonb
--   D5  failed lookups are NOT counted here — see §11 owed item 4
-- ===========================================================================
create table public.external_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,

  -- ADR-005 decision 9. Defaulted to the v0.2 value in the target DDL; defaulted
  -- to the v0.1 value here, because a v0.1 row that took the default would
  -- otherwise be unstorable and the default would be a trap rather than a
  -- convenience. The vocabulary is unchanged, so v0.2 changes the default back
  -- and reinterprets nothing.
  scope_kind text not null default 'requirement_occurrence'
    check (scope_kind in ('package_version','requirement_occurrence')),
  -- v0.2's branch. Built, and unreachable: no public.package_versions table
  -- exists for the foreign key the v0.2 slice adds beside them.
  package_id uuid,
  package_version_id uuid,
  requirement_occurrence_id uuid,

  credential_type text not null default 'bearer_email_link'
    check (credential_type = 'bearer_email_link'),

  -- INV-044. HMAC-SHA-256(server_key, raw_token) and the id of the key that
  -- computed it. THE RAW TOKEN IS NEVER STORED, never audited, never enqueued;
  -- the only place it exists after the issuing request returns is the recipient's
  -- email. The key id is what makes rotation possible without re-deriving
  -- verifiers that cannot be re-derived.
  token_hmac bytea not null check (octet_length(token_hmac) = 32),
  hmac_key_id text not null check (length(btrim(hmac_key_id)) > 0),

  -- D1: THE DELIVERY ADDRESS.
  --
  -- The target DDL carries recipient_contact_id and recipient_role and NO
  -- address, and the entity catalog's party_contacts row (line 8) records the
  -- open question in terms: «if step 5 must address a named технагляд through a
  -- stored contact rather than a typed address then M5 owes a route and this row
  -- is where that is decided». It is decided here, and against the contact:
  -- technical/openapi/scope-v0.1.csv carries NO operation that writes
  -- public.party_contacts, so requiring one would make occurrence_grants.issue
  -- unreachable in every pilot workspace — M4's «three signatory slots naming
  -- records no v0.1 command can create», except that here it would make the
  -- whole milestone unreachable rather than one section of one document.
  --
  -- So the address is typed, stored, and minimized: it is the only way to
  -- re-deliver on reissue, and the only way to answer «who was this link sent
  -- to» afterwards. recipient_contact_id stays, nullable, for the day a contact
  -- route exists. Retention class external_gate_retention
  -- (entity-catalog.csv:67); this column is personal data and the row is in
  -- scope of the retention schedule that must be approved before pilot.
  recipient_email text not null
    check (length(btrim(recipient_email)) between 3 and 320
           and recipient_email = lower(recipient_email)
           and recipient_email like '%@%'),
  recipient_contact_id uuid,
  -- The self-declared role claim. NOT identity proof, NOT authority outside the
  -- pinned grant (tenancy-and-security.md §"Assurance wording").
  recipient_role text not null check (length(btrim(recipient_role)) > 0),

  -- D4: the v0.1 permission object, as a closed vocabulary.
  --
  -- The two keys are capability ids from technical/permissions/capabilities.csv
  -- — `external.view_scope` (:37) and `external.decide_evidence` (:39) — and not
  -- names invented here. The CHECK below forbids a third key, forbids a
  -- non-boolean, and forbids a grant that views nothing: a grant that confers no
  -- view is not a grant, it is a row.
  --
  -- `external.decide_commercial` (:38) is deliberately NOT in the vocabulary. It
  -- is a v0.2 capability, v0.1 has no commercial decision to submit, and a key
  -- that could be set today would be a permission the product cannot honour.
  permissions jsonb not null,

  status text not null default 'active'
    check (status in ('active','revoked','expired','superseded')),
  -- «Expire the initial link after seven days or package supersession, whichever
  -- occurs first. An occurrence-scoped grant has no package to be superseded by»
  -- (tenancy-and-security.md §"Grant creation" item 7). Set by the command; the
  -- CHECK only says it is in the future at issue.
  expires_at timestamptz not null,
  -- INV-057: the single-use marker. Set once, never cleared (§9's guard).
  exchange_consumed_at timestamptz,
  revocation_version bigint not null default 0 check (revocation_version >= 0),
  review_epoch_at_issue bigint,
  replaced_grant_id uuid,

  issued_by_member_id uuid not null,
  issued_at timestamptz not null default now(),
  version bigint not null default 1 check (version >= 1),

  -- D2/D3: two DERIVED columns that turn two invariants into foreign keys.
  --
  -- They are ordinary columns pinned to `permissions` by CHECK rather than
  -- GENERATED ALWAYS AS ... STORED, and the choice is deliberate. A foreign key
  -- whose referencing or referenced column is generated is a shape this
  -- repository cannot test — no database has been available at any point in this
  -- work — and a migration that fails to APPLY is worse than one that needs the
  -- command to write two more values. A CHECK is exactly as unevadable by an
  -- INSERT as a generated column is; what it costs is a 23514 where the other
  -- would have been arithmetic.
  --
  -- decide_role is the recipient's role WHEN the grant may decide, and NULL when
  -- it may not. Under MATCH SIMPLE a NULL component skips the whole foreign key,
  -- so an OBSERVER grant may name any role it likes and a DECIDING grant may
  -- name only the role its occurrence's approver_role names. Without this a
  -- deciding grant could be issued to «геодезист» against an obligation whose
  -- approver_role is «технагляд», and the decision it produced would be pinned by
  -- requirement_evidence_decisions_occurrence_fkey into the occurrence's role
  -- anyway — i.e. a decision recorded in a role nobody was granted.
  decide_role text,
  -- decides_evidence is INV-031 — «an observer cannot submit a decision» — made
  -- referenceable. public.external_decision_batches carries a matching column
  -- CHECKed to true and a foreign key onto this one, so a receipt for an
  -- observer's submit is UNSTORABLE rather than refused by a command.
  decides_evidence boolean not null,

  unique (workspace_id, id),
  -- The verifier's own key. INV-044's «compare verifiers» resolves through this
  -- index; the application ALSO performs a constant-time comparison of the
  -- recomputed HMAC against the stored one, because an index probe is not a
  -- constant-time comparison and the document asks for one.
  unique (hmac_key_id, token_hmac),
  -- Backs the session's scope pin (§4) and the batch's (§5).
  constraint external_access_grants_scope_key
    unique (workspace_id, id, requirement_occurrence_id),
  -- Backs the batch's INV-031 pin.
  constraint external_access_grants_decide_key
    unique (workspace_id, id, decides_evidence),
  -- A grant replaces at most one predecessor, and a predecessor is replaced at
  -- most once: reissue lineage is a chain, never a fan.
  constraint external_access_grants_reissue_key
    unique (workspace_id, replaced_grant_id),

  -- v0.1's arc, four columns wide (§2). MATCH SIMPLE, so a v0.2 package grant
  -- with a NULL occurrence skips it.
  constraint external_access_grants_occurrence_fkey
    foreign key (workspace_id, project_id, contract_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, project_id, contract_id, id),
  -- D2's foreign key. Also MATCH SIMPLE: NULL decide_role => skipped.
  constraint external_access_grants_decide_role_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id, decide_role)
    references public.requirement_occurrences (workspace_id, project_id, id, approver_role),
  constraint external_access_grants_contact_fkey
    foreign key (workspace_id, recipient_contact_id)
    references public.party_contacts (workspace_id, id),
  constraint external_access_grants_replaced_fkey
    foreign key (workspace_id, replaced_grant_id)
    references public.external_access_grants (workspace_id, id),
  constraint external_access_grants_member_fkey
    foreign key (workspace_id, issued_by_member_id)
    references public.memberships (organization_id, id),

  -- INV-074, transcribed from schema-v0.1.sql:2049-2055 without change.
  constraint external_access_grants_scope_arc_check
    check ((scope_kind = 'package_version'
              and package_id is not null and package_version_id is not null
              and requirement_occurrence_id is null and review_epoch_at_issue is not null)
        or (scope_kind = 'requirement_occurrence'
              and requirement_occurrence_id is not null
              and package_id is null and package_version_id is null
              and review_epoch_at_issue is null)),

  -- D4's shape. NAMED because the auto-name would be 54 bytes and the next two
  -- are longer still.
  constraint external_access_grants_permissions_check
    check (scope_kind <> 'requirement_occurrence'
        or (permissions ?& array['external.view_scope','external.decide_evidence']
            and jsonb_typeof(permissions->'external.view_scope') = 'boolean'
            and jsonb_typeof(permissions->'external.decide_evidence') = 'boolean'
            and permissions->>'external.view_scope' = 'true'
            and permissions - 'external.view_scope' - 'external.decide_evidence'
                = '{}'::jsonb)),

  -- D2/D3's pins. These two are the whole of «derived, not typed»: a row whose
  -- decides_evidence disagrees with its own permission object, or whose
  -- decide_role is anything other than the recipient's role on a deciding grant
  -- and NULL on an observing one, is unstorable.
  constraint external_access_grants_decides_derived_check
    check (decides_evidence = (permissions->>'external.decide_evidence' = 'true')),
  constraint external_access_grants_decide_role_check
    check (decide_role is not distinct from
           (case when decides_evidence then recipient_role end)),

  -- A consumed exchange is never in the future of the issue, and never before it.
  constraint external_access_grants_consumed_check
    check (exchange_consumed_at is null or exchange_consumed_at >= issued_at),
  constraint external_access_grants_expiry_check
    check (expires_at > issued_at)
);

comment on table public.external_access_grants is
  'ONE recipient, ONE scope kind, ONE token that is never stored (INV-044). v0.1 '
  'issues only the requirement_occurrence arc of INV-074, so an external hold '
  'approver can decide BEFORE any package version exists; the package arc is v0.2 '
  'and the exclusive CHECK is what makes it additive. Delivery is fragment-only '
  'and the exchange is a deliberate same-origin POST — an ordinary GET, an email '
  'prefetch, a link preview or a health check consumes nothing (INV-010), which '
  'is enforced by the fact that NO GET HANDLER IN THIS PRODUCT TOUCHES THIS TABLE. '
  'decides_evidence and decide_role are generated so INV-031 and «decide only in '
  'the role the obligation names» are foreign keys rather than command habits.';

comment on column public.external_access_grants.recipient_email is
  'DEPARTURE from technical/database/schema-v0.1.sql:2025-2026, which carries a '
  'nullable recipient_contact_id and no address. No v0.1 operation writes '
  'public.party_contacts (scope-v0.1.csv has none), so a contact-only recipient '
  'would make occurrence_grants.issue unreachable in every pilot workspace. '
  'Personal data; retention class external_gate_retention.';

create index external_access_grants_occurrence_idx
  on public.external_access_grants (workspace_id, requirement_occurrence_id, status);
create index external_access_grants_project_idx
  on public.external_access_grants (workspace_id, project_id, issued_at desc);

-- ===========================================================================
-- 4. external_sessions — thirty minutes idle, twelve hours absolute, revocable
--
-- The session INHERITS the grant's scope and cannot widen it. That is not a
-- command's promise here: external_sessions_grant_scope_fkey compares the
-- session's occurrence against THE GRANT'S OWN occurrence column, so a session
-- naming a sibling occurrence of the same assignment is unstorable (INV-056).
-- ===========================================================================
create table public.external_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  external_access_grant_id uuid not null,
  package_version_id uuid,
  requirement_occurrence_id uuid,

  -- The cookie value is generated server-side at exchange and only its keyed
  -- verifier is stored, exactly as the token is.
  session_verifier bytea not null check (octet_length(session_verifier) = 32),
  -- DEPARTURE from schema-v0.1.sql:2060-2091, which mandates a session-bound
  -- synchronizer CSRF token IN ITS TABLE COMMENT and gives it no column. A
  -- mandate with nowhere to live is a mandate the application would have had to
  -- keep in memory, which for a stateless BFF means not at all. Separate secret
  -- from session_verifier ON PURPOSE: the session value lives in an HttpOnly
  -- cookie the page cannot read, and the CSRF token must be readable by the page
  -- in order to be echoed back in a header. One secret used for both would be a
  -- CSRF token an XSS could not steal only because it was also the session.
  csrf_verifier bytea not null check (octet_length(csrf_verifier) = 32),
  verifier_key_id text not null check (length(btrim(verifier_key_id)) > 0),

  status text not null default 'active'
    check (status in ('active','expired','revoked')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  rotated_from_session_id uuid,
  -- INV-009's readable half: a revoke bumps the grant's revocation_version, and
  -- every request compares the two. There is deliberately NO foreign key onto
  -- (grant_id, revocation_version): it would make the revoking UPDATE itself
  -- fail while a live session still named the old value, which is the one moment
  -- revocation must not fail.
  grant_revocation_version bigint not null check (grant_revocation_version >= 0),
  review_epoch bigint,

  unique (workspace_id, id),
  unique (verifier_key_id, session_verifier),
  -- Backs the decision's session pin (§6) and the batch's (§5).
  constraint external_sessions_scope_key
    unique (workspace_id, id, requirement_occurrence_id),
  constraint external_sessions_grant_key
    unique (workspace_id, id, external_access_grant_id),
  -- A rotation replaces exactly one predecessor.
  constraint external_sessions_rotation_key
    unique (workspace_id, rotated_from_session_id),

  constraint external_sessions_grant_fkey
    foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  -- INV-056 AS A KEY: the session's occurrence IS the grant's occurrence.
  constraint external_sessions_grant_scope_fkey
    foreign key (workspace_id, external_access_grant_id, requirement_occurrence_id)
    references public.external_access_grants (workspace_id, id, requirement_occurrence_id),
  constraint external_sessions_occurrence_fkey
    foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id),
  constraint external_sessions_rotation_fkey
    foreign key (workspace_id, rotated_from_session_id)
    references public.external_sessions (workspace_id, id),

  -- Transcribed from schema-v0.1.sql:2087-2090.
  constraint external_sessions_scope_arc_check
    check ((package_version_id is not null and requirement_occurrence_id is null
              and review_epoch is not null)
        or (requirement_occurrence_id is not null and package_version_id is null
              and review_epoch is null)),
  -- 30 minutes idle, 12 hours absolute, and the idle window never outlives the
  -- absolute one — a sliding window that could slide past its ceiling is not a
  -- ceiling.
  constraint external_sessions_ttl_check
    check (idle_expires_at > created_at
       and absolute_expires_at > created_at
       and idle_expires_at <= absolute_expires_at),
  constraint external_sessions_seen_check
    check (last_seen_at >= created_at)
);

comment on table public.external_sessions is
  'Cookie: __Host- prefix, Path=/, Secure, HttpOnly, SameSite=Lax, no Domain. '
  'SameSite is NOT the CSRF defense (INV-058): every state-changing external '
  'endpoint requires the session-bound synchronizer token whose verifier is '
  'csrf_verifier, plus an Origin check. The session carries the grant''s '
  'revocation version so a revoke invalidates it without an UPDATE that could '
  'fail, and exactly one scope kind, pinned to its grant''s by '
  'external_sessions_grant_scope_fkey (INV-056/INV-074).';

-- INV-057, structural half. Exactly one session per grant may be born of an
-- EXCHANGE; every later session on the same grant is a rotation and names its
-- predecessor. A second exchange therefore cannot produce a session even if the
-- exchange_consumed_at marker were forgotten by a future command.
create unique index external_sessions_one_exchange_key
  on public.external_sessions (workspace_id, external_access_grant_id)
  where rotated_from_session_id is null;

create index external_sessions_expiry_idx
  on public.external_sessions (status, idle_expires_at, absolute_expires_at);

-- ===========================================================================
-- 5. external_decision_batches — the receipt, and the external plane's own
--    idempotency record
--
-- WHY THIS TABLE CARRIES ITS OWN IDEMPOTENCY AND DOES NOT USE
-- public.idempotency_records: 0006:50-59 scopes that table's policies to
-- `actor_scope = 'user:' || app.current_actor()`. An external submit has no
-- actor, so it can neither read nor write a row there. INV-007 — «external
-- decision submit is idempotent, bounded idempotency key plus request hash with
-- same-receipt replay» — is therefore carried HERE, by
-- (workspace_id, external_access_grant_id, idempotency_key) and request_hash,
-- which is exactly what entity-catalog.csv:69 says this table is for.
-- ===========================================================================
create table public.external_decision_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid,
  package_id uuid,
  package_version_id uuid,
  requirement_occurrence_id uuid,
  external_access_grant_id uuid not null,
  external_session_id uuid not null,

  -- Self-declared name/company/title. LABELLED as claims everywhere they are
  -- displayed or exported, and never identity proof (tenancy-and-security.md
  -- §"Assurance wording"). Shape-checked so a batch cannot become a second,
  -- unreviewed place to store arbitrary personal data.
  reviewer_claims jsonb not null default '{}'
    check (jsonb_typeof(reviewer_claims) = 'object'
       and reviewer_claims - 'name' - 'company' - 'title' = '{}'::jsonb),
  -- The exact wording the reviewer was shown when they submitted. Without it a
  -- receipt says «they agreed» and cannot say to what.
  confirmation_text_version text not null
    check (length(btrim(confirmation_text_version)) > 0),
  submitted_at timestamptz,
  server_received_at timestamptz not null default now(),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  receipt_id uuid not null default gen_random_uuid(),
  receipt_hash bytea not null check (octet_length(receipt_hash) = 32),

  -- LINK_CONFIRMATION and nothing else in v0.1 (ADR-005 assumption d). The
  -- column exists so the receipt itself states its assurance level rather than
  -- leaving a reader to infer it from the absence of a member id.
  assurance_label text not null default 'LINK_CONFIRMATION'
    check (assurance_label = 'LINK_CONFIRMATION'),
  -- INV-031 as a foreign key: see §3's decides_evidence.
  grant_decides_evidence boolean not null default true
    check (grant_decides_evidence is true),

  unique (workspace_id, id),
  -- INV-007.
  constraint external_decision_batches_idempotency_key
    unique (workspace_id, external_access_grant_id, idempotency_key),
  constraint external_decision_batches_receipt_key
    unique (workspace_id, receipt_id),
  -- Backs the decision's batch pin (§6).
  constraint external_decision_batches_session_key
    unique (workspace_id, id, external_session_id),
  constraint external_decision_batches_scope_key
    unique (workspace_id, id, requirement_occurrence_id),

  -- Transcribed from schema-v0.1.sql:2138-2141.
  constraint external_decision_batches_scope_arc_check
    check ((package_version_id is not null and contract_id is not null
              and package_id is not null and requirement_occurrence_id is null)
        or (requirement_occurrence_id is not null and package_version_id is null
              and contract_id is null and package_id is null)),

  -- THREE COLUMNS AND NOT TWO. The target DDL (schema-v0.1.sql:2144-2145) pins
  -- the batch to its occurrence on (workspace_id, requirement_occurrence_id) and
  -- leaves `project_id` — which is NOT NULL, and which `edb_select` resolves a
  -- member's capability against — free text. The external session's insert
  -- policy has no reason to constrain it, so a batch could name a project of the
  -- same tenant that its occurrence does not belong to, and would then be
  -- visible to that project's members instead of to its own. Carrying
  -- `project_id` through the key makes the pairing structural.
  constraint external_decision_batches_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, project_id, id),
  constraint external_decision_batches_grant_fkey
    foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  -- INV-031: an observer's receipt is unstorable, because grant_decides_evidence
  -- is CHECKed true and this key resolves it against the grant's generated
  -- column. A command that forgot to look at the permission object still cannot
  -- write the row.
  constraint external_decision_batches_decide_fkey
    foreign key (workspace_id, external_access_grant_id, grant_decides_evidence)
    references public.external_access_grants (workspace_id, id, decides_evidence),
  constraint external_decision_batches_session_fkey
    foreign key (workspace_id, external_session_id)
    references public.external_sessions (workspace_id, id),
  -- INV-056: the batch's occurrence is the SESSION'S occurrence, which is in turn
  -- the grant's. Three rows, one occurrence, by key.
  constraint external_decision_batches_session_scope_fkey
    foreign key (workspace_id, external_session_id, requirement_occurrence_id)
    references public.external_sessions (workspace_id, id, requirement_occurrence_id),
  constraint external_decision_batches_grant_session_fkey
    foreign key (workspace_id, external_session_id, external_access_grant_id)
    references public.external_sessions (workspace_id, id, external_access_grant_id)
);

comment on table public.external_decision_batches is
  'IMMUTABLE receipt for one external submit, of either grant scope kind '
  '(INV-074). It is also the external plane''s idempotency record, because '
  'public.idempotency_records is scoped to `user:<actor>` by 0006:50-59 and an '
  'external submit has no actor (INV-007). grant_decides_evidence is CHECKed true '
  'and foreign-keyed onto the grant''s generated decides_evidence, so INV-031 — '
  '«an observer cannot submit a decision» — refuses at the storage layer and not '
  'only at the command.';

create index external_decision_batches_occurrence_idx
  on public.external_decision_batches (workspace_id, requirement_occurrence_id, server_received_at desc);

-- ===========================================================================
-- 6. The interlock 0045 left for this migration
--
-- One statement, as 0045:690-698 asked: the shutting CHECK goes and the three
-- foreign keys arrive. Everything else on that table is unchanged — the
-- authority CHECK (exactly one deciding authority, never both, never neither),
-- the assurance CHECK (LINK_CONFIRMATION beside an external session and nothing
-- else), the lineage keys and the append-only trigger all stay exactly as they
-- were written.
--
-- The extra two keys beyond the three 0045 named are INV-056 carried onto the
-- decision itself: the decision's occurrence must be the SESSION's occurrence,
-- and the batch it names must be a batch of THAT session. Without them a
-- correctly-scoped session could write a correctly-shaped decision about a
-- DIFFERENT occurrence and every three-column key would still resolve.
-- ===========================================================================
alter table public.requirement_evidence_decisions
  drop constraint requirement_evidence_decisions_v01_internal_only_check,
  add constraint requirement_evidence_decisions_session_fkey
    foreign key (workspace_id, external_session_id)
    references public.external_sessions (workspace_id, id),
  add constraint requirement_evidence_decisions_grant_fkey
    foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  add constraint requirement_evidence_decisions_batch_fkey
    foreign key (workspace_id, decision_batch_id)
    references public.external_decision_batches (workspace_id, id),
  -- INV-056 on the fact itself. MATCH SIMPLE: an internal decision has a NULL
  -- session and skips both.
  add constraint requirement_evidence_decisions_session_scope_fkey
    foreign key (workspace_id, external_session_id, requirement_occurrence_id)
    references public.external_sessions (workspace_id, id, requirement_occurrence_id),
  add constraint requirement_evidence_decisions_batch_session_fkey
    foreign key (workspace_id, decision_batch_id, external_session_id)
    references public.external_decision_batches (workspace_id, id, external_session_id);

comment on constraint requirement_evidence_decisions_session_scope_fkey
  on public.requirement_evidence_decisions is
  'INV-056 on the decision. The occurrence a session decides is the occurrence '
  'its grant named; a sibling obligation on the same assignment is unstorable, '
  'not merely refused.';

-- ===========================================================================
-- 7. THE EXTERNAL ACTOR PLANE
--
-- app.current_external_session() is the second subject, and it is DELIBERATELY
-- NULL whenever an ordinary actor is present. tenancy-and-security.md §"Capability
-- evaluation" says an external command «follows the same last three steps but
-- replaces membership and responsibility with current grant/session capability»
-- — replaces, not adds to. A transaction carrying both GUCs is a bug in
-- @goproceed/database, and the way this database resolves that bug is towards
-- the plane that requires a real identity.
--
-- app.external_session_scope() is SECURITY DEFINER for the same reason
-- app.has_project_capability is (0011:6-12): it is consulted from policies on
-- the very tables it reads, and would otherwise recurse. It is bounded to the
-- CURRENT session, validates grant state, both expiries and the revocation
-- version internally, and returns at most one row.
--
-- EVERY EXPIRY IS CHECKED HERE AND NOT ONLY IN THE COMMAND. INV-009 —
-- «revoked, expired or replaced grants cannot decide» — then holds for any
-- statement any future route writes, including one that forgot to look.
-- ===========================================================================
create or replace function app.current_external_session() returns uuid
language sql stable as $$
  select case
    when nullif(current_setting('app.actor_user_id', true), '') is not null then null
    else nullif(current_setting('app.external_session_id', true), '')::uuid
  end
$$;
revoke all on function app.current_external_session() from public;
grant execute on function app.current_external_session() to aktflow_app;

create or replace function app.external_session_scope()
returns table (session_id uuid, workspace_id uuid, project_id uuid,
               grant_id uuid, occurrence_id uuid, may_decide boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.workspace_id, g.project_id, g.id, s.requirement_occurrence_id,
         g.decides_evidence
    from public.external_sessions s
    join public.external_access_grants g
      on g.workspace_id = s.workspace_id
     and g.id = s.external_access_grant_id
   where s.id = app.current_external_session()
     and s.status = 'active'
     and s.idle_expires_at > now()
     and s.absolute_expires_at > now()
     -- v0.1 has exactly one arc, and a session that somehow carried the other
     -- would resolve to NO scope rather than to a package one.
     and s.requirement_occurrence_id is not null
     and g.scope_kind = 'requirement_occurrence'
     and g.status = 'active'
     and g.expires_at > now()
     and g.revocation_version = s.grant_revocation_version
$$;
revoke all on function app.external_session_scope() from public, anon, authenticated;
grant execute on function app.external_session_scope() to aktflow_app;

create or replace function app.external_session_occurrence() returns uuid
language sql stable as $$ select occurrence_id from app.external_session_scope() $$;
create or replace function app.external_session_workspace() returns uuid
language sql stable as $$ select workspace_id from app.external_session_scope() $$;
create or replace function app.external_session_may_decide() returns boolean
language sql stable as $$
  select coalesce((select may_decide from app.external_session_scope()), false)
$$;
revoke all on function app.external_session_occurrence() from public, anon, authenticated;
revoke all on function app.external_session_workspace()  from public, anon, authenticated;
revoke all on function app.external_session_may_decide() from public, anon, authenticated;
grant execute on function app.external_session_occurrence() to aktflow_app;
grant execute on function app.external_session_workspace()  to aktflow_app;
grant execute on function app.external_session_may_decide() to aktflow_app;

-- ---------------------------------------------------------------------------
-- app.exchange_external_grant — the one bounded command with no subject
--
-- THE ONLY OPERATION IN THIS PRODUCT THAT RUNS WITH NEITHER AN ACTOR NOR A
-- SESSION, because at the moment it runs there is no session yet and there never
-- was an account. It cannot be a policy, so it is a SECURITY DEFINER function
-- that does the whole of INV-057 in one statement sequence under one row lock:
-- find the grant by its keyed verifier, refuse unless it is live and unconsumed,
-- mark it consumed, create exactly one session. `for update` plus the
-- `exchange_consumed_at is null` predicate is what makes ONE concurrent exchange
-- win; external_sessions_one_exchange_key is what makes a second one unstorable
-- even if this function were rewritten wrongly.
--
-- IT RETURNS NOTHING ABOUT WHY IT FAILED. Zero rows for a token that never
-- existed, a token that is revoked, a token that expired, a token already
-- exchanged, and a token for a workspace the caller invented — «never reveals
-- whether a recipient, package, occurrence, workspace, or grant exists»
-- (tenancy-and-security.md §"Fragment shell and exchange").
-- ---------------------------------------------------------------------------
create or replace function app.exchange_external_grant(
  p_hmac_key_id text,
  p_token_hmac bytea,
  p_verifier_key_id text,
  p_session_verifier bytea,
  p_csrf_verifier bytea,
  p_idle_seconds integer,
  p_absolute_seconds integer)
returns table (session_id uuid, workspace_id uuid, project_id uuid, grant_id uuid,
               occurrence_id uuid, may_decide boolean, token_hmac bytea,
               absolute_expires_at timestamptz, idle_expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  g record;
  s_id uuid;
  now_ts timestamptz := now();
  idle_at timestamptz;
  abs_at timestamptz;
begin
  if p_idle_seconds is null or p_idle_seconds <= 0
     or p_absolute_seconds is null or p_absolute_seconds <= 0
     or p_idle_seconds > p_absolute_seconds then
    raise exception 'external session TTLs are out of range';
  end if;

  select * into g
    from public.external_access_grants
   where hmac_key_id = p_hmac_key_id
     and token_hmac = p_token_hmac
   for update;

  if not found then return; end if;
  if g.status <> 'active' then return; end if;
  if g.expires_at <= now_ts then return; end if;
  if g.exchange_consumed_at is not null then return; end if;
  -- v0.1 exchanges only the occurrence arc. A package-scoped grant reaching this
  -- function in a v0.1 database is a row nothing could have written, and it is
  -- refused rather than half-handled.
  if g.scope_kind <> 'requirement_occurrence' then return; end if;

  idle_at := now_ts + make_interval(secs => p_idle_seconds);
  abs_at  := now_ts + make_interval(secs => p_absolute_seconds);

  update public.external_access_grants
     set exchange_consumed_at = now_ts, version = version + 1
   where id = g.id and exchange_consumed_at is null;
  if not found then return; end if;

  insert into public.external_sessions
    (workspace_id, external_access_grant_id, requirement_occurrence_id,
     session_verifier, csrf_verifier, verifier_key_id,
     idle_expires_at, absolute_expires_at, grant_revocation_version)
  values
    (g.workspace_id, g.id, g.requirement_occurrence_id,
     p_session_verifier, p_csrf_verifier, p_verifier_key_id,
     idle_at, abs_at, g.revocation_version)
  returning id into s_id;

  return query select s_id, g.workspace_id, g.project_id, g.id,
                      g.requirement_occurrence_id, g.decides_evidence, g.token_hmac,
                      abs_at, idle_at;
end $$;
revoke all on function app.exchange_external_grant(text, bytea, text, bytea, bytea, integer, integer)
  from public, anon, authenticated;
grant execute on function app.exchange_external_grant(text, bytea, text, bytea, bytea, integer, integer)
  to aktflow_app;

comment on function app.exchange_external_grant(text, bytea, text, bytea, bytea, integer, integer) is
  'INV-057. Single-use atomic exchange under a row lock; one concurrent winner; '
  'ZERO ROWS for every other outcome so the caller cannot tell a revoked grant '
  'from one that never existed. Returns token_hmac so the caller can perform the '
  'constant-time verifier comparison the protocol requires on top of the index '
  'probe that found the row. NEVER receives or returns the raw token (INV-044).';

-- ---------------------------------------------------------------------------
-- app.resolve_external_session — the cookie, before there is a session GUC
--
-- Also subject-less: the request arrives with an opaque cookie value and nothing
-- else, and the row it names cannot be found through a policy that keys off the
-- row it is trying to find. Bounded to one lookup by a 256-bit keyed verifier.
--
-- IT SLIDES THE IDLE WINDOW, which makes it volatile and makes it a write on a
-- GET path. That is session keep-alive and is NOT grant consumption: this
-- function never touches public.external_access_grants, and INV-010 is about the
-- grant. A GET that did not slide the window would give the reviewer a session
-- that expires thirty minutes after the exchange no matter how long they read.
-- ---------------------------------------------------------------------------
create or replace function app.resolve_external_session(
  p_verifier_key_id text, p_session_verifier bytea, p_idle_seconds integer)
returns table (session_id uuid, workspace_id uuid, project_id uuid, grant_id uuid,
               occurrence_id uuid, may_decide boolean, csrf_verifier bytea,
               session_verifier bytea, absolute_expires_at timestamptz,
               idle_expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  r record;
  now_ts timestamptz := now();
  new_idle timestamptz;
begin
  if p_idle_seconds is null or p_idle_seconds <= 0 then
    raise exception 'external session idle TTL is out of range';
  end if;

  select s.id, s.workspace_id, s.csrf_verifier, s.session_verifier,
         s.absolute_expires_at, s.requirement_occurrence_id,
         g.project_id, g.id as grant_id, g.decides_evidence
    into r
    from public.external_sessions s
    join public.external_access_grants g
      on g.workspace_id = s.workspace_id and g.id = s.external_access_grant_id
   where s.verifier_key_id = p_verifier_key_id
     and s.session_verifier = p_session_verifier
     and s.status = 'active'
     and s.idle_expires_at > now_ts
     and s.absolute_expires_at > now_ts
     and s.requirement_occurrence_id is not null
     and g.scope_kind = 'requirement_occurrence'
     and g.status = 'active'
     and g.expires_at > now_ts
     and g.revocation_version = s.grant_revocation_version;

  if not found then return; end if;

  new_idle := least(now_ts + make_interval(secs => p_idle_seconds), r.absolute_expires_at);
  update public.external_sessions
     set last_seen_at = now_ts, idle_expires_at = new_idle
   where id = r.id;

  return query select r.id, r.workspace_id, r.project_id, r.grant_id,
                      r.requirement_occurrence_id, r.decides_evidence,
                      r.csrf_verifier, r.session_verifier, r.absolute_expires_at, new_idle;
end $$;
revoke all on function app.resolve_external_session(text, bytea, integer)
  from public, anon, authenticated;
grant execute on function app.resolve_external_session(text, bytea, integer) to aktflow_app;

-- ===========================================================================
-- 8. Grants
--
-- Route by route, so an unused grant is visible:
--   external_access_grants     SELECT  the issuing member's own list; the
--                                      external session's own grant
--                              INSERT  occurrence_grants.issue,
--                                      external_grants.revoke_reissue (successor)
--                              UPDATE  external_grants.revoke_reissue
--                                      (status/revocation_version only — §9)
--   external_sessions          SELECT  the session resolver's own row; the
--                                      member's accountability read
--                              INSERT  session rotation on submit
--                              UPDATE  rotation and revocation
--   external_decision_batches  SELECT  the receipt, and the INV-007 replay read
--                              INSERT  external.occurrence_decision_submit
--
-- NO DELETE on any of the three: a grant that was issued was issued, a session
-- that existed existed, and a receipt is append_only_fact
-- (entity-catalog.csv:69). NO UPDATE on the batch for the same reason — §9's
-- trigger is the layer beyond this line.
-- ===========================================================================
revoke all on
    public.external_access_grants, public.external_sessions,
    public.external_decision_batches
  from public, anon, authenticated;

grant select, insert, update on public.external_access_grants    to aktflow_app;
grant select, insert, update on public.external_sessions         to aktflow_app;
grant select, insert         on public.external_decision_batches to aktflow_app;

-- ===========================================================================
-- 9. Append-only enforcement and the two guards
--
-- app.reject_mutation() is 0013:5-9, reused unchanged: it fires for the table
-- OWNER too, so a grant re-issued by a later migration that did not read this
-- one cannot rewrite a receipt.
-- ===========================================================================
create trigger external_decision_batches_immutable before update or delete
  on public.external_decision_batches
  for each row execute function app.reject_mutation();

-- A grant's identity, scope, verifier, recipient and permissions never move.
-- What moves is its state, its consumed marker (once), and its revocation
-- version (forward only).
create or replace function app.guard_external_grant() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'an external access grant is never deleted; revoke it — the record that a link existed is the accountability (INV-044)';
  end if;

  if (new.workspace_id, new.project_id, new.contract_id, new.scope_kind,
      new.requirement_occurrence_id, new.package_id, new.package_version_id,
      new.credential_type, new.token_hmac, new.hmac_key_id,
      new.recipient_email, new.recipient_contact_id, new.recipient_role,
      new.permissions, new.decide_role, new.decides_evidence,
      new.expires_at, new.review_epoch_at_issue,
      new.replaced_grant_id, new.issued_by_member_id, new.issued_at)
     is distinct from
     (old.workspace_id, old.project_id, old.contract_id, old.scope_kind,
      old.requirement_occurrence_id, old.package_id, old.package_version_id,
      old.credential_type, old.token_hmac, old.hmac_key_id,
      old.recipient_email, old.recipient_contact_id, old.recipient_role,
      old.permissions, old.decide_role, old.decides_evidence,
      old.expires_at, old.review_epoch_at_issue,
      old.replaced_grant_id, old.issued_by_member_id, old.issued_at) then
    raise exception
      'an external access grant''s scope, recipient, permissions, verifier and expiry are fixed at issue; reissue instead (INV-056/INV-074)';
  end if;

  -- INV-057: consumed once, and never un-consumed. A cleared marker would make
  -- a spent link live again.
  if old.exchange_consumed_at is not null
     and new.exchange_consumed_at is distinct from old.exchange_consumed_at then
    raise exception 'a consumed exchange marker is never cleared or moved (INV-057)';
  end if;

  -- Terminal states are terminal. ADR-005 defines no un-revoke.
  if old.status <> 'active' and new.status <> old.status then
    raise exception 'an external access grant leaves ''active'' once (% -> %)',
      old.status, new.status;
  end if;

  if new.revocation_version < old.revocation_version then
    raise exception 'a grant''s revocation version never goes backwards (% -> %)',
      old.revocation_version, new.revocation_version;
  end if;

  if new.version <> old.version + 1 then
    raise exception 'updating a grant must move its version exactly once (% -> %)',
      old.version, new.version;
  end if;

  return new;
end $$;
revoke all on function app.guard_external_grant() from public;
create trigger external_access_grants_guard before update or delete
  on public.external_access_grants
  for each row execute function app.guard_external_grant();

-- A session's identity, scope and secrets never move. Its status leaves 'active'
-- once, its idle window slides forward and never past its ceiling.
create or replace function app.guard_external_session() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'an external session is never deleted; it expires or is revoked — a decision names the session that took it';
  end if;

  if (new.workspace_id, new.external_access_grant_id, new.package_version_id,
      new.requirement_occurrence_id, new.session_verifier, new.csrf_verifier,
      new.verifier_key_id, new.created_at, new.absolute_expires_at,
      new.rotated_from_session_id, new.grant_revocation_version, new.review_epoch)
     is distinct from
     (old.workspace_id, old.external_access_grant_id, old.package_version_id,
      old.requirement_occurrence_id, old.session_verifier, old.csrf_verifier,
      old.verifier_key_id, old.created_at, old.absolute_expires_at,
      old.rotated_from_session_id, old.grant_revocation_version, old.review_epoch) then
    raise exception
      'an external session''s scope, secrets and absolute ceiling are fixed at exchange; rotate instead';
  end if;

  if old.status <> 'active' and new.status <> old.status then
    raise exception 'an external session leaves ''active'' once (% -> %)',
      old.status, new.status;
  end if;

  if new.idle_expires_at < old.idle_expires_at then
    raise exception 'an idle window slides forward, never backwards';
  end if;
  if new.last_seen_at < old.last_seen_at then
    raise exception 'last_seen_at never goes backwards';
  end if;

  return new;
end $$;
revoke all on function app.guard_external_session() from public;
create trigger external_sessions_guard before update or delete
  on public.external_sessions
  for each row execute function app.guard_external_session();

-- ===========================================================================
-- 10. RLS
--
-- TWO SUBJECTS, TWO FAMILIES, ONE TABLE AT A TIME.
--
-- The member family asks for `packages.submit` on writes and
-- `project.view`/`project.admin` on reads, following capabilities.csv:34 and the
-- 0045 §10 precedent: a member who is shown «this obligation is with the
-- технагляд» and cannot see the grant has been shown a status word.
--
-- The external family asks app.external_session_occurrence(), which is NULL for
-- every member request and for every expired, revoked or replaced session. A
-- policy comparing a column to NULL yields NULL, which is not TRUE, so every one
-- of these policies FAILS CLOSED with no branch to get wrong.
--
-- WHAT HAS NO EXTERNAL POLICY AND THEREFORE NO EXTERNAL ACCESS: work_items,
-- work_assignments, work_stages, stage_closures, projects, contracts,
-- contract_versions, valuation_allocations, progress_entries, statutory_acts and
-- everything else in this database. That is the ADR-005 decision 9 sentence
-- «an accepting evidence decision moves no money on its own» made structural —
-- the reviewer cannot see money, so the reviewer cannot decide about money.
-- ===========================================================================
alter table public.external_access_grants    enable row level security;
alter table public.external_sessions         enable row level security;
alter table public.external_decision_batches enable row level security;

-- ── external_access_grants ────────────────────────────────────────────────
create policy eag_select on public.external_access_grants for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin','packages.submit']));
create policy eag_insert on public.external_access_grants for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['packages.submit']));
-- The `using` clause names the state a revoke may act on, so a second revoke of
-- an already-revoked grant is refused by the policy as well as by §9's guard.
create policy eag_update on public.external_access_grants for update to aktflow_app
  using (status = 'active'
     and app.has_project_capability(workspace_id, project_id, array['packages.submit']))
  with check (app.has_project_capability(workspace_id, project_id,
              array['packages.submit']));
-- The external session sees ITS OWN grant and no other row of this table — not
-- a sibling grant on the same occurrence, not an earlier grant it replaced.
create policy eag_external_select on public.external_access_grants
  for select to aktflow_app
  using (id = (select grant_id from app.external_session_scope()));

-- ── external_sessions ─────────────────────────────────────────────────────
-- READ-ONLY for members: a session is the reviewer's, and a member's legitimate
-- interest in it is «did they open the link», which a read answers.
create policy es_select on public.external_sessions for select to aktflow_app
  using (app.has_project_capability(workspace_id,
         (select g.project_id from public.external_access_grants g
           where g.workspace_id = external_sessions.workspace_id
             and g.id = external_sessions.external_access_grant_id),
         array['project.view','project.admin','packages.submit']));
create policy es_external_select on public.external_sessions for select to aktflow_app
  using (id = app.current_external_session());
-- Rotation. The successor names the current session as its predecessor, and the
-- current session is the only row an external request may update. A session
-- cannot mint a sibling for another grant, because
-- external_sessions_grant_scope_fkey pins the scope and this policy pins the
-- lineage.
create policy es_external_rotate_insert on public.external_sessions
  for insert to aktflow_app
  with check (rotated_from_session_id = app.current_external_session()
              and requirement_occurrence_id = app.external_session_occurrence());
create policy es_external_rotate_update on public.external_sessions
  for update to aktflow_app
  using (id = app.current_external_session() and status = 'active')
  with check (id = app.current_external_session());
-- Revocation by the issuing member: revoke_reissue invalidates every session of
-- the grant it revokes, and the member plane is where that happens.
create policy es_member_revoke on public.external_sessions for update to aktflow_app
  using (status = 'active'
     and app.has_project_capability(workspace_id,
         (select g.project_id from public.external_access_grants g
           where g.workspace_id = external_sessions.workspace_id
             and g.id = external_sessions.external_access_grant_id),
         array['packages.submit']))
  with check (status = 'revoked');

-- ── external_decision_batches ─────────────────────────────────────────────
create policy edb_select on public.external_decision_batches for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin','packages.submit']));
create policy edb_external_select on public.external_decision_batches
  for select to aktflow_app
  using (external_session_id = app.current_external_session());
-- INV-031 at the policy layer, beside the foreign key at the storage layer and
-- the check in the command. Three layers, and the middle one is the only one a
-- future route cannot forget.
create policy edb_external_insert on public.external_decision_batches
  for insert to aktflow_app
  with check (external_session_id = app.current_external_session()
              and requirement_occurrence_id = app.external_session_occurrence()
              and app.external_session_may_decide());

-- ── the one occurrence, and the evidence linked to it ─────────────────────
-- tenancy-and-security.md §"RLS for the readiness-gate tables": «an
-- occurrence-scoped external session sees exactly one occurrence. The policy
-- resolves the grant's occurrence identity and nothing wider — not the
-- assignment, not sibling occurrences, not the work item's other stages.»
create policy ro_external_select on public.requirement_occurrences
  for select to aktflow_app
  using (id = app.external_session_occurrence());

-- «only the evidence objects linked to that one occurrence» (§"Storage RLS").
-- `available` and nothing else: staged content is not evidence, a scan-blocked
-- upload never becomes one, and an intent that is still in flight is not
-- something to decide about.
create policy ui_external_select on public.upload_intents for select to aktflow_app
  using (requirement_occurrence_id = app.external_session_occurrence()
         and status = 'available');
create policy eo_external_select on public.evidence_objects for select to aktflow_app
  using (exists (
    select 1 from public.upload_intents ui
     where ui.workspace_id = evidence_objects.workspace_id
       and ui.id = evidence_objects.upload_intent_id
       and ui.requirement_occurrence_id = app.external_session_occurrence()
       and ui.status = 'available'));

-- ── the decision, and the head that serialises it ─────────────────────────
-- The external decider reads the lineage it is about to append to — «no current
-- return on o» is a fact the reviewer's own screen shows — and appends exactly
-- one row naming its own session.
create policy red_external_select on public.requirement_evidence_decisions
  for select to aktflow_app
  using (requirement_occurrence_id = app.external_session_occurrence());
create policy red_external_insert on public.requirement_evidence_decisions
  for insert to aktflow_app
  with check (requirement_occurrence_id = app.external_session_occurrence()
              and external_session_id = app.current_external_session()
              and decided_by_member_id is null
              and app.external_session_may_decide());

create policy redh_external_select on public.requirement_evidence_decision_heads
  for select to aktflow_app
  using (requirement_occurrence_id = app.external_session_occurrence());
create policy redh_external_insert on public.requirement_evidence_decision_heads
  for insert to aktflow_app
  with check (requirement_occurrence_id = app.external_session_occurrence()
              and app.external_session_may_decide());
create policy redh_external_update on public.requirement_evidence_decision_heads
  for update to aktflow_app
  using (requirement_occurrence_id = app.external_session_occurrence()
         and app.external_session_may_decide())
  with check (requirement_occurrence_id = app.external_session_occurrence()
              and app.external_session_may_decide());

-- ── audit and outbox on a plane with no member ────────────────────────────
--
-- 0006:29-45 binds both INSERTs to an ACTIVE MEMBERSHIP of app.current_actor().
-- An external command has neither, so without these two policies every external
-- write would fail on its audit row — and «every command records audit» is not
-- negotiable. event-catalog.csv:38 names the row: `audit.external_command`,
-- «append-only audit row with grant/session identity», v0.1-M5.
--
-- Both are narrower than their member twins, not wider: the organization must be
-- the CURRENT SESSION'S workspace, so an external request cannot audit or
-- enqueue into any other tenant, and the audit row must declare itself external
-- and carry no user id. public.audit_events has no SELECT grant at all
-- (0006:29), so nothing here makes audit readable.
create policy audit_insert_external on public.audit_events for insert to aktflow_app
  with check (actor_type = 'external'
              and actor_user_id is null
              and organization_id = app.external_session_workspace());
create policy outbox_insert_external on public.transaction_outbox
  for insert to aktflow_app
  with check (organization_id is not null
              and organization_id = app.external_session_workspace());

-- ===========================================================================
-- 11. What this slice owes, recorded here rather than edited into the catalogs
--
-- A migration that edits prose is a migration nobody can review (0042:497-508,
-- 0043:1005-1038, 0047 §11). Ten items are owed and none is made here:
--
--   1. THE TWO TypeScript HALVES OF THE CAPABILITY VOCABULARY. §1 widens the
--      CHECK by `packages.submit`; `projectCapability`
--      (packages/contracts/src/project-access.ts) and `ProjectCapability`
--      (packages/domain/src/authz.ts) gain it in this same commit, or
--      packages/testing/src/capability-vocabulary.test.ts goes red and no grant
--      row carrying it can be written by a route.
--
--   2. responsibility-presets.csv NAMES `packages.submit` IN NO PRESET. Same
--      shape as M1 finding 8, M3 item 22 and M4 item 32 — the fourth time. No
--      persona can issue the link that is the whole of ADR-006 step 5, and every
--      M5 suite grants the capability by hand.
--
--   3. technical/rate-limits.csv HAS NO ROW FOR /external/exchange OR
--      /external/occurrence-decisions. Its only external rows (:6, :7) are
--      `externalShareOtp`, which is a v0.2 mechanism this milestone does not
--      build. tenancy-and-security.md §"Throttling and privacy" requires burst
--      and sustained limits, bounded failure counters and distributed-abuse
--      alerting on both endpoints. NONE OF IT IS BUILT, HERE OR ANYWHERE: this
--      product contains no rate limiter of any kind, for any surface. What
--      stands in its place is the token's own 256 bits, the single-use exchange
--      and the seven-day expiry — which bound the value of guessing but do not
--      bound the volume of trying. THIS IS THE LARGEST SECURITY GAP M5 LEAVES.
--
--   4. THE GRANT COUNTS NO FAILED LOOKUP, and cannot. An exchange attempt with a
--      wrong token matches no row, so there is no row on which to increment a
--      counter; a per-grant lockout is unimplementable against an attacker who
--      does not possess a grant. A real control is per-network and per-bucket
--      and belongs in the layer item 3 names.
--
--   5. technical/error-catalog.csv:28 `EXTERNAL_SHARE_INVALID` is the generic
--      invalid-link 404 and its log policy `no_existence_detail` is exactly
--      right; :66 `EXTERNAL_SHARE_LOCKED` (429) has NO PRODUCER in v0.1 because
--      item 3 is not built; :65 `EXTERNAL_OTP_REQUIRED` names an OTP step this
--      protocol does not have. The catalog is owed a statement that the last two
--      are v0.2, and a CSRF/origin-failure row — nothing in it describes «this
--      state-changing external request carried no synchronizer token», and
--      `VALIDATION_FAILED` is being borrowed for it.
--
--   6. technical/copy-catalog.csv CARRIES NO ROW FOR THE EXTERNAL SHELL. Every
--      Ukrainian string the reviewer reads — the confirmation sentence they
--      submit under, the «this is not an electronic signature» statement, the
--      invalid-link page — is product copy no reviewer has approved. The
--      assurance sentence is the one that matters, and it is transcribed from
--      docs/product/hidden-works-content-rules.md rather than composed.
--
--   7. technical/states/state-catalog.csv HAS NO MACHINE FOR
--      `external_access_grant.status`. It has one for `external_session.status`
--      (:67-69) and transitions for it (:69-70), and the four grant states —
--      active/revoked/expired/superseded — are named only by
--      schema-v0.1.sql:110. §9's guard makes them terminal; the catalog is owed
--      the machine.
--
--   8. NOTHING EXPIRES A GRANT OR A SESSION. Both `expired` values are reachable
--      only by a sweep, and this product has no scheduled principal
--      (tenancy-and-security.md Current risks item 3). Every expiry is therefore
--      enforced by COMPARISON at read time — in §7's two functions and in
--      app.external_session_scope() — and the stored status stays `active` on a
--      row that is expired in fact. That is safe, because nothing trusts the
--      column alone; it is also why `external_sessions_expiry_idx` exists,
--      pointing at the sweep that is owed.
--
--   9. THE PROVIDER SEND IS NOT BUILT. tenancy-and-security.md §"Grant creation"
--      requires the raw token to leave in one post-commit email-provider request
--      and never through the outbox. This repository has NO email provider: the
--      v0.0 invitation command returns its token in the 201 body and lets the
--      caller deliver it (apps/app/app/v1/workspaces/[workspaceId]/invitations/
--      route.ts:66). M5 follows that precedent, returns the link ONCE, and the
--      issuing member is the delivery mechanism. `delivery.protected_link_email`
--      (event-catalog.csv:42) has no producer, and INV-044's «one-time
--      post-commit send» is satisfied only in the sense that nothing is stored.
--
--  10. `external_decision_issues` and `external_decision_coverage` are v0.2 and
--      are NOT built (entity-catalog.csv:72-73). The v0.1 return carries free
--      text and the `issues` jsonb already on
--      public.requirement_evidence_decisions, which is where 0045 §4 put it.
-- ===========================================================================
