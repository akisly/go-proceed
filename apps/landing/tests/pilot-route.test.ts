import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverPilotRequest } from "../app/api/pilot/deliver";
import { bucketEntries, bucketSize, rateLimited, resetRateLimit } from "../app/api/pilot/rate-limit";
import { POST } from "../app/api/pilot/route";

const fields = { name: "Ірина", company: "", contact: "iryna@example.com", role: "Керівник ПТВ", context: "БЦ" };
const ok = () => new Response("{}", { status: 200 });
const bad = () => new Response("{}", { status: 500 });

function post(body: unknown, ip = "1.1.1.1") {
  return POST(new Request("http://localhost/api/pilot", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body),
  }));
}

afterEach(() => { vi.unstubAllEnvs(); resetRateLimit(); });

describe("deliverPilotRequest", () => {
  it("answers not-configured when no channel has its variables", async () => {
    expect(await deliverPilotRequest({ fields, referer: null, env: {}, fetchImpl: vi.fn() })).toEqual({ ok: false, error: "not-configured" });
  });

  it("sends to Telegram with the seven-line text and reports the channel", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const result = await deliverPilotRequest({ fields, referer: "https://goproceed.example/", env: { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" }, fetchImpl });
    expect(result).toEqual({ ok: true, via: ["telegram"] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bott/sendMessage");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe("c");
    expect(body.text).toContain("Ім'я: Ірина");
    expect(body.text).toContain("Сторінка: https://goproceed.example/");
  });

  it("sends through Resend with a reply_to when the contact is an email", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const result = await deliverPilotRequest({ fields, referer: null, env: { RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x", PILOT_FROM_EMAIL: "GoProceed <from@x>" }, fetchImpl });
    expect(result).toEqual({ ok: true, via: ["email"] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer k" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual(["to@x"]);
    expect(body.reply_to).toBe("iryna@example.com");
  });

  it("reports delivery failure only when every channel failed", async () => {
    const env = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c", RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x" };
    const half = vi.fn().mockResolvedValueOnce(bad()).mockResolvedValueOnce(ok());
    expect(await deliverPilotRequest({ fields, referer: null, env, fetchImpl: half })).toEqual({ ok: true, via: ["email"] });
    const none = vi.fn().mockResolvedValue(bad());
    expect(await deliverPilotRequest({ fields, referer: null, env, fetchImpl: none })).toEqual({ ok: false, error: "delivery" });
  });

  // The `reply_to` a stranger can set is where the owner's reply goes. Resend
  // reads a comma-separated value as a recipient LIST, so anything that can
  // carry a separator can add a second reader; `\S+@\S+\.\S+` could.
  it("refuses a contact that is a list, a display name, or absurdly long", async () => {
    const env = { RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x" };
    const smuggled = [
      "a@b.co, c@d.co",
      "a@b.co;c@d.co",
      '"x" <a@b.co>',
      "a@b.co c@d.co",
      `${"a".repeat(250)}@b.co`,
    ];
    for (const contact of smuggled) {
      const fetchImpl = vi.fn().mockResolvedValue(ok());
      await deliverPilotRequest({ fields: { ...fields, contact }, referer: null, env, fetchImpl });
      const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.reply_to, contact).toBeUndefined();
    }
  });

  it("still accepts one plain address", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await deliverPilotRequest({ fields: { ...fields, contact: "iryna+pilot@sub.example.co.ua" }, referer: null, env: { RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x" }, fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.reply_to).toBe("iryna+pilot@sub.example.co.ua");
  });

  // A connection that opens and never answers would otherwise hold the
  // invocation to the platform's maximum for every submission.
  it("gives both outbound calls an abort signal", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await deliverPilotRequest({
      fields, referer: null,
      env: { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c", RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x" },
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe("POST /api/pilot", () => {
  it("rejects a bad body with 400 and stores nothing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await post({ name: "", contact: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "required" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("pretends success for a filled honeypot and delivers nothing", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await post({ ...fields, website: "spam" });
    expect(res.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 503 when no channel is configured", async () => {
    const res = await post(fields);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "not-configured" });
  });

  it("answers 200 with the channels that took the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await post(fields);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, via: ["telegram"] });
  });

  it("answers 502 when delivery failed everywhere", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bad()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    expect((await post(fields)).status).toBe(502);
  });

  // The form carries `method="post" action="/api/pilot"`, so a visitor without
  // JavaScript sends `application/x-www-form-urlencoded` here rather than
  // GETting their name into the address bar. That body must be a client
  // problem, never a 500 — `request.json()` throws on it and the catch turns it
  // into the same empty object a missing field would produce.
  it("answers a client error, never a 500, for a form-encoded body", async () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await POST(new Request("http://localhost/api/pilot", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "4.4.4.4" },
      body: "name=%D0%86%D1%80%D0%B8%D0%BD%D0%B0&contact=iryna%40example.com",
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("limits one address to five requests in ten minutes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    for (let i = 0; i < 5; i++) expect((await post(fields, "2.2.2.2")).status).toBe(200);
    expect((await post(fields, "2.2.2.2")).status).toBe(429);
    expect((await post(fields, "3.3.3.3")).status).toBe(200);
  });
});

describe("rateLimited", () => {
  // The limiter used to `push` for every caller, rejected ones included, and
  // then `filter` the whole array on the next request: one address could make
  // the component whose job is to stop a flood grow with the flood.
  it("records nothing for a rejected request, so one address is bounded by the limit", () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) expect(rateLimited(ip)).toBe(false);
    for (let i = 0; i < 100; i++) expect(rateLimited(ip)).toBe(true);
    expect(bucketEntries(ip)).toBe(5);
  });

  it("forgets an address once its window has passed", () => {
    const ip = "8.8.8.8";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimited(ip, t0 + i)).toBe(false);
    expect(rateLimited(ip, t0 + 5)).toBe(true);
    expect(rateLimited(ip, t0 + 10 * 60 * 1000 + 10)).toBe(false);
    expect(bucketEntries(ip)).toBe(1);
  });

  it("bounds the map at 500 addresses and keeps enforcing limits after eviction", () => {
    for (let i = 0; i < 600; i++) rateLimited(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    expect(bucketSize()).toBeLessThanOrEqual(500);

    expect(rateLimited("192.168.1.1")).toBe(false); // a fresh IP is still allowed

    const repeatIp = "192.168.1.2";
    for (let i = 0; i < 5; i++) expect(rateLimited(repeatIp)).toBe(false);
    expect(rateLimited(repeatIp)).toBe(true); // the 6th call is still blocked after eviction ran
    expect(bucketSize()).toBeLessThanOrEqual(500);
  });
});
