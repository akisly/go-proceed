import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extendTailwindMerge, twMerge } from "tailwind-merge";
import { TW_MERGE_EXTEND } from "../../ui/src/tw-merge.generated";

/**
 * v1 recorded this trap in prose: "tailwind-merge has to be taught this theme.
 * `text-data` is not a t-shirt size, so stock tailwind-merge files it as a
 * COLOUR, decides it conflicts with `text-foreground`, and drops one of them."
 *
 * Prose does not fail a build. This does — and it asserts the trap in both
 * directions: that stock tailwind-merge really still breaks these pairs (so the
 * config is not cargo cult), and that the taught instance does not.
 */
const cn = extendTailwindMerge({ extend: TW_MERGE_EXTEND });

const repoRoot = join(import.meta.dirname, "..", "..", "..");

describe("tailwind-merge is taught this theme", () => {
  it("stock tailwind-merge still eats the font size — the trap is real", () => {
    // If this ever starts passing, tailwind-merge learned to handle custom
    // theme namespaces and the override may be reconsidered. Until then it is
    // load-bearing.
    expect(twMerge("text-data text-ink")).toBe("text-ink");
  });

  it("keeps a size and a colour that share the `text-` prefix", () => {
    expect(cn("text-data text-ink")).toBe("text-data text-ink");
    expect(cn("text-mkt-lead text-ink-muted")).toBe("text-mkt-lead text-ink-muted");
    expect(cn("text-display text-status-blocked-fg")).toBe("text-display text-status-blocked-fg");
  });

  it("collapses two values from the same namespace, last wins", () => {
    expect(cn("rounded-panel rounded-pill")).toBe("rounded-pill");
    expect(cn("shadow-raised shadow-float")).toBe("shadow-float");
    expect(cn("text-data text-body")).toBe("text-body");
    expect(cn("duration-fast duration-base")).toBe("duration-base");
    expect(cn("ease-out ease-soft")).toBe("ease-soft");
    expect(cn("tracking-tight tracking-wide")).toBe("tracking-wide");
    expect(cn("leading-snug leading-relaxed")).toBe("leading-relaxed");
    expect(cn("font-display font-sans")).toBe("font-sans");
  });

  it("keeps stock Tailwind working beside the roles (owner, 2026-09-24)", () => {
    // Stock sizes are sizes, not colours, so they survive a colour role…
    expect(cn("text-sm text-ink")).toBe("text-sm text-ink");
    // …and collapse against a role from the same namespace, last wins.
    expect(cn("text-sm text-data")).toBe("text-data");
    expect(cn("text-data text-sm")).toBe("text-sm");
    expect(cn("rounded-md rounded-panel")).toBe("rounded-panel");
    expect(cn("shadow-md shadow-raised")).toBe("shadow-raised");
    expect(cn("font-light font-medium")).toBe("font-medium");
    expect(cn("max-w-md max-w-content")).toBe("max-w-content");
    expect(cn("bg-red-500 bg-canvas")).toBe("bg-canvas");
  });

  it("lets a caller override a component's own class", () => {
    // The whole reason components take `className`.
    expect(cn("bg-surface text-ink", "bg-canvas")).toBe("text-ink bg-canvas");
  });

  it("leaves unrelated utilities alone", () => {
    expect(cn("rounded-panel border border-line px-4 py-3")).toBe(
      "rounded-panel border border-line px-4 py-3");
  });

  it("still understands arbitrary values, which are the only escape hatch", () => {
    expect(cn("text-data text-[13px]")).toBe("text-[13px]");
    expect(cn("h-(--gp-control-height-desk) h-(--gp-control-height-touch)"))
      .toBe("h-(--gp-control-height-touch)");
  });

  it("the config is generated, not hand-listed", () => {
    const file = readFileSync(
      join(repoRoot, "packages/ui/src/tw-merge.generated.ts"), "utf8");
    expect(file).toContain("GENERATED — do not edit");
    // v1's fix carried a note to "extend it when the theme gains a namespace".
    // Generation is that note executed: a namespace cannot be gained without
    // the merge config gaining it.
    const src = JSON.parse(
      readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
    for (const name of Object.keys(src.primitive.text)) {
      expect(file, `font size ${name} is missing from the merge config`)
        .toContain(JSON.stringify(name));
    }
    for (const name of Object.keys(src.primitive.radius)) {
      expect(file, `radius ${name} is missing from the merge config`)
        .toContain(JSON.stringify(name));
    }
  });
});
