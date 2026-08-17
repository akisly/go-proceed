import Link from "next/link";
import { redirect } from "next/navigation";
import type { ListRequirementOccurrencesResponse } from "@goproceed/contracts";

import { apiGet, ApiError } from "../../../../src/lib/api";
import { buildObligationScreen, type ObligationItem } from "../../../../src/lib/field/obligations";
import { Button } from "../../../../src/ui/button";
import { CaptureIsland } from "./capture";

/**
 * THE OBLIGATION SCREEN — ADR-007 decision 4, both obligations now present:
 * what must be photographed, in the standard's own wording, BEFORE work
 * starts (this file), and the capture control that takes the photo (task 9's
 * `CaptureIsland`, rendered inside `ObligationCard` below).
 *
 * ALL THE DECISIONS LIVE IN `buildObligationScreen`
 * (`src/lib/field/obligations.ts`), tested there with no DOM (see that
 * file's test suite). This component fetches, hands the response to that
 * function unmodified, and renders exactly what comes back — it makes no
 * decision of its own about order, wording, or what an empty list means.
 *
 * GOES THROUGH `/v1`, NOT AROUND IT — same reasoning as `apiGet`'s own
 * header comment and as `app/(app)/page.tsx`: the route re-checks membership
 * and `project.view` on every call, so this page and a future native client
 * are authorised by the same code.
 */

type ObligationPageProps = {
  // Next 16 hands a dynamic segment in as a Promise — see app/(auth)/login/page.tsx's
  // comment on the same pattern for `searchParams`.
  params: Promise<{ assignmentId: string }>;
};

export default async function ObligationPage({ params }: ObligationPageProps) {
  const { assignmentId } = await params;

  let response: ListRequirementOccurrencesResponse;
  try {
    response = await apiGet<ListRequirementOccurrencesResponse>(
      `/v1/assignments/${assignmentId}/requirement-occurrences`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent(`/a/${assignmentId}`)}`);
    }
    return <ErrorState detail={problemDetail(err)} />;
  }

  const screen = buildObligationScreen(response);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        {/*
         * Kept as a real Button (not a bare <Link>) so the back-navigation
         * target still meets the 44px touch floor below `md` — the audience
         * for this screen is a foreman on a phone, often gloved, not a mouse
         * user for whom a small text link is enough.
         */}
        <Button asChild variant="link" size="sm" className="self-start px-0 text-data">
          <Link href="/">← Мої доручення</Link>
        </Button>
        <h1 className="text-h1 font-display font-semibold text-foreground">
          Обов&#39;язкові фіксації
        </h1>
      </div>

      {/*
       * THE COVERAGE MESSAGE — shown unconditionally, for every one of the
       * four `coverage` values, `covered` included. Three of the four are
       * refusals with a named remedy; an empty `items` list below must never
       * be read on its own as "nothing is required here" (context item 5),
       * and this sentence is what stops that misreading.
       */}
      <p className="text-body text-foreground-secondary">{screen.coverageMessage}</p>

      {screen.items.length > 0 && (
        <ol className="flex flex-col gap-4">
          {screen.items.map((item, index) => (
            <ObligationCard
              key={item.occurrenceId} item={item} index={index} assignmentId={assignmentId}
            />
          ))}
        </ol>
      )}

      {/*
       * THE ДОВІДКОВИЙ DISCLAIMER — MANDATORY, NEVER COLLAPSED
       * (hidden-works-content-rules.md §"Required disclaimers"). Plain text,
       * always visible: no `<details>`, no accordion, no scroll container, no
       * `overflow:hidden` that could clip it. `screen.disclaimer` is
       * `DOVIDKOVYI_DISCLAIMER_TEXT`, imported (not typed) inside
       * `buildObligationScreen` and proven byte-identical to it in
       * `obligations.test.ts` — this component never composes the string
       * itself, so there is no second copy that could drift from the source.
       * Rendered for EVERY `coverage` value, including the three refusals
       * above (`screen.disclaimer` is assigned unconditionally, not per
       * branch).
       */}
      <p className="border-t border-border pt-4 text-data text-foreground-secondary">
        {screen.disclaimer}
      </p>
    </main>
  );
}

function ObligationCard(
  { item, index, assignmentId }: { item: ObligationItem; index: number; assignmentId: string },
) {
  return (
    <li className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
      <span className="text-meta font-medium uppercase tracking-wide text-foreground-muted">
        {index + 1}. {item.timingLabel}
      </span>

      {/*
       * VERBATIM. The ДБН standard's own Ukrainian, copied at rule-version
       * publication (INV-073). No trim, no normalize, no smart-quote fix, no
       * truncation — `acceptanceCriterion` is rendered exactly as
       * `buildObligationScreen` returned it.
       */}
      <p className="text-body text-foreground">{item.acceptanceCriterion}</p>

      {item.normRef && (
        // Text, verification tag and source travel together — never the text
        // alone (INV-073's rendering half). A normative string with no
        // visible source is unrenderable per hidden-works-content-rules.md.
        // `break-words` on the source line, and it is not cosmetic. `source`
        // carries the retrieval record — a URL and a 64-character sha256 —
        // neither of which contains a break opportunity, so at 375px the line
        // ran off the right edge of the phone and took the horizontal scroll
        // of the whole page with it. A regulatory citation that cannot be read
        // on the device the client is FOR is a citation that is not really
        // rendered, which is the same failure the qa harness's own
        // disclaimer-visibility check exists to catch. Not applied to
        // `normRef.text`: that is prose, it breaks on its own, and no class
        // here alters the string itself (INV-073).
        <div className="flex flex-col gap-1 rounded-control bg-surface-muted p-3 text-data text-foreground-secondary">
          <p>{item.normRef.text}</p>
          <p className="text-meta break-words text-foreground-muted">
            {item.normRef.verification} · {item.normRef.source}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-data text-foreground-secondary">
        <dt className="text-foreground-muted">Вид доказу</dt>
        <dd>{item.evidenceKindLabel}</dd>

        <dt className="text-foreground-muted">Кількість матеріалів</dt>
        <dd>{formatEvidenceCount(item.minEvidenceCount, item.maxEvidenceCount)}</dd>

        {item.allowedMedia && (
          <>
            <dt className="text-foreground-muted">Формати файлів</dt>
            <dd>{item.allowedMedia.mimeTypes.join(", ")}</dd>
          </>
        )}
      </dl>

      {/*
       * ONLY FOR `photo` — corrected in fix round 2: `document` is NOT
       * grouped with `measurement`/`checkbox` as producing no uploaded
       * original (route.ts's media-policy comment excludes only the latter
       * two; `document` requires `allowedMedia` exactly as `photo` does).
       * The real reason this control renders for `photo` alone is ADR-007
       * decision 4, "What the PWA must do in v0.1": the v0.1 client's second
       * obligation is named as «take the photo» — one interaction — and no
       * document-capture flow is in that scope. This component is that one
       * obligation, not a generic evidence uploader a wider evidenceKind
       * check would turn it into. Fix round 1 finding 1: previously nothing
       * here rendered `CaptureIsland` at all, so a foreman had no way to
       * attach a photo — this is the wiring that closes that gap.
       *
       * A RENDERED CONTROL IS NOT A SATISFACTION CLAIM. `CaptureIsland`'s own
       * copy is about the PHOTO's upload state ("Фото збережено"), never
       * about the OBLIGATION being met — that computation (accounting for
       * `minEvidenceCount`, review decisions, exceptions) is out of v0.1's
       * scope (`obligations.ts`'s own header) and nothing here invents a
       * stand-in for it: no badge, no checkmark, no "виконано" wording is
       * added by this card, before or after a photo is captured.
       */}
      {item.evidenceKind === "photo" && (
        <CaptureIsland
          assignmentId={assignmentId}
          occurrenceId={item.occurrenceId}
          // `exactOptionalPropertyTypes` (tsconfig.base.json) refuses an
          // explicit `accept={undefined}` against `accept?: string` — a
          // conditional spread omits the key entirely when there is no
          // policy to narrow it with, which is what "optional" means here.
          {...(item.allowedMedia ? { accept: item.allowedMedia.mimeTypes.join(",") } : {})}
        />
      )}
    </li>
  );
}

/**
 * "мінімум N" when `max === null` (no upper bound in the row — a nullable
 * column, not "unlimited" as a product decision); "N" when the range is a
 * single number; "N–M" otherwise. Not a decision `buildObligationScreen`
 * needs to make — the two numbers already arrive verbatim from the route —
 * only formatting of them for a caption.
 */
function formatEvidenceCount(min: number, max: number | null): string {
  if (max === null) return `мінімум ${min}`;
  if (min === max) return `${min}`;
  return `${min}–${max}`;
}

/**
 * Surfaces the route's own Ukrainian `detail` (e.g. "Завдання не знайдено."
 * for a 404) rather than a second, hand-written translation of the same
 * refusal — the server already localizes `ProblemJson.detail`
 * (`src/lib/http.ts`'s `problem()`), and duplicating it here is exactly the
 * kind of second copy that drifts.
 */
function problemDetail(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.problem;
  if (typeof body !== "object" || body === null || !("detail" in body)) return null;
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.length > 0 ? detail : null;
}

function ErrorState({ detail }: { detail: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <h1 className="text-h1 font-display font-semibold text-foreground">
        Обов&#39;язкові фіксації
      </h1>
      <p className="text-body text-foreground-secondary">
        {detail ?? "Не вдалося завантажити перелік обов'язкових фіксацій. Спробуйте ще раз."}
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">До списку доручень</Link>
      </Button>
    </main>
  );
}
