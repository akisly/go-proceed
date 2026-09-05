---
name: GoProceed Daylight
description: Warm paper, cool ink and one cobalt mark for accountable construction evidence.
colors:
  paper: "#F6F5F1"
  surface: "#FFFFFF"
  paper-subtle: "#EFEEE8"
  ink: "#15161A"
  ink-secondary: "#4E5158"
  ink-muted: "#5E626B"
  ink-subtle: "#7A7E87"
  line: "#D9D9D6"
  line-strong: "#CFCFCC"
  cobalt: "#2B4BFF"
  accent: "#5568DE"
  accent-soft: "#EAEDFF"
  ready-surface: "#E8F4EE"
  ready-ink: "#17754A"
  review-surface: "#EAEDFF"
  review-ink: "#1E36B8"
  attention-surface: "#FAEFE8"
  attention-ink: "#A6511A"
  blocked-surface: "#FCE9E6"
  blocked-line: "#FBD5D1"
  blocked-ink: "#A02827"
typography:
  display:
    fontFamily: "Onest Variable, Onest, system-ui, sans-serif"
    fontSize: "clamp(38px, 5.2vw, 66px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Onest Variable, Onest, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.3vw, 44px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Onest Variable, Onest, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.6vw, 34px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Onest Variable, Onest, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.011em"
  data:
    fontFamily: "Onest Variable, Onest, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  label:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  field: "8px"
  panel: "10px"
  card: "12px"
  surface: "14px"
  section: "16px"
  pill: "999px"
spacing:
  base: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
  section-lg: "112px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.data}"
    rounded: "{rounded.panel}"
    padding: "0 20px"
    height: "42px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line-strong}"
    typography: "{typography.data}"
    rounded: "{rounded.panel}"
    padding: "0 20px"
    height: "42px"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line-strong}"
    typography: "{typography.data}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line}"
    typography: "{typography.data}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "42px"
  status-chip:
    backgroundColor: "{colors.ready-surface}"
    textColor: "{colors.ready-ink}"
    typography: "{typography.data}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  feature-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line-strong}"
    rounded: "{rounded.surface}"
    padding: "24px"
  bento-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line-strong}"
    rounded: "{rounded.surface}"
    padding: "24px"
  compare-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "24px"
---

# Design System: GoProceed Daylight

## Overview

**Creative North Star: "The work is ready when the proof is in place, shown on paper in daylight."**

GoProceed should feel like a construction dossier read at a desk in daylight, not
a control room. Warm paper carries the page; cool ink carries the copy; one
cobalt mark — never a wash, never a background — points at the single thing
that matters on a screen: the accent phrase in a heading, the mark itself, the
review state. Everything else is built from recognisable, restrained community
blocks (21st.dev structure, restyled in our token roles) rather than invented
decoration, so the page reads as an instrument someone can trust, not a pitch.

**Key Characteristics:**

- Warm paper (`#F6F5F1`) grounds every canvas; cool ink (`#15161A`) carries
  every value. The two are deliberately opposed in temperature — that
  opposition is the identity.
- Onest for display, body, UI and figures; JetBrains Mono for indices and
  evidence IDs. No serif anywhere in this system.
- One cobalt mark (`#2B4BFF`), used as the brand dot, the review state, the
  focus ring and — large text only — the accent phrase inside a heading.
  Never a fill behind copy, never a decorative wash.
- Structure is a 1px line and a step of lightness between four background
  roles, not a shadow ladder. `shadow-float` is reserved for the handful of
  surfaces that genuinely lift off the page: the product frame, the receipt,
  the pilot form, the route cards.
- Recognisable 21st.dev and Fora patterns — the announcement pill, the
  container-scroll product frame, the dot-pattern background, feature-grid
  cells, a bento layout, a sticky feature stack, a stepper — taken as
  structure and restyled in roles, never installed as a second system.
- Motion is the shared sixteen-word vocabulary in `@goproceed/ui/motion`, with
  exactly two scroll-linked elements on the page and never in the same fold.

## Colors

The palette is warm-paper and cool-ink: Paper holds the page, Ink carries
copy and the primary action, and Cobalt marks the few moments that are the
brand, a link, a focus ring, or the accent phrase in a heading.

### Primary

- **Cobalt** (`cobalt`): the mark. The brand dot, the signal/review state, and
  the shared focus ring. `accent` (`#5568DE`) is its large-text-only sibling —
  the highlighted phrase inside a display heading, never body copy.

### Secondary

- **Ready, Review, and Attention families** (`ready-*`, `review-*`,
  `attention-*`): paired surface and foreground roles that always accompany a
  written state, never color alone. `blocked-*` is unchanged from the prior
  system — one meaning, one red, across the app and the landing.

### Neutral

- **Paper** (`paper`): the warm page canvas, hue ≈ 95.
- **Clean Sheet** (`surface`): white — product frames, forms, cards laid over
  the canvas.
- **Paper Wash** (`paper-subtle`): sunken wells, the "was" card, inset grounds.
- **Ink** (`ink`): primary copy and the primary action fill, hue ≈ 270 — cool
  where the paper is warm.
- **Document Ink** (`ink-secondary`, `ink-muted`): secondary prose and the
  body-text floor; `ink-subtle` is metadata only, never body copy.
- **Drawing Rules** (`line`, `line-strong`): one-pixel dividers, card edges,
  table rules.

**The Signal Budget Rule.** Cobalt occupies roughly five percent or less of a
viewport; its scarcity is what makes the mark, a link or a focus ring legible
as *the* thing to look at. `bg-action-signal` — the one accent action a screen
may carry — is a ceiling, not a quota: at most one per screen, and the
landing carries none, because its primary action is ink.

**The Semantic Risk Rule.** Cobalt (review), amber (attention), red (blocked)
and green (ready) describe actual state and never serve as decorative palette
variety. There is no lime anywhere in this system.

## Typography

**Display Font:** Onest Variable (with Onest, system-ui, sans-serif fallbacks)
**Body Font:** Onest Variable (the same stack — one typeface, not two)
**Label/Mono Font:** JetBrains Mono Variable (with JetBrains Mono and
ui-monospace fallbacks)

**Character:** Onest is direct, warm and legible at every weight it is asked
to carry — headline and body alike — so the page reads as one voice instead
of a display face performing against a body face. JetBrains Mono is reserved
for indices, evidence IDs and timestamps, so a reference reads as
attributable data rather than as a stylistic flourish.

### Hierarchy

- **Display** (semibold, fluid 38–66px, tight line height): the hero
  statement, one or two lines.
- **Headline** (semibold, fluid 28–44px, tight line height): section
  headings.
- **Title** (semibold, fluid 24–34px): the heading inside a route card.
- **Body** (regular, 16px, relaxed line height): public narrative.
- **Data** (semibold, 13px): controls, values, compact labels.
- **Label** (medium, 12px, wide tracking, mono): section indices, evidence
  IDs, timestamps.

**The Weight Discipline Rule.** Four weights only — 400 / 500 / 600 / 700 —
and no more. Onest carries every one of them; nothing in this system asks a
second typeface to cover a gap.

## Layout

The public layout uses a centered 1180px marketing column (`container.
marketing`) with the app's 1240px content cap kept separately, so a product
screenshot dropped into a landing block still lines up with the shell it came
from. Sections breathe at the marketing rhythm — 64/96/112/160px depending on
the section's weight — while product surfaces keep the denser 12–32px rhythm
derived from the 4px base.

Compositions favor a dominant figure over a grid of equal cards: one product
frame in the hero, one bento layout for provenance, a sticky feature stack for
the route — never a wall of same-sized tiles standing in for a decision.
Breakpoints are `md` (768px) and `wide` (1240px) only; below `md` every
composition becomes a complete, readable single column.

## Elevation & Depth

Depth is structural, not atmospheric. Most working surfaces stay flat,
separated by paper tone and a one-pixel rule. `shadow-float` — the prototype's
signature lift — is reserved for the handful of surfaces that are genuinely
floating above the page: the product frame, the receipt, the pilot form, the
route cards, the "now" card in a comparison pair.

### Shadow Vocabulary

- **Raised** (`0px 1px 2px rgba(21, 22, 26, 0.04)`): the role-grid cell at
  rest — structure is border-led, so this is nearly invisible by design.
- **Overlay** (`0px 12px 30px -16px rgba(21, 22, 26, 0.35)`): the hero's
  floating pills, compact callouts.
- **Float** (`0px 20px 50px -30px rgba(21, 22, 26, 0.22), 0px 1px 2px rgba(21, 22, 26, 0.05)`):
  the board, the receipt, the form, the route cards. Marketing only — no
  colour tint, even on the selected "now" card.

**The Structural Shadow Rule.** A shadow must explain overlap; ordinary
document cells, rows and textual sections stay flat.

## Shapes

Radius is graduated by what it is rounding: `field` (8px) for inputs and
inline evidence tiles, `panel` (10px) for buttons and the UI windows inside a
route card, `card` (12px) for the figure and the pilot form, `surface` (14px)
for route cards, the role grid, bento cells and compare cards, `section`
(16px) for the closing CTA card, and `pill` (999px) for status chips, the
announcement pill and the floating nav.

**The Document Edge Rule.** Round the outer instrument, not every internal
partition. A table rule or a nested key-value row keeps its edge crisp.

## Components

### Buttons

- **Ink** (`button-ink`): near-black fill, white text — the primary action on
  every screen, including the landing, where it is the *only* action; there
  is no accent button on the public page.
- **Outline** (`button-outline`): surface ground, a strong-line border — the
  secondary action, and the only other button variant. There is no signal
  button on the landing.
- **Height:** 42px on marketing (`control-height-marketing`), read through
  `size="lg"` — never a hard-coded `h-11`. Touch keeps the 44px floor.

### Status Chips

- **Style:** a pill combining a semantic surface, a matching border and dark
  semantic text, with an optional leading dot — never colour alone.
- **Tones:** ready (green), review (cobalt — "на розгляді" reads in the mark's
  own hue, not a second brand colour), attention (amber), blocked (red,
  unchanged from the prior system).

### Cards / Cells

- **Feature cell:** a 1px-gap grid of cells on a strong line, `rounded-
  surface`, with a pointer spotlight on hover.
- **Bento cell:** `surface` background, strong-line border, `rounded-surface`;
  one cell may span two rows.
- **Compare card:** a "was" card (dashed, on `paper-subtle`) beside a "now"
  card (`border-accent`-tinted, lifted with `shadow-float`, never a coloured
  shadow).

### Inputs / Fields

- **Style:** surface background, a 1px line, `rounded-field`, a visible
  label, 42px marketing height with a 44px touch floor.
- **Focus:** the cobalt focus ring, one treatment for every focusable
  element.

### Navigation

A fixed 58px bar (`header-height-marketing`) with a hairline at its base:
mark and wordmark at left, four links with a sliding underline that also
marks the active section, one ink button at right. Below `md` the links hide
and the button shortens to «Пілот».

## Do's and Don'ts

### Do:

- **Do** keep one cobalt mark per screen's worth of attention — the brand
  dot, a link, a focus ring, or the accent phrase in a heading — and nothing
  else in that hue.
- **Do** build from recognisable community structure (21st.dev, Fora),
  restyled entirely in token roles, with the source named per block.
- **Do** use thin rules and paper tone, not shadows, to separate ordinary
  content.
- **Do** pair every status colour with a written label.
- **Do** make every animated explanation a complete, readable composition
  under reduced motion — a different composition, never a faster one.

### Don't:

- **Don't** add a second accent colour, a gradient fill, or a lime survivor
  anywhere in the system — cobalt is the only accent hue.
- **Don't** use 3D, tilt, or pointer-driven perspective on any surface. The
  product frame settles once on scroll entry; it never tracks the pointer.
- **Don't** run any animation forever except the marquee — the Border Beam is
  finite, two passes, and stops.
- **Don't** imply status through colour alone, or claim a document is signed
  when it is a draft.
- **Don't** put a testimonial, a price other than "free", a customer name, or
  a company logo in public copy — the pilot is free and unattributed by
  design.
