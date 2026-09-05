import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverPilotRequest } from "../app/api/pilot/deliver";
import { resetRateLimit } from "../app/api/pilot/rate-limit";
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

  it("limits one address to five requests in ten minutes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    for (let i = 0; i < 5; i++) expect((await post(fields, "2.2.2.2")).status).toBe(200);
    expect((await post(fields, "2.2.2.2")).status).toBe(429);
    expect((await post(fields, "3.3.3.3")).status).toBe(200);
  });
});
