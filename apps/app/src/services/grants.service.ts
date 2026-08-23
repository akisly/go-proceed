"use client";

import {
  issueOccurrenceGrantRequest,
  type ExternalLinkDelivery,
  type IssueOccurrenceGrantResponse,
} from "@goproceed/contracts";

/**
 * The grants domain's one service module — `occurrence_grants.issue`, called
 * from the browser, and the only place in the product that reaches
 * `POST /v1/occurrences/{occurrenceId}/grants`. Until this file existed that
 * route was reachable by curl and by nothing else, so the external review
 * plane — a shipped stream, a shipped shell, a shipped decision route — could
 * only be entered by an owner running a command by hand.
 *
 * A DISCRIMINATED RESULT AND NOT A THROW, for the reason
 * `workspaces.service.ts`'s header gives: the caller reads a `.kind` switch.
 *
 * ─── IT USES `fetch` DIRECTLY, NOT `src/lib/api.ts` ────────────────────────
 *
 * `apiGet` imports `next/headers`, which exists only on the server: it is the
 * shape a Server Component's read takes, and this is a browser POST driven by
 * a button. The precedent for the browser half is `src/lib/capture/upload.ts`
 * — the field client's own capture, which posts to `/v1/assignments/{id}/
 * upload-intents` with a same-origin `fetch` and an `Idempotency-Key`, and
 * relies on the browser attaching the Supabase session cookies itself. This
 * follows it call for call, including taking `fetchImpl` as an injected
 * parameter so `grants.service.test.ts` can drive every branch in plain Node
 * with no network and no DOM (`apps/app`'s vitest has neither jsdom nor a
 * DOM testing library, by that file's own deliberate choice).
 *
 * ─── THE REQUEST IS PARSED THROUGH THE CONTRACT BEFORE IT IS SENT ──────────
 *
 * `issueOccurrenceGrantRequest` is a zod schema (unlike
 * `IssueOccurrenceGrantResponse`, which is a plain interface with nothing to
 * parse against), and it carries a TRANSFORM this caller must not reimplement:
 * `recipientEmail` is lower-cased by the contract «so the storage CHECK
 * (`recipient_email = lower(recipient_email)`) is met by the contract rather
 * than by every caller remembering». Sending `parsed.data` rather than the
 * raw object is what makes that true here, and the same parse is what turns a
 * malformed address into a local refusal instead of a round trip that comes
 * back 422.
 *
 * ─── INV-044 IS A BRANCH OF THIS FUNCTION, NOT A CAVEAT IN A COMMENT ───────
 *
 * The route returns the link ONLY on a first execution: on an idempotent
 * replay the token is not in the stored response body, deliberately, because
 * putting it there would persist a raw bearer token in
 * `public.idempotency_records`. GoProceed therefore cannot reconstruct or
 * retry it, and the only recovery is an authorized revoke-and-reissue. So a
 * 201 with no `link` is a distinct outcome with a distinct answer, and it gets
 * its own arm (`issued_without_link`) rather than being folded into `error` —
 * the grant exists, the caller simply cannot be given its token, and the
 * screen must say precisely that.
 */

/** The shape this module needs from `fetch`. Real global `fetch` satisfies it, so does a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type IssueReviewLinkResult =
  /** First execution: the link exists and is being handed over for the only time. */
  | { kind: "ok"; link: ExternalLinkDelivery }
  /** 201 with no link — an idempotent replay. The grant is real; the token is gone (INV-044). */
  | { kind: "issued_without_link" }
  /** Refused before the network, by the contract itself. */
  | { kind: "invalid" }
  /** 401: the office session is gone. Every other in-flight request would fail the same way. */
  | { kind: "session_expired" }
  /** The server refused and said why, in Ukrainian, in `detail`. */
  | { kind: "refused"; detail: string }
  | { kind: "error"; error: unknown };

export type IssueReviewLinkInput = {
  occurrenceId: string;
  recipientEmail: string;
  recipientRole: string;
};

/**
 * `external.view_scope` alone, and `external.decide_evidence: false`.
 *
 * THIS SCREEN CANNOT ISSUE A DECIDING GRANT, and the reason is a refusal the
 * route owns rather than a preference: a deciding grant must name the
 * occurrence's own `approver_role` (`grants/route.ts` refusal 1, backed by
 * `external_access_grants_decide_role_fkey`), and this screen's only
 * interface — `assignmentEvidenceResponse` — carries the occurrence's id and
 * nothing else. It does not know the approver role, so it cannot name it, and
 * a form that asked ПТВ to type it would be a form whose correct answer is a
 * string they cannot see. The second refusal compounds it: a deciding grant
 * also requires `approver_is_external`, which this screen equally cannot read.
 *
 * What that costs, stated on the screen and not only here: the reviewer sees
 * the obligation and its photos and cannot record acceptance from the link.
 * The deciding path is the external decision arc, which has its own routes
 * (`/external/occurrence-decisions`) and is not this slice's.
 */
const VIEW_ONLY_PERMISSIONS = {
  "external.view_scope": true,
  "external.decide_evidence": false,
} as const;

/**
 * A FRESH KEY PER CALL, WHICH IS THE OPPOSITE OF A REPLAY — CORRECTED IN FIX
 * ROUND 1, BECAUSE THE SENTENCE THAT STOOD HERE SAID THE REVERSE OF WHAT THIS
 * FUNCTION DOES.
 *
 * It claimed this was «the same rule `capture/upload.ts`'s `attemptKey` states:
 * a retry after a network failure must REPLAY rather than issue a second
 * grant», and then said in the same paragraph that the key is minted per call
 * so two presses issue two grants. Both halves cannot be true. The cited
 * precedent states it correctly — its own header says «A fresh key per call
 * attempt — NOT per photo» — and what makes a retry replay there is REUSING a
 * key, not minting one.
 *
 * WHAT THIS ACTUALLY DOES: every call to `issueReviewLink` carries a NEW
 * Idempotency-Key, so nothing this module does can ever replay. Two presses
 * issue two grants, which is the correct reading of two deliberate presses and
 * is what the route's own duplicate-recipient refusal (409, deciding grants
 * only) exists to bound.
 *
 * WHY THAT MATTERS TO THE NEXT EDITOR, which is the whole reason this
 * correction is not cosmetic: someone adding an automatic retry to
 * `issueReviewLink`'s `catch` arm would have read the old sentence as a promise
 * that the retry replays, and shipped a duplicate grant on every transient
 * network failure — a second live link, to the same address, that nobody
 * intended and that the recipient cannot tell from the first. A retry that must
 * replay has to carry the SAME key across attempts, which means lifting the key
 * out of this function and into the caller's attempt state. That is a change,
 * not a refactor.
 *
 * CONSEQUENCE, STATED RATHER THAN LEFT IMPLIED: because the key is always
 * fresh, `issued_without_link` is UNREACHABLE from this caller. That branch is
 * defensive — it exists because the route's contract genuinely has it, and
 * because the alternative to handling it is `body.link!` rendering `undefined`
 * as a link and telling a person to copy it — but nothing here can produce it
 * today, and `grants.service.test.ts` reaches it only by handing this function
 * a fake `fetch` that returns a token-free 201.
 */
function attemptKey(): string {
  return crypto.randomUUID();
}

async function detailOf(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.length > 0) return detail;
    }
  } catch {
    // Not JSON — the caller falls back to its own generic message.
  }
  return null;
}

export async function issueReviewLink(
  input: IssueReviewLinkInput,
  fetchImpl: FetchLike = fetch,
): Promise<IssueReviewLinkResult> {
  const parsed = issueOccurrenceGrantRequest.safeParse({
    recipientEmail: input.recipientEmail,
    recipientRole: input.recipientRole,
    permissions: VIEW_ONLY_PERMISSIONS,
    expiresInDays: 7,
  });
  if (!parsed.success) return { kind: "invalid" };

  let res: Response;
  try {
    res = await fetchImpl(`/v1/occurrences/${input.occurrenceId}/grants`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": attemptKey() },
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return { kind: "error", error };
  }

  if (res.status === 401) return { kind: "session_expired" };
  if (!res.ok) {
    const detail = await detailOf(res);
    return detail === null ? { kind: "error", error: res.status } : { kind: "refused", detail };
  }

  let body: IssueOccurrenceGrantResponse;
  try {
    body = await res.json() as IssueOccurrenceGrantResponse;
  } catch (error) {
    return { kind: "error", error };
  }

  // NARROWED, NOT CAST. `IssueOccurrenceGrantResponse` is a plain TypeScript
  // interface — `apiGet`'s `<T>` problem, and the reason
  // `listAssignments`/`listProjects` stay cast-only: there is no schema to
  // parse against. What this screen is about to render to a person, once,
  // with no way to get it back, is `link.url`; so the one field that must be
  // a non-empty string is checked to be one, and a response that carries a
  // `link` without a usable `url` is treated as the no-link case rather than
  // rendered as an empty line the reader would copy.
  const link = body.link;
  if (!link || typeof link.url !== "string" || link.url.length === 0) {
    return { kind: "issued_without_link" };
  }
  return { kind: "ok", link };
}
