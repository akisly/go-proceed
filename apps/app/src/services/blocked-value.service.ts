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
 *     `select workspace_id from public.projects where id = $1`
 *     (`app/v1/projects/[projectId]/blocked-value/route.ts:68-70`) runs
 *     under RLS, and `projects_select` (`supabase/migrations/
 *     0011_workspace_access_security.sql:121-122`) admits only
 *     `array['project.view','project.admin']` — NOT `readiness.view`. A
 *     caller lacking both project.view and project.admin gets zero rows
 *     back, and the route's own `notFound` fires (route.ts:70, 404
 *     `RESOURCE_NOT_FOUND`, "Проєкт не знайдено.") before any capability
 *     check is even reached — the identical RLS-fires-before-the-check shape
 *     `assignments.service.ts`'s own header already documents for its
 *     sibling route.
 *
 *   `forbidden`  — the caller CAN see the project (so `/dash/projects/
 *     {projectId}/assignments` is reachable to them) but cannot see the
 *     MONEY. Unlike the assignments route, this one checks TWO capabilities
 *     (route.ts:74-75, `:102-103`), and the FIRST — `readiness.view`
 *     (route.ts:74-75) — is the one RLS does not already gate: a member
 *     holding `project.view` alone (granted, per this task brief, without
 *     `readiness.view` — `authz.ts:41-92`'s own header records that
 *     `readiness.view` is in no row of `responsibility-presets.csv`) passes
 *     the RLS-gated read at route.ts:70, passes `requireActiveMembership`,
 *     and THEN fails `requireProjectCapability(…, "readiness.view")` at
 *     `authz.ts:101` (403 `SCOPE_PROJECT_DENIED`, "Немає доступу до цього
 *     проєкту."). That branch IS reachable here — checked by reading both
 *     files together, not assumed — which is the opposite of `assignments.
 *     service.ts`'s own project.view-only 403 that its header proves
 *     unreachable through the identical RLS coupling. A member who can open
 *     the доручення register can therefore land on THIS screen and be
 *     refused, and the refusal needs its own legible state rather than
 *     falling through to `error`'s generic wording.
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
 * `app/(app)/a/[assignmentId]/page.tsx`'s own `problemDetail` for the
 * identical reason. `null` when the shape is not what `ApiError` promises,
 * so a caller always has a safe generic fallback to show instead.
 */
function problemDetail(error: ApiError): string | null {
  const body = error.problem;
  if (typeof body !== "object" || body === null || !("detail" in body)) return null;
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.length > 0 ? detail : null;
}
