import { EmptyState } from "@goproceed/ui/components";

/**
 * `app/dash/projects/[projectId]/assignments/page.tsx` renders this when
 * `GET /v1/projects/{projectId}/assignments` returns none for a project that
 * does exist — the exact copy named in `task-5-brief.md`, catalogued as
 * `dash.empty.no_assignments_title` / `dash.empty.no_assignments`. Mirrors
 * `dash-shell/no-projects-empty-state.tsx`'s shape one level down: a project,
 * not a workspace, is what turned out to be empty — WITH ONE DELIBERATE
 * DIFFERENCE, below.
 *
 * `max-w-112`, NOT `max-w-md` — WHICH THE DASH THEME ITSELF DOES NOT EMIT.
 * Fix round 1 on this task's own commit caught this file copying
 * `no-projects-empty-state.tsx`'s `max-w-md` along with its shape:
 * `packages/ui/src/theme.generated.css:21` clears the whole default
 * container namespace (`--container-*: initial`) and defines exactly three
 * roles — `measure` (680px), `content` (1240px), `nav` (880px) — none of
 * which means "a short empty-state message".
 *
 * VERIFIED AGAINST THE REBUILT `apps/app/.next` OUTPUT, NOT INFERRED — and
 * stated as a METHOD rather than as chunk filenames, because the earlier
 * version of this paragraph named two (`25yajd-s762y3.css`,
 * `0_82hi0me6fh6.css`) and neither survives a rebuild: Next content-hashes CSS
 * chunk names, so a citation to one is stale the moment anything upstream of it
 * changes, and a reader who greps for it finds nothing and cannot tell whether
 * the claim or the filename went bad. To re-check it, run `pnpm --filter
 * @goproceed/app build`, read this route's own
 * `page_client-reference-manifest.js` for the CSS chunk it loads, and grep that
 * file. Three things hold there, re-confirmed in the final fix wave:
 *
 *   1. the dash-owned chunk contains no `.max-w-md` rule and no
 *      `--container-md` property at all — Tailwind emits NOTHING for a class
 *      whose theme namespace was cleared, rather than a declaration with an
 *      unresolvable variable behind it;
 *   2. the ONE chunk that does define `--container-md:28rem` and
 *      `.max-w-md{max-width:var(--container-md)}` is the same chunk
 *      `apps/app/app/(app)/page` (the field client's root route) loads, so it
 *      is the global `app/globals.css` chunk leaking onto dash pages through
 *      the shared root layout — the exact cross-stylesheet coupling
 *      `dash-theme.css`'s header declares out of scope, not something this
 *      route's own stylesheet provides;
 *   3. the dash chunk does contain `.max-w-112{max-width:calc(var(--spacing) *
 *      112)}` and its own `--spacing:.25rem`
 *      (`packages/ui/src/theme.generated.css:32` is the source — corrected from
 *      `:31`, which is the `@theme static {` line that opens the block).
 *
 * So `max-w-112` is the SPACING scale, computes to the same 28rem `max-w-md`
 * would have produced, and depends on nothing that leaks in from the field
 * client. Same substitution `sign-out-dialog.tsx` already made for its own
 * leaked `max-w-sm` (`max-w-96`), verified there the same way.
 *
 * NOT A GENERAL FIX. `no-projects-empty-state.tsx`, `no-workspace-empty-
 * state.tsx`, `shell-error.tsx` and `packages/ui/src/components/Dialog.tsx`'s
 * own default carry the identical gap and are deliberately left alone —
 * `TODOS.md`'s "Surfaced by Plan D slice D0" P2 entry already records all
 * four, and the real fix is a missing container ROLE in `packages/tokens/
 * src/tokens.json` (§3.3 question 2), not a fifth scattered substitution.
 */
export function NoAssignmentsEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-112 py-16"
      title="Немає доручень"
      description="У цьому проєкті ще немає доручень."
    />
  );
}
