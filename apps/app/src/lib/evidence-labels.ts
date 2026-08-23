import type { EvidenceObjectView } from "@goproceed/contracts";

/**
 * Two label maps `evidence-card.tsx` renders — the same shape
 * `assignment-status-labels.ts` established for `work_assignments.status`:
 * a standalone module a schema-derived fidelity test (`evidence-labels.
 * test.ts`) can import, rather than a `const` a component file would
 * otherwise keep private. Both are read straight off `supabase/migrations/
 * 0015_execution_evidence_module.sql`'s `evidence_objects` table, the one
 * the route this screen calls actually queries.
 *
 * ══════════════════════════════════════════════════════════════════════
 * `captureTimeTrust` — PLAIN TEXT, NOT A CHIP. FIX ROUND 1 CORRECTED THIS.
 *
 * The original version of this file rendered the value inside a
 * `<Chip tone="neutral">` and cited `Chip.tsx`'s own header — "Not a status.
 * The eyebrow pill above a heading, and nothing else" — as the justification.
 * That citation was backwards: that sentence RESTRICTS `neutral` to the
 * eyebrow-pill role: it is an argument against putting a trust value inside
 * a `Chip` at all, not for doing so with a defanged tone. With all three
 * values sharing one identical, colourless tone, the `Chip` carried no
 * information the text inside it did not already carry — a pill shape with
 * nothing behind it.
 *
 * `packages/contracts/src/evidence.ts`'s own header still explains WHY this
 * field is a `z.enum` rather than a bare string — so an exhaustive switch is
 * possible — and this map is still that exhaustiveness: typed as
 * `Record<EvidenceObjectView["captureTimeTrust"], string>`, so a value the
 * union does not carry is a compile error, not a runtime fallback (unlike
 * `originMethodLabel` below, which needs one because its field is a bare
 * `z.string()`). What changed is only the CONTAINER, not the label text or
 * the exhaustiveness — `evidence-card.tsx` now renders this string the same
 * plain way it renders `originMethodLabel`'s result, immediately below.
 *
 * THE REASON A COLOUR LADDER IS STILL REFUSED HOLDS, UNCHANGED: this was
 * considered and rejected as a `ready`/`attention`/`idle` mapping (mirroring
 * `Chip`'s own status tones) for a reason specific to this product's subject
 * matter — `device_claimed` is NOT verified capture-time evidence.
 * `apps/app/app/(app)/a/[assignmentId]/capture.tsx:349` — the field client's
 * own receipt panel — labels the identical fact «Час пристрою (не
 * перевірено)», and that is a RENDERED `<dt>`, in ordinary lowercase, not a
 * reasoning comment and not in caps (this sentence used to say both, and both
 * were wrong; the caps were this comment's own emphasis, read back as if the
 * source carried them). What the source does carry, in the reasoning comment
 * immediately above that `<dt>` at capture.tsx:330-348, is the argument: ADR-007
 * decision 5 «names exactly three — the device's own unverified capture-time
 * claim, the server's receipt time, and a client-computed content hash — and
 * nothing stronger», because the device's own claim binds nothing about the
 * sensor. Painting `device_claimed` in a positive/verified tone would tell a
 * colour-scanning reader the opposite of what this product's own evidence-
 * integrity stance requires it to say. Reusing this file's existing
 * vocabulary (the same parenthetical) for the LABEL, and refusing a colour
 * claim the product does not make, is the safer of the two available
 * choices — matching `assignments-list.tsx`'s own precedent of refusing an
 * invented tone for `work_assignments.status` where "no design decision …
 * assigns a tone to any … value," and matching `originMethodLabel`'s own
 * plain-text treatment immediately below, for the identical reason.
 * ══════════════════════════════════════════════════════════════════════
 */
export const CAPTURE_TIME_TRUST_LABELS: Readonly<
  Record<EvidenceObjectView["captureTimeTrust"], string>
> = Object.freeze({
  device_claimed: "Час пристрою (не перевірено)",
  server_estimated: "Оцінка сервера",
  unknown: "Час невідомий",
});

export function captureTimeTrustLabel(trust: EvidenceObjectView["captureTimeTrust"]): string {
  return CAPTURE_TIME_TRUST_LABELS[trust];
}

/**
 * `originMethod` — PLAIN TEXT, NOT A CHIP, same reasoning
 * `assignments-list.tsx` gives for `work_assignments.status`: no design
 * decision in this slice's brief or spec assigns a tone to any of the six
 * values, so inventing one would be the exact unverified, plausible-sounding
 * call this branch's review rounds have already spent time correcting.
 *
 * A `Record<string, string>` WITH A FALLBACK, NOT THE EXHAUSTIVE SHAPE
 * ABOVE — `evidenceObjectView.originMethod` is `z.string().min(1)`, not an
 * enum (`packages/contracts/src/evidence.ts`), so a server one deploy ahead
 * can legitimately send a value this map has not learned yet.
 * `Object.hasOwn`, not `?? method` — same reachable-prototype-property
 * hazard `assignmentStatusLabel` is pinned against
 * (`ORIGIN_METHOD_LABELS["toString"]` resolves up the prototype chain to a
 * function, which `??` would never treat as nullish).
 */
export const ORIGIN_METHOD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  native_camera: "Камера пристрою",
  photo_picker: "Вибір із галереї",
  file_picker: "Вибір файлу",
  form: "Форма",
  import: "Імпорт",
  generated_derivative: "Похідний файл",
  /**
   * ADDED 2026-08-22 (Plan D slice D1 task 7), AND IT WAS THE ONLY VALUE THE
   * PRODUCT CAN ACTUALLY PRODUCE TODAY.
   *
   * Every photo this repository can capture is a PWA capture, and
   * `buildCreateIntentBody` (`src/lib/capture/upload.ts`) has exactly one
   * literal to send: `origin_not_distinguished` (ADR-007 decision 5, INV-086 —
   * a browser has no camera-session identity and may be handed transcoded
   * bytes, so the origin cannot be established and the vocabulary says so
   * rather than asserting a camera). This map did not carry it, so the office
   * evidence card rendered the raw identifier — `originMethodLabel`'s fallback
   * doing exactly what it was built for, on the one value that is not an
   * unknown future one.
   *
   * WHY NOTHING CAUGHT IT, which is the more useful half: the fidelity test
   * derived «every value the database permits» by PARSING MIGRATION SQL, and
   * read migration **0015**, whose CHECK carries six. Migration **0043**
   * widened the same constraint to seven — that is the migration that made the
   * PWA capture storable at all — and the test never read it, so a green suite
   * defended the gap.
   *
   * The first fix walked the whole migration directory, last definition wins.
   * That was still not enough, and the second failure would have let this
   * exact defect recur silently: the parser matched only the literal spelling
   * `check (<column> in (…))`, while the running database renders this
   * constraint as `= ANY (ARRAY[…])` and six migrations here already write it
   * that way by hand. Measured: with an eighth value added in the ANY spelling,
   * the migration parser still reported seven and stayed green.
   *
   * So the question is now asked of `pg_constraint`, in
   * `apps/app/tests/evidence-labels.int.test.ts`, whose header carries the
   * whole account. A test that approximates the schema can be wrong about the
   * schema; the database cannot.
   *
   * The label is what ADR-007 decision 5 says and not a softer paraphrase: the
   * origin was not established. It does not say «browser», because the field
   * this value describes is about what can be ASSERTED, not about which client
   * sent it.
   */
  origin_not_distinguished: "Походження не встановлено",
});

export function originMethodLabel(method: string): string {
  return Object.hasOwn(ORIGIN_METHOD_LABELS, method)
    ? ORIGIN_METHOD_LABELS[method]!
    : method;
}
