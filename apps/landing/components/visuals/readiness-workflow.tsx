"use client";

import { useReduced } from "@goproceed/ui/motion";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef } from "react";

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
  fillClassName: string;
  id: "trunk" | ReadinessWorkflowNode["id"];
  opacity: MotionValue<number>;
  progress: MotionValue<number>;
  start: readonly [number, number];
  strokeClassName: string;
  travelerOpacity: MotionValue<number>;
};

const cycle = {
  duration: 2.2,
  pause: 1.8,
  trunkEnd: 0.25,
  branchesEnd: 0.614,
} as const;

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

export function ReadinessWorkflow({ nodes }: ReadinessWorkflowProps) {
  const workflowRef = useRef<SVGSVGElement>(null);
  const inView = useInView(workflowRef, { amount: 0.4, once: true });
  const reduced = useReduced();
  const cycleProgress = useMotionValue(0);
  const active = inView && !reduced;
  const total = nodes.reduce((sum, node) => sum + Number.parseInt(node.value, 10), 0);

  useEffect(() => {
    if (!active) {
      cycleProgress.set(0);
      return;
    }

    cycleProgress.set(0);
    const controls = animate(cycleProgress, 1, {
      duration: cycle.duration,
      ease: "linear",
      repeat: Infinity,
      repeatDelay: cycle.pause,
      repeatType: "loop",
    });

    return () => controls.stop();
  }, [active, cycleProgress]);

  const trunkProgress = useTransform(
    cycleProgress,
    [0, cycle.trunkEnd],
    [0, 1],
    { clamp: true },
  );
  const branchProgress = useTransform(
    cycleProgress,
    [cycle.trunkEnd, cycle.branchesEnd],
    [0, 1],
    { clamp: true },
  );
  const trunkOpacity = useTransform(
    cycleProgress,
    [0, 0.015, cycle.trunkEnd, 0.64, 0.72],
    [0, 1, 1, 0.32, 0],
  );
  const branchOpacity = useTransform(
    cycleProgress,
    [0.235, cycle.trunkEnd, cycle.branchesEnd, 0.72, 0.8],
    [0, 1, 1, 0.28, 0],
  );
  const trunkTravelerOpacity = useTransform(
    cycleProgress,
    [0, 0.015, 0.23, cycle.trunkEnd],
    [0, 1, 1, 0],
  );
  const branchTravelerOpacity = useTransform(
    cycleProgress,
    [0.235, cycle.trunkEnd, 0.59, cycle.branchesEnd],
    [0, 1, 1, 0],
  );
  const primaryPulseOpacity = useTransform(
    cycleProgress,
    [0.59, 0.635, 0.76, 0.91],
    [0, 1, 0.58, 0],
  );
  const primaryPulseTransform = useTransform(
    cycleProgress,
    [0.59, 0.7, 0.91],
    ["scale(0.98, 0.95)", "scale(1.025, 1.035)", "scale(1.07, 1.1)"],
  );
  const secondaryPulseOpacity = useTransform(
    cycleProgress,
    [0.65, 0.715, 0.84, 1],
    [0, 0.82, 0.36, 0],
  );
  const secondaryPulseTransform = useTransform(
    cycleProgress,
    [0.65, 0.78, 1],
    ["scale(0.99, 0.97)", "scale(1.05, 1.075)", "scale(1.1, 1.16)"],
  );

  const motionState = reduced ? "static" : active ? "active" : "idle";

  return (
    <svg
      ref={workflowRef}
      role="img"
      aria-labelledby="readiness-title readiness-desc"
      viewBox="0 0 760 320"
      data-readiness-workflow="true"
      data-readiness-motion-engine="motion"
      data-readiness-cycle="infinite"
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
          fillClassName="fill-ink-muted"
          id="trunk"
          opacity={trunkOpacity}
          progress={trunkProgress}
          start={[182, 160]}
          strokeClassName="stroke-ink-muted"
          travelerOpacity={trunkTravelerOpacity}
        />
        {nodes.map((node) => (
          <ReadinessSignal
            key={`signal-${node.id}`}
            d={layout[node.id].path}
            fillClassName={layout[node.id].signalFill}
            id={node.id}
            opacity={branchOpacity}
            progress={branchProgress}
            start={[366, 160]}
            strokeClassName={layout[node.id].signalStroke}
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
            <motion.rect
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
            <motion.rect
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
  );
}

function ReadinessSignal({
  d,
  fillClassName,
  id,
  opacity,
  progress,
  start,
  strokeClassName,
  travelerOpacity,
}: ReadinessSignalProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const travelerX = useTransform(progress, (value) => {
    const path = pathRef.current;
    return path
      ? path.getPointAtLength(path.getTotalLength() * value).x
      : start[0];
  });
  const travelerY = useTransform(progress, (value) => {
    const path = pathRef.current;
    return path
      ? path.getPointAtLength(path.getTotalLength() * value).y
      : start[1];
  });

  return (
    <>
      <motion.path
        ref={pathRef}
        d={d}
        data-readiness-signal={id}
        className={strokeClassName}
        strokeWidth="2.5"
        style={{ opacity, pathLength: progress }}
      />
      <motion.circle
        cx={travelerX}
        cy={travelerY}
        r="5.5"
        aria-hidden="true"
        data-readiness-traveler={id}
        className={`${fillClassName} stroke-surface`}
        strokeWidth="2.5"
        style={{ opacity: travelerOpacity }}
      />
    </>
  );
}
