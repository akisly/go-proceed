import { ImageOff } from "lucide-react";
import type { EvidenceObjectView } from "@goproceed/contracts";
import { Chip } from "@goproceed/ui/components";
import { captureTimeTrustLabel, originMethodLabel } from "../../lib/evidence-labels";

/**
 * One evidence object — the unit ПТВ scans this whole screen to find. Four
 * facts sit beside the photo, the exact ones the task brief names as "the
 * facts ПТВ retypes into Word today": `serverReceivedAt`, `originMethod`,
 * `captureTimeTrust`, `contentHash`. Nothing else from `EvidenceObjectView`
 * is rendered (not `mediaType`, not `byteSize`) — the brief names these four
 * specifically, and adding more would be a guess this screen has no design
 * decision to back.
 *
 * `rounded-card` (14px), NOT `rounded-panel` (10px) — a role `packages/ui`
 * already ships and nothing under `/dash` had used yet (verified: no other
 * `rounded-card` call site in `apps/app` or `apps/landing` before this file).
 * A photo card reads as a distinct, denser unit than the section `Panel` it
 * sits inside, which is exactly what the slightly larger radius signals.
 *
 * NO `next/image`. `next/image` would either hit Supabase's paid image-
 * transformation add-on or need a custom loader that re-fetches the
 * signed URL server-side — both outside this task's scope, named rather
 * than solved (see `TODOS.md`'s "Surfaced by Plan D slice D1 task 6" entry).
 * A bare `<img>`, `loading="lazy"`, in the FIXED-HEIGHT container below is
 * the brief's own instruction.
 */

/** Ukrainian date/time, matching the field client's own
 * `app/(app)/a/[assignmentId]/capture.tsx:50` `formatClaimed` — the same
 * one-line helper, not shared, because that file is the only OTHER call
 * site and the two apps' token systems already do not share components
 * (`dash-theme.css`'s own header). */
function formatReceivedAt(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

export function EvidenceCard({ item }: { item: EvidenceObjectView }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      {/* FIXED-SIZE CONTAINER, NOT `aspect-*` — `packages/ui/src/theme.
       * generated.css` clears `--aspect-*: initial` and defines no role back,
       * so `aspect-square`/`aspect-[4/3]` would compile to nothing here,
       * exactly the silent-failure trap `02-building-ui.md` §4.1 warns about
       * for every other cleared namespace. `h-56` (the spacing scale, 14rem)
       * is what actually resolves under the dash theme. */}
      <div className="h-56 w-full shrink-0 overflow-hidden bg-subtle">
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
          <dd className="tabular text-ink">{formatReceivedAt(item.serverReceivedAt)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-muted">Спосіб фіксації</dt>
          <dd className="text-ink">{originMethodLabel(item.originMethod)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-ink-muted">Довіра до часу</dt>
          <dd>
            <Chip tone="neutral">{captureTimeTrustLabel(item.captureTimeTrust)}</Chip>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-ink-muted">Контрольна сума (SHA-256)</dt>
          {/* `break-all`, WITH `font-mono` (unlike the field client's own
           * `capture.tsx:355-360`, which explicitly refuses `font-mono`
           * because `globals.css` clears `--font-*` there). The dash theme
           * does not: `packages/ui/src/theme.generated.css:46` re-adds
           * `--font-mono`, so it resolves under `/dash` — verified against
           * that file, not assumed from the field client's comment about a
           * different stylesheet. */}
          <dd className="break-all font-mono text-ink">{item.contentHash}</dd>
        </div>
      </dl>
    </div>
  );
}
