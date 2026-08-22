/**
 * Membership `role` and `status` → the Ukrainian label a screen may render.
 *
 * WHY A MAP AND NOT A `ui_uk` COLUMN ON THE WIRE. `packages/contracts`'s
 * `meContextResponse` types both fields as `z.string()` — the contract does
 * not enumerate them — while `technical/schema.sql`'s `public.memberships`
 * CHECK constraints do: thirteen roles and four statuses. Rendering
 * `pto_manager` or `revoked` on a Ukrainian screen is a defect, and the
 * translation has to live somewhere the server does not send it from.
 *
 * FROZEN, AND EVERY LITERAL COVERED BY A SCHEMA-DERIVED TEST.
 * `membership-labels.test.ts` reads `technical/schema.sql`, extracts the
 * `create table public.memberships` block, parses BOTH CHECK lists out of it,
 * and asserts every literal has a label here. That is the whole point of the
 * test being schema-derived rather than a second hardcoded list: widening the
 * constraint without adding a label fails, which a duplicated list could
 * never catch. (The block scoping is load-bearing — `role`'s CHECK also
 * appears on `public.invitations` with a different, twelve-value list, and
 * `status` CHECKs appear on a dozen unrelated tables.)
 *
 * THE FALLBACK RETURNS THE RAW VALUE, NEVER BLANK AND NEVER A THROW. The
 * contract really is `z.string()`: a server one deploy ahead of this client
 * can legitimately send a role this map has not learned yet. A blank cell
 * would hide a real membership; a throw would take down the whole screen for
 * one unknown word. Showing `security_officer` untranslated is ugly and
 * truthful, and it is the only one of the three that leaves the row readable.
 *
 * NAMED FOR D4. Plan D's members screen (`04-role-pain-map.md` screen 4) is
 * the second consumer — it renders one row per member with exactly these two
 * fields — hence `membership-labels`, not `profile-labels`.
 */

/** `public.memberships.role` — thirteen, per `technical/schema.sql`. */
export const MEMBERSHIP_ROLE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  owner: "Власник",
  admin: "Адміністратор",
  commercial_manager: "Комерційний директор",
  pto_manager: "Керівник ПТВ",
  project_manager: "Керівник проєкту",
  foreman: "Виконроб",
  field_worker: "Робітник на майданчику",
  internal_reviewer: "Внутрішній рецензент",
  estimator: "Кошторисник",
  accountant: "Бухгалтер",
  viewer: "Спостерігач",
  integration_admin: "Адміністратор інтеграцій",
  security_admin: "Адміністратор безпеки",
});

/**
 * `public.memberships.status` — four, per `technical/schema.sql`.
 *
 * Only `active` is reachable through `GET /v1/me/context` today: the
 * `api.me_context` view filters `where … m.status = 'active'`
 * (`supabase/migrations/0004_rls_policies.sql`). The other three are not
 * speculative — they are values the column holds and D4's members screen
 * reads directly — so they are labelled here rather than added later by
 * someone reading the same CHECK a second time.
 *
 * One grammatical shape for all four (masculine, agreeing with «учасник»), so
 * a column of them reads as one set rather than a mix of participles and
 * adjectives.
 */
export const MEMBERSHIP_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  invited: "Запрошений",
  active: "Активний",
  suspended: "Призупинений",
  revoked: "Відкликаний",
});

/**
 * `Object.hasOwn`, NOT `MAP[key] ?? key`. Both maps are ordinary object
 * literals, so `MEMBERSHIP_ROLE_LABELS["toString"]` resolves up the prototype
 * chain to a FUNCTION — which is not nullish, so `??` never fires and the
 * screen renders `function toString() { [native code] }` where a role should
 * be. TypeScript cannot see it: the declared value type is `string`, and the
 * lookup is typed `string | undefined` under `noUncheckedIndexedAccess`
 * regardless of what the prototype actually holds. `role` is
 * `z.string()`-wide and arrives from the network, so this is a reachable
 * input, not a hypothetical. Pinned by `membership-labels.test.ts`.
 */
export function membershipRoleLabel(role: string): string {
  return Object.hasOwn(MEMBERSHIP_ROLE_LABELS, role) ? MEMBERSHIP_ROLE_LABELS[role]! : role;
}

export function membershipStatusLabel(status: string): string {
  return Object.hasOwn(MEMBERSHIP_STATUS_LABELS, status) ? MEMBERSHIP_STATUS_LABELS[status]! : status;
}
