import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Stock Tailwind stays whole and the token roles ride on top of it (owner,
 * 2026-09-24): a role adds a name or overrides a stock one of the same name,
 * and nothing Tailwind ships is cleared. Before this the theme opened with
 * `--container-*: initial` and seventeen more, so `max-w-md` compiled to
 * nothing and every `Dialog` ran full width (BL-047).
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const theme = readFileSync(join(repoRoot, "packages/ui/src/theme.generated.css"), "utf8");

describe("the theme extends stock Tailwind", () => {
  it("clears no stock namespace", () => {
    expect(theme).not.toMatch(/--[a-z-]+-\*:\s*initial/);
  });

  it("still declares the roles, which override stock names they share", () => {
    for (const role of ["--container-content", "--breakpoint-wide", "--radius-card", "--font-weight-medium"]) {
      expect(theme, role).toContain(role);
    }
  });
});
