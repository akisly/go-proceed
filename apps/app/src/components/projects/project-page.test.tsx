// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ProjectPage } from "./project-page";

afterEach(cleanup);

/**
 * DEV-035: the frame every project screen shares. The harness asserts the
 * first «Доручення» link on the overview points at the register; this pins
 * the same fact without a browser, plus the parts a reader navigates by.
 */
describe("ProjectPage", () => {
  it("names the project in the h1 and in the trail, with a way back to the list", () => {
    render(<ProjectPage projectId="p-1" projectName="ЖК Річковий, будинок 2" tab="overview">x</ProjectPage>);
    expect(screen.getByRole("heading", { level: 1, name: "ЖК Річковий, будинок 2" })).toBeTruthy();
    const trail = screen.getByRole("navigation", { name: "Шлях" });
    expect(trail).toHaveTextContent("Проєкти/ЖК Річковий, будинок 2");
    expect(screen.getByRole("link", { name: "Проєкти" })).toHaveAttribute("href", "/");
  });

  it("has two tabs that are pages, the current one marked", () => {
    render(<ProjectPage projectId="p-1" projectName="Об’єкт" tab="assignments">x</ProjectPage>);
    const overview = screen.getByRole("link", { name: "Огляд" });
    const register = screen.getByRole("link", { name: "Доручення" });
    expect(overview).toHaveAttribute("href", "/projects/p-1");
    expect(register).toHaveAttribute("href", "/projects/p-1/assignments");
    expect(register).toHaveAttribute("aria-current", "page");
    expect(overview).not.toHaveAttribute("aria-current");
  });

  it("still frames a project the list did not return, under a neutral name", () => {
    render(<ProjectPage projectId="p-1" projectName={null} tab="overview">x</ProjectPage>);
    expect(screen.getByRole("heading", { level: 1, name: "Проєкт" })).toBeTruthy();
  });
});
