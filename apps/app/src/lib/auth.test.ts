import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpProblem } from "./http";

// This suite covers requireUser's OWN branching (bearer-token vs cookie
// fallback, error mapping) — apps/app/tests/*.int.test.ts vi.mock the whole
// "../src/lib/auth" module, so that branching currently has zero real
// coverage. Stub only the supabase client module (./supabase-server), not
// auth.ts itself, so the code under test is the real requireUser().
const { mockSupabaseAnon, mockSupabaseServer } = vi.hoisted(() => ({
  mockSupabaseAnon: vi.fn(),
  mockSupabaseServer: vi.fn(),
}));
vi.mock("./supabase-server", () => ({
  supabaseAnon: () => mockSupabaseAnon(),
  supabaseServer: () => mockSupabaseServer(),
}));

describe("requireUser", () => {
  beforeEach(() => {
    mockSupabaseAnon.mockReset();
    mockSupabaseServer.mockReset();
  });

  it("throws HttpProblem 401 AUTH_REQUIRED when there is no Authorization header and no cookie session", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    });

    const { requireUser } = await import("./auth");
    const req = new Request("http://x/v1/me/context");

    await expect(requireUser("req-1", req)).rejects.toBeInstanceOf(HttpProblem);
    try {
      await requireUser("req-1", req);
      expect.unreachable();
    } catch (e) {
      const err = e as HttpProblem;
      expect(err.status).toBe(401);
      expect(err.body.code).toBe("AUTH_REQUIRED");
      expect(err.body.userAction).toBe("sign_in");
    }
    // Cookie path was used, not the bearer path.
    expect(mockSupabaseAnon).not.toHaveBeenCalled();
  });

  it("throws HttpProblem 401 AUTH_REQUIRED with no Request object at all (no cookies, no headers to read)", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    });

    const { requireUser } = await import("./auth");
    await expect(requireUser("req-2")).rejects.toBeInstanceOf(HttpProblem);
  });

  it("throws HttpProblem 401 AUTH_REQUIRED for a malformed/garbage bearer token", async () => {
    mockSupabaseAnon.mockReturnValue({
      auth: {
        getUser: async (token: string) => {
          expect(token).toBe("garbage-not-a-real-jwt");
          return { data: { user: null }, error: { message: "invalid JWT" } };
        },
      },
    });

    const { requireUser } = await import("./auth");
    const req = new Request("http://x/v1/me/context", {
      headers: { authorization: "Bearer garbage-not-a-real-jwt" },
    });

    await expect(requireUser("req-3", req)).rejects.toBeInstanceOf(HttpProblem);
    try {
      await requireUser("req-3", req);
      expect.unreachable();
    } catch (e) {
      const err = e as HttpProblem;
      expect(err.status).toBe(401);
      expect(err.body.code).toBe("AUTH_REQUIRED");
    }
    // Bearer path never falls back to the cookie session — the caller
    // presented a credential and it must be validated on its own merits.
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it("resolves the userId from a valid bearer token via supabase.auth.getUser(token), never trusting a client-supplied id", async () => {
    mockSupabaseAnon.mockReturnValue({
      auth: {
        getUser: async (token: string) => {
          expect(token).toBe("a-valid-looking-jwt");
          return { data: { user: { id: "user-123" } }, error: null };
        },
      },
    });

    const { requireUser } = await import("./auth");
    const req = new Request("http://x/v1/me/context", {
      headers: { authorization: "Bearer a-valid-looking-jwt" },
    });

    const result = await requireUser("req-4", req);
    expect(result.userId).toBe("user-123");
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
