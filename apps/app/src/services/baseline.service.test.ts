import { describe, it, expect, vi } from "vitest";

vi.mock("./blocked-value.service", () => ({
  getBlockedValue: vi.fn(async () => ({
    kind: "ok",
    blockedValue: { byBaseline: [
      { contractId: "c1", contractVersionId: "v1", contractVersionNo: 2, totalsByCurrency: [], unvaluedAssignmentCount: 0 },
    ] },
  })),
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  apiGet: vi.fn(async () => ({ workItems: [
    { workItemId: "w1", workCode: "1.1", description: "Приклад-прокладання кабелю", unitCode: "м" },
  ] })),
}));

import { listPublishedBaselines } from "./baseline.service";
import { apiGet } from "../lib/api";

describe("listPublishedBaselines", () => {
  it("reads each baseline's lines by contract id and version NUMBER", async () => {
    const res = await listPublishedBaselines("p1");
    expect(apiGet).toHaveBeenCalledWith("/v1/contracts/c1/versions/2");
    expect(res).toEqual({ kind: "ok", baselines: [{
      contractId: "c1", contractVersionId: "v1", contractVersionNo: 2,
      workItems: [{ workItemId: "w1", workCode: "1.1", description: "Приклад-прокладання кабелю", unitCode: "м" }],
    }] });
  });
});
