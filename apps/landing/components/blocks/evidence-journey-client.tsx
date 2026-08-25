"use client";

import { useEffect, useRef, useState } from "react";
import type { JourneyChapter } from "../../content/landing-content";
import { JourneyScene } from "../visuals/journey-scene";

type EvidenceJourneyClientProps = {
  chapters: readonly JourneyChapter[];
};

export function EvidenceJourneyClient({ chapters }: EvidenceJourneyClientProps) {
  const [active, setActive] = useState<JourneyChapter["id"]>(chapters[0].id);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.getAttribute("data-journey-chapter") as JourneyChapter["id"] | null;
          if (id) setActive(id);
        }
      },
      { rootMargin: "-34% 0px -44%", threshold: 0 },
    );

    for (const node of chapterRefs.current) {
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative mt-12 grid gap-8 wide:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] wide:gap-16">
      <div className="landing-journey-stage hidden wide:sticky wide:top-24 wide:block wide:h-[calc(100vh-7.5rem)] wide:max-h-[720px] wide:min-h-[560px]">
        <div className="relative h-full overflow-hidden rounded-section border border-line-strong bg-surface shadow-float">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              aria-hidden={active !== chapter.id}
              className={`absolute inset-0 transition-[opacity,transform] duration-slow ease-out motion-reduce:transform-none motion-reduce:transition-none ${
                active === chapter.id
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-3 opacity-0"
              }`}
            >
              <JourneyScene id={chapter.id} />
            </div>
          ))}
        </div>
      </div>

      <ol className="border-t border-line-strong">
        {chapters.map((chapter, index) => (
          <li key={chapter.id}>
            <article
              ref={(node) => { chapterRefs.current[index] = node; }}
              data-journey-chapter={chapter.id}
              className="grid min-h-[72vh] content-center border-b border-line-strong py-14 md:py-20 wide:min-h-[76vh]"
            >
              <div className="mb-8 wide:hidden">
                <JourneyScene id={chapter.id} />
              </div>
              <div className="flex items-center gap-4">
                <span className="grid size-9 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-meta font-semibold text-ink">
                  {chapter.index}
                </span>
                <span className="text-meta font-semibold text-ink-muted">{chapter.moment}</span>
              </div>
              <h3 className="display mt-6 max-w-[16ch] text-mkt-display-3 text-ink">{chapter.title}</h3>
              <p className="measure mt-5 max-w-[55ch] text-body leading-relaxed text-ink-muted">{chapter.lead}</p>
              <p className="index-label mt-7 text-ink-muted">{chapter.reference}</p>
              <ul className="mt-5 grid gap-2 text-data text-ink md:grid-cols-3 wide:grid-cols-1">
                {chapter.facts.map((fact) => (
                  <li key={fact} className="border-t border-line pt-3">{fact}</li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
