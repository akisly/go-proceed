/**
 * The motion vocabulary. TWENTY-TWO primitives, and a feature file may use
 * nothing else — a bespoke `motion.div` in a block component is a review
 * failure, and `packages/testing/qa/motion-audit.mjs` fails the build on one.
 *
 * That is not tidiness. Every rule the system has about motion — ease-out only,
 * transform and opacity only, reveal fires once, reduced motion is a different
 * animation rather than a faster one, the scroll-linked compositions the
 * landing spec names, one per section — is enforced by living inside these
 * twenty-two files. A `motion.div` written by hand in a block is a rule that
 * has to be remembered instead of one that holds.
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

export { shouldReduce, useReduced } from "./use-reduced";
export { DURATION, EASE, STAGGER, SPRING, BLUR, REDUCED } from "./tokens";
