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
const looksLikeEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

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
