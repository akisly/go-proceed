import { describe, it, expect, vi } from "vitest";

const OK = {
  kind: "ok",
  blockedValue: { byBaseline: [
    { contractId: "c1", contractVersionId: "v1", contractVersionNo: 2, totalsByCurrency: [], unvaluedAssignmentCount: 0 },
  ] },
};

vi.mock("./blocked-value.service", () => ({
  getBlockedValue: vi.fn(async () => OK),
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  apiGet: vi.fn(async () => ({ workItems: [
    { workItemId: "w1", workCode: "1.1", description: "Приклад-прокладання кабелю", unitCode: "м" },
  ] })),
}));

import { listPublishedBaselines } from "./baseline.service";
import { getBlockedValue } from "./blocked-value.service";
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

  /**
   * F2. This used to answer `{ kind: "error", error: money }` to the money
   * read's dedicated `forbidden`, and the create route renders `error` as
   * `ShellFatalError` — «щось пішло не так» for a member who is simply not
   * granted `readiness.view`, four responsibility presets' worth of real
   * people who hold `project.view` without it. The refusal has its own arm now,
   * and the route its own legible state.
   *
   * THE VERSION READ MUST NOT RUN. A forbidden money read means there are no
   * `byBaseline` rows to walk, and firing `contract_versions.get` anyway would
   * turn one refusal into a second, unrelated failure — so the call count is
   * asserted, not just the returned arm.
   */
  it("forwards a forbidden money read as its own arm, and reads no versions", async () => {
    vi.mocked(apiGet).mockClear();
    vi.mocked(getBlockedValue).mockResolvedValueOnce(
      { kind: "forbidden", detail: "Немає доступу до цього проєкту." },
    );

    expect(await listPublishedBaselines("p1")).toEqual({ kind: "forbidden" });
    expect(apiGet).not.toHaveBeenCalled();
  });

  /** Every other non-ok outcome stays in `error` — see the module header. */
  it("keeps not_found in the error arm, so the route renders one thing for it", async () => {
    vi.mocked(getBlockedValue).mockResolvedValueOnce({ kind: "not_found" });
    const res = await listPublishedBaselines("p1");
    expect(res.kind).toBe("error");
  });
});
