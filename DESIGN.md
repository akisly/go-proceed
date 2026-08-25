---
name: GoProceed Evidence Atlas
description: A paper-and-carbon evidence system for accountable construction decisions.
colors:
  paper: "#FBFBF9"
  surface: "#FFFFFF"
  paper-subtle: "#F6F6F3"
  paper-sunken: "#EFEEEB"
  carbon: "#11100F"
  carbon-hover: "#2C2B29"
  ink-secondary: "#5C5B57"
  ink-muted: "#6D6C68"
  ink-subtle: "#92918C"
  line: "#DDDCD8"
  line-strong: "#CCCAC6"
  line-inverse: "#444441"
  on-inverse: "#E7E6E2"
  on-inverse-muted: "#B1AFAB"
  safety-lime: "#C6FF34"
  safety-lime-hover: "#CEFE6C"
  focus-blue: "#5A7DCE"
  ready-surface: "#E9FECA"
  ready-line: "#DDFEA5"
  ready-ink: "#526628"
  review-surface: "#E8EFFC"
  review-line: "#D4E0F9"
  review-ink: "#3756A1"
  blocked-surface: "#FCE9E6"
  blocked-line: "#FBD5D1"
  blocked-ink: "#A02827"
typography:
  display:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "clamp(40px, 5.6vw, 72px)"
    fontWeight: 590
    lineHeight: 1
    letterSpacing: "-0.020em"
  headline:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "clamp(32px, 4vw, 48px)"
    fontWeight: 590
    lineHeight: 1
    letterSpacing: "-0.020em"
  title:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "clamp(26px, 2.6vw, 32px)"
    fontWeight: 590
    lineHeight: 1
    letterSpacing: "-0.020em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.011em"
  data:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 590
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  label:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 510
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  control: "6px"
  section: "28px"
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
  button-signal:
    backgroundColor: "{colors.safety-lime}"
    textColor: "{colors.carbon}"
    typography: "{typography.data}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  button-carbon:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.surface}"
    typography: "{typography.data}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.carbon}"
    typography: "{typography.data}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.carbon}"
    typography: "{typography.data}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  status-ready:
    backgroundColor: "{colors.ready-surface}"
    textColor: "{colors.ready-ink}"
    typography: "{typography.data}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  dossier:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.section}"
    padding: "0"
    width: "100%"
---

# Design System: GoProceed Evidence Atlas

## Overview

**Creative North Star: "The Evidence Atlas"**

GoProceed should feel like a construction evidence dossier laid across a drawing table: precise, calm, attributable, and visibly connected from requirement to decision. Warm paper grounds make long reading humane; carbon intervals create decisive chapter breaks; blueprint lines, physical drawings, site photography, and document receipts make the product world specific without turning it into themed decoration.

The system is information-dense inside product proof and generous around consequences. It borrows editorial scale for persuasion while preserving the compact labels, thin rules, and exact IDs of an operational instrument. The shipped public surface is light-first with deliberate carbon sections, not a dark-mode marketing skin.

**Key Characteristics:**

- Paper-led canvases with thin document rules and restrained carbon intervals.
- Large Source Serif statements paired with compact Inter UI and JetBrains Mono evidence labels.
- Product proof shown as linked work, requirement, evidence, decision, and receipt surfaces.
- Safety Lime reserved for an action, an active route node, or a verified state.
- Real construction imagery and code-native diagrams carry the visual argument.
- Motion explains one handoff and becomes a complete static composition under reduced motion.

## Colors

The palette is warm-neutral and documentary: Paper holds the page, Carbon provides ink and inverse intervals, and Safety Lime marks the few moments that can advance or verify the evidence trail.

### Primary

- **Safety Lime** (`safety-lime`): the singular signal for primary calls to action, the active evidence node, and verified handoffs. Its lighter sibling is the hover response, not an ambient wash.

### Secondary

- **Focus Blue** (`focus-blue`): the shared keyboard-focus treatment and link cue. Review blues remain semantic status colors, not a second brand accent.

### Tertiary

- **Ready, Review, and Blocked families** (`ready-*`, `review-*`, `blocked-*`): paired surface, border, and foreground roles that always accompany a written state or icon.

### Neutral

- **Paper** (`paper`): the warm page canvas.
- **Clean Sheet** (`surface`): product frames, forms, receipts, and cards laid over the canvas.
- **Blueprint Washes** (`paper-subtle`, `paper-sunken`): inset diagrams, grids, and image wells.
- **Carbon** (`carbon`): primary copy, decisive controls, and full-width inverse intervals.
- **Document Ink** (`ink-secondary`, `ink-muted`): secondary prose and metadata; `ink-subtle` is limited to non-body supporting text.
- **Drawing Rules** (`line`, `line-strong`, `line-inverse`): one-pixel dividers, record boundaries, and inverse separators.

**The Signal Budget Rule.** Safety Lime occupies roughly five percent or less of a viewport; its scarcity makes an active or verified state legible.

**The Semantic Risk Rule.** Blue, amber, red, and green status colors describe actual state and never serve as decorative palette variety.

## Typography

**Display Font:** Source Serif 4 Variable (with Source Serif 4, Georgia, serif fallbacks)  
**Body Font:** Inter Variable (with Inter, system UI, sans-serif fallbacks)  
**Label/Mono Font:** JetBrains Mono Variable (with JetBrains Mono and ui-monospace fallbacks)

**Character:** The serif gives public claims an editorial, considered voice without romantic flourish. Inter stays direct and legible in controls and records; the mono face makes references read like attributable evidence rather than marketing ornament.

### Hierarchy

- **Display** (semibold variable weight, fluid 40–72px, unit line height): one dominant landing promise, balanced across short lines.
- **Headline** (semibold variable weight, fluid 32–48px, unit line height): major scene titles with restrained measure.
- **Title** (semibold variable weight, fluid 26–32px, unit line height): section conclusions and prominent statements inside visual proof.
- **Body** (regular, 16px, relaxed line height): public narrative, normally held to a 680px reading measure.
- **Data** (semibold, 13px): controls, record values, and compact decision labels.
- **Label** (medium, 12px, wide tracking): uppercase IDs, timestamps, figure references, and evidence-route nodes.

**The Figure Discipline Rule.** Source Serif never carries product UI, IDs, timestamps, or quantities; evidence identifiers use the mono label and data values use tabular Inter figures.

## Layout

The public layout uses a centered 1240px content frame with 20px mobile, 32px medium, and 48px wide gutters. Primary sections breathe vertically at 80px on compact screens and 112px from the medium breakpoint; internal product surfaces use a denser 12–32px rhythm derived from the 4px base.

Two-column compositions are intentionally asymmetric, pairing a dominant product scene with a shorter explanation instead of equal card grids. At 1240px the Evidence Journey becomes a sticky visual plus scrolling narrative; below that threshold every chapter becomes a complete, readable stack. At 768px figures may gain columns, while 360–390px remains a first-class no-overflow state.

Thin full-width rules and blueprint grids connect sections. Whitespace separates ideas; it does not create empty marketing blocks.

## Elevation & Depth

Depth is structural, not atmospheric. Most working surfaces remain flat and are separated by paper tone and one-pixel rules. Shadows appear where a document floats above imagery, a sticky scene needs a clear boundary, or a no-account review surface must read as a distinct layer.

### Shadow Vocabulary

- **Overlay** (`0px 4px 12px rgba(17, 16, 15, 0.06), 0px 12px 28px rgba(17, 16, 15, 0.08)`): compact callouts, evidence captions, and nested sheets.
- **Float** (`0px 12px 32px rgba(17, 16, 15, 0.08), 0px 40px 80px rgba(17, 16, 15, 0.10)`): the live dossier, sticky journey stage, phone/review handoff, and pilot form frame.

**The Structural Shadow Rule.** A shadow must explain overlap or hierarchy; ordinary document cells, readiness rows, and textual sections stay flat.

## Shapes

The form language combines square document sheets with a small number of purposeful curves. Controls use gently rounded corners (`control`), major immersive frames use broad clipped corners (`section`), and pills are reserved for compact status or route nodes. Receipts and nested work records often remain square so their one-pixel rules align like technical documentation.

**The Document Edge Rule.** Do not round every container. Round the outer instrument or interactive control; keep internal evidence sheets and tabular partitions crisp.

## Components

### Buttons

- **Shape:** compact rounded controls with a 44px minimum target.
- **Signal:** Safety Lime with Carbon text for the page's primary advancement action.
- **Carbon:** Carbon with white text for persistent navigation actions.
- **Quiet:** white or transparent ground with a strong rule or underline; it never competes with the signal action.
- **Hover / Focus:** color shifts complete in 160ms; every focusable element receives the shared 2px Focus Blue outline with a 2px offset.

### Status Chips

- **Style:** a pill combines semantic surface, matching border, dark semantic text, and a written state.
- **State:** color is reinforced by text and, where useful, a check, clock, or lock icon.

### Cards / Containers

- **Corner Style:** broad rounding for the live dossier, sticky journey stage, phone capture, and pilot form; square edges for nested documents and receipts.
- **Background:** Clean Sheet over Paper or Blueprint Wash; Carbon only for decisive intervals and compact overlays.
- **Shadow Strategy:** use the Structural Shadow Rule.
- **Border:** one-pixel Drawing Rules organize every record without a decorative card grid.
- **Internal Padding:** 20px on compact screens, growing to 32px for primary working surfaces.

### Inputs / Fields

- **Style:** Clean Sheet background, strong one-pixel rule, compact rounded corners, visible label, and 44px minimum height.
- **Focus:** Focus Blue border plus the shared visible outline; placeholders use muted ink and never replace labels.
- **Error / Disabled:** native validation and semantics remain intact; state must be expressed in text rather than color alone.

### Navigation

The navigation is a fixed 64px glassy paper strip with the mark and product name at left, restrained pill links at medium widths, and one Carbon action at right. Mobile keeps the brand and a shortened pilot action instead of compressing all links.

### Evidence Rail

The signature route links requirement, evidence, decision, and closure as one continuous ordered instrument. IDs use mono labels; completed nodes use Carbon, the current node uses Safety Lime, and unfinished nodes remain outlined. The rail changes with intersection state but never autoplay, and reduced motion replaces sticky crossfades with the full static sequence.

### Pilot Form and FAQ

The form uses native labelled fields, honest mail-client status, and a copy fallback. FAQ entries use native `details`/`summary` behavior inside the same closing Carbon scene, with no separate decorative accordion shell.

## Do's and Don'ts

### Do:

- **Do** make one concrete evidence route or product dossier the dominant proof on a public surface.
- **Do** use thin rules, paper tones, IDs, timestamps, and source labels to establish accountability.
- **Do** keep Safety Lime rare and attach it to a real action, current node, or verified outcome.
- **Do** pair construction photography with legible code-native records and diagrams.
- **Do** preserve visible labels, 44px targets, keyboard focus, and non-color status cues.
- **Do** make every animated explanation complete and readable as a static reduced-motion composition.

### Don't:

- **Don't** replace the linked evidence story with a generic grid of same-sized feature cards.
- **Don't** use decorative color gradients; neutral blueprint grids and the translucent paper navigation are the narrow structural exceptions.
- **Don't** spread Safety Lime across backgrounds, illustrations, or secondary actions.
- **Don't** add shadows to every panel or make document surfaces float without a hierarchy reason.
- **Don't** use Source Serif for product controls, figures, IDs, or body copy.
- **Don't** imply status through color alone or hide essential content behind JavaScript-driven motion.
