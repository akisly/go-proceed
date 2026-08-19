// Types for the generators' colour maths. Hand-written because color.mjs must
// stay runnable by `node scripts/…` with no build step — a generator that needs
// compiling is a generator that can be out of date with its own source.
export declare function srgbToLinear(c: number): number;
export declare function linearToSrgb(c: number): number;
export declare function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number];
export declare function inGamut(L: number, C: number, H: number, epsilon?: number): boolean;
export declare function maxChroma(L: number, H: number): number;
export declare function clampChroma(L: number, C: number, H: number): number;
export declare function oklchToHex(L: number, C: number, H: number): string;
export declare function hexToRgb(hex: string): [number, number, number];
export declare function relativeLuminance(hex: string): number;
export declare function contrastRatio(a: string, b: string): number;
export declare function rgba(color: { hex: string; alpha: number }): string;
export declare function hexToOklch(hex: string): [number, number, number];
