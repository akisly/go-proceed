import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above this file's other imports, so the
// mock's own state has to be created through `vi.hoisted` — a plain
// `const getSessionMock = vi.fn()` above the `vi.mock` call would still be
// hoisted *under* it and throw "Cannot access before initialization".
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

// Imported after the mock is registered so `api.ts` resolves `./supabase` to
// the fake above rather than the real client (which would otherwise try to
// construct a real supabase-js client from `src/lib/env.ts`'s values).
const { apiGet, apiPost, readProblem } = await import("./api");

function headerValue(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe("apiGet / apiPost — bearer attachment", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches Authorization: Bearer <token> when a session exists", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok-123" } },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiGet("/v1/ping");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/v1/ping");
    expect(init.method).toBe("GET");
    expect(headerValue(init, "Authorization")).toBe("Bearer tok-123");
  });

  it("sends no Authorization header when there is no session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiGet("/v1/ping");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("apiPost attaches the bearer token, Idempotency-Key, content-type, and a JSON body", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok-456" } },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/v1/assignments/1/upload-intents", { a: 1 }, "idem-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/v1/assignments/1/upload-intents");
    expect(init.method).toBe("POST");
    expect(headerValue(init, "Authorization")).toBe("Bearer tok-456");
    expect(headerValue(init, "Idempotency-Key")).toBe("idem-1");
    expect(headerValue(init, "content-type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("apiPost sends no Authorization header when there is no session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/v1/assignments/1/upload-intents", { a: 1 }, "idem-2");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("apiPost forwards an AbortSignal straight through to fetch", async () => {
    // Pins the one thing `src/lib/capture/upload.ts` depends on this
    // function for: without `signal` actually reaching `fetch`, a discard's
    // abort would stop the raw PUT but not the create/finalize calls routed
    // through this function — see `upload.ts`'s own header on why that gap
    // matters for INV-081.
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await apiPost("/v1/assignments/1/upload-intents", { a: 1 }, "idem-3", controller.signal);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});

describe("readProblem", () => {
  it("parses detail, userAction, and code off a JSON problem body", async () => {
    const res = new Response(
      JSON.stringify({
        code: "PAYLOAD_TOO_LARGE",
        detail: "Файл завеликий.",
        userAction: "Зменшіть розмір і спробуйте ще раз.",
        fieldErrors: [],
        requestId: "req-1",
        retryable: false,
      }),
      { status: 413 },
    );

    await expect(readProblem(res)).resolves.toEqual({
      code: "PAYLOAD_TOO_LARGE",
      detail: "Файл завеликий.",
      userAction: "Зменшіть розмір і спробуйте ще раз.",
    });
  });

  it("returns the generic {} shape when the body is not JSON", async () => {
    const res = new Response("<html>502 Bad Gateway</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });

    await expect(readProblem(res)).resolves.toEqual({});
  });

  it("returns the generic {} shape when the JSON body has no matching fields", async () => {
    const res = new Response(JSON.stringify({ unrelated: true }), { status: 500 });

    await expect(readProblem(res)).resolves.toEqual({
      code: undefined,
      detail: undefined,
      userAction: undefined,
    });
  });
});
