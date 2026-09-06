// GENERATED — do not edit. Source: packages/tokens/src/tokens.json
// Regenerate: node packages/tokens/scripts/generate-native.mjs
// packages/testing/src/token-fidelity.test.ts fails if this drifts.

export type PrimitiveName = "neutral-0" | "neutral-25" | "neutral-50" | "neutral-100" | "neutral-150" | "neutral-200" | "neutral-300" | "neutral-400" | "neutral-500" | "neutral-600" | "neutral-700" | "neutral-800" | "neutral-900" | "neutral-950" | "neutral-975" | "cobalt-50" | "cobalt-100" | "cobalt-200" | "cobalt-300" | "cobalt-400" | "cobalt-500" | "cobalt-600" | "cobalt-700" | "cobalt-800" | "cobalt-900" | "green-50" | "green-100" | "green-200" | "green-300" | "green-500" | "green-600" | "green-700" | "green-800" | "green-900" | "amber-50" | "amber-100" | "amber-200" | "amber-300" | "amber-500" | "amber-600" | "amber-700" | "amber-800" | "amber-900" | "danger-50" | "danger-100" | "danger-200" | "danger-300" | "danger-500" | "danger-600" | "danger-700" | "danger-800" | "danger-900" | "violet-100" | "violet-200" | "violet-300" | "violet-500" | "violet-700" | "violet-900";
export type RoleName = "bg-canvas" | "bg-surface" | "bg-subtle" | "bg-muted" | "bg-inverse" | "bg-signal" | "bg-overlay" | "text-primary" | "text-secondary" | "text-muted" | "text-subtle" | "text-on-inverse" | "text-on-inverse-muted" | "text-on-signal" | "text-link" | "text-brand" | "border-subtle" | "border-default" | "border-strong" | "border-inverse" | "border-focus" | "action-primary-bg" | "action-primary-fg" | "action-primary-hover" | "action-signal-bg" | "action-signal-fg" | "action-signal-hover" | "action-ghost-hover" | "status-ready-surface" | "status-ready-border" | "status-ready-fg" | "status-attention-surface" | "status-attention-border" | "status-attention-fg" | "status-blocked-surface" | "status-blocked-border" | "status-blocked-fg" | "status-review-surface" | "status-review-border" | "status-review-fg" | "status-idle-surface" | "status-idle-border" | "status-idle-fg" | "evidence-satisfied" | "evidence-pending" | "evidence-blocking" | "viz-1" | "viz-2" | "viz-3" | "viz-4" | "viz-5" | "text-accent" | "border-accent" | "bg-accent-soft";
export type ThemeName = "light" | "dark";

/** The ramps. Present so a chart or a generated asset can walk a scale;
  * NOT for component styling — a component names a role. */
export const primitive: Record<PrimitiveName, string> = {
  "neutral-0": "#FFFFFF",
  "neutral-25": "#F6F5F1",
  "neutral-50": "#EFEEE8",
  "neutral-100": "#E9E8E2",
  "neutral-150": "#E2E1DE",
  "neutral-200": "#D9D9D6",
  "neutral-300": "#CFCFCC",
  "neutral-400": "#A9ACB3",
  "neutral-500": "#7A7E87",
  "neutral-600": "#5E626B",
  "neutral-700": "#4E5158",
  "neutral-800": "#3A3D45",
  "neutral-900": "#2A2C33",
  "neutral-950": "#1E1F24",
  "neutral-975": "#15161A",
  "cobalt-50": "#F4F6FF",
  "cobalt-100": "#EAEDFF",
  "cobalt-200": "#D5DBFF",
  "cobalt-300": "#9AAAFF",
  "cobalt-400": "#5568DE",
  "cobalt-500": "#2B4BFF",
  "cobalt-600": "#2440D9",
  "cobalt-700": "#1E36B8",
  "cobalt-800": "#172A8C",
  "cobalt-900": "#101D5E",
  "green-50": "#F1F9F4",
  "green-100": "#E8F4EE",
  "green-200": "#CFE9DC",
  "green-300": "#9FD4B8",
  "green-500": "#1E8F5A",
  "green-600": "#1B8050",
  "green-700": "#17754A",
  "green-800": "#125A39",
  "green-900": "#0D3F28",
  "amber-50": "#FCF5EF",
  "amber-100": "#FAEFE8",
  "amber-200": "#F4D8C4",
  "amber-300": "#EDB48F",
  "amber-500": "#E07A32",
  "amber-600": "#C8641F",
  "amber-700": "#A6511A",
  "amber-800": "#7E3E14",
  "amber-900": "#4F2A10",
  "danger-50": "#FBF4F3",
  "danger-100": "#FCE9E6",
  "danger-200": "#FBD5D1",
  "danger-300": "#F5BAB3",
  "danger-500": "#E45C55",
  "danger-600": "#CE2F30",
  "danger-700": "#A02827",
  "danger-800": "#792623",
  "danger-900": "#531E1B",
  "violet-100": "#F0EBFC",
  "violet-200": "#E4DAF9",
  "violet-300": "#D0C3EB",
  "violet-500": "#916CCD",
  "violet-700": "#60438D",
  "violet-900": "#36284D",
};

/** The OKLCH triple each primitive was derived from, kept beside the hex so
  * the derivation is auditable on native too, and so a tool that needs to
  * interpolate a ramp does it in the space the ramp was built in. */
export const primitiveOklch: Record<PrimitiveName, [number, number, number]> = {
  "neutral-0": [1, 0, 89.88],
  "neutral-25": [0.9698, 0.005408, 95.1],
  "neutral-50": [0.9482, 0.008055, 98.88],
  "neutral-100": [0.9301, 0.008093, 98.88],
  "neutral-150": [0.9097, 0.004188, 91.45],
  "neutral-200": [0.8845, 0.004061, 106.48],
  "neutral-300": [0.8537, 0.004097, 106.49],
  "neutral-400": [0.7442, 0.010568, 267.33],
  "neutral-500": [0.5927, 0.014479, 266.63],
  "neutral-600": [0.4958, 0.01516, 266.59],
  "neutral-700": [0.4347, 0.012129, 267.24],
  "neutral-800": [0.3603, 0.014381, 269.29],
  "neutral-900": [0.294, 0.013009, 272.93],
  "neutral-950": [0.2404, 0.009628, 276.67],
  "neutral-975": [0.2009, 0.008119, 274.5],
  "cobalt-50": [0.9742, 0.012172, 276.1],
  "cobalt-100": [0.9491, 0.024404, 278.37],
  "cobalt-200": [0.8982, 0.049772, 277.88],
  "cobalt-300": [0.7593, 0.123516, 274.95],
  "cobalt-400": [0.5662, 0.17981, 272.46],
  "cobalt-500": [0.5251, 0.264234, 267.09],
  "cobalt-600": [0.4677, 0.232104, 267.14],
  "cobalt-700": [0.4157, 0.203704, 267.26],
  "cobalt-800": [0.3465, 0.162363, 267.55],
  "cobalt-900": [0.2702, 0.116305, 268.31],
  "green-50": [0.9747, 0.0107, 158.85],
  "green-100": [0.9565, 0.014961, 164.73],
  "green-200": [0.9113, 0.032544, 164.17],
  "green-300": [0.8252, 0.067616, 161.41],
  "green-500": [0.5763, 0.127169, 157.1],
  "green-600": [0.532, 0.117054, 156.95],
  "green-700": [0.4989, 0.108739, 157.73],
  "green-800": [0.4157, 0.08836, 158.16],
  "green-900": [0.3281, 0.066562, 158.87],
  "amber-50": [0.9739, 0.010978, 63.36],
  "amber-100": [0.9588, 0.015167, 54.93],
  "amber-200": [0.9002, 0.041211, 57.72],
  "amber-300": [0.8134, 0.083056, 54.22],
  "amber-500": [0.6823, 0.15117, 51.96],
  "amber-600": [0.6123, 0.148425, 49.89],
  "amber-700": [0.5319, 0.129258, 48.79],
  "amber-800": [0.4389, 0.103138, 49.64],
  "amber-900": [0.328, 0.066775, 53],
  "danger-50": [0.972, 0.00753, 26],
  "danger-100": [0.948, 0.022039, 26],
  "danger-200": [0.905, 0.043269, 26],
  "danger-300": [0.84, 0.070375, 26],
  "danger-500": [0.6484, 0.171, 26],
  "danger-600": [0.56, 0.195828, 26],
  "danger-700": [0.47, 0.156763, 26],
  "danger-800": [0.395, 0.115745, 26],
  "danger-900": [0.315, 0.079589, 26],
  "violet-100": [0.95, 0.022312, 300],
  "violet-200": [0.905, 0.04319, 300],
  "violet-300": [0.84, 0.057941, 300],
  "violet-500": [0.61, 0.145512, 300],
  "violet-700": [0.45, 0.120193, 300],
  "violet-900": [0.31, 0.066342, 300],
};

/** Semantic roles, resolved. This is what a native component reads. */
export const color: Record<ThemeName, Record<RoleName, string>> = {
  light: {
    "bg-canvas": "#F6F5F1",
    "bg-surface": "#FFFFFF",
    "bg-subtle": "#EFEEE8",
    "bg-muted": "#E9E8E2",
    "bg-inverse": "#15161A",
    "bg-signal": "#2B4BFF",
    "bg-overlay": "rgba(21, 22, 26, 0.32)",
    "text-primary": "#15161A",
    "text-secondary": "#4E5158",
    "text-muted": "#5E626B",
    "text-subtle": "#7A7E87",
    "text-on-inverse": "#E2E1DE",
    "text-on-inverse-muted": "#A9ACB3",
    "text-on-signal": "#FFFFFF",
    "text-link": "#2440D9",
    "text-brand": "#1E36B8",
    "border-subtle": "#E2E1DE",
    "border-default": "#D9D9D6",
    "border-strong": "#CFCFCC",
    "border-inverse": "#3A3D45",
    "border-focus": "#2B4BFF",
    "action-primary-bg": "#15161A",
    "action-primary-fg": "#FFFFFF",
    "action-primary-hover": "#2A2C33",
    "action-signal-bg": "#2B4BFF",
    "action-signal-fg": "#FFFFFF",
    "action-signal-hover": "#2440D9",
    "action-ghost-hover": "#E9E8E2",
    "status-ready-surface": "#E8F4EE",
    "status-ready-border": "#CFE9DC",
    "status-ready-fg": "#17754A",
    "status-attention-surface": "#FAEFE8",
    "status-attention-border": "#F4D8C4",
    "status-attention-fg": "#A6511A",
    "status-blocked-surface": "#FCE9E6",
    "status-blocked-border": "#FBD5D1",
    "status-blocked-fg": "#A02827",
    "status-review-surface": "#EAEDFF",
    "status-review-border": "#D5DBFF",
    "status-review-fg": "#1E36B8",
    "status-idle-surface": "#E9E8E2",
    "status-idle-border": "#D9D9D6",
    "status-idle-fg": "#4E5158",
    "evidence-satisfied": "#17754A",
    "evidence-pending": "#7E3E14",
    "evidence-blocking": "#A02827",
    "viz-1": "#2440D9",
    "viz-2": "#1B8050",
    "viz-3": "#C8641F",
    "viz-4": "#CE2F30",
    "viz-5": "#916CCD",
    "text-accent": "#5568DE",
    "border-accent": "#2B4BFF",
    "bg-accent-soft": "#EAEDFF",
  },
  dark: {
    "bg-canvas": "#15161A",
    "bg-surface": "#1E1F24",
    "bg-subtle": "#2A2C33",
    "bg-muted": "#3A3D45",
    "bg-inverse": "#FFFFFF",
    "bg-signal": "#2B4BFF",
    "bg-overlay": "rgba(21, 22, 26, 0.56)",
    "text-primary": "#F6F5F1",
    "text-secondary": "#D9D9D6",
    "text-muted": "#CFCFCC",
    "text-subtle": "#A9ACB3",
    "text-on-inverse": "#2A2C33",
    "text-on-inverse-muted": "#4E5158",
    "text-on-signal": "#FFFFFF",
    "text-link": "#9AAAFF",
    "text-brand": "#9AAAFF",
    "border-subtle": "#2A2C33",
    "border-default": "#3A3D45",
    "border-strong": "#4E5158",
    "border-inverse": "#CFCFCC",
    "border-focus": "#9AAAFF",
    "action-primary-bg": "#FFFFFF",
    "action-primary-fg": "#15161A",
    "action-primary-hover": "#E2E1DE",
    "action-signal-bg": "#2B4BFF",
    "action-signal-fg": "#FFFFFF",
    "action-signal-hover": "#2440D9",
    "action-ghost-hover": "#2A2C33",
    "status-ready-surface": "#0D3F28",
    "status-ready-border": "#125A39",
    "status-ready-fg": "#9FD4B8",
    "status-attention-surface": "#4F2A10",
    "status-attention-border": "#7E3E14",
    "status-attention-fg": "#EDB48F",
    "status-blocked-surface": "#531E1B",
    "status-blocked-border": "#792623",
    "status-blocked-fg": "#F5BAB3",
    "status-review-surface": "#101D5E",
    "status-review-border": "#172A8C",
    "status-review-fg": "#9AAAFF",
    "status-idle-surface": "#2A2C33",
    "status-idle-border": "#3A3D45",
    "status-idle-fg": "#CFCFCC",
    "evidence-satisfied": "#9FD4B8",
    "evidence-pending": "#EDB48F",
    "evidence-blocking": "#F5BAB3",
    "viz-1": "#9AAAFF",
    "viz-2": "#9FD4B8",
    "viz-3": "#EDB48F",
    "viz-4": "#F5BAB3",
    "viz-5": "#D0C3EB",
    "text-accent": "#9AAAFF",
    "border-accent": "#9AAAFF",
    "bg-accent-soft": "#101D5E",
  },
};

export type ShadowName = "raised" | "overlay" | "modal" | "float" | "float-accent";

/**
 * Structurally React Native's own `BoxShadowValue`
 * (react-native@0.86.2, Libraries/StyleSheet/StyleSheetTypes.d.ts:343-350),
 * declared here rather than imported so @goproceed/tokens stays free of a
 * react-native dependency and keeps working in the web build. RN's version
 * makes `color`, `blurRadius` and `spreadDistance` optional and allows
 * strings for the numbers, so this narrower shape is assignable to it, and
 * `BoxShadowValue[]` is assignable to `ViewStyle["boxShadow"]`
 * (`ReadonlyArray<BoxShadowValue> | string`, same file at :516).
 */
export type BoxShadowValue = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
};

/** Pass straight to a View's `boxShadow` style prop — CSS box-shadow
  * semantics on both iOS and Android, so nothing here is approximated per
  * platform. */
export const shadow: Record<ShadowName, BoxShadowValue[]> = {
  "raised": [{ offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: "rgba(21, 22, 26, 0.04)" }],
  "overlay": [{ offsetX: 0, offsetY: 12, blurRadius: 30, spreadDistance: -16, color: "rgba(21, 22, 26, 0.35)" }],
  "modal": [{ offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: "rgba(21, 22, 26, 0.08)" }, { offsetX: 0, offsetY: 24, blurRadius: 64, spreadDistance: 0, color: "rgba(21, 22, 26, 0.12)" }],
  "float": [{ offsetX: 0, offsetY: 20, blurRadius: 50, spreadDistance: -30, color: "rgba(21, 22, 26, 0.22)" }, { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: "rgba(21, 22, 26, 0.05)" }],
  "float-accent": [{ offsetX: 0, offsetY: 30, blurRadius: 70, spreadDistance: -40, color: "rgba(43, 75, 255, 0.35)" }, { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: "rgba(21, 22, 26, 0.05)" }],
};

export const font = {
  "display": "'Onest Variable', Onest, system-ui, sans-serif",
  "sans": "'Onest Variable', Onest, system-ui, sans-serif",
  "mono": "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
  "features": "\"calt\"",
} as const;

export const text = {
  "micro": "11px",
  "meta": "12px",
  "data": "13px",
  "body": "15px",
  "h3": "18px",
  "h2": "22px",
  "h1": "26px",
  "display": "32px",
  "mkt-caption": "13px",
  "mkt-index": "12px",
  "mkt-body": "16px",
  "mkt-lead": "clamp(16px, 1.25vw, 19px)",
  "mkt-display-3": "clamp(24px, 2.6vw, 34px)",
  "mkt-display-2": "clamp(28px, 3.3vw, 44px)",
  "mkt-display-1": "clamp(38px, 5.2vw, 66px)",
} as const;

export const fontWeight = {
  "normal": "400",
  "medium": "500",
  "semibold": "600",
  "bold": "700",
} as const;

export const leading = {
  "none": "1",
  "tight": "1.15",
  "display": "1.05",
  "snug": "1.35",
  "normal": "1.5",
  "relaxed": "1.6",
} as const;

export const tracking = {
  "tightest": "-0.035em",
  "tighter": "-0.03em",
  "tight": "-0.025em",
  "normal": "-0.011em",
  "wide": "0.08em",
} as const;

export const radius = {
  "control": "6px",
  "field": "8px",
  "panel": "10px",
  "card": "12px",
  "surface": "14px",
  "section": "16px",
  "pill": "999px",
} as const;

export const space = {
  "base": "0.25rem",
  "section-sm": "64px",
  "section-md": "96px",
  "section-lg": "112px",
  "section-xl": "160px",
} as const;

export const breakpoint = {
  "md": "768px",
  "wide": "1240px",
} as const;

export const container = {
  "measure": "680px",
  "content": "1240px",
  "nav": "880px",
  "marketing": "1180px",
} as const;

export const duration = {
  "instant": "100ms",
  "fast": "160ms",
  "base": "240ms",
  "slow": "400ms",
  "marquee": "35s",
  "deliberate": "640ms",
  "stately": "900ms",
  "grand": "1200ms",
} as const;

export const ease = {
  "out": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  "enter": "cubic-bezier(0.165, 0.84, 0.44, 1)",
  "emphatic": "cubic-bezier(0.19, 1, 0.22, 1)",
  "soft": "cubic-bezier(0.44, 0, 0.56, 1)",
  "overshoot": "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const stagger = {
  "tight": "40ms",
  "default": "80ms",
  "loose": "120ms",
} as const;

export const spring = {
  "reveal": "stiffness 100, damping 20, mass 1",
  "press": "stiffness 400, damping 30, mass 1",
  "tilt": "stiffness 120, damping 20, mass 1",
  "magnetic": "stiffness 150, damping 18, mass 0.5",
} as const;

export const blur = {
  "chrome": "20px",
  "reveal": "6px",
} as const;

export const component = {
  "rail-width-wide": "240px",
  "rail-width-collapsed": "68px",
  "rail-width-drawer": "min(300px, 84vw)",
  "control-height-touch": "44px",
  "control-height-desk": "36px",
  "control-height-desk-sm": "32px",
  "header-height-app": "56px",
  "header-height-marketing": "58px",
  "register-row-padding-y": "10px",
  "register-row-padding-x": "12px",
  "focus-ring-width": "2px",
  "focus-ring-offset": "2px",
  "control-height-marketing": "42px",
} as const;
