import type { MeContextResponse } from "@goproceed/contracts";
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
    const meContext = await apiGet<MeContextResponse>("/v1/me/context");
    return { kind: "ok", meContext };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
