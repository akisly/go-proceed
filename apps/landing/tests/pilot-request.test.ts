import { describe, expect, it } from "vitest";
import {
  PILOT_EMAIL, buildPilotClipboardText, buildPilotMailto, buildPilotMessage, cleanField, validatePilotFields,
} from "../content/pilot-request";

const fields = { name: "Ірина", company: "", contact: "@iryna", role: "Керівник ПТВ", context: "БЦ, інженерні мережі" };

describe("pilot request", () => {
  it("builds the seven-line message with dashes for empty fields", () => {
    const lines = buildPilotMessage(fields).split("\n");
    expect(lines[0]).toBe("Нова заявка на пілот GoProceed");
    expect(lines[3]).toBe("Компанія: —");
    expect(lines[6]).toBe("Об'єкт і пакет робіт: БЦ, інженерні мережі");
  });

  it("copies the message alone — the clipboard never carries the address", () => {
    // It used to append «Надіслати на: <address>». The address is a personal
    // mailbox and the page stopped naming it (2026-09-08); the mail-client
    // button beside the copied text is what knows where it goes.
    expect(buildPilotClipboardText(fields)).toBe(buildPilotMessage(fields));
    expect(buildPilotClipboardText(fields)).not.toContain(PILOT_EMAIL);
  });

  it("encodes the mailto to the pilot address", () => {
    const href = buildPilotMailto(fields);
    expect(href.startsWith(`mailto:${PILOT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain("Ім'я: Ірина");
  });

  it("requires a name and a contact, and strips control characters", () => {
    expect(validatePilotFields({ name: "", contact: "x" })).toEqual({ ok: false, error: "required" });
    expect(validatePilotFields({ name: "x", contact: "" })).toEqual({ ok: false, error: "required" });
    expect(validatePilotFields(null)).toEqual({ ok: false, error: "required" });
    const ok = validatePilotFields({ name: " Ірина\u0000 ", contact: "+380", context: "a".repeat(5000) });
    expect(ok.ok && ok.fields.name).toBe("Ірина");
    expect(ok.ok && ok.fields.context.length).toBe(2000);
    expect(cleanField(42, 10)).toBe("42");
    expect(cleanField("a\u0007b", 10)).toBe("ab");
    expect(cleanField("Ірина Петренко +380-67", 40)).toBe("Ірина Петренко +380-67");
  });
});
