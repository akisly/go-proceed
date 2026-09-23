// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ProjectMoneyForbidden } from "./project-money-forbidden";

afterEach(cleanup);

/**
 * DEV-035 review R5-01: a comment tag placed after a JSX comment's `*\/}`
 * rendered as visible text («[deleted 2026-09-23, DEV-035]») inside this
 * refusal. The banner must carry the refusal and nothing else.
 */
describe("ProjectMoneyForbidden", () => {
  it("shows the server's own detail as the banner body, and no stray text", () => {
    render(<ProjectMoneyForbidden projectId="p-1" projectName="Об’єкт" detail="Немає доступу до цього проєкту." />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/^Немає доступу до заблокованої вартостіНемає доступу до цього проєкту\.$/);
    expect(document.body.textContent).not.toMatch(/\[deleted|DEV-0\d\d/);
  });
});
