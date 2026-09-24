// GENERATED — do not edit. Source: packages/tokens/src/tokens.json
// Regenerate: node packages/tokens/scripts/generate-merge-config.mjs
// packages/testing/src/token-fidelity.test.ts fails if this drifts.
//
// Teaches tailwind-merge this theme's namespaces. See the generator's header
// for the measured failure this prevents.

import { validators } from "tailwind-merge";

const { isArbitraryValue, isArbitraryVariable } = validators;

/** Every semantic colour name, so a colour utility is recognised as one. */
export const COLOUR_NAMES = ["accent", "accent-soft", "action", "action-brand", "action-brand-fg", "action-brand-hover", "action-fg", "action-ghost-hover", "action-hover", "action-signal", "action-signal-fg", "action-signal-hover", "brand", "canvas", "chip-clay", "chip-clay-fg", "chip-pine", "chip-pine-fg", "chip-stone", "chip-stone-fg", "chip-violet", "chip-violet-fg", "evidence-blocking", "evidence-pending", "evidence-satisfied", "focus", "focus-inverse", "ink", "ink-muted", "ink-secondary", "ink-subtle", "inverse", "line", "line-accent", "line-inverse", "line-strong", "line-subtle", "line-warm", "link", "on-inverse", "on-inverse-muted", "on-signal", "overlay", "signal", "status-attention", "status-attention-fg", "status-attention-line", "status-blocked", "status-blocked-fg", "status-blocked-line", "status-idle", "status-idle-fg", "status-idle-line", "status-ready", "status-ready-fg", "status-ready-line", "status-review", "status-review-fg", "status-review-line", "subtle", "sunken", "surface", "tint-warm", "viz-1", "viz-2", "viz-3", "viz-4", "viz-5", "viz-brand", "viz-empty"] as const;

// EXTENDS stock tailwind-merge (owner, 2026-09-24): stock Tailwind stays whole,
// so `text-sm` must stay a size; the roles are added to each stock group.
export const TW_MERGE_EXTEND = {
  classGroups: {
    "font-size": [{ text: ["micro", "meta", "data", "body", "h3", "h2", "h1", "display", "mkt-caption", "mkt-index", "mkt-body", "mkt-lead", "mkt-display-3", "mkt-display-2", "mkt-display-1", isArbitraryValue, isArbitraryVariable] }],
    "font-family": [{ font: ["display", "sans", "mono"] }],
    "font-weight": [{ font: ["normal", "medium", "semibold", "bold", isArbitraryValue, isArbitraryVariable] }],
    leading: [{ leading: ["none", "tight", "display", "snug", "normal", "relaxed", isArbitraryValue, isArbitraryVariable] }],
    tracking: [{ tracking: ["tightest", "tighter", "tight", "normal", "wide", isArbitraryValue, isArbitraryVariable] }],
    rounded: [{ rounded: ["control", "field", "panel", "card", "surface", "section", "pill", "", "none", isArbitraryValue, isArbitraryVariable] }],
    shadow: [{ shadow: ["raised", "overlay", "modal", "float", "float-accent", "", "none", isArbitraryValue, isArbitraryVariable] }],
    ease: [{ ease: ["out", "enter", "emphatic", "soft", "overshoot", "linear", "initial", isArbitraryValue, isArbitraryVariable] }],
    // Durations are NAMED here, not numeric: `duration-fast` and
    // `duration-base` are the same property and must collapse, and stock
    // tailwind-merge only recognises `duration-<number>`.
    duration: [{ duration: ["instant", "fast", "base", "slow", "marquee", "deliberate", "stately", "grand", isArbitraryValue, isArbitraryVariable] }],
    blur: [{ blur: ["chrome", "reveal", "", "none", isArbitraryValue, isArbitraryVariable] }],
    "max-w": [{ "max-w": ["measure", "content", "nav", "marketing"] }],
  },
} as const;
