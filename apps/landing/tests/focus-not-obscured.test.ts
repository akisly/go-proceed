import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(import.meta.dirname, "..");
const globals = readFileSync(join(app, "app/globals.css"), "utf8");
const nav = readFileSync(join(app, "components/blocks/nav.tsx"), "utf8");

/**
 * WCAG 2.4.11 Focus Not Obscured (Minimum).
 *
 * The header is `fixed top-0` and 59px tall. `scroll-mt-*` on the sections
 * covers fragment navigation and nothing else — it does not apply to the
 * focusable controls inside them, so shift-tabbing back up the page put the
 * focused element under the header with no scroll at all: as far as the
 * browser is concerned an element at `top: 20` is already in view, because it
 * has no knowledge of an out-of-flow bar painted over it. Measured before the
 * fix, the FAQ trigger came back 81% covered and the form's mail link 100%.
 *
 * `scroll-padding-top` on the scrolling element is the fix, and it is the only
 * one that also covers keyboard focus rather than just anchors.
 */
describe("keyboard focus is not hidden behind the fixed header", () => {
  it("reserves the header's height on the scroll container", () => {
    const declaration = /html\s*\{[^}]*scroll-padding-top:\s*([^;]+);/.exec(globals);
    expect(declaration).not.toBeNull();
    expect(declaration?.[1]).toContain("--gp-header-height-marketing");
  });

  it("takes the reserve from the same token the header is sized by", () => {
    // A literal here (`59px`, `4rem`) stops tracking the header the moment the
    // header changes, and nothing would fail. The token is the whole point.
    expect(nav).toContain("h-(--gp-header-height-marketing)");
  });
});
