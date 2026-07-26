/**
 * Capability claims that must never appear in the shipped bundle (spec A.4.20).
 * The ported prototype Landing.jsx contained all four original patterns.
 * Shared by the unit test and the QA harness so a claim cannot slip past
 * one of them.
 *
 * IMPORTANT — this is a regression guard, not a general claim detector.
 * Each pattern below encodes one *specific, already-caught* claim class
 * (or, for `pricing-recurring`/`mobile-field-device`, a documented example
 * of one) so that class can never silently reappear. It cannot catch a
 * newly worded unsupported claim it has no pattern for — fix round 1
 * demonstrated this concretely: «План Контроль коштує 10 900 гривень
 * щомісяця», «Працює на телефоні майстра в полі», «Кожна дія перевіряється
 * за роллю користувача» and «Усі документи можна вивантажити одним
 * архівом» all passed the original four patterns untouched. A green run of
 * tests/claims.test.ts means "no *known* claim class reappeared", not "this
 * page makes no unsupported claims" — a human read against the actual
 * domain model (src/domain/types.ts, src/data/project.ts) is still required
 * before any of this is shown to a real subcontractor. See task-11 and
 * task-11 fix-round-1 reports for the sentence-by-sentence review that
 * substitutes for automation here.
 *
 * `security-enforcement` and `data-export` are deliberately narrow rather
 * than bare-root (`гарант*`, `тариф`) matches: `гарант*` collides with
 * legitimate construction-warranty language and `тариф` with real
 * electrical-tariff jargon, both plausible in later tasks' copy (12-15). A
 * false positive that blocks legitimate Ukrainian copy costs more than the
 * narrower pattern misses — do not broaden either of these two without a
 * concrete case for why the collision risk no longer applies.
 */
export const FORBIDDEN_CLAIM_PATTERNS = [
  { id: 'pricing', pattern: /₴\s*\/\s*міс|грн\s*\/\s*міс|\bтариф/iu },
  { id: 'mobile-app', pattern: /\biOS\b|\bAndroid\b/iu },
  { id: 'security-enforcement', pattern: /гаранту[єм].{0,40}(доступ|безпек)/iu },
  { id: 'data-export', pattern: /експорт\s+(усіх|всіх)\s+даних|гарантований\s+експорт/iu },
  // Fix round 1: a number next to a currency word next to a recurrence word
  // — e.g. «10 900 гривень щомісяця» — rather than a bare currency-symbol
  // match, so it does not trip on formatUah's own rendering elsewhere in
  // this codebase («184 000,00 ₴» / «0,00 ₴» in UnrecoverableNote.tsx),
  // which never carries a recurrence word next to the amount.
  {
    id: 'pricing-recurring',
    pattern: /\d[\d\s]{0,12}(?:грн\.?|₴|грив\w*)[^\n]{0,20}(?:щоміс\w*|на\s+місяц\w*|щорок\w*|на\s+рік)/iu,
  },
  // Fix round 1: a phone/field-device word next to a field-work word — e.g.
  // «Працює на телефоні майстра в полі» — rather than a bare "телефон"
  // match, so a legitimate future "номер телефону" contact field (task 13's
  // /pilot) would not trip this.
  {
    id: 'mobile-field-device',
    pattern: /(?:телефон\w*|смартфон\w*)[^\n]{0,20}(?:майстр\w*|в\s+пол[іi]\b|на\s+об['’ʼ]?єкт\w*)/iu,
  },
]
