import { validatePilotFields } from "../../../content/pilot-request";
import { deliverPilotRequest, type DeliveryEnv } from "./deliver";
import { rateLimited } from "./rate-limit";

/**
 * POST /api/pilot — the landing's one server-side handler. Not a product API
 * and not a Supabase client: it validates a contact form, forwards it to the
 * owner (deliver.ts) and stores nothing. next.config.ts records the dated
 * correction to «never grow API routes».
 *
 * Route handler contract per Next 16.3.1:
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
 * (Web Request/Response; `runtime` defaults to nodejs).
 *
 * The rate limit lives in rate-limit.ts (per instance, resets on a cold start).
 */
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "?";
  if (rateLimited(ip)) return json(429, { ok: false, error: "rate" });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.length > 0) {
    return json(200, { ok: true }); // a bot filled the honeypot: pretend, deliver nothing
  }
  const checked = validatePilotFields(body);
  if (!checked.ok) return json(400, { ok: false, error: checked.error });

  const env: DeliveryEnv = {
    ...(process.env.TELEGRAM_BOT_TOKEN ? { TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN } : {}),
    ...(process.env.TELEGRAM_CHAT_ID ? { TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID } : {}),
    ...(process.env.RESEND_API_KEY ? { RESEND_API_KEY: process.env.RESEND_API_KEY } : {}),
    ...(process.env.PILOT_TO_EMAIL ? { PILOT_TO_EMAIL: process.env.PILOT_TO_EMAIL } : {}),
    ...(process.env.PILOT_FROM_EMAIL ? { PILOT_FROM_EMAIL: process.env.PILOT_FROM_EMAIL } : {}),
  };
  const result = await deliverPilotRequest({ fields: checked.fields, referer: request.headers.get("referer"), env, fetchImpl: fetch });
  if (result.ok) return json(200, result);
  return json(result.error === "not-configured" ? 503 : 502, result);
}
