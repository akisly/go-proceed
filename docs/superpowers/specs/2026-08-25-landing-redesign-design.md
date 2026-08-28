# GoProceed landing redesign

**Status:** Approved direction in chat on 2026-08-25; written review pending

**Scope:** `apps/landing` only, except for a narrowly justified shared-motion fix
when an existing `@goproceed/ui/motion` contract blocks the approved experience

**Supersedes:** the visual composition and page architecture in
`2026-08-20-landing-site-design.md`; its product-truth, accessibility and
scope boundaries remain binding

## 1. Outcome

Turn the existing long catalogue of marketing sections into one persuasive,
domain-specific story. The page should feel as deliberate and product-led as
Linear and Folio while remaining unmistakably about construction evidence:
drawings, required captures, site photographs, external decisions, closure and
the draft act are the visual material.

The visitor should understand one example from start to finish and either open
the evidence story or begin a small pilot enquiry. No section ships merely to
fill vertical space, repeat a previous claim or display a generic SaaS pattern.

## 2. Audience and page job

The primary reader remains the owner, commercial director or head of PTV at a
Ukrainian electrical/MEP subcontractor. The page has one job: make that reader
willing to test GoProceed on one bounded package of real work.

The argument is:

1. a blocking requirement is known before concealment;
2. the foreman sees the exact capture needed on site;
3. the evidence keeps its work, author, time, place and source;
4. technical supervision can decide through a narrow no-account surface;
5. an unmet blocking requirement prevents recorded stage closure;
6. accepted facts can populate a draft statutory act.

The landing must not imply that GoProceed blocks physical work, produces a
signed act, supports qualified electronic signatures, provides durable offline
capture or ships the v0.2 payment-presentation gate.

## 3. Chosen direction: Evidence Journey

The approved direction is **Evidence Journey**: the existing Evidence Atlas
identity becomes a continuous route rather than a collection of independent
blocks.

- Linear contributes restraint, decisive hierarchy, large product scenes and
  calm information density.
- Folio contributes a generous hero, product UI as the proof, and layered
  foreground/background composition.
- GoProceed supplies the distinctive material: blueprint rules, a real-looking
  electrical work record, evidence imagery, requirement IDs, a review receipt
  and an act fragment.

The signature element is a continuous **evidence rail**. It begins as a marked
requirement on a drawing, crosses the site photograph and external decision,
then resolves into an allowed closure and draft act. It is structural, not
decorative: every node corresponds to a real domain transition.

## 4. Visual system

The redesign retains the canonical token roles and uses no new raw colours.

- **Canvas:** Paper/White for approximately three quarters of the page.
- **Ink:** Carbon for copy, product chrome and one field interval.
- **Signal:** Lime only for the primary action, the active evidence-rail node or
  a verified state. It never becomes ambient decoration.
- **Risk:** existing amber/red semantic roles only for pending or blocked facts.
- **Type:** Source Serif 4 remains the restrained display face; Inter carries
  reading and UI; JetBrains Mono carries IDs, timestamps and references.
- **Structure:** thin rules, document edges and one main product frame. Generic
  rounded-card grids, ornamental badges, gradients and repeated shadows are
  removed.
- **Imagery:** keep the approved synthetic `cable-tray-evidence.png`,
  `blueprint-folio.png` and `verified-stamp.png`. Product visuals remain
  code-native so their Ukrainian labels stay legible and responsive.

The layout is dense where the product is being demonstrated and generous where
the reader needs to understand the consequence. Blank space must separate
ideas, not compensate for weak content.

## 5. Page architecture

The page is reduced to six scenes plus navigation and footer.

### Scene 1 — Thesis and live dossier

The hero opens with a shorter two-line thesis: requirement to accepted evidence,
not a broad construction-software promise. One primary action begins the pilot
enquiry; one secondary action scrolls into the evidence route.

The current full dashboard becomes a more focused live dossier: one work line,
one blocking requirement, the site photograph and the current review state.
The larger project context remains visible around it but is visually secondary.
The first viewport should already show the start of the dossier on desktop and
the complete thesis/action on mobile.

### Scene 2 — One evidence route

The current proof strip, evidence chain and product-tour introduction merge into
one narrative. A sticky product canvas on desktop shows three chapters:

1. drawing plus `R-041` before work;
2. `EV-0248` captured on site and submitted for external review;
3. `DR-0091`, allowed closure and draft act.

The text moves in normal document flow while the evidence rail advances through
the shared visual. There is no automatic tab rotation. On smaller screens the
three chapters stack in full and preserve the same order without sticky
behaviour.

### Scene 3 — Field to decision

The one Carbon interval stages the actual hand-off instead of explaining mobile
capture in isolation: foreman phone on the left, no-account supervision review
on the right, and the evidence receipt between them. The real cable-tray image
is the focal point. Copy explicitly states that the current capture requires an
active connection.

Role value is expressed inside the scene through the decision each participant
makes. The separate role-card grid is removed.

### Scene 4 — Project state as a diagram

A code-native readiness diagram replaces a generic comparison table. It shows
how sample work moves between `ready`, `in review` and `blocked`, and why a
single unmet requirement blocks recorded closure. The figures are labelled as
demonstration data and are never presented as customer outcomes.

A compact before/after annotation explains the difference between fragmented
channels and a linked event chain. The separate comparison section is removed.

### Scene 5 — Trust and product boundary

The provenance receipt becomes a large, quiet document surface. Its event
timeline, source and decision are directly visible. Beside it, a concise scope
note names what v0.1 does and does not do. This absorbs the useful content from
the current integrity section without producing another three-column feature
catalogue.

### Scene 6 — Pilot enquiry and FAQ

The close asks for one bounded package of work, then presents a compact form in
the same visual scene. Fields:

- name;
- company;
- reply contact (email, phone or messenger handle);
- role;
- short context: project or process to test.

For this temporary version, submission does not claim server delivery. The
validated values are encoded into a Ukrainian email addressed to
`akisliy2306@gmail.com`, and the visitor's mail client opens with subject and
body prefilled. The interface then says clearly that the message still needs to
be sent from that mail client. A copy-message fallback is provided if no mail
client opens. This preserves a working action without adding an unconfigured
third-party processor or pretending the planned `/pilot-leads` endpoint exists.

The FAQ follows inside the same closing scene and contains only questions that
resolve adoption or product-boundary concerns. The pilot-format card and
standalone FAQ section are removed.

## 6. Component and data boundaries

`app/page.tsx` remains a Server Component. The intended block boundaries are:

- `nav-float.tsx`;
- `hero.tsx` plus a focused dossier visual;
- `evidence-journey.tsx` with a small client leaf for active chapter state;
- `field-review.tsx`;
- `readiness-diagram.tsx`;
- `trust-boundary.tsx`;
- `pilot-enquiry.tsx` with a client form leaf;
- `footer.tsx`.

Factual copy and demonstration records stay in `content/landing-content.ts`.
Components do not invent claims. The mailto subject/body builder is a pure
function with unit coverage. Existing block files that no longer map to an
independent idea are deleted after their content is either absorbed or removed.

The page must not import the whole shared component barrel when a direct public
subpath exists. The current development-server failure caused by unrelated
shared barrel exports resolving absent table/form dependencies must be removed
as part of making the landing independently runnable.

## 7. Motion and interaction

Motion has one narrative job: show the evidence rail moving from obligation to
durable decision.

- Hero copy and dossier resolve once on load with short opacity/y choreography.
- Evidence Journey updates the active rail node when its chapter crosses a
  stable viewport threshold; the product visual cross-fades without autoplay.
- Field-to-review hand-off draws once when the scene enters.
- Buttons use restrained press/hover feedback; document surfaces do not float
  without meaning.
- FAQ uses accessible disclosure behaviour.

Reduced motion removes sticky choreography, transforms, blur and line drawing.
All three evidence chapters remain visible as a static stack. Content does not
begin invisible in a way that produces blank full-page captures or no-JavaScript
gaps.

## 8. Responsive and accessibility contract

The implementation is checked at `1440`, `1024`, `768`, `390` and `360` pixels.

- No horizontal overflow, clipped product labels or nav wrapping.
- The dossier becomes a cropped but meaningful mobile product frame rather than
  a scaled-down desktop screenshot.
- Sticky scenes become normal stacked sections below the desktop breakpoint.
- Form fields have visible labels, useful autocomplete attributes and inline
  error text; status is announced through a live region.
- Touch targets are at least 44 pixels and keyboard focus is always visible.
- Charts and diagrams carry text equivalents and never rely on colour alone.
- With JavaScript unavailable, the product story and FAQ questions remain
  readable and the email address remains reachable.

## 9. Performance and validation

No additional image or chart library is introduced. SVG diagrams are small and
code-native; approved raster assets use the framework image component with
intrinsic dimensions. Client JavaScript is limited to the journey state,
disclosures and enquiry form.

Validation includes:

1. landing content, render, metadata and no-filler tests;
2. unit tests for required fields, email body encoding and copy fallback;
3. `pnpm --filter @goproceed/landing typecheck`;
4. `pnpm --filter @goproceed/landing test`;
5. `pnpm --filter @goproceed/landing build`;
6. one bounded browser QA pass at desktop and mobile, covering form behaviour,
   keyboard interaction, overflow, reduced motion and console errors;
7. one batched correction pass and a final confirmation capture.

## 10. Scope boundaries

This redesign does not add authentication, analytics, a lead database, a
third-party form processor, a deployed email API, product routes, pricing,
customer logos, testimonials or fabricated outcome metrics. A seamless
server-sent email flow can replace the temporary mailto builder after the
planned privacy-minimised `/pilot-leads` operation is implemented and deployed.
