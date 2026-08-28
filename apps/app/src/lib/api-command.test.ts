import { describe, it, expect } from "vitest";
import { apiPost, type FetchLike } from "./api-command";

describe("apiPost", () => {
  it("sends the body, the content type and the idempotency key", async () => {
    let seen: RequestInit | undefined;
    const fake = async (_input: string, init?: RequestInit) => { seen = init; return new Response("{}", { status: 201 }); };
    await apiPost("/v1/contracts/c1/assignments", { workItemId: "w1" }, "key-1", fake);
    expect(seen?.method).toBe("POST");
    const headers = seen?.headers as Record<string, string | undefined>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(seen?.body).toBe(JSON.stringify({ workItemId: "w1" }));
  });

  it("returns the response rather than throwing on a refusal", async () => {
    const fake = async () => new Response("{}", { status: 422 });
    const res = await apiPost("/v1/x", {}, "key-2", fake);
    expect(res.status).toBe(422);
  });
});
