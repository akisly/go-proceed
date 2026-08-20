// GENERATED — do not edit. Source: packages/tokens/src/tokens.json
// Regenerate: node packages/tokens/scripts/generate-native.mjs
// packages/testing/src/token-fidelity.test.ts fails if this drifts.

export type PrimitiveName = "neutral-0" | "neutral-25" | "neutral-50" | "neutral-100" | "neutral-150" | "neutral-200" | "neutral-300" | "neutral-400" | "neutral-500" | "neutral-600" | "neutral-700" | "neutral-800" | "neutral-900" | "neutral-950" | "neutral-975" | "signal-50" | "signal-100" | "signal-200" | "signal-300" | "signal-400" | "signal-500" | "signal-600" | "signal-700" | "signal-800" | "signal-900" | "amber-50" | "amber-100" | "amber-200" | "amber-300" | "amber-500" | "amber-600" | "amber-700" | "amber-800" | "amber-900" | "danger-50" | "danger-100" | "danger-200" | "danger-300" | "danger-500" | "danger-600" | "danger-700" | "danger-800" | "danger-900" | "blue-50" | "blue-100" | "blue-200" | "blue-300" | "blue-500" | "blue-600" | "blue-700" | "blue-800" | "blue-900" | "violet-100" | "violet-200" | "violet-300" | "violet-500" | "violet-700" | "violet-900";
export type RoleName = "bg-canvas" | "bg-surface" | "bg-subtle" | "bg-muted" | "bg-inverse" | "bg-signal" | "bg-overlay" | "text-primary" | "text-secondary" | "text-muted" | "text-subtle" | "text-on-inverse" | "text-on-inverse-muted" | "text-on-signal" | "text-link" | "text-brand" | "border-subtle" | "border-default" | "border-strong" | "border-inverse" | "border-focus" | "action-primary-bg" | "action-primary-fg" | "action-primary-hover" | "action-signal-bg" | "action-signal-fg" | "action-signal-hover" | "action-ghost-hover" | "status-ready-surface" | "status-ready-border" | "status-ready-fg" | "status-attention-surface" | "status-attention-border" | "status-attention-fg" | "status-blocked-surface" | "status-blocked-border" | "status-blocked-fg" | "status-review-surface" | "status-review-border" | "status-review-fg" | "status-idle-surface" | "status-idle-border" | "status-idle-fg" | "evidence-satisfied" | "evidence-pending" | "evidence-blocking" | "viz-1" | "viz-2" | "viz-3" | "viz-4" | "viz-5";
export type ThemeName = "light" | "dark";

/** The ramps. Present so a chart or a generated asset can walk a scale;
  * NOT for component styling — a component names a role. */
export const primitive: Record<PrimitiveName, string> = {
  "neutral-0": "#FFFFFF",
  "neutral-25": "#FBFBF9",
  "neutral-50": "#F6F6F3",
  "neutral-100": "#EFEEEB",
  "neutral-150": "#E7E6E2",
  "neutral-200": "#DDDCD8",
  "neutral-300": "#CCCAC6",
  "neutral-400": "#B1AFAB",
  "neutral-500": "#92918C",
  "neutral-600": "#6D6C68",
  "neutral-700": "#5C5B57",
  "neutral-800": "#444441",
  "neutral-900": "#2C2B29",
  "neutral-950": "#1A1917",
  "neutral-975": "#11100F",
  "signal-50": "#F7FDEE",
  "signal-100": "#E9FECA",
  "signal-200": "#DDFEA5",
  "signal-300": "#D6FE8C",
  "signal-400": "#CEFE6C",
  "signal-500": "#C6FF34",
  "signal-600": "#99C23D",
  "signal-700": "#6F8D30",
  "signal-800": "#526628",
  "signal-900": "#3B4821",
  "amber-50": "#FCF6ED",
  "amber-100": "#FEEED4",
  "amber-200": "#FCDBA3",
  "amber-300": "#F6C97D",
  "amber-500": "#F2B84B",
  "amber-600": "#BF8F34",
  "amber-700": "#916E2D",
  "amber-800": "#6B5225",
  "amber-900": "#423319",
  "danger-50": "#FBF4F3",
  "danger-100": "#FCE9E6",
  "danger-200": "#FBD5D1",
  "danger-300": "#F5BAB3",
  "danger-500": "#E45C55",
  "danger-600": "#CE2F30",
  "danger-700": "#A02827",
  "danger-800": "#792623",
  "danger-900": "#531E1B",
  "blue-50": "#F5F7FB",
  "blue-100": "#E8EFFC",
  "blue-200": "#D4E0F9",
  "blue-300": "#BBCBEB",
  "blue-500": "#5A7DCE",
  "blue-600": "#3E63BD",
  "blue-700": "#3756A1",
  "blue-800": "#274181",
  "blue-900": "#1B2D5B",
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
  "neutral-0": [1, 0, 95],
  "neutral-25": [0.988, 0.0025, 95],
  "neutral-50": [0.972, 0.0035, 95],
  "neutral-100": [0.95, 0.0045, 95],
  "neutral-150": [0.925, 0.005, 95],
  "neutral-200": [0.895, 0.0055, 95],
  "neutral-300": [0.84, 0.006, 95],
  "neutral-400": [0.755, 0.0065, 95],
  "neutral-500": [0.655, 0.0065, 95],
  "neutral-600": [0.53, 0.006, 95],
  "neutral-700": [0.47, 0.0055, 95],
  "neutral-800": [0.385, 0.005, 95],
  "neutral-900": [0.29, 0.0045, 95],
  "neutral-950": [0.215, 0.004, 95],
  "neutral-975": [0.175, 0.0035, 95],
  "signal-50": [0.985, 0.020162, 125],
  "signal-100": [0.968, 0.070306, 125],
  "signal-200": [0.953, 0.118258, 125],
  "signal-300": [0.944, 0.147876, 125],
  "signal-400": [0.936, 0.180854, 125],
  "signal-500": [0.9281, 0.219957, 125],
  "signal-600": [0.76, 0.164318, 125],
  "signal-700": [0.6, 0.123731, 125],
  "signal-800": [0.48, 0.091798, 125],
  "signal-900": [0.38, 0.06319, 125],
  "amber-50": [0.975, 0.013587, 80],
  "amber-100": [0.955, 0.037836, 80],
  "amber-200": [0.905, 0.080076, 80],
  "amber-300": [0.86, 0.107432, 80],
  "amber-500": [0.8165, 0.1399, 80],
  "amber-600": [0.68, 0.119769, 80],
  "amber-700": [0.56, 0.092865, 80],
  "amber-800": [0.455, 0.069843, 80],
  "amber-900": [0.33, 0.04529, 80],
  "danger-50": [0.972, 0.00753, 26],
  "danger-100": [0.948, 0.022039, 26],
  "danger-200": [0.905, 0.043269, 26],
  "danger-300": [0.84, 0.070375, 26],
  "danger-500": [0.6484, 0.171, 26],
  "danger-600": [0.56, 0.195828, 26],
  "danger-700": [0.47, 0.156763, 26],
  "danger-800": [0.395, 0.115745, 26],
  "danger-900": [0.315, 0.079589, 26],
  "blue-50": [0.975, 0.006436, 265],
  "blue-100": [0.95, 0.018895, 265],
  "blue-200": [0.905, 0.03653, 265],
  "blue-300": [0.84, 0.048916, 265],
  "blue-500": [0.6, 0.129948, 265],
  "blue-600": [0.52, 0.147232, 265],
  "blue-700": [0.4695, 0.1266, 265],
  "blue-800": [0.39, 0.112526, 265],
  "blue-900": [0.31, 0.085245, 265],
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
    "bg-canvas": "#FBFBF9",
    "bg-surface": "#FFFFFF",
    "bg-subtle": "#F6F6F3",
    "bg-muted": "#EFEEEB",
    "bg-inverse": "#11100F",
    "bg-signal": "#C6FF34",
    "bg-overlay": "rgba(17, 16, 15, 0.32)",
    "text-primary": "#11100F",
    "text-secondary": "#5C5B57",
    "text-muted": "#6D6C68",
    "text-subtle": "#92918C",
    "text-on-inverse": "#E7E6E2",
    "text-on-inverse-muted": "#B1AFAB",
    "text-on-signal": "#11100F",
    "text-link": "#3E63BD",
    "text-brand": "#526628",
    "border-subtle": "#E7E6E2",
    "border-default": "#DDDCD8",
    "border-strong": "#CCCAC6",
    "border-inverse": "#444441",
    "border-focus": "#5A7DCE",
    "action-primary-bg": "#11100F",
    "action-primary-fg": "#FFFFFF",
    "action-primary-hover": "#2C2B29",
    "action-signal-bg": "#C6FF34",
    "action-signal-fg": "#11100F",
    "action-signal-hover": "#CEFE6C",
    "action-ghost-hover": "#EFEEEB",
    "status-ready-surface": "#E9FECA",
    "status-ready-border": "#DDFEA5",
    "status-ready-fg": "#526628",
    "status-attention-surface": "#FEEED4",
    "status-attention-border": "#FCDBA3",
    "status-attention-fg": "#6B5225",
    "status-blocked-surface": "#FCE9E6",
    "status-blocked-border": "#FBD5D1",
    "status-blocked-fg": "#A02827",
    "status-review-surface": "#E8EFFC",
    "status-review-border": "#D4E0F9",
    "status-review-fg": "#3756A1",
    "status-idle-surface": "#EFEEEB",
    "status-idle-border": "#DDDCD8",
    "status-idle-fg": "#5C5B57",
    "evidence-satisfied": "#526628",
    "evidence-pending": "#6B5225",
    "evidence-blocking": "#A02827",
    "viz-1": "#99C23D",
    "viz-2": "#3E63BD",
    "viz-3": "#BF8F34",
    "viz-4": "#CE2F30",
    "viz-5": "#916CCD",
  },
  dark: {
    "bg-canvas": "#11100F",
    "bg-surface": "#1A1917",
    "bg-subtle": "#2C2B29",
    "bg-muted": "#444441",
    "bg-inverse": "#FFFFFF",
    "bg-signal": "#C6FF34",
    "bg-overlay": "rgba(17, 16, 15, 0.56)",
    "text-primary": "#FBFBF9",
    "text-secondary": "#DDDCD8",
    "text-muted": "#CCCAC6",
    "text-subtle": "#B1AFAB",
    "text-on-inverse": "#2C2B29",
    "text-on-inverse-muted": "#5C5B57",
    "text-on-signal": "#11100F",
    "text-link": "#BBCBEB",
    "text-brand": "#CEFE6C",
    "border-subtle": "#2C2B29",
    "border-default": "#444441",
    "border-strong": "#5C5B57",
    "border-inverse": "#CCCAC6",
    "border-focus": "#BBCBEB",
    "action-primary-bg": "#FFFFFF",
    "action-primary-fg": "#11100F",
    "action-primary-hover": "#E7E6E2",
    "action-signal-bg": "#C6FF34",
    "action-signal-fg": "#11100F",
    "action-signal-hover": "#CEFE6C",
    "action-ghost-hover": "#2C2B29",
    "status-ready-surface": "#3B4821",
    "status-ready-border": "#526628",
    "status-ready-fg": "#D6FE8C",
    "status-attention-surface": "#423319",
    "status-attention-border": "#6B5225",
    "status-attention-fg": "#F6C97D",
    "status-blocked-surface": "#531E1B",
    "status-blocked-border": "#792623",
    "status-blocked-fg": "#F5BAB3",
    "status-review-surface": "#1B2D5B",
    "status-review-border": "#274181",
    "status-review-fg": "#BBCBEB",
    "status-idle-surface": "#2C2B29",
    "status-idle-border": "#444441",
    "status-idle-fg": "#CCCAC6",
    "evidence-satisfied": "#D6FE8C",
    "evidence-pending": "#F6C97D",
    "evidence-blocking": "#F5BAB3",
    "viz-1": "#CEFE6C",
    "viz-2": "#BBCBEB",
    "viz-3": "#F6C97D",
    "viz-4": "#F5BAB3",
    "viz-5": "#D0C3EB",
  },
};

export type ShadowName = "raised" | "overlay" | "modal" | "float";

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
  "raised": [{ offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: "rgba(17, 16, 15, 0.04)" }, { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: "rgba(17, 16, 15, 0.04)" }],
  "overlay": [{ offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: 0, color: "rgba(17, 16, 15, 0.06)" }, { offsetX: 0, offsetY: 12, blurRadius: 28, spreadDistance: 0, color: "rgba(17, 16, 15, 0.08)" }],
  "modal": [{ offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: "rgba(17, 16, 15, 0.08)" }, { offsetX: 0, offsetY: 24, blurRadius: 64, spreadDistance: 0, color: "rgba(17, 16, 15, 0.12)" }],
  "float": [{ offsetX: 0, offsetY: 12, blurRadius: 32, spreadDistance: 0, color: "rgba(17, 16, 15, 0.08)" }, { offsetX: 0, offsetY: 40, blurRadius: 80, spreadDistance: 0, color: "rgba(17, 16, 15, 0.1)" }],
};

export const font = {
  "display": "'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif",
  "sans": "'Inter Variable', Inter, system-ui, sans-serif",
  "mono": "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
  "features": "\"cv01\", \"ss03\"",
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
  "mkt-lead": "clamp(17px, 1.4vw, 20px)",
  "mkt-display-3": "clamp(26px, 2.6vw, 32px)",
  "mkt-display-2": "clamp(32px, 4vw, 48px)",
  "mkt-display-1": "clamp(40px, 5.6vw, 72px)",
} as const;

export const fontWeight = {
  "normal": "400",
  "medium": "510",
  "semibold": "590",
  "bold": "680",
} as const;

export const leading = {
  "none": "1",
  "tight": "1.15",
  "display": "1.0",
  "snug": "1.35",
  "normal": "1.5",
  "relaxed": "1.6",
} as const;

export const tracking = {
  "tightest": "-0.022em",
  "tighter": "-0.020em",
  "tight": "-0.014em",
  "normal": "-0.011em",
  "wide": "0.08em",
} as const;

export const radius = {
  "control": "6px",
  "field": "8px",
  "panel": "10px",
  "card": "14px",
  "surface": "20px",
  "section": "28px",
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
} as const;

export const duration = {
  "instant": "100ms",
  "fast": "160ms",
  "base": "240ms",
  "slow": "400ms",
  "marquee": "35s",
  "deliberate": "640ms",
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
  "header-height-marketing": "64px",
  "register-row-padding-y": "10px",
  "register-row-padding-x": "12px",
  "focus-ring-width": "2px",
  "focus-ring-offset": "2px",
} as const;
