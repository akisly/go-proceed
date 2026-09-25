import { ImageOff } from "lucide-react";
import type { EvidenceObjectView } from "@goproceed/contracts";
import { captureTimeTrustLabel, originMethodLabel } from "../../lib/evidence-labels";
import { formatWorkspaceTime } from "../../lib/workspace-time";

/**
 * One evidence object — the unit ПТВ scans this whole screen to find. Four
 * facts sit beside the photo, the exact ones the task brief names as "the
 * facts ПТВ retypes into Word today": `serverReceivedAt`, `originMethod`,
 * `captureTimeTrust`, `contentHash`. Nothing else from `EvidenceObjectView`
 * is rendered (not `mediaType`, not `byteSize`) — the brief names these four
 * specifically, and adding more would be a guess this screen has no design
 * decision to back.
 *
 * `rounded-panel`, CORRECTED FROM `rounded-card`. The original reasoning here
 * was that `rounded-card` (14px) reads as a distinct, denser unit than the
 * section `Panel` (10px) it sits inside — and it cited, as support, that no
 * other `rounded-card` call site existed in `apps/app` or `apps/landing`. That
 * observation was true and it was the argument AGAINST: `docs/design/02-
 * building-ui.md` §3.3 question 1 is explicit that `radius-card`, `surface`,
 * `section` and `shadow-float` belong to `apps/landing`, which «is greenfield
 * and may use the marketing scale», and that «`apps/app` may use none of
 * those: it is dense, its type scale is the product scale, and nothing floats
 * off the page». A larger radius is exactly the softening that rule forbids
 * here. `rounded-panel` is what the eight other dash surfaces use, including
 * `packages/ui/src/components/Panel.tsx` itself, and the distinction between
 * this card and its containing panel is carried by `border border-line`, which
 * is how a border-led system is meant to carry it (§4.1: «Structure is
 * border-led»). Nothing in the gate catches a legal-but-wrong-surface role, so
 * this would have survived to become the precedent the next dashboard card
 * copied.
 *
 * NO `next/image`. `next/image` would either hit Supabase's paid image-
 * transformation add-on or need a custom loader that re-fetches the
 * signed URL server-side — both outside this task's scope, named rather
 * than solved (see `TODOS.md`'s "Surfaced by Plan D slice D1 task 6" entry).
 * A bare `<img>`, `loading="lazy"`, in the fixed-ratio container below is
 * the brief's own instruction.
 */

/**
 * `serverReceivedAt`, in the workspace's own zone (DEV-089, BL-034) — the one
 * `GET /v1/assignments/{assignmentId}/evidence` returns as
 * `workspaceTimezone`, threaded down from the page. It was a hard-coded
 * `Europe/Kyiv` until then: right while every workspace was in Kyiv, silently
 * wrong the day one was not.
 *
 * FIX ROUND 1, CRITICAL, KEPT ON RECORD: this used to call
 * `toLocaleString("uk-UA", { dateStyle, timeStyle })` with NO `timeZone` —
 * silently correct on a developer's own Kyiv machine and silently WRONG in
 * production, where Vercel's runtime clock is UTC. This file carries no
 * `"use client"`, so it formats on the SERVER, in the server process's zone;
 * a photo received at 09:30Z would have rendered as "09:30" instead of
 * "12:30", with nothing on screen to say a zone was involved. The zone is
 * now always named and always shown; `src/lib/workspace-time.ts` owns both,
 * and the fallback when the stored zone is not one the runtime knows.
 */
export function formatReceivedAt(iso: string, timeZone: string): string {
  return formatWorkspaceTime(iso, timeZone);
}

export function EvidenceCard({ item, timeZone }: { item: EvidenceObjectView; timeZone: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-panel border border-line bg-surface">
      {/* FIX ROUND 1: `aspect-[4/3]`, corrected from a fixed `h-56`
       * (14rem) height — and the PREVIOUS comment here, claiming
       * `aspect-square`/`aspect-[4/3]` "compile to nothing" because
       * `packages/ui/src/theme.generated.css` clears `--aspect-*: initial`,
       * was WRONG and is retracted, not merely replaced. `--aspect-*:
       * initial` was real then (the theme cleared it until 2026-09-24,
       * ADR-015), but the inference from it was not: `aspect-square`
       * is a STATIC utility (`aspect-ratio: 1`, no theme lookup) and
       * `aspect-[4/3]` is an ARBITRARY VALUE (the ratio comes from the
       * bracket, not a theme variable) — neither reads the cleared
       * namespace. Only a THEME-NAMED aspect utility (`aspect-video`, which
       * needs `--aspect-video`) would actually fail here. Proven two ways:
       * `aspect-[4/3]` was typechecked and rendered directly (no fallback to
       * the old height needed), and separately — this exact irony is worth
       * keeping on record — the WRONG former comment's own text
       * (`aspect-square`, `aspect-[4/3]`, spelled out as plain words for a
       * human reader) was enough for Tailwind's source-text scanner to lift
       * both class names out of the comment and compile them into the built
       * dash chunk anyway, disproving the claim from inside the same file
       * that made it.
       *
       * WHY A RATIO, NOT A HEIGHT: a fixed `h-56` kept every card's box the
       * same PIXEL height while its WIDTH tracked the grid's column count
       * (1/2/3 across this screen's own breakpoints), so the box's aspect
       * ratio — and therefore how hard `object-cover` crops a photo's
       * sides — silently changed with viewport width: closer to 16:9 (light
       * cropping) at the 3-column width, closer to 4:3 (heavier side
       * cropping) at the 1-column width. For an evidentiary photo viewer,
       * how much of "the photo" a reader sees should not depend on their
       * screen size. `aspect-[4/3]` fixes the ratio instead, so the crop is
       * the same proportion of the source image at every breakpoint — a
       * mild, deliberate choice for phone-camera photos that are not
       * reliably 16:9, not a workaround for a namespace that, corrected
       * above, was never actually blocking `aspect-video`'s siblings. */}
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden bg-subtle">
        {item.readUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- deliberate,
          // see the file header: a signed URL cannot go through next/image
          // without either the paid transformation add-on or a bespoke
          // server-side loader, and this task builds neither.
          <img
            src={item.readUrl}
            alt={item.originalFilename ?? "Фото доказу"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          // `readUrl` ABSENT MEANS THE OBJECT COULD NOT BE SIGNED — never a
          // broken `<img>`, never an empty box. The row still renders: a
          // missing photo is a fact ПТВ needs to see, not one to hide.
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ImageOff aria-hidden="true" strokeWidth={1.75} className="size-6 text-ink-muted" />
            <p className="text-meta text-ink-muted">Зображення тимчасово недоступне</p>
          </div>
        )}
      </div>
      <dl className="flex flex-col gap-2 p-3 text-meta">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-muted">Отримано сервером</dt>
          <dd className="tabular text-ink">{formatReceivedAt(item.serverReceivedAt, timeZone)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-muted">Спосіб фіксації</dt>
          <dd className="text-ink">{originMethodLabel(item.originMethod)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-muted">Довіра до часу</dt>
          {/* FIX ROUND 1: plain text, not a `Chip` — see `evidence-labels.
           * ts`'s header for why the earlier `<Chip tone="neutral">` was
           * wrong (it cited `Chip.tsx`'s own "not a status" line as support
           * for the very use that line argues against), and why plain text
           * is the same choice `originMethodLabel` already makes one row
           * above for the identical reason. */}
          <dd className="text-ink">{captureTimeTrustLabel(item.captureTimeTrust)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-ink-muted">Контрольна сума (SHA-256)</dt>
          {/* `break-all`, WITH `font-mono` (unlike the field client's own
           * `capture.tsx:355-360` [deleted 2026-09-23, DEV-035], which explicitly refuses `font-mono`
           * because `globals.css` clears `--font-*` there). The dash theme
           * does not: `packages/ui/src/theme.generated.css` re-adds
           * `--font-mono`, so it resolves under `/` — verified against
           * that file, not assumed from the field client's comment about a
           * different stylesheet. */}
          <dd className="break-all font-mono text-ink">{item.contentHash}</dd>
        </div>
      </dl>
    </div>
  );
}
