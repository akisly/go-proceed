import { blockedValueResponse, type BlockedValueResponse } from "@goproceed/contracts";
import { apiGet, ApiError, isSessionExpired } from "../lib/api";

/**
 * The blocked-money domain's one service module — see `workspaces.service.
 * ts`'s header for why this returns a discriminated result rather than
 * throwing.
 *
 * PARSED THROUGH `blockedValueResponse`, NOT JUST CAST — same reasoning
 * `evidence.service.ts` gives for `assignmentEvidenceResponse`: `apiGet`'s
 * `<T>` is a compile-time assertion only, and `blockedValueResponse` IS a
 * zod schema whose own `superRefine` re-checks the reconciliation identities
 * on THIS side of the wire too (`packages/contracts/src/blocked-value.ts`) —
 * a response a proxy or a stale cache mangled in transit fails here rather
 * than rendering a headline number nobody re-verified.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FOUR OUTCOMES, NOT TWO — because this route's refusal shape is genuinely
 * different from every other service in this directory, and folding it into
 * one `"error"` arm (`assignments.service.ts`, `projects.service.ts`'s own
 * pattern) would hide the one thing the task brief asked to be established
 * rather than assumed:
 *
 *   `not_found`  — the caller cannot see the PROJECT at all. The route's own
 *     `select workspace_id from public.projects where id = $1` (the same
 *     query the local `notFound` guards, `app/v1/projects/[projectId]/
 *     blocked-value/route.ts`) runs under RLS, and `projects_select`
 *     (`supabase/migrations/0011_workspace_access_security.sql`, the
 *     `create policy projects_select` block) admits only
 *     `array['project.view','project.admin']` — NOT `readiness.view`. A
 *     caller lacking both project.view and project.admin gets zero rows
 *     back, and the route's own `notFound` const fires (404
 *     `RESOURCE_NOT_FOUND`, "Проєкт не знайдено.") before any capability
 *     check is even reached — the identical RLS-fires-before-the-check shape
 *     `assignments.service.ts`'s own header already documents for its
 *     sibling route.
 *
 *   `forbidden`  — the caller CAN see the project (so `/projects/
 *     {projectId}/assignments` is reachable to them) but cannot see the
 *     MONEY. Unlike the assignments route, this one calls
 *     `requireProjectCapability` TWICE — once for `readiness.view`, once for
 *     `project.view` — and the FIRST of the two, `readiness.view`, is the
 *     one RLS does not already gate.
 *
 *     CORRECTED IN FIX ROUND 1: this used to say `readiness.view` "is in no
 *     row of `responsibility-presets.csv`", copied from `authz.ts`'s own
 *     comment ABOVE `IMPLIED_BY_PROJECT_ADMIN` without independently
 *     re-checking the CSV that comment names — and that comment is itself
 *     dated 2026-08-08 (M3 pre-landing
 *     review finding 5) and superseded by corrections the CSV records under
 *     2026-08-17, which `authz.ts` was never updated to mention. Read
 *     directly: `technical/permissions/responsibility-presets.csv` DOES
 *     grant `readiness.view` to two presets today — `pto_engineer` (line 13)
 *     and `commercial_manager` (line 15), both by a 2026-08-17 correction,
 *     and line 15's own text says the capability was withheld while the
 *     preset's description already pointed the commercial lead at this exact
 *     screen. So "granted without readiness.view" is not the general case —
 *     it is not true of the two presets built for the money-reading
 *     personas.
 *
 *     THE REAL REACHABILITY CONDITION IS NARROWER: four OTHER presets grant
 *     `project.view` WITHOUT `readiness.view` —
 *     `requirement_owner` (line 6), `internal_verifier` (line 8),
 *     `package_submitter` (line 9) and `foreman` (line 12). A member holding
 *     one of those four can open `/projects/{projectId}/assignments`
 *     and then land on THIS screen's 403: the RLS-gated read at the route's
 *     own `notFound` guard passes (it only checks `project.view`/`project.
 *     admin`), `requireActiveMembership` passes, and `requireProjectCapability
 *     (…, "readiness.view")` then throws its own `SCOPE_PROJECT_DENIED`
 *     (403, "Немає доступу до цього проєкту.") — a citation to WHERE inside
 *     `requireProjectCapability` that throw sits is deliberately not repeated
 *     here: fix round 1 cited `authz.ts:101`, and this file's own edit in
 *     that same round moved it to `authz.ts:115` before the round even
 *     closed — the third such rot on this work. The function name is the
 *     part that survives an edit; `authz.ts` has exactly one
 *     `SCOPE_PROJECT_DENIED` throw and it is inside `requireProjectCapability`,
 *     which is enough to re-find it. That branch
 *     IS reachable — checked by reading the route, `authz.ts` and the CSV
 *     together, not assumed — which is the opposite of `assignments.
 *     service.ts`'s own project.view-only 403 that its header proves
 *     unreachable through the identical RLS coupling. The refusal needs its
 *     own legible state rather than falling through to `error`'s generic
 *     wording, for a real persona this product already names.
 *
 *   `session_expired` — unchanged from every sibling service.
 *
 *   `error` — anything else (a 500, a network failure, a schema mismatch).
 */
export type BlockedValueResult =
  | { kind: "ok"; blockedValue: BlockedValueResponse }
  | { kind: "session_expired" }
  | { kind: "forbidden"; detail: string | null }
  | { kind: "not_found" }
  | { kind: "error"; error: unknown };

export async function getBlockedValue(projectId: string): Promise<BlockedValueResult> {
  try {
    const body = await apiGet<unknown>(`/v1/projects/${projectId}/blocked-value`);
    const blockedValue = blockedValueResponse.parse(body);
    return { kind: "ok", blockedValue };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    if (error instanceof ApiError && error.status === 404) return { kind: "not_found" };
    if (error instanceof ApiError && error.status === 403) {
      return { kind: "forbidden", detail: problemDetail(error) };
    }
    return { kind: "error", error };
  }
}

/**
 * Surfaces the route's own Ukrainian `detail` rather than a second,
 * hand-written translation of the same refusal — the server already
 * localizes `ProblemJson.detail` (`src/lib/http.ts`'s `problem()`), matching
 * `app/(app)/a/[assignmentId]/page.tsx`'s [deleted 2026-09-23, DEV-035] own `problemDetail` for the
 * identical reason. `null` when the shape is not what `ApiError` promises,
 * so a caller always has a safe generic fallback to show instead.
 */
function problemDetail(error: ApiError): string | null {
  const body = error.problem;
  if (typeof body !== "object" || body === null || !("detail" in body)) return null;
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.length > 0 ? detail : null;
}
