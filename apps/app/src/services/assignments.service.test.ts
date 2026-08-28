import { describe, it, expect } from "vitest";
import { createAssignment } from "./assignments.service";
import type { FetchLike } from "../lib/api";

const input = {
  contractId: "11111111-1111-4111-8111-111111111111",
  workItemId: "22222222-2222-4222-8222-222222222222",
  assigneeMemberId: "33333333-3333-4333-8333-333333333333",
};

describe("createAssignment", () => {
  it("refuses before the network when the contract rejects the body", async () => {
    let called = false;
    const fake: FetchLike = async () => { called = true; return new Response("{}", { status: 201 }); };
    const res = await createAssignment({ ...input, workItemId: "not-a-uuid" }, "k1", fake);
    expect(res.kind).toBe("invalid");
    expect(called).toBe(false);
  });

  it("posts to the contract's assignments route with the key it was given", async () => {
    let path = ""; let key = "";
    const fake: FetchLike = async (p, init) => {
      path = p; key = (init?.headers as Record<string, string>)["Idempotency-Key"];
      return new Response(JSON.stringify({ assignmentId: "a1" }), { status: 201 });
    };
    const res = await createAssignment(input, "k2", fake);
    expect(path).toBe(`/v1/contracts/${input.contractId}/assignments`);
    expect(key).toBe("k2");
    expect(res).toEqual({ kind: "ok", assignmentId: "a1" });
  });

  it("does NOT send the contractId in the body — it is the path", async () => {
    let body: unknown;
    const fake: FetchLike = async (_p, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ assignmentId: "a1" }), { status: 201 });
    };
    await createAssignment(input, "k3", fake);
    expect(body).not.toHaveProperty("contractId");
  });

  it("hands a 422 back whole, so the field errors survive", async () => {
    const problem = { detail: "Перевірте поля.", fieldErrors: [{ path: "workItemId", message: "Оберіть рядок." }] };
    const fake: FetchLike = async () => new Response(JSON.stringify(problem), { status: 422 });
    const res = await createAssignment(input, "k4", fake);
    expect(res.kind).toBe("refused");
    if (res.kind === "refused") {
      expect(res.status).toBe(422);
      expect(res.problem).toEqual(problem);
      expect(res.detail).toBe("Перевірте поля.");
    }
  });

  it("names an expired session for what it is", async () => {
    const fake: FetchLike = async () => new Response("{}", { status: 401 });
    expect((await createAssignment(input, "k5", fake)).kind).toBe("session_expired");
  });

  it("omits an absent optional rather than sending null", async () => {
    let body: Record<string, unknown> = {};
    const fake: FetchLike = async (_p, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ assignmentId: "a1" }), { status: 201 });
    };
    await createAssignment(input, "k6", fake);
    expect("plannedQuantity" in body).toBe(false);
    expect("dueDate" in body).toBe(false);
  });
});
