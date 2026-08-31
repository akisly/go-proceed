import { describe, expect, it } from "vitest";
import { HttpProblem } from "../http";
import { recordEvidenceDecision } from "./record-evidence-decision";

describe("recordEvidenceDecision", () => {
  it("returns the exact shared not-found contract before opening a tenant transaction", async () => {
    const requestId = "10000000-0000-4000-8000-000000000001";
    const thrown = await recordEvidenceDecision({
      actorUserId: "10000000-0000-4000-8000-000000000002", requestId, occurrenceId: "",
      body: { outcome: "accepted", issues: [], expectedVersion: null },
      idempotencyKey: "shared-command-boundary", requestHash: "a".repeat(64),
    }).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(HttpProblem);
    expect(thrown).toMatchObject({ status: 404, body: {
      code: "RESOURCE_NOT_FOUND", detail: "Вимогу не знайдено.", requestId,
      retryable: false, userAction: "return_to_list",
    } });
  });
});
