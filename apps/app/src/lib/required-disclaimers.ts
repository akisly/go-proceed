import type { VerificationTagValue } from "@goproceed/contracts";

/**
 * THE REQUIREMENT-LIST DISCLAIMERS — the two texts
 * `docs/product/hidden-works-content-rules.md` §"Required disclaimers" puts
 * under a generated requirement list, held in one dependency-free module so
 * every surface that prints such a list prints the same bytes:
 *
 *   - the act (`statutory-act-form.ts`, which re-exports them);
 *   - the Telegram assignment card and the requirement-choice prompt
 *     (`telegram/cards.ts`), a list by prohibition T of the content rules;
 *   - the office's blocked-reasons list (`components/projects/
 *     blocked-reasons-list.tsx`), a list of requirements in the standard's own
 *     wording with their citations.
 *
 * The native field client keeps its own copy (`apps/mobile/src/lib/field/
 * disclaimer.ts`, DEV-058); each copy answers to the content rules byte for
 * byte (`apps/app/tests/act-content-fidelity.test.ts`), not to the other.
 * Moved here from `statutory-act-form.ts` by DEV-075 (BL-156) with no byte
 * changed, so the act's `RENDERER_VERSION` stands.
 */

/**
 * §"Required disclaimers": «Under every generated requirement list», never
 * collapsed. Transcribed verbatim.
 *
 * WHY THE ACT PRINTS IT. The act's decision section reproduces the acceptance
 * criteria of the occurrences the closure was proved against, and those criteria
 * are Додаток Н items carrying Додаток Н citations. That is a generated
 * requirement list in substance, and prohibitions B and C are the two largest
 * legal risks the content rules name. Printing a mandatory disclaimer where it
 * may not have been strictly required costs a paragraph; omitting one where it
 * was required is the failure the document exists to prevent.
 */
export const DOVIDKOVYI_DISCLAIMER_TEXT =
  "Наведений перелік — це довідковий Додаток Н ДБН А.3.1-5:2016 (позиція Н.15 "
  + "«Монтаж електротехнічних установок» / Н.14 «Внутрішні санітарно-технічні роботи»), "
  + "відтворений дослівно. Обов'язковий перелік прихованих робіт для вашого об'єкта "
  + "визначає робоча документація (п. 8.4.3.3 ДБН А.3.1-5:2016). Цей перелік її не "
  + "замінює. За потреби такими актами оформлюють й інші види робіт.";

/**
 * How a mandatory disclaimer decides whether it is shown, named as a value so
 * the distinction §"Required disclaimers" draws between its disclaimers is
 * checkable rather than only described in a comment.
 *
 *   `"every_page"`      — the act's `pageFooterText`: shown on every page
 *                          regardless of what the page contains
 *                          (`pageFooterRepeatsOnEveryPage` on the rendered
 *                          document).
 *   `"never_collapsed"` — `DOVIDKOVYI_DISCLAIMER_TEXT` above and the act's
 *                          decision-block disclaimers: shown every time
 *                          their host block is shown at all, which is why
 *                          every other `disclaimer()` call in
 *                          `statutory-act-form.ts` passes `neverCollapse: true`.
 *   `"conditional"`     — shown only when a further fact about the host
 *                          list's CONTENTS holds, true on some lists and
 *                          false on others. `PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT`
 *                          below carries this value.
 *
 * ADDITIVE ONLY: the act's other disclaimer constants are not retrofitted with this
 * type, because doing so is not this change's surface.
 */
export type DisclaimerPlacement = "every_page" | "never_collapsed" | "conditional";

/**
 * §"Required disclaimers": «and, only on a list that also carries
 * project-sourced items, immediately after it» — printed immediately after
 * `DOVIDKOVYI_DISCLAIMER_TEXT` above, and only when that list carries at
 * least one item whose `verification` is `PROJECT_DOCUMENTATION`
 * (§"Project-sourced strings", ADR-010, migration 0059). Transcribed
 * verbatim.
 *
 * CONDITIONAL, NOT NEVER-COLLAPSED — the distinction §"Required disclaimers"
 * itself draws between this text and `DOVIDKOVYI_DISCLAIMER_TEXT`.
 * `DOVIDKOVYI_DISCLAIMER_TEXT` is shown under every generated requirement
 * list once that list is shown at all; this text is shown only when a fact
 * about the list's CONTENTS holds.
 *
 * THE CONDITION IS «AT LEAST ONE», NOT «MIXED», and the difference is not
 * pedantry. The rule's own words are «only on a list that ALSO CARRIES
 * project-sourced items» — satisfied by one such item whatever the rest of the
 * list is. A condition written as «seeded Додаток Н items ALONGSIDE a
 * workspace-supplied one» would omit the mandated string from the list that
 * most needs it: the one whose every item came from the site's own робоча
 * документація. A list built entirely from the seeded library carries no such
 * item and never prints it, which is what
 * `PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT` below records as
 * `"conditional"` rather than `"never_collapsed"`.
 *
 * The act's `blocksFor` `"decision_blocks"` case READS THIS CONSTANT and pushes it
 * directly after the довідковий disclaimer when the condition holds. The
 * surface is live: `loadActVersionView` (src/lib/statutory-act.ts) composes an
 * act's decisions from `stage_closure_occurrences ⋈ requirement_occurrences`
 * with no provenance filter, and since migration 0059 an occurrence's
 * `norm_ref_verification` can be `PROJECT_DOCUMENTATION` — which is also why
 * the act's `normative()` takes the full `VerificationTagValue`.
 */
export const PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT =
  "Пункти, позначені «за робочою документацією об'єкта», внесені виконавцем з "
  + "робочої документації цього об'єкта із зазначенням аркуша та номера креслення. "
  + "Їх текст не є витягом з ДБН і видавцем цієї системи не перевірявся.";

export const PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT: DisclaimerPlacement = "conditional";

/**
 * The disclaimers a requirement list carries, in the rule's order: the
 * довідковий text whenever a list is shown at all, then the project-sourced
 * note when at least one item's citation is `PROJECT_DOCUMENTATION`. An empty
 * list prints nothing, so it carries nothing. A withheld citation (`null`)
 * says nothing about provenance and adds no note.
 */
export function requirementListDisclaimers(
  citations: ReadonlyArray<{ verification: VerificationTagValue } | null>,
): string[] {
  if (citations.length === 0) return [];
  return citations.some((citation) => citation?.verification === "PROJECT_DOCUMENTATION")
    ? [DOVIDKOVYI_DISCLAIMER_TEXT, PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT]
    : [DOVIDKOVYI_DISCLAIMER_TEXT];
}
