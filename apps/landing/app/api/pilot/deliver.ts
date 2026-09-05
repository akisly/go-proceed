import { type PilotFields, buildPilotMessage } from "../../../content/pilot-request";

/**
 * Forwards one pilot request to whichever channels are configured. Stores
 * nothing; logs a failure reason and never the fields.
 *
 * Telegram Bot API `sendMessage` — https://core.telegram.org/bots/api#sendmessage
 * (read 2026-09-05): POST JSON {chat_id, text, disable_web_page_preview}.
 * Resend `POST /emails` — https://resend.com/docs/api-reference/emails/send-email
 * (read 2026-09-05): `from` required, `to` an array, `reply_to` accepted.
 * Both through `fetch`; no SDK, so nothing new is on the wire or in the
 * lockfile.
 */
export type DeliveryEnv = Partial<Record<
  "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID" | "RESEND_API_KEY" | "PILOT_TO_EMAIL" | "PILOT_FROM_EMAIL", string>>;

export type DeliveryResult = { ok: true; via: string[] } | { ok: false; error: "not-configured" | "delivery" };

const escapeHtml = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
/**
 * ONE address, and that is the whole point. `reply_to` is the only field a
 * stranger controls that decides where the owner's reply goes, and Resend reads
 * a comma-separated value as a recipient LIST — so `\S+@\S+\.\S+`, which
 * accepts commas, semicolons, quotes and angle brackets, let a submitter add a
 * second reader to a reply that looks like a private one. Both halves therefore
 * exclude every separator and every quoting character, and RFC 5321's
 * 254-character ceiling on a path caps the field so a long string cannot be
 * used as a battering ram instead. This is a deliverability check, not an
 * address parser: anything it refuses simply travels in the message body,
 * where it already is.
 */
const SINGLE_ADDRESS = /^[^\s<>",;@]+@[^\s<>",;@]+\.[^\s<>",;@]{2,}$/;
const looksLikeEmail = (s: string) => s.length <= 254 && SINGLE_ADDRESS.test(s);

/** Eight seconds. A connection that opens and never answers otherwise holds the
 * whole invocation to the platform's maximum duration for EVERY submission, and
 * `Promise.allSettled` waits for the slowest task — so without this the second
 * channel cannot rescue the first. `AbortSignal.timeout` is Node 18+; the route
 * runs on the nodejs runtime. */
const TIMEOUT_MS = 8_000;

export async function deliverPilotRequest({
  fields, referer, env, fetchImpl,
}: {
  fields: PilotFields;
  referer: string | null;
  env: DeliveryEnv;
  fetchImpl: typeof fetch;
}): Promise<DeliveryResult> {
  const text = `${buildPilotMessage(fields)}\n\nСторінка: ${referer ?? "—"}`;
  const tasks: Array<Promise<string>> = [];

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    tasks.push(
      fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).then((r) => (r.ok ? "telegram" : Promise.reject(new Error(`telegram ${r.status}`)))),
    );
  }
  if (env.RESEND_API_KEY && env.PILOT_TO_EMAIL) {
    tasks.push(
      fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.PILOT_FROM_EMAIL || "GoProceed <onboarding@resend.dev>",
          to: [env.PILOT_TO_EMAIL],
          ...(looksLikeEmail(fields.contact) ? { reply_to: fields.contact } : {}),
          subject: `Пілот GoProceed — заявка від ${fields.name}`,
          text,
          html: `<pre style="font:14px/1.5 -apple-system,Segoe UI,sans-serif">${escapeHtml(text)}</pre>`,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).then((r) => (r.ok ? "email" : Promise.reject(new Error(`email ${r.status}`)))),
    );
  }
  if (tasks.length === 0) return { ok: false, error: "not-configured" };

  const results = await Promise.allSettled(tasks);
  const via = results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value);
  if (via.length === 0) {
    console.error("pilot delivery failed", results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok")));
    return { ok: false, error: "delivery" };
  }
  return { ok: true, via };
}
