# Evidence Atlas design QA

Date: 2026-07-23  
Scope: full AktFlow interactive prototype  
Selected source: `design-references/evidence-atlas/selected-direction.png`

## Build evidence

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run qa`: passed with no findings.
- Automated coverage: 17 business flow families, 19 deterministic screenshots.
- Viewports: 1487×1058, 1440×1100, 1440×1050, 1440×1024, 1200×850 and 390×844.
- Work-mode cloud browser did not open the local preview in this workspace. Visual inspection therefore used the repository’s fresh deterministic renders; this is a preview-surface limitation, not runtime certification.

## Same-input comparison

`design-qa/landing-first-viewport-comparison.png` contains the selected reference and the fresh implementation first viewport in one image. `design-qa/evidence-atlas-flow-contact-sheet.png` contains the selected board plus fresh landing, dashboard, onboarding, evidence-review and field renders.

Observed alignment:

- Paper-dominant first viewport, Carbon typography and Lime primary action match the selected direction.
- Hero object uses layered plan folios, a code-native financial dossier, evidence attachments and a generated audit stamp.
- The section rhythm matches: ledger → workflow → Carbon mobile stage → role dossier → security → plans → pilot CTA.
- Manrope/Inter hierarchy, low-radius folios, Slate rules and sparse Lime usage remain consistent across surfaces.

## Surface review

| Surface | Checks | Result |
|---|---|---|
| Landing | header, hero crop, money hierarchy, evidence assets, mobile section, pricing, footer routes | passed |
| Auth/recovery | form hierarchy, magic-link state, reset receipt, legal destinations | passed |
| Onboarding | progress, mapping density, validation counts, rules hand-off, responsive structure | passed |
| Desktop shell | grouped navigation, nested selected state, context switcher, notifications, route hand-off | passed |
| Dashboard/work | above-fold density, search/filter/export states, drawers and exact work context | passed |
| Rules/baseline | version proof, stale-preview guard, publish receipt and immutable copy | passed |
| Assignments/occurrence | exact version context, mixed row receipt, offline bundle, hold/concealment | passed |
| Evidence | real media crop, warning state, decision rail, original/R2 lineage and receipts | passed |
| Close/package | blocker persistence, override, snapshot, generation, submission and reconciliation | passed |
| External review | exact v2 boundary, section navigation, return/accept receipts, non-KEP copy | passed |
| Payments/billing | construction-commercial and SaaS planes remain visually and semantically separate | passed |
| Team/settings | scope preview, offboarding, mandatory-event lock and settings receipt | passed |
| Field | Today/Captures/Queue navigation, capture, local receipt, server receipt, 390×844 | passed |

## Asset review

The complete chosen asset set is preserved in `design-references/evidence-atlas/`:

- selected direction board;
- synthetic blueprint folio;
- synthetic construction evidence photo;
- synthetic audit stamp;
- asset/usage/crop/motion manifest.

Production copies are under `prototype/public/assets/evidence-atlas/`. No customer data, people, logos or readable customer documents are present.

## Interaction and routing review

- Public conversion routes lead to pilot, login, synthetic demo and field demo.
- Onboarding returns through the versioned rule flow.
- Authenticated navigation follows work → assignment → field → review → close → package → external review → project payment.
- Nested occurrence/package pages retain the correct parent navigation state.
- Notification and project-context menus open and contain real destinations.
- Field and external-review tabs change visible state.
- Password recovery, legal links, help contact and workspace settings are no longer dead affordances.
- Existing domain commands, receipts and state consequences remain unchanged; the visual revision did not weaken the v2.9 business-logic contracts.

## Non-prototype release gates

This pass does not certify backend authorization, RLS, object durability, native mobile security, legal effect, KEP, customer adapters, WCAG conformance or production infrastructure. Those remain governed by the production-readiness and validation registers.

final result: passed
