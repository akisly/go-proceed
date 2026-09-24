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

  it("states every breakpoint and container size in one unit, so `sm:`/`lg:` sort before `md:`/`wide:`", () => {
    // Tailwind 4.3.3 orders breakpoints by unit before value; a rem stock `lg`
    // beside a px role `wide` would be emitted after it and win at 1440.
    for (const ns of ["breakpoint", "container"]) {
      const units = [...theme.matchAll(new RegExp(`--${ns}-[\\w-]+:\\s*[\\d.]+([a-z]+);`, "g"))].map((m) => m[1]);
      expect(units.length, ns).toBeGreaterThan(4);
      expect(new Set(units), ns).toEqual(new Set(["px"]));
    }
  });

  it("restates the installed Tailwind's stock sizes exactly (rem × 16)", () => {
    const stock = readFileSync(join(repoRoot, "node_modules/.pnpm/node_modules/tailwindcss/theme.css"), "utf8");
    const found = [...stock.matchAll(/--(breakpoint|container)-([\w-]+):\s*([\d.]+)rem;/g)];
    expect(found.length).toBeGreaterThan(10);
    for (const [, ns, name, rem] of found) {
      if (ns === "breakpoint" && name === "md") continue; // the role `md` (768px) replaces it
      expect(theme, `${ns}-${name}`).toContain(`--${ns}-${name}: ${Number(rem) * 16}px;`);
    }
  });

  it("still declares the roles, which override stock names they share", () => {
    for (const role of ["--container-content", "--breakpoint-wide", "--radius-card", "--font-weight-medium"]) {
      expect(theme, role).toContain(role);
    }
  });
});
