"use client";

import { useEffect, useRef, useState } from "react";

type ReadinessWorkflowNode = {
  id: "ready" | "review" | "blocked";
  value: string;
  label: string;
  detail: string;
};

type ReadinessWorkflowProps = {
  nodes: readonly ReadinessWorkflowNode[];
};

const layout = {
  ready: {
    cardY: 24,
    path: "M366 160C414 160 438 63 508 63",
    detailLines: ["усі блокуючі вимоги", "виконані"],
    surface: "fill-status-ready",
    border: "stroke-status-ready-line",
    foreground: "fill-status-ready-fg",
  },
  review: {
    cardY: 121,
    path: "M366 160H508",
    detailLines: ["рішення ще не", "зафіксоване"],
    surface: "fill-status-review",
    border: "stroke-status-review-line",
    foreground: "fill-status-review-fg",
  },
  blocked: {
    cardY: 218,
    path: "M366 160C414 160 438 257 508 257",
    detailLines: ["є невиконана блокуюча", "вимога"],
    surface: "fill-status-blocked",
    border: "stroke-status-blocked-line",
    foreground: "fill-status-blocked-fg",
  },
} as const;

export function ReadinessWorkflow({ nodes }: ReadinessWorkflowProps) {
  const workflowRef = useRef<SVGSVGElement>(null);
  const [motionState, setMotionState] = useState<"idle" | "active" | "static">("idle");
  const total = nodes.reduce((sum, node) => sum + Number.parseInt(node.value, 10), 0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;

    const showStatic = () => {
      setMotionState("static");
      observer?.disconnect();
    };

    if (mediaQuery.matches || !("IntersectionObserver" in window)) {
      showStatic();
      return;
    }

    const node = workflowRef.current;
    if (!node) {
      showStatic();
      return;
    }

    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) showStatic();
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setMotionState("active");
        observer?.disconnect();
      },
      { rootMargin: "0px 0px -10%", threshold: 0.4 },
    );

    mediaQuery.addEventListener("change", handlePreferenceChange);
    observer.observe(node);

    return () => {
      mediaQuery.removeEventListener("change", handlePreferenceChange);
      observer?.disconnect();
    };
  }, []);

  return (
    <svg
      ref={workflowRef}
      role="img"
      aria-labelledby="readiness-title readiness-desc"
      viewBox="0 0 760 320"
      data-readiness-workflow="true"
      data-readiness-motion={motionState}
      className="mt-8 hidden h-auto w-full md:block"
    >
      <title id="readiness-title">Перевірка повноти пакета робіт</title>
      <desc id="readiness-desc">
        Один пакет робіт проходить перевірку повноти та розподіляється на три незалежні результати: готово, на розгляді або заблоковано.
      </desc>

      <g fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path
          d="M182 160H306"
          data-readiness-trunk="true"
          className="stroke-line-strong"
          strokeWidth="1.5"
        />
        {nodes.map((node) => (
          <path
            key={`base-${node.id}`}
            d={layout[node.id].path}
            data-readiness-branch={node.id}
            className="stroke-line-strong"
            strokeWidth="1.5"
          />
        ))}

        <path
          d="M182 160H306"
          pathLength="1"
          className="readiness-workflow-signal readiness-workflow-trunk-signal stroke-action-signal"
          strokeWidth="2.5"
        />
        {nodes.map((node) => (
          <path
            key={`signal-${node.id}`}
            d={layout[node.id].path}
            pathLength="1"
            className="readiness-workflow-signal readiness-workflow-branch-signal stroke-action-signal"
            strokeWidth="2.5"
          />
        ))}
      </g>

      {motionState === "active" && (
        <g aria-hidden="true" className="fill-action-signal">
          <circle r="4.5">
            <animateMotion path="M182 160H306" dur="0.56s" fill="freeze" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.84;1" dur="0.56s" fill="freeze" />
          </circle>
          {nodes.map((node) => (
            <circle key={`pulse-${node.id}`} r="4.5">
              <animateMotion path={layout[node.id].path} begin="0.4s" dur="0.64s" fill="freeze" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.84;1" begin="0.4s" dur="0.64s" fill="freeze" />
            </circle>
          ))}
        </g>
      )}

      <g>
        <rect x="22" y="118" width="160" height="84" rx="14" className="fill-surface stroke-line-strong" />
        <text x="42" y="148" className="fill-ink-muted font-mono text-[13px] font-semibold uppercase tracking-[0.1em]">
          Пакет робіт
        </text>
        <text x="42" y="181" className="fill-ink font-mono text-[28px] font-semibold">
          {total}
        </text>
        <text x="82" y="180" className="fill-ink-muted text-[15px]">
          роботи
        </text>
      </g>

      <g>
        <text x="336" y="112" textAnchor="middle" className="fill-ink-muted font-mono text-[13px] font-semibold uppercase tracking-[0.1em]">
          Перевірка повноти
        </text>
        <circle cx="336" cy="160" r="30" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
        <circle cx="336" cy="160" r="8" className="fill-action-signal" />
        <path d="m331 160 3.5 3.5 7-8" className="fill-none stroke-action-signal-fg" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {nodes.map((node) => {
        const styles = layout[node.id];
        const textY = styles.cardY + 29;

        return (
          <g key={node.id} data-readiness-endpoint={node.id} aria-label={node.detail}>
            <rect
              x="508"
              y={styles.cardY}
              width="230"
              height="78"
              rx="14"
              className={`${styles.surface} ${styles.border}`}
            />
            <rect
              x="508"
              y={styles.cardY}
              width="230"
              height="78"
              rx="14"
              className={`readiness-workflow-endpoint-pulse fill-none ${styles.border}`}
              strokeWidth="2"
            />
            <text x="528" y={textY + 13} className={`${styles.foreground} font-mono text-[26px] font-semibold`}>
              {node.value}
            </text>
            <text x="582" y={textY} className="fill-ink text-[15px] font-semibold">
              {node.label}
            </text>
            <text x="582" y={textY + 19} className="fill-ink-muted text-[13px]">
              <tspan x="582">{styles.detailLines[0]}</tspan>
              <tspan x="582" dy="15">{styles.detailLines[1]}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
