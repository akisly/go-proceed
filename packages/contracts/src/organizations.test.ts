import { describe, it, expect } from "vitest";
import { createOrganizationRequest } from "./organizations";

describe("createOrganizationRequest", () => {
  it("accepts a minimal valid body and defaults currency/timezone", () => {
    const parsed = createOrganizationRequest.parse({
      legalName: "ТОВ Електромонтаж",
      displayName: "Електромонтаж",
    });
    expect(parsed.baseCurrency).toBe("UAH");
    expect(parsed.timezone).toBe("Europe/Kyiv");
  });

  it("rejects empty legalName with a field path", () => {
    const r = createOrganizationRequest.safeParse({ legalName: "", displayName: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["legalName"]);
  });

  it("rejects a 4-char currency code", () => {
    const r = createOrganizationRequest.safeParse({
      legalName: "a", displayName: "b", baseCurrency: "USDX",
    });
    expect(r.success).toBe(false);
  });

  // Bounds must match technical/openapi.yaml components.schemas.OrganizationCreate
  // (legalName maxLength 240, displayName maxLength 160).
  it("accepts legalName/displayName at the exact catalog max length", () => {
    const r = createOrganizationRequest.safeParse({
      legalName: "a".repeat(240),
      displayName: "b".repeat(160),
    });
    expect(r.success).toBe(true);
  });

  it("rejects legalName over 240 chars", () => {
    const r = createOrganizationRequest.safeParse({
      legalName: "a".repeat(241), displayName: "b",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["legalName"]);
  });

  it("rejects displayName over 160 chars", () => {
    const r = createOrganizationRequest.safeParse({
      legalName: "a", displayName: "b".repeat(161),
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["displayName"]);
  });
});
