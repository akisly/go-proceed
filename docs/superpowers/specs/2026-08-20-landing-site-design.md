# GoProceed landing site design

**Status:** Approved in chat on 2026-08-20

**Scope:** `apps/landing`, with narrowly justified changes to `packages/ui`
motion or components when a shared contract is genuinely missing

**Branch:** `codex/landing-site`

## 1. Outcome

Replace the current token-proof route in `apps/landing` with a complete,
responsive Ukrainian marketing site for GoProceed. The site should feel modern
and carefully crafted while remaining recognisably about construction work:
drawings, hidden-work evidence, site capture, review, closure and statutory act
drafts are the visual and narrative material.

This first version is a visual and interaction mock. The primary pilot CTA does
not navigate, submit data or call an API. Section navigation may still scroll to
real sections because that is part of the page itself.

## 2. Audience and job

The primary audience is the owner, commercial director or head of PTV at a
Ukrainian MEP or electrical installation subcontractor with 15-100 staff and
2-10 concurrent sites. The site must help that reader understand, in one pass:

1. requirements are connected to work before the work starts;
2. the foreman sees and captures the required evidence;
3. technical supervision can decide through a narrow external review surface;
4. a hidden or covered stage cannot be recorded as closed while its blocking
   requirement remains unmet;
5. a satisfied closure can produce a draft act from recorded facts.

The site must not imply that the payment-presentation gate, package versions,
partial commercial acceptance, durable offline capture or qualified electronic
signature exists in v0.1.

## 3. Chosen direction

The chosen direction is **Evidence Atlas Hybrid**.

- Folio contributes editorial composition, generous document surfaces,
  layered folios and a strong product frame.
- Linear contributes typographic restraint, calm information density, fine
  borders and motion that explains hierarchy rather than decorating sections.
- GoProceed contributes the domain-specific visual language: blueprint paper,
  evidence photos, requirement references, review receipts, act fragments and
  the existing Carbon/Paper/Lime palette.

Design dials:

- `DESIGN_VARIANCE: 7/10` - composed asymmetry without agency-style chaos;
- `MOTION_INTENSITY: 6/10` - visible choreography with no ambient noise;
- `VISUAL_DENSITY: 5/10` - enough real work detail to feel credible, with one
  focal object per fold.

Rejected directions:

- **Dark Control Room:** visually strong but too close to a generic software
  command centre and too weak on documentary trust.
- **Field First:** authentic to the site, but it under-explains the evidence
  chain and the owner/PTV value.

References:

- https://folio-topaz-delta.vercel.app/
- https://linear.app/
- `design-references/evidence-atlas/selected-direction.png`
- `design-references/evidence-atlas/assets/`

## 4. Visual system

The implementation uses the existing semantic design system. Components name
roles, never raw values. No hex colour, primitive ramp token or private CSS
variable may appear in landing source.

- **Canvas:** Paper-led light theme for the full page.
- **Ink:** Carbon for primary copy and consequential UI.
- **Signal:** Lime only for the next action or a verified state, capped at one
  signal action per screen and approximately five percent of a viewport.
- **Structure:** one-pixel rules and small surface steps. Shadows are reserved
  for a genuinely floating folio, nav or product frame.
- **Type:** Source Serif 4 for marketing display headings, Inter for body and
  UI copy, JetBrains Mono for references and evidence identifiers.
- **Shape:** pills for navigation and CTA presentation, field/card/surface
  radii according to existing marketing tokens. Product surfaces are not a
  collection of generic rounded cards.
- **Theme exception:** one Carbon field-capture band is allowed as a deliberate
  physical-site interval. The rest of the page stays in the Paper family.

The approved synthetic assets are production-safe and contain no customer data:

- `blueprint-folio.png` for hero and closing composition;
- `cable-tray-evidence.png` for field capture and evidence context;
- `verified-stamp.png` for durable review/receipt moments.

The old AktFlow concept boards remain visual QA references only and do not ship
as product UI or marketing images.

## 5. Page architecture

The page keeps the fourteen-block catalogue, with claims tightened to current
product truth.

| Block | Purpose and composition |
|---|---|
| `NavFloat` | Floating single-line navigation with GoProceed wordmark, four section links, language indicator, login presentation and mock pilot CTA. |
| `Hero` | Two-line maximum value proposition, short supporting sentence, mock pilot CTA and a layered Evidence Atlas composition using approved assets and a real domain preview. |
| `ProofStrip` | Three specification facts, not customer logos: supported trade scope, evidence classes and external decision surface. |
| `MoneyOutcome` | First-time acceptance rate and days-to-signature are named as pilot outcomes to measure, not as achieved metrics. Blocked value is shown only as an explained example. |
| `Statement` | One positioning sentence focused on refusing an unsupported closure, not refusing physical work or v0.1 payment presentation. |
| `EvidenceChain` | `Робота -> Вимога -> Доказ -> Рішення -> Закриття -> Акт`. No payment node appears in the v0.1 chain. |
| `ProductTour` | Four product moments: baseline and work, requirements and evidence, stage closure, act and external decision. |
| `FieldMobile` | The one Carbon band. Shows online-only PWA capture, explicit upload/receipt state and no offline durability claim. |
| `RolesDossier` | Contractor, foreman, technical supervision and owner views in one tabbed dossier rather than a card grid. |
| `Comparison` | Capability comparison against spreadsheets/chat and a generic field-management suite, using precise functional differences and no unsupported market superlatives. |
| `EvidenceIntegrity` | Three open policy columns: version pinning, attributable decisions and receipt/provenance boundaries. |
| `PilotFormat` | Replaces fabricated pricing. It explains the pilot format without prices, commitments or invented package names. |
| `FAQ` | Questions about scope, evidence, external review, online capture, electronic signature and what v0.1 does not yet include. |
| `FinalCTA` + `Footer` | Blueprint-backed closing statement, the same mock pilot CTA, concise section navigation, a product-scope note and inert `Privacy`/`Terms` labels because the mock adds no legal destinations. |

No testimonials, customer logos, pilot commitments, conversion counters,
commercial impact claims or prices are invented. Example domain records use
plausible Ukrainian construction strings and are marked as demonstration data
where a reader could mistake them for production data.

## 6. Component boundaries

`app/page.tsx` remains a Server Component and composes blocks from
`apps/landing/components/blocks/`. Content is held in one typed landing-content
module so visual components do not invent product claims.

Client Components are limited to interaction leaves:

- motion orchestration;
- role dossier switching;
- product tour tabs;
- FAQ disclosure when the shared accordion requires client state.

Landing-specific domain previews stay inside `apps/landing`. A change belongs
in `packages/ui` only when at least two blocks need the same primitive and the
primitive can be explained without construction-domain vocabulary.

Existing `@goproceed/ui/components` and `@goproceed/ui/motion` contracts are
preferred. They may be rewritten when the contract itself is inadequate, but a
thirteenth motion primitive requires a documented vocabulary decision, an index
export, a kitchen-sink example and contract coverage.

## 7. Motion design

The installed Motion package is the Framer Motion successor (`motion` 12.34.x).
Feature code imports animation only through `@goproceed/ui/motion`; direct
`motion/react` imports remain confined to the shared motion package.

Motion communicates one of four things: hierarchy, narrative order, feedback
or a durable state transition.

- Hero copy resolves once with `TextBlurIn`; the folio follows with a restrained
  y/opacity reveal.
- The evidence connector uses `LineDraw` and locks nodes in process order.
- The product tour uses `PinnedTabs` as the page's only pinned interaction.
- Role and product content swaps use `CrossFade`.
- Folio hover uses `Lift` only where elevation represents a movable sheet.
- CTA press feedback uses `Press`, even though the mock CTA performs no
  navigation.
- No second marquee, decorative pulse, cursor effect or free-floating loop is
  added.

Every shared primitive continues to use the package's `useReduced()` wrapper
over Motion's `useReducedMotion()`. The unknown hydration state is treated as
reduced, so no transform begins before the user's preference is known. Reduced
motion removes transform, blur, scroll pinning and line choreography; content
remains fully available with static layouts and opacity-only changes.

## 8. Mock interaction rules

The pilot CTA is presented visually but has no route, form, request or external
effect in this version. It is an `aria-disabled="true"` button with no handler;
assistive technology receives its unavailable state while pointer and keyboard
users receive no false navigation or submission.

Section navigation scrolls to stable anchor IDs. Role tabs, product tour tabs
and FAQ disclosures work locally and preserve keyboard interaction, focus
visibility and touch targets. There is no persistent user state.

If JavaScript fails, the primary content remains readable. Interactive blocks
start with a useful default selection; FAQ content uses an accessible disclosure
structure rather than becoming unavailable.

## 9. Responsive behaviour

The layout is checked at `1920`, `1440`, `1240`, `768`, `390` and `360` pixels.

- The hero remains within the initial desktop viewport with its CTA visible.
- Asymmetric desktop grids become strict single-column flows below `md`.
- The floating navigation becomes a compact mobile bar without wrapping.
- The evidence chain becomes a vertical sequence on mobile.
- Pinned product tour behaviour degrades to a normal stacked or horizontal-tab
  flow below `md`.
- All touch controls use the tokenised 44-pixel minimum.
- Ukrainian copy is used during every viewport check.

## 10. Metadata and performance

The page receives site-specific title, description, canonical metadata and
Open Graph/X fields. Once headline and visual direction are final, exactly one
cohesive `og.png` is generated and inspected for text accuracy before wiring it
to metadata. A failed social card is omitted rather than replaced with a generic
fallback.

Images use the framework image component with intrinsic dimensions and sensible
priority. Static content stays in Server Components; client bundles contain only
the interactive leaves. Animation changes transform and opacity only.

Targets:

- no unexpected layout shift from images or fonts;
- no horizontal overflow at the six required widths;
- Lighthouse performance and accessibility scores of at least 95 in the final
  production build. A lower score blocks completion unless the report itself
  proves the result came from audit-tool infrastructure rather than the page.

## 11. Validation

Repository UI gates run in order:

1. token generation only if `tokens.json` changes;
2. `node packages/testing/qa/motion-audit.mjs`;
3. `pnpm --filter @goproceed/testing test`;
4. `pnpm turbo run typecheck`;
5. `pnpm --filter @goproceed/landing build`.

Browser validation covers the six required widths, keyboard access, local tab
and accordion interactions, the disabled mock CTA, console errors, overflow and
the reduced-motion layout. The final source is then packaged and published with
Sites unless the user changes the delivery request to local-only.

## 12. Scope boundaries

This slice does not add lead capture, authentication, analytics, cookies,
persistence, pricing, customer proof, additional routes or product backend
behaviour. It does not change the database, Supabase, `apps/app` domain logic or
the v0.1/v0.2 boundary.
