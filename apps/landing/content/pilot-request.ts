export const PILOT_EMAIL = "akisliy2306@gmail.com";

export type PilotFields = { name: string; company: string; contact: string; role: string; context: string };

export const PILOT_LIMITS: Record<keyof PilotFields, number> = { name: 120, company: 160, contact: 160, role: 60, context: 2000 };

/** Strip control characters, trim, cap the length. Never throws on a non-string. */
export function cleanField(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

/** The required fields, named once. The form reads this rather than restating it. */
export type RequiredPilotField = "name" | "contact";

export function validatePilotFields(
  input: unknown,
): { ok: true; fields: PilotFields } | { ok: false; error: "required"; missing: RequiredPilotField[] } {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fields: PilotFields = {
    name: cleanField(body.name, PILOT_LIMITS.name),
    company: cleanField(body.company, PILOT_LIMITS.company),
    contact: cleanField(body.contact, PILOT_LIMITS.contact),
    role: cleanField(body.role, PILOT_LIMITS.role),
    context: cleanField(body.context, PILOT_LIMITS.context),
  };
  const missing: RequiredPilotField[] = [];
  if (!fields.name) missing.push("name");
  if (!fields.contact) missing.push("contact");
  if (missing.length > 0) return { ok: false, error: "required", missing };
  return { ok: true, fields };
}

export function buildPilotMessage(fields: PilotFields): string {
  return [
    "Нова заявка на пілот GoProceed",
    "",
    `Ім'я: ${fields.name || "—"}`,
    `Компанія: ${fields.company || "—"}`,
    `Контакт: ${fields.contact || "—"}`,
    `Роль: ${fields.role || "—"}`,
    `Об'єкт і пакет робіт: ${fields.context || "—"}`,
  ].join("\n");
}

/**
 * The text the fallback copies. It used to append «Надіслати на: <address>»;
 * since 2026-09-08 it does not, because that address is a personal mailbox and
 * the page no longer names it anywhere a reader can see. Where to send it is
 * the «Відкрити поштовий клієнт» button beside this text, which carries the
 * address in a `mailto:` and fills the message in for the sender.
 */
export function buildPilotClipboardText(fields: PilotFields): string {
  return buildPilotMessage(fields);
}

export function buildPilotMailto(fields: PilotFields): string {
  const subject = encodeURIComponent("Пілот GoProceed — нова заявка");
  const body = encodeURIComponent(buildPilotMessage(fields));
  return `mailto:${PILOT_EMAIL}?subject=${subject}&body=${body}`;
}
