// PORT of the `DOVIDKOVYI_DISCLAIMER_TEXT` constant defined in
// apps/app/src/lib/statutory-act-form.ts — byte-identical copy. Transitional
// duplication under ADR-009: the PWA original retires when the Expo client
// passes the parity gate; until then fix bugs (or wording) in BOTH files.
//
// Split into its own module here (the source keeps it inside the much larger
// `statutory-act-form.ts`, which this app has no reason to port in full —
// nothing under `apps/mobile` builds an acт form) so
// `src/lib/field/obligations.ts` can import just the one string, the same
// way its source does.

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
