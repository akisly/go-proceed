import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), member: vi.fn(), capability: vi.fn(), stream: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireUser: vi.fn(async () => ({ userId: "member" })) }));
vi.mock("@goproceed/database", () => ({ withTenantTx: vi.fn(async (_ctx, fn) => fn({ query: mocks.query })) }));
vi.mock("../src/lib/authz", () => ({ requireActiveMembership: mocks.member, requireProjectCapability: mocks.capability }));
vi.mock("../src/lib/evidence-storage", () => ({ openObjectStream: mocks.stream }));
import { GET } from "../app/v1/occurrences/[occurrenceId]/reference-image/route";
import { HttpProblem, problem } from "../src/lib/http";

const id = "11111111-1111-4111-8111-111111111111";
const bytes = new Uint8Array([1, 2, 3]);
const row = { workspace_id: "workspace", project_id: "project", storage_bucket: "requirement-reference-images",
  storage_key: "private/key", byte_size: 3, sha256: createHash("sha256").update(bytes).digest("hex"), mime_type: "image/jpeg" };
const get = () => GET(new Request(`https://app.example/v1/occurrences/${id}/reference-image`),
  { params: Promise.resolve({ occurrenceId: id }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ rows: [row] });
  mocks.member.mockResolvedValue({ memberId: "membership" });
  mocks.capability.mockResolvedValue(undefined);
  mocks.stream.mockImplementation(async () => new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }));
});
describe("authorized occurrence-scoped reference content", () => {
  it("serves verified inert bytes only after membership and project.view", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(mocks.capability.mock.calls[0]![2]).toEqual({ workspaceId: "workspace", projectId: "project",
      memberId: "membership", capability: "project.view" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
  });
  it("does not touch storage when RLS hides the occurrence or pin", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    expect((await get()).status).toBe(404);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("does not touch storage for revoked membership or capability", async () => {
    for (const gate of [mocks.member, mocks.capability]) {
      gate.mockRejectedValueOnce(new HttpProblem(403, problem("SCOPE_PROJECT_DENIED", "Немає доступу.",
        { requestId: "r", retryable: false, userAction: "request_project_scope" })));
      expect((await get()).status).toBe(403);
    }
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("sanitizes storage failures and refuses changed bytes", async () => {
    mocks.stream.mockRejectedValueOnce(new Error("private/key provider secret"));
    const unavailable = await get();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("private/key");
    mocks.query.mockResolvedValue({ rows: [{ ...row, sha256: "a".repeat(64) }] });
    expect((await get()).status).toBe(503);
  });
});
