import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "./store";
import type { LeadInput } from "./types";

const base: LeadInput = {
  company_name: "Приклад-Електромонтаж",
  website: "https://www.pryklad-elektro.com.ua/",
  city: "Київ",
  regions_served: "Київська;Житомирська",
  specialization: "electrical",
  primary_trade: "electrical",
  channel_track: "cold",
  icp_match_reason: "Власний сайт описує електромонтаж на комерційних об'єктах",
  job_fit_note: "Кабель у стяжці — докази зникають після заливки",
  source_urls: "https://pryklad-elektro.com.ua/projects",
};

let store: Store;
beforeEach(() => { store = openStore(":memory:"); });
afterEach(() => { store.close(); });

describe("ingestLead", () => {
  it("assigns a monotonic lead_id and normalizes the domain", () => {
    const r = store.ingestLead(base);
    expect(r.lead_id).toBe("AKT-L-0001");
    expect(r.deduped).toBe(false);
    expect(store.getLead(r.lead_id)?.domain_normalized).toBe("pryklad-elektro.com.ua");
  });

  it("dedupes on normalized domain regardless of www, scheme or path", () => {
    const first = store.ingestLead(base);
    const second = store.ingestLead({ ...base, website: "http://pryklad-elektro.com.ua/contacts" });
    expect(second.deduped).toBe(true);
    expect(second.merged_into).toBe(first.lead_id);
    expect(store.allLeads()).toHaveLength(1);
  });

  it("dedupes on normalized email across different domains", () => {
    store.ingestLead({ ...base, email: "Info@Pryklad.com.ua", email_source_url: "https://pryklad-elektro.com.ua/contacts" });
    const second = store.ingestLead({
      ...base, website: "https://inshiy.com.ua", email: "info@pryklad.com.ua",
      email_source_url: "https://inshiy.com.ua/contacts",
    });
    expect(second.deduped).toBe(true);
    expect(store.allLeads()).toHaveLength(1);
  });

  it("ЄДРПОУ wins over domain: two brands, one legal entity, one lead", () => {
    const first = store.ingestLead({ ...base, edrpou: "12345678" });
    const second = store.ingestLead({
      ...base, website: "https://brand-two.com.ua", edrpou: "12345678",
    });
    expect(second.deduped).toBe(true);
    expect(second.merged_into).toBe(first.lead_id);
  });

  it("merges source_urls and never downgrades an existing verification", () => {
    store.ingestLead(base);
    store.ingestLead({
      ...base,
      source_urls: "https://clarity-project.info/edr/12345678",
      identity_verified: true,
      identity_source_url: "https://clarity-project.info/edr/12345678",
      identity_evidence_note: "ЄДР картка: назва та ЄДРПОУ збігаються",
    });
    const lead = store.allLeads()[0];
    expect(lead?.source_urls).toContain("clarity-project.info");
    expect(lead?.source_urls).toContain("pryklad-elektro.com.ua/projects");
    expect(lead?.confidence_score).toBe(40);

    // A later merge that omits the flag must not clear it.
    store.ingestLead({ ...base, source_urls: "https://work.ua/jobs/1" });
    expect(store.allLeads()[0]?.confidence_score).toBe(40);
  });

  it("allows many leads with no email (D5 unreachable) without unique collisions", () => {
    store.ingestLead(base);
    const second = store.ingestLead({ ...base, website: "https://inshiy-pidryadnyk.com.ua" });
    expect(second.deduped).toBe(false);
    expect(store.allLeads()).toHaveLength(2);
  });
});

describe("generated columns", () => {
  it("derives fit_band from fit_score at the ER-2 thresholds", () => {
    const { lead_id } = store.ingestLead(base);
    for (const [score, band] of [[85, "A"], [75, "A"], [74, "B"], [60, "B"], [55, "B"], [54, "C"], [40, "C"], [39, "D"]] as const) {
      store.setFitScore(lead_id, score);
      expect(store.getLead(lead_id)?.fit_band).toBe(band);
    }
  });

  // D-3: URL presence alone is NOT evidence. The manual check must have passed.
  it("scores zero when URLs are stored but no dimension was verified", () => {
    const { lead_id } = store.ingestLead({
      ...base,
      identity_source_url: "https://clarity-project.info/edr/12345678",
      specialization_source_url: "https://pryklad-elektro.com.ua/services",
      email: "info@pryklad-elektro.com.ua",
      email_source_url: "https://pryklad-elektro.com.ua/contacts",
    });
    const lead = store.getLead(lead_id);
    expect(lead?.confidence_score).toBe(0);
    expect(lead?.verification_complete).toBe(0);
  });

  it("counts a dimension only when the verified flag AND the URL are both present", () => {
    const { lead_id } = store.ingestLead({
      ...base,
      identity_verified: true, identity_source_url: "https://clarity-project.info/edr/12345678",
      identity_evidence_note: "ЄДР картка збігається з назвою на сайті",
      specialization_verified: true, specialization_source_url: "https://pryklad-elektro.com.ua/services",
      specialization_evidence_note: "Сторінка послуг описує електромонтаж",
    });
    const lead = store.getLead(lead_id);
    expect(lead?.confidence_score).toBe(70);
    expect(lead?.verification_complete).toBe(0); // contact still missing
  });

  it("a verified flag with no URL contributes nothing", () => {
    const { lead_id } = store.ingestLead({ ...base, identity_verified: true });
    expect(store.getLead(lead_id)?.confidence_score).toBe(0);
  });

  it("maps primary_trade to the mandated quota buckets", () => {
    const cases: Array<[LeadInput["primary_trade"], string]> = [
      ["electrical", "electrical_group"], ["low_voltage", "electrical_group"],
      ["hvac", "hvac"], ["plumbing", "plumbing"], ["solar", "solar"],
      ["maintenance", "maintenance"], ["telecom", "none"],
    ];
    cases.forEach(([trade, bucket], i) => {
      const { lead_id } = store.ingestLead({ ...base, website: `https://firma-${i}.com.ua`, primary_trade: trade });
      expect(store.getLead(lead_id)?.quota_bucket).toBe(bucket);
    });
  });
});

// D-3: the database itself refuses a qualified lead with an incomplete dimension.
describe("qualification gate in the schema", () => {
  it("refuses `qualified` when a mandatory dimension is missing, whatever the sum", () => {
    const { lead_id } = store.ingestLead({
      ...base,
      identity_verified: true, identity_source_url: "https://clarity-project.info/edr/1",
      specialization_verified: true, specialization_source_url: "https://pryklad-elektro.com.ua/s",
      email: "info@pryklad-elektro.com.ua",
    });
    expect(store.getLead(lead_id)?.confidence_score).toBe(70);
    expect(() => store.setStatus(lead_id, "qualified")).toThrow(/CHECK constraint failed/);
  });

  it("allows `qualified` once all three dimensions are complete", () => {
    const { lead_id } = store.ingestLead({
      ...base,
      identity_verified: true, identity_source_url: "https://clarity-project.info/edr/1",
      specialization_verified: true, specialization_source_url: "https://pryklad-elektro.com.ua/s",
      contact_verified: true, email: "info@pryklad-elektro.com.ua",
      email_source_url: "https://pryklad-elektro.com.ua/contacts",
    });
    expect(() => store.setStatus(lead_id, "qualified")).not.toThrow();
    expect(store.getLead(lead_id)?.confidence_score).toBe(100);
  });

  it("setVerification refuses to raise a flag without a URL and an evidence note", () => {
    const { lead_id } = store.ingestLead(base);
    expect(() => store.setVerification(lead_id, "identity", {
      verified: true, source_url: "", evidence_note: "",
    })).toThrow(/requires a source_url and an evidence_note/);
  });

  it("setVerification records the evidence note alongside the flag", () => {
    const { lead_id } = store.ingestLead(base);
    store.setVerification(lead_id, "specialization", {
      verified: true,
      source_url: "https://pryklad-elektro.com.ua/services",
      evidence_note: "Сторінка «Послуги»: монтаж кабельних мереж, фото бригад",
    });
    const lead = store.getLead(lead_id);
    expect(lead?.specialization_verified).toBe(1);
    expect(lead?.specialization_evidence_note).toContain("Послуги");
    expect(lead?.confidence_score).toBe(30);
  });
});

describe("outreach_log", () => {
  it("appends events with monotonic ids", () => {
    const { lead_id } = store.ingestLead(base);
    const id = store.appendEvent({ lead_id, event_type: "lead_scored", actor: "agent", channel: "none", channel_track: "cold" });
    expect(id).toMatch(/^AKT-E-\d{6}$/);
  });

  it("rejects UPDATE — the log is append-only", () => {
    const { lead_id } = store.ingestLead(base);
    store.appendEvent({ lead_id, event_type: "lead_created", actor: "agent", channel: "none", channel_track: "cold" });
    expect(() => store.rawExec("UPDATE outreach_log SET notes = 'tampered'")).toThrow(/append-only/);
  });

  it("rejects DELETE — the log is append-only", () => {
    const { lead_id } = store.ingestLead(base);
    store.appendEvent({ lead_id, event_type: "lead_created", actor: "agent", channel: "none", channel_track: "cold" });
    expect(() => store.rawExec("DELETE FROM outreach_log")).toThrow(/append-only/);
  });
});

describe("suppression", () => {
  it("is append-only", () => {
    store.addSuppression({ email_normalized: "info@pryklad.com.ua", domain_normalized: "pryklad.com.ua", reason: "opted_out", date: "2026-07-26", note: "" });
    expect(() => store.rawExec("DELETE FROM suppression")).toThrow(/append-only/);
  });
});
