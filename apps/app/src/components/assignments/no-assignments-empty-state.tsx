import Link from "next/link";
import { Button, EmptyState } from "@goproceed/ui/components";

/**
 * `app/dash/projects/[projectId]/assignments/page.tsx` renders this when
 * `GET /v1/projects/{projectId}/assignments` returns none for a project that
 * does exist — the exact copy named in `task-5-brief.md`, catalogued as
 * `dash.empty.no_assignments_title` / `dash.empty.no_assignments`. Mirrors
 * `dash-shell/no-projects-empty-state.tsx`'s shape one level down: a project,
 * not a workspace, is what turned out to be empty — WITH TWO DELIBERATE
 * DIFFERENCES, both below.
 *
 * IT CARRIES AN ACTION, AND UNTIL THE FINAL FIX WAVE IT DID NOT — the change
 * that makes the FIRST доручення in a project creatable through the UI at all.
 *
 * `assignments/page.tsx` returns this component when the register is empty,
 * BEFORE it renders `AssignmentsList` — and `assignments-list.tsx` held the
 * only navigational entry point to `/assignments/new` in the entire app. So
 * the create link existed only once at least one assignment already existed.
 * An owner standing up a fresh pilot published a baseline, opened Доручення,
 * read «Немає доручень», and had no way to create one short of typing the URL:
 * the exact opposite of what this branch's own ADR-009 amendment commits to —
 * «a person holding only a browser and an email address creates … one
 * assignment, with no curl, no psql and no SQL».
 *
 * THE ARGUMENT AGAINST AN ACTION HERE WAS REAL AND IS NOW STALE.
 * `no-baseline-empty-state.tsx`'s header described this component's shape as
 * «name the condition, no dead-end action invented for it», which was true
 * before this branch: `/assignments/new` did not exist, so any control offered
 * here would have led nowhere. It exists now, it is a real screen, and it has
 * its own honest empty state for the case where the project has no published
 * baseline yet — so the action leads to an answer either way, never to a dead
 * end. `EmptyState`'s own header states the rule this satisfies: name the
 * condition AND the next act.
 *
 * THE CONTROL IS THE REGISTER'S OWN, not a second one. Same label, same
 * destination, same `Button asChild`+`Link` shape as `assignments-list.tsx`
 * renders above the table — a real anchor that merely looks like a button, and
 * the 44px touch floor arrives with `Button`'s own `touch` variant rather than
 * from a size prop here. Two different controls for one act on two states of
 * one screen is how a product starts disagreeing with itself.
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
 *      the shared root layout — until 2026-09-05, a dedicated
 *      `app/dash/dash-theme.css` imported the real system for `/dash/**` only,
 *      and its header declared such cross-stylesheet coupling out of scope;
 *      that file was deleted in the migration to a single entry point, but the
 *      coupling it warned against remains here in this comment's own logic;
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
export function NoAssignmentsEmptyState({ projectId }: { projectId: string }) {
  return (
    <EmptyState
      className="mx-auto max-w-112 py-16"
      title="Немає доручень"
      description="У цьому проєкті ще немає доручень."
      action={(
        <Button asChild>
          <Link href={`/dash/projects/${projectId}/assignments/new`}>Нове доручення</Link>
        </Button>
      )}
    />
  );
}
