// Deliberate duplicates of the `DOVIDKOVYI_DISCLAIMER_TEXT` and
// `PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT` constants in
// apps/app/src/lib/statutory-act-form.ts. Every copy must equal, byte for
// byte, the Approved text in docs/product/hidden-works-content-rules.md
// §"Required disclaimers": disclaimer.test.ts checks these and
// apps/app/tests/act-content-fidelity.test.ts the app's.
//
// Split into its own module here (the source keeps it inside the much larger
// `statutory-act-form.ts`, which this app has no reason to port in full —
// nothing under `apps/mobile` builds an acт form) so
// `src/lib/field/obligations.ts` can import just these strings.

/**
 * hidden-works-content-rules.md §"Required disclaimers": mandatory, rendered
 * on the obligation screen next to the requirement list it describes, and
 * NEVER collapsed — see `src/screens/assignment.tsx`'s own comment on where
 * this renders and why nothing there may hide it behind a `<details>` or a
 * scroll container.
 */
export const DOVIDKOVYI_DISCLAIMER_TEXT =
  "Наведений перелік — це довідковий Додаток Н ДБН А.3.1-5:2016 (позиція Н.15 "
  + "«Монтаж електротехнічних установок» / Н.14 «Внутрішні санітарно-технічні роботи»), "
  + "відтворений дослівно. Обов'язковий перелік прихованих робіт для вашого об'єкта "
  + "визначає робоча документація (п. 8.4.3.3 ДБН А.3.1-5:2016). Цей перелік її не "
  + "замінює. За потреби такими актами оформлюють й інші види робіт.";

/**
 * hidden-works-content-rules.md §"Required disclaimers": «only on a list that
 * also carries project-sourced items, immediately after» the довідковий
 * disclaimer above. `buildObligationScreen` decides the condition — an item
 * whose `normRef.verification` is `PROJECT_DOCUMENTATION`, the items labelled
 * «за робочою документацією об'єкта» — and `src/screens/assignment.tsx`
 * prints it right after `DOVIDKOVYI_DISCLAIMER_TEXT`.
 */
export const PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT =
  "Пункти, позначені «за робочою документацією об'єкта», внесені виконавцем з "
  + "робочої документації цього об'єкта із зазначенням аркуша та номера креслення. "
  + "Їх текст не є витягом з ДБН і видавцем цієї системи не перевірявся.";
