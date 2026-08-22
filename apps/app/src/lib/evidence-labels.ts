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
 * `captureTimeTrust` — A TRUST BADGE, NOT A TRUST HIERARCHY IN COLOUR.
 *
 * `packages/contracts/src/evidence.ts`'s own header says this field exists
 * as a `z.enum` (not a bare string, unlike `originMethod` below) precisely
 * so a screen can render "a trust badge" with an exhaustive switch — and
 * this map IS that exhaustiveness: it is typed as
 * `Record<EvidenceObjectView["captureTimeTrust"], string>`, so a value the
 * union does not carry is a compile error, not a runtime fallback (unlike
 * `originMethodLabel` below, which needs one because its field is a bare
 * `z.string()`).
 *
 * THE BADGE'S CHIP TONE IS `"neutral"` FOR ALL THREE VALUES, DELIBERATELY —
 * this was considered and rejected as a `ready`/`attention`/`idle` colour
 * ladder (mirroring `Chip`'s own status tones) and rejected for a reason
 * specific to this product's subject matter: `device_claimed` is NOT
 * verified capture-time evidence. `apps/app/app/(app)/a/[assignmentId]/
 * capture.tsx:349` — the field client's own receipt panel — labels the
 * identical fact "Час пристрою (НЕ ПЕРЕВІРЕНО)", in caps in the original
 * reasoning comment there, specifically because the device's own claim binds
 * nothing about the sensor. Painting `device_claimed` in `Chip`'s `ready`
 * tone (used elsewhere for a verified/positive state) would tell a
 * colour-scanning reader the opposite of what this product's own README on
 * evidence integrity requires it to say. Reusing this file's existing
 * vocabulary (the same parenthetical) for the LABEL, and refusing a colour
 * claim the product does not make, is the safer of the two available
 * choices — matching `assignments-list.tsx`'s own precedent of refusing an
 * invented tone for `work_assignments.status` where "no design decision …
 * assigns a tone to any … value." `Chip`'s own header names `neutral`
 * exactly for this: "not a status. The eyebrow pill … and nothing else."
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
});

export function originMethodLabel(method: string): string {
  return Object.hasOwn(ORIGIN_METHOD_LABELS, method)
    ? ORIGIN_METHOD_LABELS[method]!
    : method;
}
