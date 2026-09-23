// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ProjectListRow } from "@goproceed/contracts";

import { monogram, Sidebar } from "./sidebar";

// See `no-assignments-empty-state.test.tsx`: no `test.globals`, so cleanup is
// registered by hand.
afterEach(cleanup);

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const projects = [
  { projectId: "p-1", name: "ЖК Річковий, будинок 2" },
  { projectId: "p-2", name: "БЦ Unit City, вежа А" },
] as ProjectListRow[];

const renderRail = () =>
  render(<Sidebar memberships={[]} projects={projects} profileSlot={<button type="button">Профіль і вихід</button>} />);

/**
 * DEV-035 (2026-09-23): the rail's three groups after the owner's Autumn CRM
 * reference. What is pinned is what a reader relies on: every item is a real
 * link to a route that exists, the current one says so in `aria-current`, and
 * the four disabled placeholders of D1–D4 are gone rather than restyled.
 */
describe("Sidebar", () => {
  it("links every project the member sees, under its own group", () => {
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Основна навігація" });
    expect(within(nav).getByRole("link", { name: "ЖК Річковий, будинок 2" }))
      .toHaveAttribute("href", "/projects/p-1");
    expect(within(nav).getByRole("link", { name: "БЦ Unit City, вежа А" }))
      .toHaveAttribute("href", "/projects/p-2");
    expect(within(nav).getByText("Проєкти")).toBeTruthy();
    expect(within(nav).getByText("Меню")).toBeTruthy();
    expect(within(nav).getByText("Налаштування")).toBeTruthy();
  });

  it("marks the current project as the page, and as the location from its sub-pages", () => {
    pathname = "/projects/p-2";
    renderRail();
    const marked = () => screen.getAllByRole("link")
      .filter((a) => a.hasAttribute("aria-current"))
      .map((a) => [a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(marked()).toEqual([["/projects/p-2", "page"]]);
    cleanup();
    pathname = "/projects/p-2/assignments";
    renderRail();
    // The register is not this link's page: the tab says «page» there.
    expect(marked()).toEqual([["/projects/p-2", "location"]]);
  });

  it("marks the project list on /, and the profile on its own page", () => {
    pathname = "/";
    renderRail();
    expect(screen.getByRole("link", { name: "Усі проєкти" })).toHaveAttribute("aria-current", "page");
    cleanup();
    pathname = "/settings/profile";
    renderRail();
    expect(screen.getByRole("link", { name: "Профіль" })).toHaveAttribute("aria-current", "page");
  });

  it("renders no disabled placeholder for a screen that does not exist", () => {
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Основна навігація" });
    expect(within(nav).queryAllByRole("button").filter((b) => b.hasAttribute("disabled"))).toEqual([]);
    expect(within(nav).queryByText(/ще не реалізовано/)).toBeNull();
  });

  it("keeps the profile control", () => {
    renderRail();
    expect(screen.getByRole("button", { name: "Профіль і вихід" })).toBeTruthy();
  });
});

describe("monogram", () => {
  it("takes the first letter of the first two words, across hyphens and apostrophes", () => {
    expect(monogram("ЖК Річковий, будинок 2")).toBe("ЖР");
    expect(monogram("Приклад-Об’єкт QA")).toBe("ПО");
    expect(monogram("БЦ")).toBe("Б");
    expect(monogram("—")).toBe("П");
  });
});
