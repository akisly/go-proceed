// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ShareLink } from "../components/blocks/share-link";
import { landingContent } from "../content/landing-content";

afterEach(cleanup);

/**
 * «Скопіювати посилання для ПТВ» (DEV-024 R-03). On one page the link was the
 * page's own address plus `#compare`; on four pages the button sits on `/`,
 * `/product` and `/roles`, and what it hands out must be «Було і стало»
 * wherever it was pressed — and the sentence in front of it must promise no
 * more than that page holds.
 */
describe("the share link", () => {
  it("copies the address of «Було і стало» on /roles, not the address of the page it was pressed on", async () => {
    const user = userEvent.setup();
    // user-event installs its own clipboard stub in setup(); patch its
    // writeText rather than replacing the object (see pilot-form.test.tsx).
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator.clipboard, "writeText", { value: writeText, configurable: true });
    window.history.replaceState({}, "", "/product#trust");

    render(<ShareLink />);
    await user.click(screen.getByRole("button", { name: landingContent.cta.share }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = String(writeText.mock.calls[0]?.[0]);
    expect(copied.startsWith(landingContent.cta.shareText)).toBe(true);
    expect(copied.endsWith(`${window.location.origin}/roles#compare`)).toBe(true);
    expect(copied).not.toContain("/product");
  });

  it("promises only what that page holds, and names it when the copy is refused", () => {
    expect(landingContent.cta.shareText).toContain("Було і стало");
    expect(landingContent.cta.shareText).not.toContain("план пілота");
    expect(landingContent.cta.shareFailed).toContain("Для кого");
  });
});
