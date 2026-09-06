"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint } from "./use-gates";

type CardRef = RefObject<HTMLDivElement | null>;
type Registry = { refFor: (index: number) => CardRef; active: boolean };
/** `useScroll`'s own `offset` option type — Motion accepts px in offsets, but the public type alias is not exported. `offset` is optional on the options object, so the plain indexed access is `... | undefined`; the outer `NonNullable` strips that back off. */
type ScrollOffset = NonNullable<NonNullable<Parameters<typeof useScroll>[0]>["offset"]>;

const StackContext = createContext<Registry | null>(null);
const CardContext = createContext<CardRef | null>(null);

/** The prototype's numbers (index.html l.1150–1152). */
const SCALE_END = 0.955;
const RISE_END = -14;
const VEIL_END = 0.7;
const MEDIA_Y: [number, number] = [14, -14];
const MEDIA_ROTATE: [number, number] = [-3, 2];
const PULL_OFFSET = ["start 0.9", "start 96px"] as ScrollOffset;
const VEIL_OFFSET = ["start 0.8", "start 96px"] as ScrollOffset;
const MEDIA_OFFSET = ["start end", "end start"] as ScrollOffset;

/**
 * Fora's sticky feature stack, as the prototype does it: every card sticks
 * under the header; when the NEXT card's top travels from 90 % of the
 * viewport to 96px below its top, the card underneath shrinks to .955, rises
 * 14px and sinks under a paper veil at .7. The UI panel inside a card's media
 * half drifts `y 14 → −14` and leans `rotateX −3 → 2` over the card's own
 * traverse.
 *
 * The container hands each card a stable ref object by index, so card *i* can
 * bind `useScroll` to card *i+1*'s element without any parent measuring
 * anything. The last card has no next and stays flat.
 *
 * Below `wide` the cards are a single column already (spec 2026-09-05 §10),
 * and a scrub on a single column reads as jitter, so the stack is off there,
 * and under reduced motion. One DOM shape in every state: `sticky` is a class
 * toggled after the gate resolves, the MotionValues are swapped for constants.
 *
 * `useBelowBreakpoint`'s own default (`false`, i.e. "assume wide") is not by
 * itself a safe answer for SSR here — unlike `Tilt`/`Magnetic`, whose off-by-
 * default comes from `usePointerFine()` defaulting `false`, "assume wide"
 * would turn the stack ON before any gate has actually resolved. So `active`
 * also waits on its own `ready` latch (the same shape `Depth` uses), which is
 * `false` on the server and the first client paint and flips once, after
 * mount — matching the "toggled after the gate resolves" contract above.
 */
export function ScrollStack({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const reduced = useReduced();
  const below = useBelowBreakpoint("wide");
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const refs = useRef(new Map<number, CardRef>());
  const registry = useMemo<Registry>(() => ({
    refFor: (index) => {
      let ref = refs.current.get(index);
      if (!ref) { ref = { current: null }; refs.current.set(index, ref); }
      return ref;
    },
    active: ready && !reduced && !below,
  }), [ready, reduced, below]);
  return (
    <StackContext.Provider value={registry}>
      <div data-scroll-stack={registry.active ? "on" : "off"} className={className}>{children}</div>
    </StackContext.Provider>
  );
}

export function ScrollStackCard({
  index, count, children, className,
}: {
  index: number;
  count: number;
  children: ReactNode;
  className?: string | undefined;
}) {
  const stack = useContext(StackContext);
  if (!stack) throw new Error("ScrollStackCard must sit inside ScrollStack");
  const reduced = useReduced();
  const own = stack.refFor(index);
  const next = stack.refFor(index + 1);
  const hasNext = index < count - 1;
  const { scrollYProgress: pull } = useScroll(hasNext ? { target: next, offset: PULL_OFFSET } : {});
  const { scrollYProgress: veilProgress } = useScroll(hasNext ? { target: next, offset: VEIL_OFFSET } : {});
  const scale = useTransform(pull, [0, 1], [1, SCALE_END]);
  const y = useTransform(pull, [0, 1], [0, RISE_END]);
  const veil = useTransform(veilProgress, [0, 1], [0, VEIL_END]);
  const on = stack.active && hasNext;
  return (
    <CardContext.Provider value={own}>
      <motion.div
        ref={own}
        data-stack-card={index}
        className={[stack.active ? "sticky top-[90px]" : "", "relative rounded-surface", className].filter(Boolean).join(" ")}
        style={{ scale: on ? scale : 1, y: on ? y : 0, transformOrigin: "50% 0%" }}
      >
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
          whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={reduced
            ? { duration: REDUCED.duration, ease: REDUCED.ease }
            : { duration: DURATION.grand, ease: EASE.emphatic }}
        >
          {children}
        </motion.div>
        <motion.i
          aria-hidden="true"
          data-stack-veil=""
          className="pointer-events-none absolute inset-0 z-5 rounded-[inherit] bg-canvas"
          style={{ opacity: on ? veil : 0 }}
        />
      </motion.div>
    </CardContext.Provider>
  );
}

export function ScrollStackMedia({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const stack = useContext(StackContext);
  const card = useContext(CardContext);
  const { scrollYProgress } = useScroll(card ? { target: card, offset: MEDIA_OFFSET } : {});
  const y = useTransform(scrollYProgress, [0, 1], MEDIA_Y);
  const rotateX = useTransform(scrollYProgress, [0, 1], MEDIA_ROTATE);
  const on = Boolean(stack?.active);
  return (
    <motion.div
      data-stack-media=""
      className={className}
      style={{ y: on ? y : 0, rotateX: on ? rotateX : 0, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}
