import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "./store";
import {
  exportLeadsCsv, exportOutreachLogCsv, exportSuppressionCsv,
  LEADS_COLUMNS, OUTREACH_LOG_COLUMNS,
} from "./export";
import type { LeadInput } from "./types";

const base: LeadInput = {
  company_name: "Приклад-Вентиляція",
  website: "https://pryklad-vent.com.ua",
  city: "Львів",
  regions_served: "вся Україна",
  specialization: "hvac",
  primary_trade: "hvac",
  channel_track: "cold",
  icp_match_reason: "Монтаж вентиляції на комерційних об'єктах",
  job_fit_note: "Повітроводи за підвісною стелею — доступ зникає після закриття",
  source_urls: "https://pryklad-vent.com.ua/objects",
};

let store: Store;
beforeEach(() => { store = openStore(":memory:"); });
afterEach(() => { store.close(); });

describe("exportLeadsCsv", () => {
  it("emits the 42 documented columns first, in order", () => {
    expect(LEADS_COLUMNS.slice(0, 6)).toEqual([
      "lead_id", "company_name", "company_name_legal", "edrpou", "website", "domain_normalized",
    ]);
    expect(LEADS_COLUMNS[19]).toBe("email");
    expect(LEADS_COLUMNS[20]).toBe("email_normalized");
    expect(LEADS_COLUMNS[41]).toBe("updated_at");
    expect(LEADS_COLUMNS.length).toBeGreaterThan(42);
    expect(LEADS_COLUMNS).toContain("channel_track");
    expect(LEADS_COLUMNS).toContain("primary_trade");
    expect(LEADS_COLUMNS).toContain("quota_bucket");
    expect(LEADS_COLUMNS).toContain("last_processed_message_id");
  });

  it("exports the D-3 verification evidence for every dimension", () => {
    for (const col of [
      "identity_verified", "identity_source_url", "identity_evidence_note",
      "specialization_verified", "specialization_source_url", "specialization_evidence_note",
      "contact_verified", "email_source_url", "contact_evidence_note",
      "verification_complete",
    ]) expect(LEADS_COLUMNS).toContain(col);
  });

  it("starts with a UTF-8 BOM and uses LF line endings", () => {
    store.ingestLead(base);
    const csv = exportLeadsCsv(store);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).not.toContain("\r\n");
    expect(csv.split("\n")[0]?.replace("﻿", "").split(",")[0]).toBe("lead_id");
  });

  it("RFC 4180-quotes fields containing comma, quote or newline", () => {
    store.ingestLead({ ...base, icp_match_reason: 'Монтаж, вентиляції "під ключ"' });
    const csv = exportLeadsCsv(store);
    expect(csv).toContain('"Монтаж, вентиляції ""під ключ"""');
  });

  it("renders NULL as an empty field, never the string null", () => {
    store.ingestLead(base);
    const csv = exportLeadsCsv(store);
    expect(csv).not.toContain("null");
  });

  it("round-trips Ukrainian text unchanged", () => {
    store.ingestLead(base);
    expect(exportLeadsCsv(store)).toContain("Приклад-Вентиляція");
  });

  it("emits touch_count from the log view, defaulting to 0", () => {
    store.ingestLead(base);
    const header = exportLeadsCsv(store).split("\n")[0]?.replace("﻿", "").split(",") ?? [];
    const row = exportLeadsCsv(store).split("\n")[1]?.split(",") ?? [];
    const idx = header.indexOf("touch_count");
    expect(idx).toBeGreaterThan(-1);
    expect(row[idx]).toBe("0");
  });
});

describe("exportOutreachLogCsv", () => {
  it("drops the hash column per ER-2 (21 columns become 20)", () => {
    expect(OUTREACH_LOG_COLUMNS).not.toContain("hash");
    expect(OUTREACH_LOG_COLUMNS.length).toBe(21);
  });

  it("records the lead_created event emitted on ingest", () => {
    store.ingestLead(base);
    const csv = exportOutreachLogCsv(store);
    expect(csv).toContain("lead_created");
    expect(csv).toContain("AKT-E-000001");
  });
});

describe("exportSuppressionCsv", () => {
  it("emits the B.4.4 columns", () => {
    store.addSuppression({
      email_normalized: "info@pryklad-vent.com.ua",
      domain_normalized: "pryklad-vent.com.ua",
      reason: "opted_out", date: "2026-07-26", note: "запит на відписку",
    });
    const csv = exportSuppressionCsv(store);
    expect(csv.split("\n")[0]?.replace("﻿", ""))
      .toBe("email_normalized,domain_normalized,reason,date,note");
    expect(csv).toContain("opted_out");
  });
});
