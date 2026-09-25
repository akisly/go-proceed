import { describe, expect, it } from "vitest";
import {
  formatWorkspaceTime, workspaceTimeFormat, WORKSPACE_TIMEZONE_DEFAULT, WORKSPACE_TIMEZONE_FALLBACKS,
} from "./workspace-time";

/**
 * The evidence screen's times, in the workspace's zone (DEV-089, BL-034). The
 * same instant throughout: 09:30Z on 22 August, and 09:30Z on 15 January.
 */
const SUMMER = "2026-08-22T09:30:00.000Z";
const WINTER = "2026-01-15T09:30:00.000Z";

describe("formatWorkspaceTime", () => {
  it("formats in the zone it is given, with the zone's own label, across DST", () => {
    expect(formatWorkspaceTime(SUMMER, "Europe/Kyiv")).toContain("12:30");
    expect(formatWorkspaceTime(SUMMER, "Europe/Kyiv")).toContain("GMT+3");
    expect(formatWorkspaceTime(WINTER, "Europe/Kyiv")).toContain("GMT+2");
    expect(formatWorkspaceTime(SUMMER, "Europe/Warsaw")).toContain("11:30");
    expect(formatWorkspaceTime(SUMMER, "Europe/Warsaw")).toContain("GMT+2");
    expect(formatWorkspaceTime(WINTER, "Europe/Warsaw")).toContain("10:30");
    expect(formatWorkspaceTime(WINTER, "Europe/Warsaw")).toContain("GMT+1");
  });

  it("keeps the medium date and short time shape of the screen it replaced", () => {
    expect(formatWorkspaceTime(SUMMER, "Europe/Kyiv")).toBe(
      new Date(SUMMER).toLocaleString("uk-UA", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Kyiv", timeZoneName: "short",
      }));
  });

  it("falls back to the default for a zone the runtime does not know, and says so by its label", () => {
    expect(() => formatWorkspaceTime(SUMMER, "Not/AZone")).not.toThrow();
    expect(formatWorkspaceTime(SUMMER, "Not/AZone")).toBe(formatWorkspaceTime(SUMMER, WORKSPACE_TIMEZONE_DEFAULT));
    expect(formatWorkspaceTime(SUMMER, "Not/AZone")).toContain("GMT+3");
  });

  it("shows a malformed instant as given rather than throwing (gp-reviewer R1)", () => {
    expect(formatWorkspaceTime("not-a-date", "Europe/Kyiv")).toBe("not-a-date");
  });

  it("tries Kyiv under its pre-2022b name before UTC, for a browser with old tzdata (R2)", () => {
    expect(WORKSPACE_TIMEZONE_FALLBACKS).toEqual(["Europe/Kyiv", "Europe/Kiev"]);
    // With the current name refused, the old one still gives Kyiv time.
    expect(workspaceTimeFormat(["Not/AZone", "Europe/Kiev"]).format(new Date(SUMMER))).toContain("12:30");
  });
});

describe("workspaceTimeFormat", () => {
  it("takes the first zone the runtime accepts", () => {
    expect(workspaceTimeFormat(["Not/AZone", "Europe/Warsaw", "Europe/Kyiv"])
      .resolvedOptions().timeZone).toBe("Europe/Warsaw");
  });

  it("ends in UTC when no candidate is known, as a browser with old tzdata would have it", () => {
    const f = workspaceTimeFormat(["Not/AZone", "Also/Not"]);
    expect(f.resolvedOptions().timeZone).toBe("UTC");
    expect(f.format(new Date(SUMMER))).toContain("09:30");
    expect(f.format(new Date(SUMMER))).toContain("UTC");
  });
});
