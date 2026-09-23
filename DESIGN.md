---
name: GoProceed Autumn
description: Warm paper, warm ink, a deep green that carries the brand and one orange spark, for accountable construction evidence.
colors:
  paper: "#ECE9DF"
  surface: "#FFFFFF"
  paper-subtle: "#E6E2D7"
  ink: "#0C0C0A"
  ink-secondary: "#514B46"
  ink-muted: "#665F58"
  ink-subtle: "#7B736A"
  line: "#D1CDC7"
  line-strong: "#C7C3BD"
  pine: "#395A4D"
  accent: "#395A4D"
  accent-soft: "#E2F1EA"
  ember: "#FF5B04"
  on-ember: "#0C0C0A"
  ready-surface: "#E0F5E3"
  ready-ink: "#167337"
  review-surface: "#EAEDFF"
  review-ink: "#1E36B8"
  attention-surface: "#FBEFD8"
  attention-ink: "#875D00"
  blocked-surface: "#FEE8E7"
  blocked-line: "#FED4D3"
  blocked-ink: "#A3122C"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(38px, 5.2vw, 66px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Hanken Grotesk Variable, Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.3vw, 44px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Hanken Grotesk Variable, Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.6vw, 34px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Hanken Grotesk Variable, Commissioner Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.011em"
  data:
    fontFamily: "Hanken Grotesk Variable, Commissioner Variable, system-ui, sans-serif"
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
  # Both button entries describe the MARKETING button — `<Button size="lg">`,
  # the 42px control. `rounded.panel` is that size only; every app size
  # (`default`, `sm`, `icon`) keeps `rounded.control` from the component's BASE.
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.data}"
    size: "lg"
    rounded: "{rounded.panel}"
    padding: "0 20px"
    height: "42px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.line-strong}"
    typography: "{typography.data}"
    size: "lg"
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

# Design System: GoProceed Autumn

## Overview

**Creative North Star: "The work is ready when the proof is in place, shown on paper in daylight."**

*[2026-09-22, DEV-028, owner: a brand sheet — a warm neutral ramp from #0C0C0A
to white, paper #ECE9DF, #FF5B04, #395A4D, Hanken Grotesk — and «сделай
основным #395A4D, а секондари #FF5B04». The system's name, palette and
typeface are that sheet; the north star, the structure and the motion
vocabulary are unchanged. THREE rules moved with the colours, and they are
marked where they sit: the accent may now carry body copy (pine clears 4.5:1,
where cobalt cleared only the 3:1 large-text bar); the accent may be a wash
under copy (`bg-accent-soft`, 1.04:1 against the canvas); and the one coloured
shadow follows the accent rather than the mark. Everything else below is as it
was. What was «warm paper, cool ink and one
cobalt mark» is now warm paper, warm ink, the deep green that carries the brand
and one orange spark. The previous palette is recorded in this document's
history and in the ruling prose of `packages/tokens/src/tokens.json`.]*

GoProceed should feel like a construction dossier read at a desk in daylight,
not a control room. Warm paper carries the page; warm ink carries the copy; the
brand's deep green marks what a reader has to find — a link, the focus ring,
the accent phrase in a heading, the ornament under a figure — and one orange
spark, scarce by contract, is what the eye lands on first. Everything else is
built from recognisable, restrained community blocks (21st.dev structure,
restyled in our token roles) rather than invented decoration, so the page reads
as an instrument someone can trust, not a pitch.

**Key Characteristics:**

- Warm paper (`#ECE9DF`) grounds every canvas; warm ink (`#0C0C0A`) carries
  every value. Both come from the brand sheet's own ramp, which runs from that
  black to white without a cool step: the temperature is carried by the two
  brand colours now, not by the distance between ink and paper.
- Hanken Grotesk for display, body, UI and figures, with **Commissioner behind
  it for Cyrillic** — Hanken carries no Cyrillic at all, and the public copy is
  Ukrainian. JetBrains Mono for indices and evidence IDs. No serif anywhere.
- **Pine (`#395A4D`) is the primary.** It is the brand as a word, the link, the
  focus ring, the accent phrase in a display heading and the colour of every
  ornament on the landing. It is the text-safe half of the pair: 6.30:1 on the
  paper.
- **Ember (`#FF5B04`) is the secondary — the spark.** 2.56:1 on the paper, so
  it is never text and never a line that has to be seen: it is the one accent
  action a screen may carry (black on orange, never white) and the light
  travelling on a dark pill, where the primary would disappear. *[2026-09-22,
  owner: «сделай кнопку в лого зеленой, а текст черным» — the mark's dot is the
  PRIMARY now, and the wordmark is ink. The logo is where both brand colours
  could have stood together; the owner chose green on the mark and black on the
  name.]* *[2026-09-22, DEV-029: counted properly, ember is on the landing as LIGHT
  in three places and as a FILL in none: the ink pills' travelling light, the
  board's beam ring (`@utility beam`) and the tap highlight. For one pass the
  closing call and the pilot submit were orange buttons; the owner took them
  off: «оставь только черные с бордером».]*
- Structure is a 1px line and a step of lightness between four background
  roles, not a shadow ladder. `shadow-float` is reserved for the handful of
  surfaces that genuinely lift off the page: the product frame, the receipt,
  the pilot form, the route cards. Five shadows; `shadow-float-accent` is the
  mark's colour under the one card that is the product's promise [2026-09-06]
  *[2026-09-22: that colour is pine, the accent. It briefly inherited ember
  when the roles swapped, and a 70px halo of the loudest colour in the system
  was decoration at the largest scale ember is allowed anywhere — which is
  none.]*.
- Recognisable 21st.dev and Fora patterns — the announcement pill, the
  container-scroll product frame, the dot-pattern background, feature-grid
  cells, a bento layout, a sticky feature stack, a stepper — taken as
  structure and restyled in roles, never installed as a second system.
- Motion is the shared twenty-seven-word vocabulary in `@goproceed/ui/motion`
  *[2026-09-19, DEV-026: twenty-two until `PixelRain` and `OrbitText`; DEV-027:
  twenty-four until `CellField`, `ArcField` and `ParticleSphere`]*;
  the scroll-linked compositions are the ones the landing spec names, one per
  section.
  [Correction, 2026-09-06: was «Motion is the shared sixteen-word vocabulary
  in @goproceed/ui/motion, with exactly two scroll-linked elements on the page
  and never in the same fold» — rule 9 was rewritten by the parity spec §8.]

**The landing's form since 2026-09-19 (owner, DEV-026).** The owner asked for
the landing «1 в 1» after https://parlo-black.vercel.app/ — its frame, cards,
animations and transitions — «только чтобы цвета сохранились наши», on the four
pages of DEV-025. So on `apps/landing` the *form* is the reference's and the
*colour* is this document's: the reference's black ground is our paper, its
white is our ink, its grey second line is `ink-muted`, its hairlines are
`line`, and the accent stays one colour under the Signal Budget Rule *[since
2026-09-22 that accent is pine, and the pills' travelling light is ember — see
the DEV-028 note in «Overview»]*. What the
landing takes: fixed double guide lines at both edges with the header inside
them; a full-viewport hero over a pixel-rain field and a perspective floor,
with a 54px/400 heading *[2026-09-22, DEV-029, owner: «снять то, что ничего не держит»: the landing no longer calls `OrbitText` — its type sat on an arc at about 2:1 on the one screen that has to be read. The primitive, its `gp-orbit` loop, its `base.css` styles, its kitchen-sink instance and `first-screen-primitives.test.ts`'s contract all remain.]*; pill controls, the
primary one with a travelling light on its border; dotted bands between
sections; two-tone section headings (first line ink, second muted); a sticky
feature list beside large rounded cards; cards on a fading grid ground; a fact
band; a radial closing block. The reference's typeface, Syne, has no Cyrillic
(Google Fonts serves `greek`, `latin`, `latin-ext`), so the system's own sans
stays, at the reference's sizes and weights *[Onest until 2026-09-22, Hanken
Grotesk with Commissioner behind it since — and Hanken has the same Cyrillic
problem Syne has, which is why it is a pair]*. `apps/app` is untouched by any of this.

*[2026-09-19, DEV-027, owner: «пересмотри каждый блок референса детально,
каждую анимацию, ховеры и тд, примени после на наш сайт. Используй threejs или
@react-three/fiber».]* DEV-026 took the reference's form from still screenshots
and so missed how it behaves. On `apps/landing` the landing also takes the
reference's *behaviour*: the hero's pixel field is deep (about two fifths of the
first screen), a twinkling raster with a soft light at the centre; the cells of
the perspective floor and of the fact band's grid light up under the pointer
and fade out (`CellField`); a dome of particles turns under the fact tiles and
scatters from the pointer (`ParticleSphere`, three.js — the one WebGL scene, see
the Don't list); the closing block's ground is a fan of arcs that lean toward
the pointer (`ArcField`); and every card, row and tile answers a hover. All of
it is ink on paper *[2026-09-19, later the same day, owner: all but the dome,
the ink pills' travelling border, the closing arcs and a cell lit under the
pointer, which are the accent — see the dated DEV-027 notes under «Do» below]*: a canvas word takes its colour from the computed `color` of
its element, so the role is chosen by a class and no value is written in a
scene. Pointer reactions exist only under `pointer: fine`; every loop is
cancelled off screen and in a hidden tab; under reduced motion a canvas shows
one still frame and reacts to nothing, and a hover changes a ground or a border
but moves nothing (`motion-safe:` on every hover translate).

## Colors

The palette is the owner's brand sheet (2026-09-22). Paper holds the page, Ink
carries copy and the primary action, Pine carries the brand and every state a
reader has to find, and Ember is the one loud colour in the system.

### Primary

- **Pine** (`accent`, `brand`, `focus`, `link`): the deep green `#395A4D`. The
  brand as a word, a link, the shared focus ring, the highlighted phrase in a
  display heading, and the colour a canvas ornament reads on the landing. It is
  text-safe at any size (6.30:1 on the canvas, 7.65:1 on white) and carries
  white at 7.65:1, which is what lets one colour do all of that. `text-brand`
  and `text-link` resolve to the same value on purpose: the brand is not a
  second hue from a link, and on a page whose links are otherwise ink, a word in
  pine reads as «the brand», not as «clickable». If the two ever have to be told
  apart, `text-link` moves, not `text-brand`. *[2026-09-23, DEV-035:
  pine is also the dashboard's primary button (`action-brand`) and its one
  data mark (`viz-brand`, with `viz-empty` beside it) — owner: charts «Зелёный
  + акцент», data in pine and ember only for a highlighted cell.]*

### Secondary

- **Ember** (`signal`): the orange `#FF5B04`. The one accent action a screen
  may carry, and the travelling light on a dark pill. Never
  text, never a hairline: it measures 2.56:1 on the paper. As a FILL it carries
  ink at 6.29:1 — **black on orange, never white on orange** (3.11:1), which is
  the pairing the brand sheet itself shows.

### Status

- **Ready, Review, Attention and Blocked families** (`status-ready`,
  `status-ready-line`, `status-ready-fg`, and the same three for
  `status-review`, `status-attention` and `status-blocked`): paired surface and
  foreground roles that always accompany a written state, never colour alone.
  *[2026-09-22, owner: «развести статусы от бренда». Attention moved from hue
  50 to hue 80 — at hue 50 «увага» stood four degrees from the brand's own
  orange — and blocked from 26 to 20. Review keeps cobalt, which is now the one
  hue in the system that belongs to no brand colour; that is exactly what «на
  перевірці» needs. `packages/testing/src/palette-derivation.test.ts` asserts
  the distances rather than the values.]*

### Neutral

The names in this section are the UTILITY names, so `bg-canvas` and
`text-status-ready-fg` are what a file writes. *[Correction, 2026-09-05: they
were `paper`, `paper-subtle`, `ready-*` and `attention-*` here — none of which
is reachable as a utility. A reader following the old prose wrote
`bg-paper-subtle`, which compiles to nothing and renders unstyled with no
warning: rule 4's exact failure mode, in the document that teaches rule 4.]*

- **Paper** (`canvas`): the sheet's own paper, hue ≈ 93.
- **Clean Sheet** (`surface`): white — product frames, forms, cards laid over
  the canvas. It reads as a sheet on this paper (1.21:1), which it barely did
  on the lighter one it replaces.
- **Paper Wash** (`subtle` for zebra rows, the "was" card and inset grounds;
  `sunken` for the inactive segment, ghost hover and idle status ground).
- **Ink** (`ink`): primary copy and the primary action fill — the sheet's
  black, 16.10:1 on the paper.
- **Document Ink** (`ink-secondary`, `ink-muted`): secondary prose and the
  body-text floor; `ink-subtle` is metadata only, never body copy.
- **Drawing Rules** (`line`, `line-strong`): one-pixel dividers, card edges,
  table rules.

**The Signal Budget Rule.** Ember occupies roughly five percent or less of a
viewport; its scarcity is what makes the one accent action or a travelling
light legible as *the* thing to look at *[2026-09-22: the mark's dot was the
third item here until the owner made it the primary; ember is on the landing
as LIGHT in three places (the pills' travelling light, the board's beam ring,
the tap highlight) and as a FILL in none. An ember GLOW sat under two dark
panels for one revision and went with them, and the orange buttons at the
closing call and the pilot submit went after them at the owner's word]*.
`bg-action-signal` is a ceiling, not a quota: at most one per screen, and **the
landing carries none** — every action on it is the ink pill with its border.
Pine is not under this rule — it is the
brand and it may carry text — but it is still a mark, not a wash: nothing is
filled with it that a reader has to read through.

**The Semantic Risk Rule.** Cobalt (review), amber (attention), red (blocked)
and green (ready) describe actual state and never serve as decorative palette
variety. The brand's own pine carries between a third and a quarter of the
ready-green's chroma (0.044 against 0.155), so a deep desaturated green beside
a saturated mid one is never a state; `palette-derivation.test.ts` holds that
ratio under 0.4. There is no
lime anywhere in this system.

## Typography

**Display Font:** Hanken Grotesk Variable, with Commissioner Variable behind it
**Body Font:** the same stack — one voice, not two faces competing
**Label/Mono Font:** JetBrains Mono Variable (with JetBrains Mono and
ui-monospace fallbacks)

**Two files, one voice.** The brand sheet sets the product in Hanken Grotesk.
That face has **no Cyrillic at all** — of the 66 Ukrainian letters it carries
none, and of the whole Cyrillic block only ₴ — and the public copy is
Ukrainian, so Hanken alone would render this site in a system fallback.
Commissioner stands behind it: full Ukrainian coverage, and the closest metric
match to Hanken among the Cyrillic-capable faces measured (x-height/cap 0.701
against 0.707, stem 0.413 em against 0.409). **The order is load-bearing** —
Hanken first, so every Latin glyph, every digit, «GoProceed» and every W-/EV-/R-
code are the brand's own face, and only Cyrillic falls through. Reversing the
stack would leave the sheet's typeface unused on a page that still looks
plausible, which is why `apps/app`'s QA harness asserts the stack and not a
name.

**Character:** Hanken Grotesk is narrow-set, even and quiet at every weight it
is asked to carry — headline and body alike. JetBrains Mono is reserved for
indices, evidence IDs and timestamps, so a reference reads as attributable data
rather than as a stylistic flourish.

**Figures.** Hanken's digits are tabular by construction — all ten share one
560/1000 advance — so a column of numbers lines up without asking for a
feature. Neither face declares `tnum`; the `tabular` utility stays, and on this
pair it is a statement of intent rather than the thing that does the work.

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
and no more. Both faces carry every one of them; nothing in this system asks a
third typeface to cover a gap.

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

*[2026-09-22, DEV-029, owner: «возможно добавить глубины».] ON `apps/landing`,
AND THERE ONLY, atmospheric depth is now permitted — and it is permitted as a
LIST, not as a licence. `apps/app` and `apps/mobile` are unchanged: structure
there is still a 1px line and a step of paper tone.*

*[2026-09-23, DEV-035, owner, of the Autumn CRM Dashboard shots: «это я хочу
что бы наш так выглядел», and for the dashboard's cards «Как в Autumn».] The
office dashboard (`apps/app` `/dash/**` — at `/` since the same day's DEV-035 extension) now has TWO grounds and one seat: the
rail stays on the paper, the screen lies on a white work sheet (`bg-surface`,
a hairline, `rounded-card`, `shadow-raised`), and every panel, KPI card and
the current navigation item sit on `shadow-raised` too — one pixel of seat under
the hairline, which is what the reference's cards carry. That is the whole
licence: no `shadow-float`, no glass, no tint ground in the app. The border
still draws every edge; the shadow only seats the sheet. The field client and
`apps/mobile` are unchanged.*

**THE GROUND IS BOUND TO THE OBJECT, NEVER TO THE SECTION.** This is the rule
two revisions of DEV-029 got wrong, and an `impeccable` critique named it
exactly: «ground stopped being a level and became a costume». Grounds were
handed out by ADDRESS — «the footer, the FAQ and the pilot's plan take the tint;
one product moment a page takes the dark» — so the same object appeared on four
different grounds and one ground carried five unlike things. The measured
result: **32 distinct card treatments across four pages, 20 of them appearing
exactly once**, and the same warm card living at 16px on `/` and 14px on
`/product`.

*There are four legal forms and nothing else:*

1. **Paper** (`bg-canvas`) — the page.
2. **A white sheet with `shadow-float`** — a product artefact. Nothing else.
3. **The stage** (`.landing-stage`: `bg-tint-warm`, `radius-surface`, one warm
   border, and ONE light falling from the top-left) — what an artefact lies on.
   ONE treatment, everywhere: the
   intro's panel, the three scene cards, the five route cards, the three channel
   cards, Рис. 01, the board's panel, the compare pair's panel, the pilot's
   plan rail. It replaced `.landing-wash-warm`, a three-angle gradient handed
   out by address. *[2026-09-22: flattened entirely for one revision, which was
   an over-correction — the fault was the ADDRESSING, not the light. The stage
   carries a single gradient again, defined once and identical at all eight
   addresses, which is what the owner's brief asked for («небольших
   градиентов-блоков») and what the grammar allows.]*
4. **A full-bleed band** — square, edge to edge, no radius. Two kinds: a
   hairline grid whose 1px gaps ARE the lines (the intro strip, the fact tiles,
   the ДБН sources) and a flat tint ground (the FAQ, the footer).
   *[2026-09-22, owner: «оставь вот такие блоки на всю ширину».] The grid strips
   were briefly pulled into the house column and the owner put them back. He is
   right: those passages are the only ones built purely from the native
   vocabulary — hairline, mono index, edge to edge — and the critique named them
   as the only ones that could not belong to another product.]*

**THERE IS NO DARK GROUND ON THE LANDING.** *[2026-09-22, owner: «убрать тёмное
совсем».]* It existed for two revisions: six sections, which the owner threw out
on sight («не от мира сего»), then two panels. The critique showed why even the
survivors failed — on the compare pair the dark was a 40px frame around two
cards that never overlapped its edge, which is an outline, not a backdrop. With
it go `.landing-deep`, `.landing-glass-deep`, both radial glows and the
`bg-mocha` role — and with them the one contrast failure the critique measured,
a glass pill at 3.94:1 that had drifted off its panel onto a white card.

*Glass has two addresses, on one condition: the ground under it must have
something in it. The header's veil, and the hero's secondary pill, which stands
on the perspective floor's grid. Over flat paper a blur has nothing to resolve
and a translucent white pill is just a pale one. [2026-09-22] The board's two
satellites wore it for one revision; `gp-ui-reviewer` measured that they sit
above and below the board on the stage's near-flat light, not over the product,
so they went back to white sheets with a hairline.*

**A TINT HAS TO BE VISIBLE.** `bg-tint-warm` stands 17 of 255 from the paper in
its strongest channel. It was 7 for one revision, which is a tint that exists in
the stylesheet and not on the screen — every wash and every band on the site was
built on it and none of them could be seen. Seven is the number to remember: if
a new ground is that close to the canvas, it is not a ground.

### Shadow Vocabulary

- **Raised** (`0px 1px 2px rgba(21, 22, 26, 0.04)`): the role-grid cell at
  rest — structure is border-led, so this is nearly invisible by design.
- **Overlay** (`0px 12px 30px -16px rgba(21, 22, 26, 0.35)`): the hero's
  floating pills, compact callouts.
- **Float** (`0px 20px 50px -30px rgba(21, 22, 26, 0.22), 0px 1px 2px rgba(21, 22, 26, 0.05)`):
  the board, the receipt, the form, the route cards. Marketing only.
  *[2026-09-22: this read «no colour tint, even on the selected "now" card»,
  which the code has contradicted since 2026-09-06 — the «now» card takes
  `shadow-float-accent`, the system's ONE coloured shadow, and it is the
  accent's colour. One coloured shadow, one card, named here so the next reader
  does not have to choose between two documents.]*

**The Structural Shadow Rule.** A shadow must explain overlap; ordinary
document cells, rows and textual sections stay flat. *[DEV-029: a card that
LIFTS on hover explains an overlap it is about to have, which is why the scene
and route cards may add `shadow-float` to a hover that already changes their
border. A card that carries a shadow at rest still owes one.]*

## Shapes

Radius is graduated by what it is rounding: `field` (8px) for inputs and
inline evidence tiles, `panel` (10px) for the marketing `lg` button and the UI
windows inside a route card, `card` (12px) for the figure and the pilot form,
`surface` (14px) for route cards, the role grid, bento cells and compare
cards, `section` (16px) for the closing CTA card, and `pill` (999px) for
status chips, the announcement pill and the floating nav.

*[Correction, 2026-09-05: this line and the two `rounded: "{rounded.panel}"`
entries above said «buttons», unqualified, while `Button`'s BASE gave every
size `rounded-control` (6px) — three documents promising a pixel the code did
not keep. `SIZE.lg` now carries `rounded-panel`; the app sizes keep `control`,
which is what §4 of the spec always said. The prototype's own `.btn` is 9px,
mapped to the existing 10px token rather than adding a fifth radius.]*

**The Document Edge Rule.** Round the outer instrument, not every internal
partition. A table rule or a nested key-value row keeps its edge crisp.

## Components

### Buttons

- **Ink** (`button-ink`): near-black fill, white text — the primary action on
  every screen, including the landing, where it is the *only* action; there
  is no accent button on the public page.
  *[2026-09-23, DEV-035, owner: «Зелёная, как в Autumn».] In the office
  dashboard the primary action is **Brand** (`variant="brand"`, the
  `action-brand` roles): a pine fill with a white label, 7.65:1 — the
  reference's own primary. Pine may be a FILL here and only here, because an
  action's label is a word on a control, not a paragraph read through a wash.
  The landing keeps the ink pill, and `component-contract.test.ts` refuses
  the variant anywhere under `apps/landing` but the kitchen sink.*
- **Outline** (`button-outline`): surface ground, a strong-line border — the
  secondary action, and the only other button variant. There is no signal
  button on the landing.
- **Height:** 42px on marketing (`control-height-marketing`), read through
  `size="lg"` — never a hard-coded `h-11`. Touch keeps the 44px floor.

### Status Chips

- **Style:** a pill combining a semantic surface, a matching border and dark
  semantic text, with an optional leading dot — never colour alone.
- **Tones:** ready (green), review (cobalt — since 2026-09-22 the one hue in
  the system that is neither brand colour, which is what a state most needs),
  attention (amber, moved to hue 80 so it cannot be read as the brand's
  orange), blocked (red, moved to hue 20 for the same reason).

### Cards / Cells

- **Feature cell:** a 1px-gap grid of cells on a strong line, `rounded-
  surface`, with a pointer spotlight on hover.
- **Bento cell:** `surface` background, strong-line border, `rounded-surface`;
  one cell may span two rows.
- **Compare card:** a "was" card (dashed, on `subtle`) beside a "now"
  card (`border-accent`-tinted, lifted with `shadow-float-accent` — the one
  coloured shadow in the system, in the accent's colour). Its eyebrow is the
  accent and its evidence codes are `ink-muted`: a status hue never marks the
  brand *[2026-09-22 — they were `status-review-fg` while cobalt WAS the brand,
  and on a warm page that read as «на перевірці» beside a green check]*.

### Inputs / Fields

- **Style:** surface background, a 1px line, `rounded-field`, a visible
  label, 42px marketing height with a 44px touch floor.
- **Focus:** the pine focus ring, one treatment for every focusable element.
  On the inverse surface it takes the dark theme's lighter rung, because the
  primary measures 2.56:1 against ink, under the 3:1 a focus ring owes.
- **Cursor:** the pointer belongs to everything that behaves like a button —
  `button`, `[role="button"]`, `summary` — and to nothing else; a disabled
  control says `not-allowed`. One rule in `base.css`, never a component's own,
  for the same reason the focus ring is global: a variant that ships its own
  cursor is a variant that can disagree. *[2026-09-22, owner: «пересмотри
  кнопки, и ссылки как кнопки, что бы был поинтер курсор» — Tailwind v4's
  Preflight leaves a `button` on the UA's arrow, and this system had no rule of
  its own, so a button and a link side by side answered differently.]*

### Navigation

A fixed 58px bar (`header-height-marketing`) with a hairline at its base:
mark and wordmark at left, the page links with a sliding underline that also
marks the current page, one ink button at right. Below `md` the links move to
a scrolling strip under the bar and the button shortens to «Пілот».

*[2026-09-19 (DEV-025): the landing is four pages — `/`, `/product`,
`/roles`, `/pilot` — so the links are page links and the underline marks the
current page (`aria-current="page"`), not the section in view. Until then the
bar held four in-page anchors. Below `md` the strip is the one set of links in
the accessibility tree, because the desktop row is `display: none` there.]*

*[2026-09-19 (DEV-027, seventh pass, owner: the reference's first screen): the
bar's ground is a layer of its own, `HeaderVeil`. From `md`, while the page
stands at its top, a running script lifts it and the header is glass — on the
home page over the hero's pixel field, whose dots stay dim under it; once the
page scrolls the ground fades back. Served veiled: below `md`, and without
JavaScript, it is the bar described above.]*

*[2026-09-22, owner: «хедер всегда сделай таким типа прозрачным, а не только на
скрол». The ground is PERMANENT frosted glass — `canvas` at 86 % over a 14px
backdrop blur — at every scroll position and on every width. The lift, its
script and the `data-at-top` attribute are gone, which also returns the header
to ONE appearance with JavaScript and without it. The hero's field still runs
to the top edge behind the bar, and its dots still stay dim there, but they are
read through the glass rather than beside it.]*

## Do's and Don'ts

### Do:

- **Do** keep one accent per screen's worth of attention — the mark's dot, a
  link, a focus ring, or the accent phrase in a heading — and nothing else in
  that hue. *[2026-09-22: the wordmark was `text-brand` for a day and is ink
  again, at the owner's word.]*
  *[2026-09-22, DEV-028: the hue is pine, and ember is a second colour under a
  harder budget — at most one accent action and the pills' travelling light
  *[2026-09-22: and no longer the mark's dot, which is the primary]*. Everything the notes below call «cobalt» is pine now,
  except that light, which is ember because the primary measures 2.56:1 on a
  near-black pill and would not be seen. The notes are kept as written: they
  are the record of what the owner asked for, and when.]*
  *[2026-09-19, DEV-026, `apps/landing` only: the reference's pills carry a
  travelling light, so a fold of the landing holds the brand dot and the thin
  cobalt `beam` on its ink pills — the header's and at most one section's. No
  heading carries an accent phrase any more; the muted second line does that
  work. The area stays far under the Signal Budget.]*
  *[2026-09-19, DEV-027, owner, `apps/landing` only: «к основным кнопкам добавь
  такой же бордер как в референсе, что он там двигается, только цвет тоже
  фиолетовый основной акцент» and, of the fact band's dome, «добавь свечение по
  бокам как основной фиолетовый акцент, и точки так же фиолетовые». So the ink
  pills' light is `beam-pill` — 2px, three seconds a lap, a bright head — where
  DEV-026 set the 1px, seven-second `beam` *[sixth pass, owner: «посмотри
  референс как сделана там, сделай точно так же только с нашим цветом» — now
  the reference's own construction: a faint constant border and a soft accent
  light moving along the pill's outline, under the pill's face; a browser
  without `offset-path: inset()` gets the earlier conic ring]*; and the home page's particle dome
  is drawn in the accent (`text-accent` on the canvas word) over two soft
  accent lights at its lower corners. That is the one fold of the landing where
  cobalt is an area and not a mark: the owner's exception, for that block. The
  grids, the pixel field, the arcs and every other ornament stay ink.]*
  *[2026-09-19, later, DEV-027, owner, third pass: «полоски в Перевірте
  маршрут… сделай фиолетовым акцентом» and «может при наведении квадратиков
  тоже сделать его фиолетовым акцентом». So the closing block's arcs and a cell
  lit under the pointer (the hero's floor, the fact band's grid) are the accent
  too. In the same pass the dome's lights moved: not «at its lower corners» any
  more but a haze at the dome's flanks that climbs past its apex, as the
  reference's does — a larger cobalt area in that fold *[fourth to sixth passes,
  owner, three times «меньше»: the same form at about a seventh of that
  strength — a tint at the dome's foot, no longer a visible area. After the
  fifth pass `gp-ui-reviewer` warned that the next step down should be deleting
  the layer; the owner's sixth «меньше» was honoured once more, and THAT is the
  floor: below it the layer is deleted, not halved]* *[seventh pass, owner: the
  hero's pixel field is the reference's halftone screen — a dot in every cell,
  the whole width, from the top edge, behind the header (`HeaderVeil`: from
  `md` only, lifted by a running script, served veiled; the dots under it kept
  dim so that the links stay the darkest marks in the bar — *2026-09-22: the
  lift, the script and that component are gone, the glass is permanent, and the
  field is read THROUGH it; see «Navigation»*) — still ink; the pills' constant rim
  and light are brighter; and the fact band's cells are barred from the dome's
  disc only, so the grid beside the dome answers the pointer again]*. This
  supersedes the
  last sentence of the note above. The whole list, and nothing else, is the
  accent on `apps/landing`: the brand dot; the ink pills' travelling border;
  the dome and its haze; the closing arcs; a cell lit under the pointer
  *[2026-09-22: and two more the enumeration never named — the position block's
  quotation glyphs at `opacity-10`. The list is «what may be the accent», not
  «what is», and the Signal Budget is measured in area, not in items]*
  *[2026-09-22, later the same day: the wordmark was in this list for a few
  hours and is ink again (owner); what joined it instead is the HOME HERO'S
  ACCENT WORD — «доказ» inside the h1, the first accent phrase in a heading
  since DEV-026 removed them, and the largest chromatic mark above the fold.
  The mark's dot is the accent now too, where it used to be the spark.]* What
  stays ink or `surface`: the grid LINES, the dotted
  bands, and every hover of a card, row, tile, source cell or link.
  *[2026-09-22, DEV-029, owner: «сделай цвет этих сверканий зеленым, или
  оранжевым, лучше зеленым».] The hero's pixel field joined the accent list: it
  was the last ornament in ink, and the owner chose the primary over the spark.
  The dots under the glass header stay dim (B7-01) — the colour moved, the calm
  did not. «доказ» stays the only pine TYPE on the first screen; the field is
  now its largest pine AREA, and it sits behind no text a reader has to read.]* It is
  still one hue, still never a text colour outside a display heading, and
  `apps/app` keeps the ration whole. `gp-ui-reviewer` (third pass): the page
  «still reads as ink on paper with one accent», the fact fold is the owner's
  exception, and «a sixth cobalt thing would tip it».]*
- **Do** build from recognisable community structure (21st.dev, Fora),
  restyled entirely in token roles, with the source named per block.
- **Do** use thin rules and paper tone, not shadows, to separate ordinary
  content.
- **Do** pair every status colour with a written label.
- **Do** make every animated explanation a complete, readable composition
  under reduced motion — a different composition, never a faster one.

### Don't:

- **Don't** add a THIRD brand colour or a lime survivor anywhere in the system.
  The brand sheet is two colours: pine leads, ember sparks. A status hue is not
  palette variety either — it belongs to the state, and decorating with it is
  how a legend stops being true.
  *[2026-09-22, DEV-029, owner: «поменять только немного палитру, бо выглядит
  монотоным, возможно добавить глубины, небольших градиентов-блоков,
  глазморфизма».] This line read «a THIRD brand colour, A GRADIENT FILL, or a
  lime survivor» until this task. The gradient clause is withdrawn and replaced
  by the rule below it, which is narrower and says what the clause was actually
  protecting: not «no gradient» but «no colour that reaches the page without
  passing through a role». The brand is still two colours. `clay` is a GROUND
  ramp — the reference's mocha, at under a third of ember's chroma — and the
  four `chip-*` tints are decorative index marks, not brands and not states.*
- **Don't** write a gradient, a glow or a glass surface as a VALUE. Every one of
  them is a named utility in `packages/ui/src/base.css` or the landing's own
  `globals.css`, composed from role variables with `color-mix` — the way
  `media-tint-1…5`, `media-glow-*`, `.landing-stage` and `.landing-glass` are
  built. A gradient in a component is a colour that no role names, no test
  measures and no theme reaches.
- **Don't** let a decorative tint sit in the same cell as a status chip. The
  four `chip-*` tints are bound to the ORDER of an enumeration — the four roles,
  the five route steps, the four columns of the intro strip. Two coloured marks
  in one card is how a reader learns that neither of them means anything.
- **Don't** reach for brutalism — no raw borders as decoration, no oversized
  display type, no deliberate roughness. The system is quiet by contract.
- **Don't** build a 3D scene — a WebGL or modelled scene, a camera, lit
  geometry. The landing's perspective floor (DEV-026) is one flat grid under a
  CSS `perspective` transform, static, and its pixel-rain field is a 2D canvas;
  neither is a scene.
  *[2026-09-19, DEV-027, owner: «Используй threejs или @react-three/fiber» —
  for `apps/landing` only, the owner overrules this line for ONE scene: the
  particle dome under the home page's fact tiles (`ParticleSphere`). It is
  points, not lit or modelled geometry; one WebGL context a page; three.js
  arrives in its own chunk only when the block nears the viewport, never before
  the first screen; without WebGL, and under reduced motion, a still 2D frame
  of the same dome stands in its place. A second scene is a new owner decision.
  `apps/app` keeps the rule whole.]*
  Pointer tilt is permitted at ≤ 3° on a spring,
  `pointer: fine` and desktop only, on the surfaces the landing spec names:
  the product frame, the role cells, the channel cards
  [Correction, 2026-09-06: was «Don't use 3D, tilt, or pointer-driven
  perspective on any surface». The owner asked for the prototype «точь-в-точь»
  — spec 2026-09-06 R2.]
- **Don't** run any animation forever except the named loops — the marquee,
  the Border Beam, the review-dot pulse, the hero drift, the dashed flow lines,
  and, since DEV-026, the arc text (`gp-orbit` — kept in the vocabulary, no
  longer called by the landing since 2026-09-22), the closing
  block's breathing mark (`gp-breathe`) and the `PixelRain` canvas. Each stops
  under reduced motion, where the rain is one still frame
  *[2026-09-19, DEV-027: `ParticleSphere` turns for as long as it is on screen;
  `CellField` and `ArcField` are not loops — they draw while something is
  fading or easing and then rest with no frame pending]*
  [Correction, 2026-09-06: was «except the marquee — the Border Beam is
  finite».]
- **Don't** imply status through colour alone, or claim a document is signed
  when it is a draft.
- **Don't** put a testimonial, a price other than "free", a customer name, or
  a company logo in public copy — the pilot is free and unattributed by
  design.
