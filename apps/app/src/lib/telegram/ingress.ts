import { createHash, timingSafeEqual } from "node:crypto";
import { withServiceTx } from "@goproceed/database";
import { loadTelegramConfig } from "./config";
import { normalizeTelegramUpdate } from "./normalize";

export const MAX_TELEGRAM_UPDATE_BYTES = 1024 * 1024;

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

/** Compare the provider's webhook secret without exposing a prefix match. */
export function sameSecret(actual: string | null, expected: string): boolean {
  if (actual === null) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyTelegramWebhookSecret(request: Request, expected: string): boolean {
  return sameSecret(request.headers.get(TELEGRAM_SECRET_HEADER), expected);
}

function declaredBodyIsTooLarge(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null || !/^\d+$/.test(contentLength)) return false;
  return BigInt(contentLength) > BigInt(MAX_TELEGRAM_UPDATE_BYTES);
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_TELEGRAM_UPDATE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function updateIdFrom(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return String(value);
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value) <= MAX_POSTGRES_BIGINT ? value : null;
  } catch {
    return null;
  }
}

function providerUpdateId(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const updateId = updateIdFrom((payload as Record<string, unknown>).update_id);
  if (updateId === null) return null;
  // The normalizer is the adapter boundary. It is used here only to make the
  // ingress identity agree with its bounded/redacted metadata convention.
  return normalizeTelegramUpdate(payload).updateId === updateId ? updateId : null;
}

function empty(status: 200 | 401 | 413 | 422): Response {
  return new Response(null, { status });
}

/**
 * Verify, bound, validate and durably enqueue one Telegram update. This is an
 * ingress boundary only: it does not resolve tenant scope, download files, or
 * call Telegram.
 */
export async function acceptTelegramUpdate(request: Request): Promise<Response> {
  const config = loadTelegramConfig();
  // This must remain before content-length checks, stream reads and JSON
  // parsing: malformed unauthenticated requests always receive the same 401.
  if (!verifyTelegramWebhookSecret(request, config.webhookSecret)) return empty(401);
  if (declaredBodyIsTooLarge(request)) return empty(413);

  const raw = await readBoundedBody(request);
  if (raw === null) return empty(413);

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return empty(422);
  }
  const updateId = providerUpdateId(payload);
  if (updateId === null) return empty(422);

  const payloadHash = createHash("sha256").update(raw).digest("hex");
  await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    await tx.query(`insert into public.telegram_inbox_updates
      (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3, $4, 'pending')
      on conflict (bot_id, update_id) do nothing`, [config.botId, updateId, payload, payloadHash]);
  });
  return empty(200);
}
