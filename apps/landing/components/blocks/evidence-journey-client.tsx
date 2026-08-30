"use client";

import { SlideSwap, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { JourneyChapter, JourneyChapters } from "../../content/landing-content";
import { EvidenceRail } from "../visuals/evidence-rail";
import { JourneyScene } from "../visuals/journey-scene";

type EvidenceJourneyClientProps = {
  chapters: JourneyChapters;
};

/**
 * Whether the chapter sits in the viewport's vertical center band, so the
 * sticky scene and rail can follow the reader's scroll position. This is
 * scroll-spy state, not an animation trigger — the motion vocabulary has
 * nothing to say about which chapter is active, only about how each
 * chapter's own content arrives. A native observer keeps that distinction
 * honest instead of borrowing Motion's `useInView` for a job that has
 * nothing to do with motion.
 */
function useCenterBand(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { rootMargin: "-50% 0px -49.8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

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
    <div
      data-evidence-motion-engine="vocabulary"
      className="relative mt-12 grid gap-8 wide:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] wide:gap-16 motion-reduce:wide:grid-cols-1"
    >
      <div className="landing-journey-stage hidden wide:sticky wide:top-24 wide:block wide:h-[calc(100vh-7.5rem)] wide:max-h-[720px] wide:min-h-[560px] motion-reduce:wide:hidden">
        <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-section border border-line-strong bg-surface shadow-float">
          <div
            data-evidence-stage-transition="slide-swap"
            className="relative min-h-0"
          >
            <SlideSwap
              activeKey={active}
              direction={direction}
              className="absolute inset-0 will-change-[transform,opacity]"
            >
              <div data-evidence-scene={active} className="h-full">
                <JourneyScene id={active} />
              </div>
            </SlideSwap>
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
  );
}

type JourneyChapterArticleProps = {
  chapter: JourneyChapter;
  onActive: (id: JourneyChapter["id"]) => void;
};

function JourneyChapterArticle({ chapter, onActive }: JourneyChapterArticleProps) {
  const chapterRef = useRef<HTMLElement>(null);
  const inView = useCenterBand(chapterRef);

  useEffect(() => {
    if (inView) onActive(chapter.id);
  }, [chapter.id, inView, onActive]);

  return (
    <li>
      <article
        ref={chapterRef}
        data-journey-chapter={chapter.id}
        data-evidence-scroll-trigger="stagger"
        className="grid min-h-[72vh] content-center border-b border-line-strong py-14 md:py-20 wide:min-h-[76vh] motion-reduce:wide:min-h-0"
      >
        <div className="landing-journey-inline-scene mb-8 wide:hidden motion-reduce:wide:block">
          <JourneyScene id={chapter.id} />
        </div>
        <Stagger>
          <StaggerItem className="flex items-center gap-4">
            <span className="grid size-9 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-meta font-semibold text-ink">
              {chapter.index}
            </span>
            <span className="text-meta font-semibold text-ink-muted">{chapter.moment}</span>
          </StaggerItem>
          <StaggerItem>
            <h3 className="display mt-6 max-w-[22ch] text-mkt-display-3 text-ink">
              {chapter.title}
            </h3>
          </StaggerItem>
          <StaggerItem>
            <p className="measure mt-5 max-w-[55ch] text-body leading-relaxed text-ink-muted">
              {chapter.lead}
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="index-label mt-7 text-ink-muted">
              {chapter.reference}
            </p>
          </StaggerItem>
          <StaggerItem>
            <ul className="mt-5 grid gap-2 text-data text-ink md:grid-cols-3 wide:grid-cols-1">
              {chapter.facts.map((fact) => (
                <li key={fact} className="border-t border-line pt-3">{fact}</li>
              ))}
            </ul>
          </StaggerItem>
        </Stagger>
      </article>
    </li>
  );
}
