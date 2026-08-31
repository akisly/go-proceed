"use client";

import { InViewProgress, useReduced } from "@goproceed/ui/motion";
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

type ReadinessSignalProps = {
  d: string;
  drawOffset: string;
  fillClassName: string;
  id: "trunk" | ReadinessWorkflowNode["id"];
  opacity: string;
  strokeClassName: string;
  travelDistance: string;
  travelerOpacity: string;
};

/**
 * HOW THIS DIAGRAM MOVES, NOW THAT IT HOLDS NO ANIMATION OF ITS OWN
 * -----------------------------------------------------------------
 * `<InViewProgress>` publishes one number, `--gp-progress`, from 0 to 1 on the
 * wrapper once the diagram scrolls into view, and every moving part below is a
 * `calc()` reading that number. Nothing here imports Motion for React; the
 * vocabulary supplies the number and the landing keeps the picture.
 *
 * IT RUNS ONCE, and `data-readiness-cycle` says so. It used to say `infinite`,
 * which was true of the `repeat: Infinity` loop this file held and is not true
 * of `InViewProgress`, which animates to 1 and stops. A hook the QA harness
 * reads has to describe the behaviour the code actually has, so the attribute
 * was renamed rather than kept for the sake of keeping it.
 *
 * THE PHASES, which are the numbers you will read inside the expressions:
 *   0      .. 0.25   trunk draws, its traveler runs Пакет робіт → перевірка
 *   0.25   .. 0.614  the three branches draw, their travelers run to the cards
 *   0.59   .. 1      the endpoint cards pulse twice and settle
 * `0.25` and `0.614` were `cycle.trunkEnd` and `cycle.branchesEnd`; they are
 * written out at each use because a `calc()` string cannot interpolate a
 * constant without becoming a built string, and a built string is the one thing
 * this repo has already paid for.
 *
 * ONE SEGMENT IS `calc(c + (d - c) * clamp(0, (p - a) / (b - a), 1))`, the CSS
 * spelling of `useTransform(p, [a, b], [c, d])`. A ramp with more than two
 * stops is the SUM of its segments, and a segment whose output does not change
 * contributes nothing and is left out.
 *
 * WHY `stroke-dashoffset` RATHER THAN A LENGTH. Motion's `pathLength` is the
 * same trick underneath: `pathLength="1"` makes the dash units a fraction of
 * the path, `stroke-dasharray: 1` is one dash and one gap, and an offset of 1
 * hides the line while 0 draws it whole.
 *
 * WHY `offset-path` FOR THE TRAVELLERS. The dot used to be placed by
 * `getPointAtLength`, which is exactly what `offset-distance` means: a
 * percentage along the same path. `cx`/`cy` sit at `r` so the circle's fill box
 * starts at the local origin, which keeps the dot on the path under both
 * readings of the reference box in CSS Motion Path.
 *
 * REDUCED MOTION. `InViewProgress` publishes 1 immediately, and every animated
 * value above reaches 0 opacity at 1 exactly as it does at 0 — the signal
 * overlays, the travellers and both pulses are invisible, and what remains is
 * the static diagram. That is the same picture the old `active === false`
 * branch drew, so `motionState === "static"` and `--gp-progress: 1` agree.
 */
const layout = {
  ready: {
    cardY: 24,
    path: "M366 160C414 160 438 63 508 63",
    detailLines: ["усі блокуючі вимоги", "виконані"],
    surface: "fill-status-ready",
    border: "stroke-status-ready-line",
    foreground: "fill-status-ready-fg",
    signalFill: "fill-status-ready-fg",
    signalStroke: "stroke-status-ready-fg",
    pulseStroke: "stroke-action-signal",
  },
  review: {
    cardY: 121,
    path: "M366 160H508",
    detailLines: ["рішення ще не", "зафіксоване"],
    surface: "fill-status-review",
    border: "stroke-status-review-line",
    foreground: "fill-status-review-fg",
    signalFill: "fill-status-review-fg",
    signalStroke: "stroke-status-review-fg",
    pulseStroke: "stroke-status-review",
  },
  blocked: {
    cardY: 218,
    path: "M366 160C414 160 438 257 508 257",
    detailLines: ["є невиконана блокуюча", "вимога"],
    surface: "fill-status-blocked",
    border: "stroke-status-blocked-line",
    foreground: "fill-status-blocked-fg",
    signalFill: "fill-status-blocked-fg",
    signalStroke: "stroke-status-blocked-fg",
    pulseStroke: "stroke-status-blocked",
  },
} as const;

/** `useTransform(p, [0, 0.25], [0, 1])`, as a dash offset: 1 hides, 0 draws. */
const trunkDrawOffset =
  "calc(1 + (0 - 1) * clamp(0, (var(--gp-progress, 0) - 0) / (0.25 - 0), 1))";
/** `useTransform(p, [0.25, 0.614], [0, 1])`, as a dash offset. */
const branchDrawOffset =
  "calc(1 + (0 - 1) * clamp(0, (var(--gp-progress, 0) - 0.25) / (0.614 - 0.25), 1))";
/** The same trunk ramp as a distance along the path, for the traveller. */
const trunkTravelDistance =
  "calc(0% + (100% - 0%) * clamp(0, (var(--gp-progress, 0) - 0) / (0.25 - 0), 1))";
/** The same branch ramp as a distance along the path, for the travellers. */
const branchTravelDistance =
  "calc(0% + (100% - 0%) * clamp(0, (var(--gp-progress, 0) - 0.25) / (0.614 - 0.25), 1))";
/** `useTransform(p, [0, 0.015, 0.25, 0.64, 0.72], [0, 1, 1, 0.32, 0])`. */
const trunkOpacity =
  "calc(0 + (1 - 0) * clamp(0, (var(--gp-progress, 0) - 0) / (0.015 - 0), 1) + (0.32 - 1) * clamp(0, (var(--gp-progress, 0) - 0.25) / (0.64 - 0.25), 1) + (0 - 0.32) * clamp(0, (var(--gp-progress, 0) - 0.64) / (0.72 - 0.64), 1))";
/** `useTransform(p, [0.235, 0.25, 0.614, 0.72, 0.8], [0, 1, 1, 0.28, 0])`. */
const branchOpacity =
  "calc(0 + (1 - 0) * clamp(0, (var(--gp-progress, 0) - 0.235) / (0.25 - 0.235), 1) + (0.28 - 1) * clamp(0, (var(--gp-progress, 0) - 0.614) / (0.72 - 0.614), 1) + (0 - 0.28) * clamp(0, (var(--gp-progress, 0) - 0.72) / (0.8 - 0.72), 1))";
/** `useTransform(p, [0, 0.015, 0.23, 0.25], [0, 1, 1, 0])`. */
const trunkTravelerOpacity =
  "calc(0 + (1 - 0) * clamp(0, (var(--gp-progress, 0) - 0) / (0.015 - 0), 1) + (0 - 1) * clamp(0, (var(--gp-progress, 0) - 0.23) / (0.25 - 0.23), 1))";
/** `useTransform(p, [0.235, 0.25, 0.59, 0.614], [0, 1, 1, 0])`. */
const branchTravelerOpacity =
  "calc(0 + (1 - 0) * clamp(0, (var(--gp-progress, 0) - 0.235) / (0.25 - 0.235), 1) + (0 - 1) * clamp(0, (var(--gp-progress, 0) - 0.59) / (0.614 - 0.59), 1))";
/** `useTransform(p, [0.59, 0.635, 0.76, 0.91], [0, 1, 0.58, 0])`. */
const primaryPulseOpacity =
  "calc(0 + (1 - 0) * clamp(0, (var(--gp-progress, 0) - 0.59) / (0.635 - 0.59), 1) + (0.58 - 1) * clamp(0, (var(--gp-progress, 0) - 0.635) / (0.76 - 0.635), 1) + (0 - 0.58) * clamp(0, (var(--gp-progress, 0) - 0.76) / (0.91 - 0.76), 1))";
/** `useTransform(p, [0.59, 0.7, 0.91], ["scale(0.98, 0.95)", "scale(1.025, 1.035)", "scale(1.07, 1.1)"])`. */
const primaryPulseTransform =
  "scale(calc(0.98 + (1.025 - 0.98) * clamp(0, (var(--gp-progress, 0) - 0.59) / (0.7 - 0.59), 1) + (1.07 - 1.025) * clamp(0, (var(--gp-progress, 0) - 0.7) / (0.91 - 0.7), 1)), calc(0.95 + (1.035 - 0.95) * clamp(0, (var(--gp-progress, 0) - 0.59) / (0.7 - 0.59), 1) + (1.1 - 1.035) * clamp(0, (var(--gp-progress, 0) - 0.7) / (0.91 - 0.7), 1)))";
/** `useTransform(p, [0.65, 0.715, 0.84, 1], [0, 0.82, 0.36, 0])`. */
const secondaryPulseOpacity =
  "calc(0 + (0.82 - 0) * clamp(0, (var(--gp-progress, 0) - 0.65) / (0.715 - 0.65), 1) + (0.36 - 0.82) * clamp(0, (var(--gp-progress, 0) - 0.715) / (0.84 - 0.715), 1) + (0 - 0.36) * clamp(0, (var(--gp-progress, 0) - 0.84) / (1 - 0.84), 1))";
/** `useTransform(p, [0.65, 0.78, 1], ["scale(0.99, 0.97)", "scale(1.05, 1.075)", "scale(1.1, 1.16)"])`. */
const secondaryPulseTransform =
  "scale(calc(0.99 + (1.05 - 0.99) * clamp(0, (var(--gp-progress, 0) - 0.65) / (0.78 - 0.65), 1) + (1.1 - 1.05) * clamp(0, (var(--gp-progress, 0) - 0.78) / (1 - 0.78), 1)), calc(0.97 + (1.075 - 0.97) * clamp(0, (var(--gp-progress, 0) - 0.65) / (0.78 - 0.65), 1) + (1.16 - 1.075) * clamp(0, (var(--gp-progress, 0) - 0.78) / (1 - 0.78), 1)))";

export function ReadinessWorkflow({ nodes }: ReadinessWorkflowProps) {
  const workflowRef = useRef<SVGSVGElement>(null);
  const reduced = useReduced();
  const [entered, setEntered] = useState(false);
  const total = nodes.reduce((sum, node) => sum + Number.parseInt(node.value, 10), 0);

  // `data-readiness-motion` reports which of three states the diagram is in;
  // it does not drive the drawing, which `--gp-progress` owns. The threshold
  // is `InViewProgress`'s own default `amount`, so the reported state and the
  // published number turn over together rather than disagreeing by a scroll.
  useEffect(() => {
    const node = workflowRef.current;
    if (!node || reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.4)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [reduced]);

  const motionState = reduced ? "static" : entered ? "active" : "idle";

  return (
    <InViewProgress>
      <svg
        ref={workflowRef}
        role="img"
        aria-labelledby="readiness-title readiness-desc"
        viewBox="0 0 760 320"
        data-readiness-workflow="true"
        data-readiness-motion-engine="motion"
        data-readiness-cycle="once"
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

          <ReadinessSignal
            d="M182 160H306"
            drawOffset={trunkDrawOffset}
            fillClassName="fill-ink-muted"
            id="trunk"
            opacity={trunkOpacity}
            strokeClassName="stroke-ink-muted"
            travelDistance={trunkTravelDistance}
            travelerOpacity={trunkTravelerOpacity}
          />
          {nodes.map((node) => (
            <ReadinessSignal
              key={`signal-${node.id}`}
              d={layout[node.id].path}
              drawOffset={branchDrawOffset}
              fillClassName={layout[node.id].signalFill}
              id={node.id}
              opacity={branchOpacity}
              strokeClassName={layout[node.id].signalStroke}
              travelDistance={branchTravelDistance}
              travelerOpacity={branchTravelerOpacity}
            />
          ))}
        </g>

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
                data-readiness-pulse={`${node.id}-primary`}
                className={`readiness-workflow-endpoint-pulse fill-none ${styles.pulseStroke}`}
                strokeWidth="3"
                style={{ opacity: primaryPulseOpacity, transform: primaryPulseTransform }}
              />
              <rect
                x="508"
                y={styles.cardY}
                width="230"
                height="78"
                rx="14"
                data-readiness-pulse={`${node.id}-secondary`}
                className={`readiness-workflow-endpoint-pulse fill-none ${styles.pulseStroke}`}
                strokeWidth="2"
                style={{ opacity: secondaryPulseOpacity, transform: secondaryPulseTransform }}
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
    </InViewProgress>
  );
}

function ReadinessSignal({
  d,
  drawOffset,
  fillClassName,
  id,
  opacity,
  strokeClassName,
  travelDistance,
  travelerOpacity,
}: ReadinessSignalProps) {
  return (
    <>
      <path
        d={d}
        data-readiness-signal={id}
        className={strokeClassName}
        strokeWidth="2.5"
        pathLength={1}
        style={{ opacity, strokeDasharray: "1", strokeDashoffset: drawOffset }}
      />
      <circle
        cx="5.5"
        cy="5.5"
        r="5.5"
        aria-hidden="true"
        data-readiness-traveler={id}
        className={`${fillClassName} stroke-surface`}
        strokeWidth="2.5"
        style={{
          opacity: travelerOpacity,
          offsetPath: `path('${d}')`,
          offsetDistance: travelDistance,
          offsetRotate: "0deg",
          offsetAnchor: "center",
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      />
    </>
  );
}
