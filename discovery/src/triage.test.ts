import { describe, expect, it } from "vitest";
import { screen, type ScreenInput } from "./triage";

const ok: ScreenInput = {
  is_gc_or_developer_only: false,
  has_visible_field_work: true,
  is_retail_or_manufacturing_only: false,
  is_design_bureau_only: false,
  operating_in_ukraine: true,
  active_within_24_months: true,
  is_sole_trader_no_crew: false,
  already_in_list: false,
  on_suppression_list: false,
  is_pure_play_icp_trade: true,
  has_concealed_or_inaccessible_work: true,
  has_public_email_and_live_fact: true,
  today: "2026-07-26",
};

describe("disqualifiers", () => {
  it.each([
    ["D1", { is_gc_or_developer_only: true }],
    ["D2", { has_visible_field_work: false }],
    ["D3", { is_retail_or_manufacturing_only: true }],
    ["D4", { is_design_bureau_only: true }],
    ["D6", { operating_in_ukraine: false }],
    ["D6", { active_within_24_months: false }],
    ["D7", { is_sole_trader_no_crew: true }],
    ["D8", { already_in_list: true }],
    ["D9", { on_suppression_list: true }],
  ])("%s permanently disqualifies", (reason, patch) => {
    const result = screen({ ...ok, ...patch });
    expect(result.kind).toBe("disqualified");
    if (result.kind === "disqualified") {
      expect(result.reason).toBe(reason);
      expect(result.status).toBe("disqualified");
    }
  });

  // ER-5b: D5 is a lookup outcome, not an ICP verdict. Permanently burning a
  // good-fit lead on a soft failure is expensive when the funnel needs volume.
  it("D5 is recoverable: unreachable with a recheck date, not disqualified", () => {
    const result = screen({ ...ok, has_public_business_email: false });
    expect(result.kind).toBe("unreachable");
    if (result.kind === "unreachable") {
      expect(result.status).toBe("unreachable");
      expect(result.recheck_after).toBe("2026-10-24"); // today + 90 days
    }
  });
});

describe("3-question triage (ER-8d)", () => {
  it("all three yes → 85 → band A", () => {
    const r = screen(ok);
    expect(r.kind).toBe("scored");
    if (r.kind === "scored") { expect(r.fit_score).toBe(85); expect(r.triage).toEqual([1, 1, 1]); }
  });

  it("two yes → 60 → band B", () => {
    const r = screen({ ...ok, has_public_email_and_live_fact: false });
    if (r.kind === "scored") { expect(r.fit_score).toBe(60); expect(r.triage).toEqual([1, 1, 0]); }
  });

  it("one yes → 45 → band C", () => {
    const r = screen({ ...ok, has_concealed_or_inaccessible_work: false, has_public_email_and_live_fact: false });
    if (r.kind === "scored") { expect(r.fit_score).toBe(45); }
  });

  it("zero yes → 20 → band D", () => {
    const r = screen({
      ...ok, is_pure_play_icp_trade: false,
      has_concealed_or_inaccessible_work: false, has_public_email_and_live_fact: false,
    });
    if (r.kind === "scored") { expect(r.fit_score).toBe(20); }
  });

  it("disqualifiers are checked before scoring", () => {
    const r = screen({ ...ok, is_gc_or_developer_only: true, is_pure_play_icp_trade: true });
    expect(r.kind).toBe("disqualified");
  });
});
