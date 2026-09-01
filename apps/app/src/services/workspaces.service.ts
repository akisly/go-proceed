import {
  meContextResponse, type MeContextResponse, type MemberRow, type MembersListResponse,
} from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";

/**
 * The workspaces domain's one service module, over `src/lib/api.ts` — a
 * route or a component never calls `apiGet` directly (plan D's hierarchy
 * convention, `docs/design/03-ui-references.md` §"The hierarchy").
 *
 * A DISCRIMINATED RESULT, NOT A THROW: `apiGet` throws `ApiError` on a
 * non-2xx response, which is the right shape for a leaf route to catch
 * directly (`app/(app)/page.tsx`'s own pattern) but the wrong shape to hand a
 * THIN route file — a route that "wires params, calls a service, and renders
 * a component" reads a `.kind` switch, not a try/catch around someone else's
 * exception type. `session_expired` is called out on its own arm (rather
 * than folded into `error`) because it is the one outcome every caller of
 * this service must treat identically: redirect to `/login`, never render.
 */
export type MeContextResult =
  | { kind: "ok"; meContext: MeContextResponse }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

export async function getMeContext(): Promise<MeContextResult> {
  try {
    // `meContextResponse` is an exported zod schema (the route itself parses
    // outbound rows through it before responding — see
    // `apps/app/app/v1/me/context/route.ts`), so this client-side call
    // PARSES the response through the same schema rather than trusting
    // `apiGet`'s `<T>` type parameter, which is a compile-time cast only and
    // asserts nothing at runtime about what the network actually returned.
    const body = await apiGet<unknown>("/v1/me/context");
    const meContext = meContextResponse.parse(body);
    return { kind: "ok", meContext };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}

export type MembersResult =
  | { kind: "ok"; members: MemberRow[] }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

/**
 * The workspace's members — the assignee picker's source. Members are read
 * per WORKSPACE while a project route only has a PROJECT id; the caller joins
 * this against `listProjects()`'s `workspaceId` column first.
 *
 * NO NAME AND NO EMAIL, and that is the route's shape rather than an omission
 * here: `GET /v1/workspaces/{workspaceId}/members`
 * (`app/v1/workspaces/[workspaceId]/members/route.ts`) selects
 * `id, user_id, role, status` and nothing else. Every screen that shows a
 * person therefore shows a role and an id fragment until slice D4 settles
 * what identity to display — see the spec's §5.
 *
 * `MemberRow`/`MembersListResponse` come from `@goproceed/contracts` rather
 * than a local redeclaration — same reasoning `projects.service.ts` gives for
 * importing `ProjectListRow` instead of inventing a second copy of a shape
 * the contracts package already owns.
 */
export async function listMembers(workspaceId: string): Promise<MembersResult> {
  try {
    const { members } = await apiGet<MembersListResponse>(
      `/v1/workspaces/${workspaceId}/members`,
    );
    return { kind: "ok", members };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
