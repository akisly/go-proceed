"use client";

import {
  AnimatePresence,
  motion,
  MotionConfig,
  useInView,
  type Variants,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JourneyChapter, JourneyChapters } from "../../content/landing-content";
import { EvidenceRail } from "../visuals/evidence-rail";
import { JourneyScene } from "../visuals/journey-scene";

type EvidenceJourneyClientProps = {
  chapters: JourneyChapters;
};

const easeEnter = [0.165, 0.84, 0.44, 1] as const;
const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

const sceneVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    filter: "blur(3px)",
    y: direction * 16,
    scale: 0.992,
  }),
  active: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: easeEnter,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    filter: "blur(2px)",
    y: direction * -10,
    scale: 0.996,
    transition: {
      duration: 0.22,
      ease: easeOut,
    },
  }),
};

const copyVariants: Variants = {
  idle: {},
  active: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.055,
    },
  },
};

const copyItemVariants: Variants = {
  idle: {
    opacity: 0.68,
    y: 10,
  },
  active: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: easeEnter,
    },
  },
};

export function EvidenceJourneyClient({ chapters }: EvidenceJourneyClientProps) {
  const [active, setActive] = useState<JourneyChapter["id"]>(chapters[0].id);
  const [direction, setDirection] = useState<1 | -1>(1);
  const activeRef = useRef(active);

  const activateChapter = useCallback((next: JourneyChapter["id"]) => {
    if (activeRef.current === next) return;

    const currentIndex = chapters.findIndex((chapter) => chapter.id === activeRef.current);
    const nextIndex = chapters.findIndex((chapter) => chapter.id === next);
    setDirection(nextIndex >= currentIndex ? 1 : -1);
    activeRef.current = next;
    setActive(next);
  }, [chapters]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-evidence-motion-engine="motion"
        className="relative mt-12 grid gap-8 wide:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] wide:gap-16 motion-reduce:wide:grid-cols-1"
      >
        <div className="landing-journey-stage hidden wide:sticky wide:top-24 wide:block wide:h-[calc(100vh-7.5rem)] wide:max-h-[720px] wide:min-h-[560px] motion-reduce:wide:hidden">
          <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-section border border-line-strong bg-surface shadow-float">
            <div
              data-evidence-stage-transition="presence"
              className="relative min-h-0"
            >
              <AnimatePresence initial={false} custom={direction} mode="sync">
                <motion.div
                  key={active}
                  custom={direction}
                  data-evidence-scene={active}
                  className="absolute inset-0 will-change-[transform,opacity,filter] motion-reduce:!blur-none"
                  variants={sceneVariants}
                  initial="enter"
                  animate="active"
                  exit="exit"
                >
                  <JourneyScene id={active} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="relative z-20 border-t border-line-strong">
              <EvidenceRail active={active} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-section border border-line-strong shadow-overlay wide:hidden motion-reduce:wide:block">
          <EvidenceRail active="decision" />
        </div>

        <ol className="border-t border-line-strong">
          {chapters.map((chapter) => (
            <JourneyChapterArticle
              key={chapter.id}
              chapter={chapter}
              onActive={activateChapter}
            />
          ))}
        </ol>
      </div>
    </MotionConfig>
  );
}

type JourneyChapterArticleProps = {
  chapter: JourneyChapter;
  onActive: (id: JourneyChapter["id"]) => void;
};

function JourneyChapterArticle({ chapter, onActive }: JourneyChapterArticleProps) {
  const chapterRef = useRef<HTMLElement>(null);
  const inView = useInView(chapterRef, {
    margin: "-50% 0px -49.8% 0px",
  });

  useEffect(() => {
    if (inView) onActive(chapter.id);
  }, [chapter.id, inView, onActive]);

  return (
    <li>
      <article
        ref={chapterRef}
        data-journey-chapter={chapter.id}
        data-evidence-scroll-trigger="motion-in-view"
        className="grid min-h-[72vh] content-center border-b border-line-strong py-14 md:py-20 wide:min-h-[76vh] motion-reduce:wide:min-h-0"
      >
        <div className="landing-journey-inline-scene mb-8 wide:hidden motion-reduce:wide:block">
          <JourneyScene id={chapter.id} />
        </div>
        <motion.div
          variants={copyVariants}
          initial={false}
          animate={inView ? "active" : "idle"}
        >
          <motion.div variants={copyItemVariants} className="flex items-center gap-4">
            <span className="grid size-9 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-meta font-semibold text-ink">
              {chapter.index}
            </span>
            <span className="text-meta font-semibold text-ink-muted">{chapter.moment}</span>
          </motion.div>
          <motion.h3 variants={copyItemVariants} className="display mt-6 max-w-[22ch] text-mkt-display-3 text-ink">
            {chapter.title}
          </motion.h3>
          <motion.p variants={copyItemVariants} className="measure mt-5 max-w-[55ch] text-body leading-relaxed text-ink-muted">
            {chapter.lead}
          </motion.p>
          <motion.p variants={copyItemVariants} className="index-label mt-7 text-ink-muted">
            {chapter.reference}
          </motion.p>
          <motion.ul variants={copyItemVariants} className="mt-5 grid gap-2 text-data text-ink md:grid-cols-3 wide:grid-cols-1">
            {chapter.facts.map((fact) => (
              <li key={fact} className="border-t border-line pt-3">{fact}</li>
            ))}
          </motion.ul>
        </motion.div>
      </article>
    </li>
  );
}
