import { z } from "zod";

/**
 * The protected external link (v0.1-M5) — the step where a технагляд decides
 * without an account.
 *
 * SIX OPERATIONS, TWO PLANES:
 *
 *   member plane
 *     `occurrence_grants.issue`        POST /v1/occurrences/{occurrenceId}/grants
 *     `external_grants.revoke_reissue` POST /v1/grants/{grantId}/revoke-reissue
 *       (scope-v0.1.csv:53-54; commands, idempotency required, governed by
 *        `packages.submit` — capabilities.csv:34, whose name is package-shaped
 *        and whose operations are these two)
 *
 *   public / external plane
 *     `external.review_shell`               GET  /external/review     (HTML, no contract)
 *     `external.exchange`                   POST /external/exchange
 *     `external.occurrence_scope`           GET  /external/occurrence
 *     `external.occurrence_decision_submit` POST /external/occurrence-decisions
 *       (scope-v0.1.csv:55-58)
 *
 * ONE MODULE, because they are one protocol. Splitting the grant from the
 * session from the decision would put the same scope vocabulary in three files
 * that must agree, and the M1 review already recorded what happens then.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RAW TOKEN IS NOT A FIELD OF ANY REQUEST EXCEPT ONE, AND OF ANY RESPONSE
 * EXCEPT ONE.
 *
 * INV-044: it is generated, HMAC'd, stored as a verifier, and handed back to the
 * issuing member exactly once. It appears:
 *
 *   * in `IssueOccurrenceGrantResponse.link` and
 *     `RevokeReissueGrantResponse.link`, and NOWHERE in the body those two
 *     commands store in `public.idempotency_records` — see the routes, which
 *     attach `link` OUTSIDE the idempotent block on purpose. A replay of the
 *     same Idempotency-Key returns the same 201 WITHOUT a link, because the
 *     product genuinely cannot reconstruct it (tenancy-and-security.md
 *     §"Grant creation": «If the process crashes or the provider result is
 *     ambiguous, GoProceed cannot reconstruct or retry that token»);
 *   * in `ExternalExchangeRequest.token`, which travels in a POST body that the
 *     routes are required to keep out of logs, traces and error serialization.
 *
 * It is in no audit row, no outbox payload, no GET, no path and no query string.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT AN OCCURRENCE-SCOPED SESSION MAY SEE, AS A TYPE
 *
 * `ExternalOccurrenceScope` carries the obligation, the evidence linked to it,
 * and the decision lineage on it. It carries NO money, NO work item, NO
 * assignment, NO stage, NO project name and NO contract — not because the
 * serializer omits them but because migration 0049 §10 gives the external
 * session no policy on any of those tables, so the rows are unreachable. That
 * is ADR-005 decision 9's «an accepting evidence decision moves no money on its
 * own» and INV-075's first half, expressed as reachability rather than as
 * discipline.
 */

/* ── the permission object, which is a closed two-key vocabulary ───────────── */

/**
 * Both keys are capability ids from `technical/permissions/capabilities.csv` —
 * `external.view_scope` (:37) and `external.decide_evidence` (:39). Neither name
 * is invented here, and there is deliberately no third key:
 * `external.decide_commercial` (:38) is v0.2, v0.1 has no commercial decision to
 * submit, and a permission the product cannot honour must not be expressible.
 *
 * `external.view_scope` is `z.literal(true)`. A grant that confers no view is
 * not a grant, it is a row — and an "observer" in ADR-003's sense is a grant
 * that VIEWS and does not DECIDE, which is `decide_evidence: false`.
 * `external_access_grants_permissions_check` says the same in the database.
 */
export const externalGrantPermissions = z.object({
  "external.view_scope": z.literal(true),
  "external.decide_evidence": z.boolean(),
}).strict();
export type ExternalGrantPermissions = z.infer<typeof externalGrantPermissions>;

/** grant_status of `technical/database/schema-v0.1.sql:110`, as text. */
export type ExternalGrantStatus = "active" | "revoked" | "expired" | "superseded";

/**
 * v0.1's only assurance label (ADR-005 assumption d).
 * `docs/product/hidden-works-content-rules.md` §"Electronic-signature assurance
 * ladder" row 3 names the mechanism it stands for and states, in the same row,
 * «Explicitly not a signature».
 */
export const EXTERNAL_ASSURANCE_LABEL = "LINK_CONFIRMATION" as const;

/* ── occurrence_grants.issue ───────────────────────────────────────────────── */

/**
 * SEVEN DAYS IS THE CEILING AND THE DEFAULT (tenancy-and-security.md §"Grant
 * creation" item 7: «Expire the initial link after seven days or package
 * supersession, whichever occurs first»). An occurrence-scoped grant has no
 * package to be superseded by, so the timer and the revoke are the whole of its
 * expiry — plus one more the document adds for this arc alone: it expires «when
 * the occurrence's rule-version binding is replaced by a successor contract
 * version». That third condition HAS NO v0.1 CARRIER and is recorded as owed:
 * a published baseline is immutable in v0.1 and no command replaces a binding
 * on a published version, so there is no event to hang it on yet.
 */
export const issueOccurrenceGrantRequest = z.object({
  /**
   * The delivery address. Lower-cased here so the storage CHECK
   * (`recipient_email = lower(recipient_email)`) is met by the contract rather
   * than by every caller remembering.
   */
  recipientEmail: z.string().trim().min(3).max(320).email()
    .transform((v) => v.toLowerCase()),
  /**
   * The recipient's self-declared role. NOT identity proof and NOT authority
   * outside the pinned grant (tenancy-and-security.md §"Assurance wording").
   *
   * WHEN `external.decide_evidence` IS TRUE IT MUST EQUAL THE OCCURRENCE'S OWN
   * `approver_role`, and the command refuses otherwise — a refusal the database
   * also carries, through `external_access_grants_decide_role_fkey`. A deciding
   * grant issued in another role would produce a decision pinned into the
   * occurrence's role by `requirement_evidence_decisions_occurrence_fkey`: a
   * decision recorded in a role nobody was granted.
   */
  recipientRole: z.string().trim().min(1).max(200),
  /**
   * Optional and, in v0.1, unusable: `technical/openapi/scope-v0.1.csv` carries
   * no operation that writes `public.party_contacts`. The field is here because
   * the column is, and because the day a contact route lands the wire should not
   * have to change. Sending one that does not exist is a 404.
   */
  recipientContactId: z.string().guid().optional(),
  permissions: externalGrantPermissions,
  expiresInDays: z.number().int().min(1).max(7).default(7),
}).strict();
export type IssueOccurrenceGrantRequest = z.infer<typeof issueOccurrenceGrantRequest>;

/**
 * The one-time link. Present on a FIRST execution and ABSENT on an idempotent
 * replay, and the difference is not an oversight — it is INV-044. The routes
 * build this object after `withIdempotency` has returned, so the raw token never
 * enters `public.idempotency_records.response_body`.
 */
export interface ExternalLinkDelivery {
  /**
   * `https://<origin>/external/review#<raw-token>` — the token in the FRAGMENT,
   * never the path and never the query (INV-010). A browser does not send a
   * fragment to the server, so an email scanner, a link preview, a CDN fetch and
   * a health check all reach a shell that consumes nothing.
   */
  url: string;
  expiresAt: string;
  /**
   * `"caller"`, always, in v0.1. There is no email provider in this repository:
   * the v0.0 invitation command returns its token in the 201 body and lets the
   * caller deliver it, and this follows that precedent. Migration 0049 §11 item
   * 9 records the consequence — `delivery.protected_link_email`
   * (event-catalog.csv:42) has no producer, and the issuing member IS the
   * delivery mechanism.
   */
  deliveredBy: "caller";
}

export interface IssueOccurrenceGrantResponse {
  grantId: string;
  requirementOccurrenceId: string;
  /** Copied from the occurrence, never typed: the role the obligation names. */
  approverRole: string;
  recipientEmail: string;
  recipientRole: string;
  permissions: ExternalGrantPermissions;
  status: ExternalGrantStatus;
  expiresAt: string;
  revocationVersion: number;
  issuedAt: string;
  /** Absent on an idempotent replay. See `ExternalLinkDelivery`. */
  link?: ExternalLinkDelivery;
}

/* ── external_grants.revoke_reissue ────────────────────────────────────────── */

/**
 * ONE OPERATION, TWO OUTCOMES, AND THE FLAG IS NOT INVENTED SURFACE.
 *
 * `technical/openapi/scope-v0.1.csv:54` names the operation `revoke_reissue` and
 * `technical/events/event-catalog.csv:33` gives it the event `external_grant.revoked`
 * — the revoked half has its own event and therefore its own outcome. A link
 * sent to the wrong address must be killable without minting another one for the
 * same wrong address, and `grant_status` carries BOTH `revoked` and `superseded`
 * (schema-v0.1.sql:110) with no other producer for either. `reissue: false`
 * writes `revoked`; `reissue: true` writes `superseded` on the predecessor and
 * creates the successor that replaced it. It is required rather than defaulted,
 * because defaulting it would make one of the two outcomes the one nobody chose.
 */
export const revokeReissueGrantRequest = z.object({
  reissue: z.boolean(),
  /** Mandatory. A revoked link is a fact somebody has to be able to explain. */
  reason: z.string().trim().min(1).max(4000),
  /**
   * Reissue only. Omitted means «the same recipient and the same permissions»,
   * which is the ordinary case: the link expired or the mail bounced. Supplying
   * them re-targets, and re-targeting is exactly why the old grant and every
   * session it produced die in the same transaction.
   */
  recipientEmail: z.string().trim().min(3).max(320).email()
    .transform((v) => v.toLowerCase()).optional(),
  recipientRole: z.string().trim().min(1).max(200).optional(),
  permissions: externalGrantPermissions.optional(),
  expiresInDays: z.number().int().min(1).max(7).default(7),
  /**
   * The grant's expected `version`. A revoke that raced another revoke, or an
   * exchange, must not silently win: `VERSION_CONFLICT` and a re-read instead.
   */
  expectedVersion: z.number().int().min(1),
}).strict().refine(
  (v) => v.reissue || (v.recipientEmail === undefined && v.recipientRole === undefined
                       && v.permissions === undefined),
  { path: ["reissue"], message: "a revoke without a reissue re-targets nothing" },
);
export type RevokeReissueGrantRequest = z.infer<typeof revokeReissueGrantRequest>;

export interface RevokeReissueGrantResponse {
  revokedGrantId: string;
  /** `revoked` on a plain revoke, `superseded` when a successor replaced it. */
  revokedStatus: Extract<ExternalGrantStatus, "revoked" | "superseded">;
  revocationVersion: number;
  /**
   * Every session the revoked grant ever produced, now `revoked`. Reported as a
   * count and not as identities: a member's legitimate question is «is the old
   * link dead», and session ids are security telemetry.
   */
  sessionsRevoked: number;
  /** Null on a plain revoke. */
  reissuedGrantId: string | null;
  /** Absent on a plain revoke and on an idempotent replay. */
  link?: ExternalLinkDelivery;
}

/* ── external.exchange ─────────────────────────────────────────────────────── */

/**
 * 256 bits, base64url, unpadded — 43 characters. The pattern is asserted here so
 * a malformed value is a 422 that never reaches a database lookup, and so the
 * shape of the secret is stated once.
 *
 * THE ONLY REQUEST IN THIS PRODUCT WHOSE BODY MUST NOT BE LOGGED. The route
 * reads it, HMACs it, and drops it; nothing serializes it into a problem
 * document, an audit row or an outbox payload.
 */
export const externalExchangeRequest = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "malformed link"),
}).strict();
export type ExternalExchangeRequest = z.infer<typeof externalExchangeRequest>;

export interface ExternalExchangeResponse {
  /**
   * The synchronizer CSRF token, session-bound (INV-058). Returned in the BODY
   * and not in a cookie, because a cookie the page can read is not a CSRF
   * defense and a cookie it cannot read cannot be echoed. The session itself
   * travels in `__Host-goproceed_external`, which is HttpOnly.
   */
  csrfToken: string;
  /** 30 minutes idle, 12 hours absolute (tenancy-and-security.md §"External session cookie"). */
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  /** Whether this grant may decide, or only view (INV-031). */
  mayDecide: boolean;
}

/* ── external.occurrence_scope ─────────────────────────────────────────────── */

/**
 * INV-073's rendering half, in the shape M2 fixed for it: one object, so the
 * three fields cannot disagree. A normative string with no verification tag and
 * no source is unrepresentable here exactly as it is unstorable in
 * `requirement_occurrences_norm_ref_sourced_check`.
 */
export const externalNormRef = z.object({
  text: z.string().min(1),
  verification: z.enum(["VERIFIED_PRIMARY", "VERIFIED_SECONDARY"]),
  source: z.string().min(1),
}).strict();

/**
 * WHAT THE REVIEWER IS SHOWN ABOUT ONE PIECE OF EVIDENCE.
 *
 * No storage key, no bucket, no signed URL and no bytes. There is no operation
 * in `technical/openapi/scope-v0.1.csv` that streams an evidence original to an
 * external session, and one is not invented here — see the route, which records
 * this as the single largest functional gap M5 leaves: the acceptance walk says
 * the технагляд «reads the requirement in the standard's own wording WITH THE
 * PHOTO», and this milestone gives them the requirement, the photo's identity,
 * its content hash and its provenance, and not the photo.
 *
 * CORRECTED 2026-08-22 (Plan D slice D1, Task 4): the second sentence has
 * stopped being true. `external.evidence_bytes` — `GET /external/evidence`,
 * scope-v0.1.csv:61, governed by the same `external.view_scope` capability —
 * streams the original, and it is catalogued rather than invented.
 *
 * THE FIRST SENTENCE IS UNCHANGED AND IS THE POINT OF THIS SCHEMA. This object
 * still carries no storage key, no bucket, no signed URL and no bytes: the new
 * operation is addressed by `evidenceObjectId`, the field already here, so the
 * reviewer's page asks for bytes by naming a row it was already shown and never
 * by naming a location. A key in a response is a capability leak whether or not
 * an operation exists to spend it; adding a `readUrl` here would be that leak,
 * and the member plane's `evidenceObjectView` carries one only because its
 * plane's CSP permits a provider-hosted URL and this plane's does not.
 *
 * `claimedCaptureTime` and `originMethod` are CLIENT-SUPPLIED METADATA and are
 * labelled as such wherever they are displayed (tenancy-and-security.md
 * §"Capability evaluation": «nothing in the capture path may be trusted because
 * it claims a camera»). `serverReceivedAt` is the server's own observation and
 * is the only time on this object that is not a claim.
 */
export const externalEvidenceItem = z.object({
  evidenceObjectId: z.string().guid(),
  mediaType: z.string().min(1),
  byteSize: z.number().int().positive(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  originalFilename: z.string().nullable(),
  originMethod: z.string().min(1),
  captureTimeTrust: z.enum(["device_claimed", "server_estimated", "unknown"]),
  claimedCaptureTime: z.string().nullable(),
  serverReceivedAt: z.string(),
}).strict();

export const externalOccurrenceScopeResponse = z.object({
  occurrence: z.object({
    requirementOccurrenceId: z.string().guid(),
    ordinal: z.number().int().positive(),
    /** The closable unit's key. Not the stage row — the session cannot read it. */
    stageKey: z.string().min(1),
    stageIsConcealed: z.boolean().nullable(),
    interventionType: z.string().min(1),
    blockingScope: z.string().min(1),
    timing: z.string().min(1),
    evidenceKind: z.string().min(1),
    /** The standard's own wording, copied at materialisation and never live (INV-066). */
    acceptanceCriterion: z.string().min(1),
    performerRole: z.string().min(1),
    approverRole: z.string().min(1),
    minEvidenceCount: z.number().int().positive(),
    maxEvidenceCount: z.number().int().positive().nullable(),
    normRef: externalNormRef.nullable(),
  }).strict(),
  evidence: z.array(externalEvidenceItem),
  /**
   * The lineage the reviewer is about to append to, or `null` when nobody has
   * decided yet. `headVersion` is what a submit must echo, so a reviewer who
   * read a stale page cannot overwrite a decision taken since.
   */
  decision: z.object({
    headVersion: z.number().int().positive(),
    currentOutcome: z.enum(["accepted", "returned"]),
    decisionNo: z.number().int().positive(),
    decidedAt: z.string(),
    /** True when the current head is this session's own grant's decision. */
    byThisGrant: z.boolean(),
  }).strict().nullable(),
  permissions: z.object({
    /** INV-031. False for an observer, and the submit route refuses on it. */
    mayDecide: z.boolean(),
  }).strict(),
  /**
   * The assurance statement the reviewer must be shown BEFORE deciding, and the
   * one that is printed on the act afterwards. Both strings are the ones
   * `apps/app/src/lib/statutory-act-form.ts` already carries and
   * `apps/app/tests/act-content-fidelity.test.ts` already compares byte for byte
   * against the Approved content rules — imported, never re-transcribed. A
   * second copy of a mandated string is the defect that file exists to catch.
   */
  assurance: z.object({
    label: z.literal(EXTERNAL_ASSURANCE_LABEL),
    /** «Рівень підтвердження: {level}.», with the ladder's own level name. */
    levelStatement: z.string().min(1),
    /** «…Це не електронний підпис.» — level 3's mandated denial, verbatim. */
    notASignature: z.string().min(1),
  }).strict(),
  /** What the submit will be recorded against. Echoed by the submit response. */
  confirmationTextVersion: z.string().min(1),
  confirmationText: z.string().min(1),
  session: z.object({
    idleExpiresAt: z.string(),
    absoluteExpiresAt: z.string(),
  }).strict(),
}).strict();
export type ExternalOccurrenceScopeResponse = z.infer<typeof externalOccurrenceScopeResponse>;

/* ── external.occurrence_decision_submit ───────────────────────────────────── */

/**
 * The same two outcomes the member plane has, and the same rule that a return
 * must say why (`requirement_evidence_decisions_return_reason_check`,
 * migration 0045 §4). `state-catalog.csv:120` files the return reason as
 * `NOT_ENUMERATED` and forbids inventing a code vocabulary; the same applies
 * here, one plane over.
 *
 * NO `commercial_decision`, NO PRICE, NO QUANTITY, NO SCOPE SELECTION. There is
 * nothing on this request from which money could be derived — ADR-005 decision 9
 * and INV-075 — and the session could not see a priced row even if there were.
 */
export const submitExternalOccurrenceDecisionRequest = z.object({
  outcome: z.enum(["accepted", "returned"]),
  reason: z.string().trim().min(1).max(4000).optional(),
  issues: z.array(z.object({
    path: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
  }).strict()).max(50).default([]),
  /**
   * The head version the reviewer's page was rendered from, `null` for the root
   * case. Same discipline as the member plane's `expectedVersion`: a submit that
   * read nothing cannot append.
   */
  expectedVersion: z.number().int().min(1).nullable(),
  /**
   * Self-declared, LABELLED AS CLAIMS wherever displayed or exported, and never
   * identity proof (tenancy-and-security.md §"Assurance wording"). Three keys
   * and no more; `external_decision_batches.reviewer_claims`'s CHECK says the
   * same.
   */
  reviewerClaims: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    company: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  }).strict().default({}),
  /**
   * The version of the confirmation wording the reviewer was actually shown, as
   * returned by `external.occurrence_scope`. A submit under a version the server
   * is no longer serving is refused rather than recorded: a receipt that says
   * «they agreed» and cannot say to what is not a receipt.
   */
  confirmationTextVersion: z.string().trim().min(1).max(200),
}).strict().refine(
  (v) => v.outcome !== "returned" || (v.reason !== undefined && v.reason.length > 0),
  { path: ["reason"], message: "a return must say why" },
);
export type SubmitExternalOccurrenceDecisionRequest =
  z.infer<typeof submitExternalOccurrenceDecisionRequest>;

/**
 * THE RECEIPT (roadmap.md's M5 exit gate: «the reviewer receives an immutable
 * decision receipt»). `receiptId` and `receiptHash` name the
 * `public.external_decision_batches` row, which is append-only by
 * `external_decision_batches_immutable`; replaying the same idempotency key with
 * the same body returns this same object, and reusing it with a different body
 * is a conflict (INV-007).
 */
export interface SubmitExternalOccurrenceDecisionResponse {
  receiptId: string;
  receiptHash: string;
  decisionBatchId: string;
  decisionId: string;
  requirementOccurrenceId: string;
  approverRole: string;
  outcome: "accepted" | "returned";
  decisionNo: number;
  supersededDecisionId: string | null;
  headVersion: number;
  decidedAt: string;
  serverReceivedAt: string;
  confirmationTextVersion: string;
  assuranceLabel: typeof EXTERNAL_ASSURANCE_LABEL;
  /**
   * Whether the obligation is now satisfied. NOT whether anything closed and NOT
   * whether money moved: the closure is a member command that re-evaluates the
   * whole predicate under its own lock (INV-061), and after ADR-008 the money
   * moves at that closure and nowhere else. There is deliberately no
   * `stageCanClose` here — the member plane's decision response carries one, and
   * an external reviewer has no stage in view to be told about.
   */
  occurrenceSatisfied: boolean;
  /**
   * The rotated session's new synchronizer token. tenancy-and-security.md
   * §"External session cookie" requires the identifier to rotate «after
   * privilege/scope revalidation», and the submit is the one place in this
   * milestone where a privilege is revalidated and then used.
   *
   * ABSENT ON AN IDEMPOTENT REPLAY, because a replay rotates nothing and handing
   * back a token for a rotation that did not happen would break the caller's
   * next request. The `Set-Cookie` header is absent with it.
   */
  csrfToken?: string;
}
