/**
 * The motion vocabulary. TWENTY-SEVEN primitives, and a feature file may use
 * nothing else — a bespoke `motion.div` in a block component is a review
 * failure, and `packages/testing/qa/motion-audit.mjs` fails the build on one.
 *
 * That is not tidiness. Every rule the system has about motion — ease-out only,
 * transform and opacity only, reveal fires once, reduced motion is a different
 * animation rather than a faster one, the scroll-linked compositions the
 * landing spec names, one per section — is enforced by living inside these
 * twenty-seven files. A `motion.div` written by hand in a block is a rule that
 * has to be remembered instead of one that holds.
 *
 * [2026-09-19, DEV-025] Twenty-two became twenty-four. The owner asked for the
 * landing «1 в 1» after its reference, whose first screen has two things the
 * vocabulary had no word for: a field of falling pixels (`PixelRain`, the one
 * canvas and the one rAF loop here) and a phrase turning on an arc over the
 * heading (`OrbitText`, a CSS loop). Both stop under reduced motion, where the
 * rain is a still frame and the arc stands still.
 *
 * [2026-09-19, DEV-026] Twenty-four became twenty-seven. DEV-025 read the
 * reference from still screenshots and so took its form without its behaviour;
 * the owner asked for the behaviour («пересмотри каждый блок референса
 * детально, каждую анимацию, ховеры… Используй threejs»). Three things the
 * vocabulary had no word for: a grid ground whose cells light under the
 * pointer and fade (`CellField`), a fan of arcs that leans toward the pointer
 * (`ArcField`), and a dome of particles that turns and scatters from the
 * pointer (`ParticleSphere` — three.js, the system's one WebGL scene, loaded as
 * its own chunk when the block nears the viewport). With `PixelRain` they are
 * the four CANVAS words, and the rules a canvas keeps live once, in
 * `canvas-loop.ts`: cancelled off screen and in a hidden tab, at rest when
 * there is nothing left to draw, colour from the computed `color`, a pointer
 * only under `pointer: fine`, one still frame under reduced motion.
 * `canvas-loop.ts` and `particle-sphere-*.ts` are plumbing, not words.
 */
export { Reveal } from "./Reveal";
export { Stagger, StaggerItem } from "./Stagger";
export { TextBlurIn } from "./TextBlurIn";
export { ScrollTint } from "./ScrollTint";
export { LineDraw } from "./LineDraw";
export { NodeLock } from "./NodeLock";
export { CountUp } from "./CountUp";
export { Marquee } from "./Marquee";
export { PinnedTabs, shouldAutoAdvance, type PinnedTab } from "./PinnedTabs";
export { Lift } from "./Lift";
export { Press } from "./Press";
export { CrossFade } from "./CrossFade";
export { TrackFill } from "./TrackFill";
export { SlideSwap } from "./SlideSwap";
export { InViewProgress } from "./InViewProgress";
export { ScrollSettle } from "./ScrollSettle";
export { LineReveal, splitAccent, type AccentWord } from "./LineReveal";
export { Depth } from "./Depth";
export { Tilt } from "./Tilt";
export { Magnetic } from "./Magnetic";
export { ScrollStack, ScrollStackCard, ScrollStackMedia } from "./ScrollStack";
export { ScrollProgress } from "./ScrollProgress";
export { PixelRain } from "./PixelRain";
export { OrbitText } from "./OrbitText";
export { CellField, cellIsBarred, cellIsBarredByDisc } from "./CellField";
export { ArcField } from "./ArcField";
export { ParticleSphere } from "./ParticleSphere";

export { shouldReduce, useReduced } from "./use-reduced";
export { DURATION, EASE, STAGGER, SPRING, BLUR, REDUCED } from "./tokens";
