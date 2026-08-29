import { describe, expect, it } from "vitest";
import { checkResearchGates, type GateContext } from "./gates";
import type { LeadRecord } from "./store";

function lead(patch: Partial<LeadRecord> = {}): LeadRecord {
  return {
    lead_id: "AKT-L-0001",
    domain_normalized: "pryklad-elektro.com.ua",
    email_normalized: "info@pryklad-elektro.com.ua",
    source_urls: "https://pryklad-elektro.com.ua/projects",
    fit_score: 85, fit_band: "A", confidence_score: 100, verification_complete: 1,
    identity_verified: 1, specialization_verified: 1, contact_verified: 1,
    identity_source_url: "https://clarity-project.info/edr/12345678",
    specialization_source_url: "https://pryklad-elektro.com.ua/services",
    quota_bucket: "electrical_group", primary_trade: "electrical",
    outreach_status: "researching",
    email: "info@pryklad-elektro.com.ua",
    email_source_url: "https://pryklad-elektro.com.ua/contacts",
    personalization_signal: "Вакансія «інженер ПТО» від 14.07.2026",
    personalization_source_url: "https://work.ua/jobs/1234567",
    personalization_verified_at: "2026-07-26",
    ...patch,
  } as LeadRecord;
}

const ctx: GateContext = {
  today: "2026-07-26",
  suppressedEmails: new Set(),
  suppressedDomains: new Set(),
  seenDomains: new Set(),
  seenEmails: new Set(),
};

describe("checkResearchGates", () => {
  it("passes a fully verified band-A lead", () => {
    expect(checkResearchGates(lead(), ctx)).toEqual([]);
  });

  it("blocks when email or its source URL is missing", () => {
    expect(checkResearchGates(lead({ email: null }), ctx))
      .toContainEqual({ code: "NO_EMAIL", detail: expect.any(String) });
    expect(checkResearchGates(lead({ email_source_url: null }), ctx))
      .toContainEqual({ code: "NO_EMAIL_SOURCE", detail: expect.any(String) });
  });

  it("blocks when the personalization signal has no source URL", () => {
    expect(checkResearchGates(lead({ personalization_source_url: null }), ctx))
      .toContainEqual({ code: "NO_PERSONALIZATION_SOURCE", detail: expect.any(String) });
  });

  it("blocks when the personalization signal was verified more than 30 days ago", () => {
    expect(checkResearchGates(lead({ personalization_verified_at: "2026-06-20" }), ctx))
      .toContainEqual({ code: "PERSONALIZATION_STALE", detail: expect.any(String) });
  });

  it("accepts a signal verified exactly 30 days ago", () => {
    expect(checkResearchGates(lead({ personalization_verified_at: "2026-06-26" }), ctx)).toEqual([]);
  });

  // D-3: each dimension is mandatory on its own.
  it("blocks an unverified identity even when a URL is stored", () => {
    expect(checkResearchGates(lead({ identity_verified: 0 }), ctx))
      .toContainEqual({ code: "IDENTITY_UNVERIFIED", detail: expect.any(String) });
    expect(checkResearchGates(lead({ identity_source_url: null }), ctx))
      .toContainEqual({ code: "IDENTITY_UNVERIFIED", detail: expect.any(String) });
  });

  it("blocks an unverified specialization", () => {
    expect(checkResearchGates(lead({ specialization_verified: 0 }), ctx))
      .toContainEqual({ code: "SPECIALIZATION_UNVERIFIED", detail: expect.any(String) });
  });

  it("blocks an unverified contact", () => {
    expect(checkResearchGates(lead({ contact_verified: 0 }), ctx))
      .toContainEqual({ code: "CONTACT_UNVERIFIED", detail: expect.any(String) });
  });

  // The decisive test: a high sum must never buy a missing dimension.
  it("a 70 confidence score does not compensate for a missing contact dimension", () => {
    const failures = checkResearchGates(
      lead({ confidence_score: 70, contact_verified: 0, verification_complete: 0 }), ctx);
    expect(failures).toContainEqual({ code: "CONTACT_UNVERIFIED", detail: expect.any(String) });
  });

  it("ignores confidence_score entirely when all three dimensions are verified", () => {
    expect(checkResearchGates(lead({ confidence_score: 0 }), ctx)).toEqual([]);
  });

  it("blocks bands C and D", () => {
    expect(checkResearchGates(lead({ fit_band: "C" }), ctx))
      .toContainEqual({ code: "BAND_NOT_CONTACTABLE", detail: expect.any(String) });
    expect(checkResearchGates(lead({ fit_band: "B" }), ctx)).toEqual([]);
  });

  it("blocks a suppressed email or domain", () => {
    const suppressed: GateContext = { ...ctx, suppressedEmails: new Set(["info@pryklad-elektro.com.ua"]) };
    expect(checkResearchGates(lead(), suppressed))
      .toContainEqual({ code: "SUPPRESSED", detail: expect.any(String) });
  });

  it("blocks a duplicate domain or email", () => {
    const dup: GateContext = { ...ctx, seenDomains: new Set(["pryklad-elektro.com.ua"]) };
    expect(checkResearchGates(lead(), dup))
      .toContainEqual({ code: "DUPLICATE", detail: expect.any(String) });
  });

  it("reports every failure, not just the first", () => {
    const failures = checkResearchGates(
      lead({ email: null, contact_verified: 0, identity_verified: 0, fit_band: "D" }), ctx);
    const codes = failures.map((f) => f.code);
    expect(codes).toContain("NO_EMAIL");
    expect(codes).toContain("IDENTITY_UNVERIFIED");
    expect(codes).toContain("CONTACT_UNVERIFIED");
    expect(codes).toContain("BAND_NOT_CONTACTABLE");
  });
});
