import { describe, expect, it } from "vitest";
import type { VaultState } from "../vault";
import { clientStateLabel } from "../status-labels";
import { heldCount, itemDetail, itemProblem, itemTitle, mediaList, megabytes, parkedBySwitch, pendingCount, pendingSummary, requirementLabel } from "./item-labels";

const states: VaultState[] = ["not_sent", "sending", "awaiting_receipt", "failed", "quarantined", "server_confirmed"];

describe("local queue labels", () => {
  it("uses the catalog label for every vault state", () => {
    for (const state of states) expect(itemTitle({ state })).toBe(clientStateLabel(state));
  });
  it("says saved on the device only for committed, unsent items", () => {
    expect(itemDetail({ state: "not_sent" })).toBe("Збережено на пристрої");
    for (const state of states.filter((s) => s !== "not_sent")) expect(itemDetail({ state })).toBeNull();
  });
  it("explains only failed items, with a generic fallback", () => {
    expect(itemProblem({ state: "not_sent", errorCode: "RECEIPT_MISMATCH" })).toBeNull();
    expect(itemProblem({ state: "failed", errorCode: "RECEIPT_MISMATCH" })).toMatch(/не підтвердив/);
    expect(itemProblem({ state: "failed", errorCode: "SOMETHING_NEW" })).toMatch(/з’єднання/);
    expect(itemProblem({ state: "failed" })).toMatch(/з’єднання/);
  });
  it("counts everything not yet confirmed by the server", () => {
    expect(pendingCount([{ state: "not_sent" }, { state: "failed" }, { state: "server_confirmed" }])).toBe(2);
  });
  it("counts a held photo apart from the unsent ones", () => {
    const held = { state: "failed" as const, discardRequestedAt: "2026-09-24T00:00:00.000Z" };
    expect(pendingCount([held, { state: "not_sent" }])).toBe(1);
    expect(heldCount([held, { state: "not_sent" }])).toBe(1);
    expect(itemTitle(held)).toBe("Буде видалено");
    expect(itemProblem({ ...held, errorCode: "NETWORK" })).toBeNull();
    expect(itemDetail(held)).toMatch(/не надсилатиме/);
  });
  it("keeps requirement text verbatim, and leaves it out rather than cut it", () => {
    const text = " Перший рядок\nдругий — з ’ і 😀 ";
    expect(requirementLabel(text)).toBe(text);
    expect(requirementLabel("x".repeat(2000))).toHaveLength(2000);
    expect(requirementLabel("x".repeat(2001))).toBeUndefined();
    expect(requirementLabel("")).toBeUndefined();
    expect(requirementLabel("a\u0000b")).toBeUndefined();
  });
  it("never reports zero pending when the journal was not read", () => {
    expect(pendingSummary(false, [])).toEqual({ known: false });
    expect(pendingSummary(true, [])).toEqual({ known: true, pending: 0 });
  });
  it("asks before a workspace switch parks unsent photos", () => {
    expect(parkedBySwitch("A", "B", { known: true, pending: 2 })).toBe(2);
    expect(parkedBySwitch("A", "A", { known: true, pending: 2 })).toBe(0);
    expect(parkedBySwitch(null, "B", { known: true, pending: 2 })).toBe(0);
    expect(parkedBySwitch("A", "B", { known: true, pending: 0 })).toBe(0);
  });
  it("names formats and sizes in field language", () => {
    expect(mediaList(["image/jpeg", "image/heic"])).toBe("JPEG, HEIC");
    expect(megabytes(20 * 1024 * 1024)).toBe("20 МБ");
    expect(megabytes(8_000_000)).toBe("7 МБ");
    expect(megabytes(500 * 1024)).toBe("500 КБ");
  });
});
