# GoProceed Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing token proof with a complete, responsive Ukrainian Evidence Atlas marketing mock for construction teams.

**Architecture:** Keep `app/page.tsx` as a server composition root, store all approved copy and product facts in a typed content module, and split each visual block into a focused component under `components/blocks`. Use only shared semantic utilities and the existing `@goproceed/ui/motion` vocabulary; interactive motion stays in client leaves such as `PinnedTabs`, while all mock CTAs remain inert.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript 5.9, Tailwind CSS 4.3, Motion 12 through `@goproceed/ui/motion`, Vitest 3.2.4, Sites hosting.

**Spec:** `docs/superpowers/specs/2026-08-20-landing-site-design.md`

## Global Constraints

- Work only on branch `codex/landing-site` in the existing linked worktree.
- Page language and metadata are Ukrainian; visible copy does not use em dashes.
- Use semantic role utilities from `@goproceed/ui/base.css`; do not add hex values, primitive ramp names, raw palette variables, or dynamic Tailwind class templates.
- Import motion only from `@goproceed/ui/motion`; use the existing twelve primitives unless a reusable missing contract is proved by two or more blocks.
- The product chain is exactly `Робота -> Вимога -> Доказ -> Рішення -> Закриття -> Акт`.
- Do not claim payment gates, package versions, durable offline capture, partial commercial acceptance, KEP, customers, pricing, ROI, or production availability.
- Primary CTA is a mock `button` with `type="button"`, `aria-disabled="true"`, and `disabled`; it has no handler, link, form, or route.
- Preserve the approved Carbon/Paper/Lime theme, Inter body, Source Serif display, and JetBrains Mono evidence labels.
- Use the three approved Evidence Atlas assets and generate exactly one `public/og.png` after visible content stabilises.
- Desktop product tour may use `PinnedTabs`; reduced motion must stack all tour panels and remove pinning.
- Required final gates: motion audit, landing tests, `@goproceed/testing` tests, repo typecheck, landing build, responsive browser QA at 1920/1440/1240/768/390/360, and reduced-motion QA.
- Known baseline on 2026-08-20: landing typecheck and motion audit pass; `@goproceed/testing` has four unrelated failures from stale `apps/demo` paths and an unsynchronised `tailwind-merge` install. Keep this fact separate from landing regressions.

---

### Task 1: Establish Landing Contracts and Typed Content

**Files:**
- Modify: `apps/landing/package.json`
- Create: `apps/landing/tests/landing-content.test.ts`
- Create: `apps/landing/content/landing-content.ts`

**Interfaces:**
- Produces: `landingContent`, `LandingContent`, `EvidenceStep`, `TourChapter`, `RoleDossier`, and `FaqEntry`.
- Consumers: every block component in Tasks 2-5.

- [ ] **Step 1: Add the landing test command and write the failing contract tests**

  Add `"test": "vitest run"` to scripts and `"vitest": "3.2.4"` to devDependencies. Create a test importing the not-yet-created `landingContent` and asserting independently derived behavior:

  ```ts
  import { describe, expect, it } from "vitest";
  import { landingContent } from "../content/landing-content";

  const flatten = (value: unknown): string =>
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value.map(flatten).join(" ")
        : value && typeof value === "object"
          ? Object.values(value).map(flatten).join(" ")
          : "";

  describe("landing product truth", () => {
    it("keeps the evidence chain in the approved operational order", () => {
      expect(landingContent.evidence.steps.map((step) => step.label)).toEqual([
        "Робота", "Вимога", "Доказ", "Рішення", "Закриття", "Акт",
      ]);
    });

    it.each(["оплат", "КЕП", "офлайн", "клієнти", "економія %"])(
      "does not publish the unsupported claim %s",
      (claim) => expect(flatten(landingContent).toLowerCase()).not.toContain(claim.toLowerCase()),
    );

    it("defines four real product-tour chapters", () => {
      expect(landingContent.tour).toHaveLength(4);
      expect(landingContent.tour.every((chapter) => chapter.id && chapter.label && chapter.hint)).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run the content test and verify RED**

  Run: `pnpm --filter @goproceed/landing test -- tests/landing-content.test.ts`

  Expected: FAIL because `../content/landing-content` does not exist.

- [ ] **Step 3: Implement the typed content catalog**

  Create one `as const satisfies LandingContent` object containing navigation, hero, proof strip, money outcome, statement, six evidence steps, four tour chapters, field capture, three role dossiers, comparison rows, integrity points, pilot format, FAQ, and final CTA. Use factual labels such as `ВРУ-1 · Секція А`, `ДБН А.3.1-5:2016`, `EV-0248`, and `Акт прихованих робіт · чернетка`, but no named customer, price, ROI, or unavailable product capability.

- [ ] **Step 4: Run the content test and verify GREEN**

  Run: `pnpm --filter @goproceed/landing test -- tests/landing-content.test.ts`

  Expected: PASS with three contract groups and no warnings.

- [ ] **Step 5: Commit the content contract**

  ```bash
  git add apps/landing/package.json apps/landing/tests/landing-content.test.ts apps/landing/content/landing-content.ts pnpm-lock.yaml
  git commit -m "feat(landing): define evidence-led content contract"
  ```

### Task 2: Build the Page Frame and First Narrative Fold

**Files:**
- Create: `apps/landing/tests/landing-render.test.tsx`
- Create: `apps/landing/components/section-shell.tsx`
- Create: `apps/landing/components/mock-action.tsx`
- Create: `apps/landing/components/blocks/nav-float.tsx`
- Create: `apps/landing/components/blocks/hero.tsx`
- Create: `apps/landing/components/blocks/proof-strip.tsx`
- Create: `apps/landing/components/blocks/money-outcome.tsx`
- Create: `apps/landing/components/blocks/statement.tsx`
- Modify: `apps/landing/app/page.tsx`
- Modify: `apps/landing/app/globals.css`

**Interfaces:**
- Consumes: `landingContent` from Task 1; `Reveal`, `Stagger`, `StaggerItem`, `TextBlurIn`, and `LineDraw` from `@goproceed/ui/motion`.
- Produces: `SectionShell`, `MockAction`, `NavFloat`, `Hero`, `ProofStrip`, `MoneyOutcome`, and `Statement`.

- [ ] **Step 1: Write the failing semantic-render tests**

  Render `<LandingPage />` with `renderToStaticMarkup` and assert that a realistic regression is caught:

  ```tsx
  import { renderToStaticMarkup } from "react-dom/server";
  import { describe, expect, it } from "vitest";
  import LandingPage from "../app/page";

  const html = renderToStaticMarkup(<LandingPage />);

  describe("landing semantic frame", () => {
    it("publishes one main heading and the first four narrative landmarks", () => {
      expect(html.match(/<h1/g)).toHaveLength(1);
      for (const id of ["product", "proof", "workflow", "pilot"]) {
        expect(html).toContain(`id="${id}"`);
      }
    });

    it("keeps every pilot action inert", () => {
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain("disabled");
      expect(html).not.toContain('href="/pilot');
      expect(html).not.toContain("<form");
    });
  });
  ```

- [ ] **Step 2: Run the render test and verify RED**

  Run: `pnpm --filter @goproceed/landing test -- tests/landing-render.test.tsx`

  Expected: FAIL because the token proof lacks the approved landmarks and inert CTA contract.

- [ ] **Step 3: Implement the shared page frame**

  `SectionShell` renders a semantic `<section>` with a content-width inner wrapper, optional eyebrow, and an actual heading. `MockAction` wraps the shared `Button` with `type="button"`, `disabled`, and `aria-disabled="true"`; it accepts only `children`, `variant`, and `className`, so a click handler or URL cannot be passed accidentally.

- [ ] **Step 4: Implement navigation, hero, proof, outcome, and statement**

  Replace the token proof with the first narrative fold. The hero uses one Source Serif `<h1>`, a compact mono evidence label, a real cable-tray evidence image, a document/evidence folio, one inert Lime CTA, and one local `#workflow` anchor. The proof strip contains product facts rather than customer logos. MoneyOutcome visualises rework exposure as a factual process equation, and Statement uses oversized editorial type with no cards.

- [ ] **Step 5: Add landing-only composition CSS**

  Add named classes only for compositions Tailwind cannot express cleanly: `landing-blueprint`, `landing-paper-grid`, `landing-folio`, and print-like registration marks. Each declaration must use semantic variables such as `var(--color-line)` and `var(--color-surface)`; motion remains in shared primitives and responsive layout remains in literal Tailwind utilities.

- [ ] **Step 6: Run tests, motion audit, and typecheck**

  Run: `pnpm --filter @goproceed/landing test && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing typecheck`

  Expected: all landing tests PASS; audit says `motion-audit: clean`; typecheck exits 0.

- [ ] **Step 7: Commit the first coherent slice**

  ```bash
  git add apps/landing/app apps/landing/components apps/landing/tests
  git commit -m "feat(landing): compose evidence atlas hero"
  ```

### Task 3: Add the Evidence Workflow and Product Tour

**Files:**
- Create: `apps/landing/components/mock-panels.tsx`
- Create: `apps/landing/components/blocks/evidence-chain.tsx`
- Create: `apps/landing/components/blocks/product-tour.tsx`
- Create: `apps/landing/components/blocks/field-mobile.tsx`
- Modify: `apps/landing/app/page.tsx`
- Modify: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `landingContent.evidence`, `landingContent.tour`, and `landingContent.field`; shared `PinnedTabs`, `NodeLock`, `CrossFade`, `Reveal`, and `Stagger` motion primitives.
- Produces: `EvidenceChain`, `ProductTour`, `FieldMobile`, `RequirementPanel`, `CapturePanel`, `ReviewPanel`, and `ActPanel`.

- [ ] **Step 1: Extend the render test for workflow behavior**

  Assert that the rendered output contains all six chain labels in order, the four tour panel headings, one `role="tablist"` or reduced-motion stacked equivalent, and explicit closure-blocked text. Run the test and confirm it fails because these blocks do not exist.

- [ ] **Step 2: Implement the evidence chain**

  Render six bordered stations connected by a shared `LineDraw`; each station carries a mono index, label, and one sentence. The `Закриття` station visibly shows both allowed and blocked states using text plus semantic status colour, never colour alone.

- [ ] **Step 3: Implement real product mock panels**

  Build four focused UI compositions from semantic HTML rather than screenshot-shaped rectangles: a requirement record, evidence capture receipt, technical-supervision decision receipt, and act draft. Use the shared `Panel`, `Chip`, `Figure`, and `Table` primitives where their contracts fit.

- [ ] **Step 4: Implement the pinned product tour**

  Create four `PinnedTab` entries with stable ids `requirements`, `capture`, `review`, and `act`. `PinnedTabs` remains the only pinned/scroll-linked block on the page. Do not add custom `motion.*` imports or scroll listeners.

- [ ] **Step 5: Implement the Carbon field-mobile band**

  Use the approved cable-tray evidence image in a mobile capture frame, include requirement reference, timestamp, origin, and required-photo checklist. The copy must explicitly say the field experience is online-only in v0.1 without presenting that as an error state.

- [ ] **Step 6: Run landing tests, motion audit, and typecheck**

  Run: `pnpm --filter @goproceed/landing test && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing typecheck`

  Expected: PASS, clean audit, zero type errors.

- [ ] **Step 7: Commit the workflow slice**

  ```bash
  git add apps/landing/app/page.tsx apps/landing/components apps/landing/tests/landing-render.test.tsx
  git commit -m "feat(landing): show evidence workflow and field capture"
  ```

### Task 4: Add Decision Support, Integrity, and Pilot Format

**Files:**
- Create: `apps/landing/components/blocks/roles-dossier.tsx`
- Create: `apps/landing/components/blocks/comparison.tsx`
- Create: `apps/landing/components/blocks/evidence-integrity.tsx`
- Create: `apps/landing/components/blocks/pilot-format.tsx`
- Modify: `apps/landing/app/page.tsx`
- Modify: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `landingContent.roles`, `comparison`, `integrity`, and `pilot`.
- Produces: `RolesDossier`, `Comparison`, `EvidenceIntegrity`, and `PilotFormat`.

- [ ] **Step 1: Extend the render contract**

  Add assertions for three role headings, the comparison table accessible name, the integrity receipt id `EV-0248`, and pilot-format copy that contains no currency symbol. Verify RED against the page from Task 3.

- [ ] **Step 2: Implement role dossiers**

  Compose three overlapping document surfaces for owner/commercial director, PTV head, and foreman. Each surface contains `Бачить`, `Вирішує`, and `Отримує` rows, not generic feature bullets. Use asymmetry on desktop and a single-column reading order on mobile.

- [ ] **Step 3: Implement the comparison ledger**

  Use a real accessible table comparing chat/files/spreadsheets with GoProceed across binding, origin, review, closure gate, and act draft. Avoid fabricated ratings and competitor trademarks.

- [ ] **Step 4: Implement the integrity receipt**

  Pair the verified-stamp asset with a dense evidence receipt showing immutable origin facts, requirement reference, capture time, author, decision, and event id. Use the stamp as supporting imagery, not the only status signal.

- [ ] **Step 5: Implement pilot format instead of pricing**

  Present a bounded collaboration format: one real project, one defined work package, selected requirements, field capture, technical-supervision review, and an end-of-pilot evidence audit. No duration or commercial terms are invented.

- [ ] **Step 6: Run RED-GREEN verification and commit**

  Run: `pnpm --filter @goproceed/landing test && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing typecheck`

  Then commit:

  ```bash
  git add apps/landing/app/page.tsx apps/landing/components apps/landing/tests/landing-render.test.tsx
  git commit -m "feat(landing): add decision and integrity story"
  ```

### Task 5: Complete FAQ, Final CTA, Footer, Assets, and Metadata

**Files:**
- Create: `apps/landing/components/blocks/faq.tsx`
- Create: `apps/landing/components/blocks/final-cta.tsx`
- Create: `apps/landing/components/blocks/footer.tsx`
- Create: `apps/landing/public/images/blueprint-folio.png`
- Create: `apps/landing/public/images/cable-tray-evidence.png`
- Create: `apps/landing/public/images/verified-stamp.png`
- Modify: `apps/landing/app/page.tsx`
- Modify: `apps/landing/app/layout.tsx`
- Modify: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: approved Evidence Atlas assets and the final content catalog.
- Produces: complete page composition and Next `Metadata` with OG image path `/og.png`.

- [ ] **Step 1: Extend render tests for the completed document**

  Assert FAQ region semantics, final inert CTA, footer product disclaimer, Ukrainian `<html lang="uk">`, and image alt text. Verify RED before adding the blocks.

- [ ] **Step 2: Copy the three approved raster assets**

  Copy from `design-references/evidence-atlas/assets/` into `apps/landing/public/images/` without recompression. Verify their dimensions with `file` or `identify`; do not ship old AktFlow concept boards.

- [ ] **Step 3: Implement FAQ and final CTA/footer**

  Use the shared `Accordion` for factual answers. The final Carbon field contains one Lime mock action and a calm proof sentence. Footer links that would leave the mock are rendered as disabled text; local section links remain real anchors.

- [ ] **Step 4: Update metadata**

  Export typed `Metadata` with title `GoProceed | Від вимоги до доказу й акта`, an accurate Ukrainian description, canonical root metadata base when the hosting URL is known, Open Graph/Twitter entries, and `/og.png` references.

- [ ] **Step 5: Run landing tests, audit, typecheck, and first build**

  Run: `pnpm --filter @goproceed/landing test && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing typecheck && pnpm --filter @goproceed/landing build`

  Expected: all commands exit 0.

- [ ] **Step 6: Commit the complete local page**

  ```bash
  git add apps/landing
  git commit -m "feat(landing): complete evidence atlas narrative"
  ```

### Task 6: Generate the Single Social Card

**Files:**
- Create: `apps/landing/public/og.png`

**Interfaces:**
- Consumes: final hero copy and approved Evidence Atlas direction.
- Produces: a 1200x630 social image referenced by metadata.

- [ ] **Step 1: Read and invoke the `imagegen` skill once**

  Request one editorial construction evidence social card: warm paper field, cropped technical drawing, cable-tray documentary photo treatment, carbon registration marks, restrained lime verification signal, `GoProceed` wordmark area, no extra invented UI and no unreadable body text.

- [ ] **Step 2: Inspect the generated result**

  Use the image viewer and check legibility, brand palette, absence of fake logos, and safe central crop. Retry at most once only if the result is unusable, as required by the Sites skill.

- [ ] **Step 3: Save and verify the asset**

  Save as `apps/landing/public/og.png`, verify PNG type and 1200x630 dimensions, then run the landing build.

- [ ] **Step 4: Commit the social card**

  ```bash
  git add apps/landing/public/og.png apps/landing/app/layout.tsx
  git commit -m "feat(landing): add social preview card"
  ```

### Task 7: Browser QA and Polish

**Files:**
- Modify: only the specific landing files implicated by failing tests or visual QA.
- Create: `apps/landing/qa/landing.mjs` only if a repeatable browser regression needs automation.

**Interfaces:**
- Consumes: the complete local landing page.
- Produces: validated responsive, accessible, reduced-motion behavior.

- [ ] **Step 1: Start the dev server and open the first meaningful preview**

  Run `pnpm --filter @goproceed/landing dev`, make a lightweight HTTP request to `http://localhost:3100`, and open that exact URL in the Codex browser. Keep reusing the same tab.

- [ ] **Step 2: Inspect the six required viewports**

  Check 1920, 1440, 1240, 768, 390, and 360 pixels wide. At each width confirm no horizontal overflow, no clipped folios, readable tables, correct section rhythm, and a single-column evidence reading order on phones.

- [ ] **Step 3: Inspect interaction and accessibility states**

  Keyboard through local navigation, tabs, FAQ, and mock actions; confirm visible focus, 44px touch controls, correct landmarks/headings, meaningful image alternatives, and no disabled CTA that announces itself as a link.

- [ ] **Step 4: Inspect reduced motion**

  Emulate `prefers-reduced-motion: reduce`; confirm blur/reveals resolve immediately, the product tour unpins and shows all four panels, and no essential information depends on animation.

- [ ] **Step 5: Fix each discovered regression with TDD**

  For behavioral bugs, add a failing landing test or browser QA assertion, watch it fail, make the smallest fix, and rerun it. For purely visual defects, adjust semantic layout utilities and recapture the implicated viewport.

- [ ] **Step 6: Run the complete local verification gate**

  Run in order:

  ```bash
  node packages/testing/qa/motion-audit.mjs
  pnpm --filter @goproceed/landing test
  pnpm --filter @goproceed/testing test
  pnpm turbo run typecheck
  pnpm --filter @goproceed/landing build
  ```

  If the four recorded baseline failures remain, prove the landing-specific tests, audit, typecheck, and build are green and report the unrelated baseline separately; do not conceal it.

- [ ] **Step 7: Commit QA fixes**

  ```bash
  git add apps/landing
  git commit -m "fix(landing): polish responsive evidence narrative"
  ```

### Task 8: Publish the Validated Mock with Sites

**Files:**
- Create: `.openai/hosting.json`
- Modify: `apps/landing/app/layout.tsx` only if the final canonical URL must be inserted.

**Interfaces:**
- Consumes: exact validated commit from Task 7.
- Produces: one private Sites project/version and a stable preview URL.

- [ ] **Step 1: Re-read the Sites hosting workflow and create the site once**

  Use the Sites MCP create operation once, save its site id and credential header to `.openai/hosting.json`, and never print the credential value.

- [ ] **Step 2: Persist and commit hosting metadata**

  Add `.openai/hosting.json` and, if known, set `metadataBase` to the final site origin. Rerun landing tests and build, then commit the exact source to deploy.

- [ ] **Step 3: Push, package, and create a private version**

  Push the validated branch using the Sites credential header, package the app with the Sites helper, create one private version, and poll until deployment reaches a terminal status.

- [ ] **Step 4: Smoke-test the deployed URL**

  Open the deployed preview in the existing browser tab and verify hero, images, product tour, FAQ, `og.png`, and an inert pilot CTA.

- [ ] **Step 5: Report the branch, commits, gates, known baseline, and Sites URL**

  Provide concise handoff links to the spec, implementation plan, primary page file, and deployed preview. Do not claim the full repository test suite passed if the recorded unrelated baseline is still failing.
