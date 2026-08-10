import type {
  EvidenceKindValue, ListRequirementOccurrencesResponse, NormativeCitation,
  RequirementOccurrenceView, RequirementTimingValue,
} from "@goproceed/contracts";
import { DOVIDKOVYI_DISCLAIMER_TEXT } from "../statutory-act-form";

/**
 * THE OBLIGATION SCREEN — ADR-007 decision 4, obligation 1 of 2: show the
 * foreman what must be photographed, in the standard's own wording, BEFORE
 * work starts. Task 9's capture widget sits inside the list this builds; this
 * file owns none of the capture flow, only what to show and in what order.
 *
 * PURE, AND TESTED AS SUCH (matching `src/lib/capture/*.ts`, task 6's
 * pattern): `apps/app` has Node-only vitest, no jsdom, so every decision this
 * screen makes lives here rather than in JSX, where it could only be proven
 * by eye. `app/(app)/a/[assignmentId]/page.tsx` calls `apiGet`, hands the
 * response to `buildObligationScreen`, and renders exactly what comes back —
 * it makes no decision of its own.
 *
 * WHAT THIS FILE DOES NOT DO, on purpose:
 *
 *   - RE-SORT. `GET /v1/assignments/{assignmentId}/requirement-occurrences`
 *     (route.ts) already orders `occurrences` by an explicit CASE over
 *     `timing` — before_work → during → before_concealment → after →
 *     before_package, "the order the work meets them" per that route's own
 *     comment. `buildObligationScreen` maps the array in place; it never
 *     calls `.sort()`, even defensively, because a second opinion about the
 *     right order is exactly how the reverse-alphabetical bug the route
 *     comment warns against (`after` before `before_work`) would come back.
 *
 *   - ALTER A REGULATORY STRING. `acceptanceCriterion` and `normRef.text` are
 *     the ДБН standard's own Ukrainian, copied verbatim at rule-version
 *     publication (INV-073). No `.trim()`, no `.normalize()`, no smart-quote
 *     substitution, no capitalisation fix, no ellipsis truncation — anywhere
 *     in this file. A formatter that "fixes" a regulatory string changes a
 *     regulatory document.
 *
 *   - SHOW `normRef.text` ALONE. `normRef` travels as one object — text,
 *     `verification` tag, `source` — or as `null`. INV-073's rendering half
 *     (see `packages/contracts/src/requirement-occurrences.ts`'s
 *     `normativeCitation` comment) is that a citation reaching a screen
 *     without its tag and its source must not render as normative;
 *     `occurrenceToItem` below passes the whole object or `null` through
 *     unopened, so there is no code path that could split it.
 *
 *   - COMPUTE SATISFACTION. The route deliberately omits any `satisfied` or
 *     `status` field — that computation is a projection over decisions,
 *     exceptions and review heads that ships in M3 — and neither this
 *     function's input type nor its output type carries one. Inventing a
 *     client-side stand-in would be a lie to the one reader (a foreman
 *     deciding whether it is safe to cover the work) who cannot tell a real
 *     satisfaction signal from an invented one.
 */

/**
 * Plain, local, honest translations of the product's OWN enum values — NOT
 * governed by docs/product/hidden-works-content-rules.md, because neither
 * `timing` nor `evidenceKind` is a quotation from the standard. Mirrors the
 * distinction `apps/demo/src/components/RequirementList.tsx`'s
 * `EVIDENCE_KIND_LABEL_UK` draws for its own (differently-shaped) evidence-kind
 * enum: "Not governed by doc 05 §5 — a plain, local, honest translation."
 */
export const TIMING_LABEL: Record<RequirementTimingValue, string> = {
  before_work: "До початку робіт",
  during: "Під час робіт",
  before_concealment: "Перед закриттям (приховані роботи)",
  after: "Після робіт",
  before_package: "Перед формуванням пакета документів",
};

export const EVIDENCE_KIND_LABEL: Record<EvidenceKindValue, string> = {
  photo: "Фото",
  measurement: "Замір",
  document: "Документ",
  checkbox: "Позначка виконання",
};

/**
 * THE FOUR COVERAGE VALUES, EACH WITH ITS OWN ACTIONABLE SENTENCE.
 * `ListRequirementOccurrencesResponse["coverage"]`'s own comment names why an
 * empty `occurrences` array is never just an empty array: a foreman shown
 * nothing cannot tell "this work carries no obligation" from "this baseline
 * bound no rules" from "the obligation set could not be computed" — three
 * different owners, three different remedies. Each message below names the
 * remedy, not just the fact, because a stage covered without evidence is what
 * silent non-coverage (INV-072) produces.
 *
 * `covered` gets a message too, though it is not a refusal — the route's own
 * comment on `coverage` treats all four uniformly, and giving `covered` no
 * caption at all would make three empty-array messages read as the norm and
 * one non-empty list read as the exception, when it is the other way round.
 */
export const COVERAGE_MESSAGE: Record<ListRequirementOccurrencesResponse["coverage"], string> = {
  covered:
    "Нижче — перелік обов'язкових фіксацій за цим дорученням, у порядку виконання робіт.",
  no_bindings:
    "До договору ще не прив'язано жодного правила фіксації. Це НЕ означає, що прихованих "
    + "робіт немає — перш ніж закривати роботи, зверніться до керівника проєкту.",
  no_matching_rule:
    "Для виду робіт цього доручення не знайдено жодного прив'язаного правила фіксації. Перш "
    + "ніж закривати роботи, зверніться до керівника проєкту, щоб підтвердити, що фіксація "
    + "справді не потрібна.",
  work_type_unresolved:
    "Для цієї позиції не визначено вид робіт, тому перелік обов'язкових фіксацій встановити "
    + "неможливо. Зверніться до керівника проєкту, щоб уточнити вид робіт до початку робіт.",
};

export interface ObligationItem {
  occurrenceId: string;
  timing: RequirementTimingValue;
  timingLabel: string;
  evidenceKind: EvidenceKindValue;
  evidenceKindLabel: string;
  /** VERBATIM. See the file header — never trimmed, normalized, or altered. */
  acceptanceCriterion: string;
  /**
   * VERBATIM when present, and travels as one unit or not at all — text,
   * `verification`, `source` together, or `null`. Never render `.text` alone.
   */
  normRef: NormativeCitation | null;
  minEvidenceCount: number;
  maxEvidenceCount: number | null;
  allowedMedia: RequirementOccurrenceView["allowedMedia"];
}

export interface ObligationScreen {
  workAssignmentId: string;
  contractVersionId: string;
  /** In the route's order. Never re-sorted here — see the file header. */
  items: ObligationItem[];
  coverage: ListRequirementOccurrencesResponse["coverage"];
  coverageMessage: string;
  /**
   * hidden-works-content-rules.md §"Required disclaimers": mandatory, never
   * collapsed. IMPORTED from `statutory-act-form.ts`, not typed here — a
   * second copy of a mandated regulatory disclaimer is two strings that can
   * drift, and the one that drifts is the one nobody is looking at. Present
   * unconditionally, for every `coverage` value: it is assigned once below,
   * not composed per branch, so there is no branch that could omit it.
   */
  disclaimer: string;
}

export function buildObligationScreen(
  response: ListRequirementOccurrencesResponse,
): ObligationScreen {
  return {
    workAssignmentId: response.workAssignmentId,
    contractVersionId: response.contractVersionId,
    items: response.occurrences.map(occurrenceToItem),
    coverage: response.coverage,
    coverageMessage: COVERAGE_MESSAGE[response.coverage],
    disclaimer: DOVIDKOVYI_DISCLAIMER_TEXT,
  };
}

function occurrenceToItem(o: RequirementOccurrenceView): ObligationItem {
  return {
    occurrenceId: o.occurrenceId,
    timing: o.timing,
    timingLabel: TIMING_LABEL[o.timing],
    evidenceKind: o.evidenceKind,
    evidenceKindLabel: EVIDENCE_KIND_LABEL[o.evidenceKind],
    acceptanceCriterion: o.acceptanceCriterion,
    normRef: o.normRef,
    minEvidenceCount: o.minEvidenceCount,
    maxEvidenceCount: o.maxEvidenceCount,
    allowedMedia: o.allowedMedia,
  };
}
