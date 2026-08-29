import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDomain, normalizeEmail } from "./normalize";
import type {
  ChannelTrack, EventType, LeadInput, OutreachStatus, VerificationDimension,
} from "./types";

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "schema.sql");

export interface LeadRecord extends Record<string, unknown> {
  lead_id: string;
  domain_normalized: string;
  email_normalized: string | null;
  source_urls: string;
  fit_score: number;
  fit_band: string;
  /** Verification COMPLETENESS, not truth or judgment (D-3). Never a gate on its own. */
  confidence_score: number;
  /** The actual gate: 1 only when all three dimensions are verified with URLs. */
  verification_complete: 0 | 1;
  identity_verified: 0 | 1;
  specialization_verified: 0 | 1;
  contact_verified: 0 | 1;
  quota_bucket: string;
  primary_trade: string;
  outreach_status: string;
}

export interface IngestResult { lead_id: string; deduped: boolean; merged_into?: string }

export interface EventInput {
  lead_id: string;
  event_type: EventType;
  actor: "agent" | "founder" | "system" | "lead";
  channel: "email" | "pilot_form" | "manual" | "none";
  channel_track: ChannelTrack;
  notes?: string;
  status_before?: string;
  status_after?: string;
}

export interface SuppressionInput {
  email_normalized: string | null;
  domain_normalized: string | null;
  reason: "opted_out" | "bounced" | "manual";
  date: string;
  note?: string;
}

export interface VerificationEvidence {
  verified: boolean;
  source_url: string;
  evidence_note: string;
}

export interface Store {
  ingestLead(input: LeadInput): IngestResult;
  appendEvent(event: EventInput): string;
  addSuppression(entry: SuppressionInput): void;
  getLead(leadId: string): LeadRecord | undefined;
  allLeads(): LeadRecord[];
  allEvents(): Array<Record<string, unknown>>;
  allSuppressions(): Array<Record<string, unknown>>;
  allTouchCounts(): Array<{ lead_id: string; touch_count: number }>;
  setFitScore(leadId: string, score: number): void;
  setTriage(leadId: string, triage: readonly [0 | 1, 0 | 1, 0 | 1]): void;
  /** Throws if the schema CHECK refuses the transition (D-3). Do not catch and ignore. */
  setStatus(leadId: string, status: OutreachStatus): void;
  setVerification(leadId: string, dimension: VerificationDimension, evidence: VerificationEvidence): void;
  update(leadId: string, patch: Record<string, string | number | null>): void;
  rawExec(sql: string): void;
  close(): void;
}

function pad(n: number, width: number): string { return String(n).padStart(width, "0"); }

function mergeSourceUrls(existing: string, incoming: string): string {
  const seen = new Set<string>();
  for (const url of `${existing};${incoming}`.split(";")) {
    const trimmed = url.trim();
    if (trimmed !== "") seen.add(trimmed);
  }
  return [...seen].join(";");
}

const VERIFICATION_COLUMNS: Record<VerificationDimension, [string, string, string]> = {
  identity: ["identity_verified", "identity_source_url", "identity_evidence_note"],
  specialization: ["specialization_verified", "specialization_source_url", "specialization_evidence_note"],
  contact: ["contact_verified", "email_source_url", "contact_evidence_note"],
};

/** Columns a caller may patch via `update`. Generated columns are never writable. */
const UPDATABLE = new Set([
  "company_name", "company_name_legal", "edrpou", "city", "regions_served",
  "specialization", "specialization_note", "primary_trade", "channel_track",
  "size_signal", "size_signal_source", "icp_match_reason", "job_fit_note",
  "trade_transfer_note", "personalization_signal", "personalization_source_url",
  "personalization_verified_at", "contact_person", "contact_role", "contact_source_url",
  "email", "email_type", "recheck_after", "last_contact_date", "last_reply_date",
  "next_action", "next_action_date", "gmail_thread_id", "last_processed_message_id",
  "template_variant", "experiment_id", "reply_class", "disqualify_reason",
  "ladder_rung", "notes",
]);

export function openStore(path: string): Store {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));

  function nextId(table: string, prefix: string, width: number): string {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number } | undefined;
    return `${prefix}${pad((row?.n ?? 0) + 1, width)}`;
  }

  function findExisting(input: LeadInput, domain: string, email: string | null): LeadRecord | undefined {
    // B.4.3: ЄДРПОУ wins over domain — two brands, one legal entity, one lead.
    if (input.edrpou !== undefined && input.edrpou !== "") {
      const byEdrpou = db.prepare("SELECT * FROM leads WHERE edrpou = ?").get(input.edrpou);
      if (byEdrpou !== undefined) return byEdrpou as LeadRecord;
    }
    const byDomain = db.prepare("SELECT * FROM leads WHERE domain_normalized = ?").get(domain);
    if (byDomain !== undefined) return byDomain as LeadRecord;
    if (email !== null) {
      const byEmail = db.prepare("SELECT * FROM leads WHERE email_normalized = ?").get(email);
      if (byEmail !== undefined) return byEmail as LeadRecord;
    }
    return undefined;
  }

  const store: Store = {
    ingestLead(input) {
      const domain = normalizeDomain(input.website);
      const email = input.email !== undefined && input.email !== "" ? normalizeEmail(input.email) : null;

      const existing = findExisting(input, domain, email);
      if (existing !== undefined) {
        // Collision: merge source_urls. A verified flag may only ever be raised
        // together with its URL, and an existing verification is never downgraded.
        const merged = mergeSourceUrls(existing.source_urls, input.source_urls);
        db.prepare(`
          UPDATE leads SET
            source_urls = ?,
            identity_source_url = COALESCE(NULLIF(identity_source_url,''), ?),
            identity_evidence_note = COALESCE(NULLIF(identity_evidence_note,''), ?),
            identity_verified = MAX(identity_verified, ?),
            specialization_source_url = COALESCE(NULLIF(specialization_source_url,''), ?),
            specialization_evidence_note = COALESCE(NULLIF(specialization_evidence_note,''), ?),
            specialization_verified = MAX(specialization_verified, ?),
            email_source_url = COALESCE(NULLIF(email_source_url,''), ?),
            contact_evidence_note = COALESCE(NULLIF(contact_evidence_note,''), ?),
            contact_verified = MAX(contact_verified, ?),
            email = COALESCE(email, ?),
            edrpou = COALESCE(NULLIF(edrpou,''), ?),
            updated_at = ?
          WHERE lead_id = ?`).run(
          merged,
          input.identity_source_url ?? null,
          input.identity_evidence_note ?? null,
          input.identity_verified === true ? 1 : 0,
          input.specialization_source_url ?? null,
          input.specialization_evidence_note ?? null,
          input.specialization_verified === true ? 1 : 0,
          input.email_source_url ?? null,
          input.contact_evidence_note ?? null,
          input.contact_verified === true ? 1 : 0,
          input.email ?? null,
          input.edrpou ?? null,
          new Date().toISOString(),
          existing.lead_id,
        );
        store.appendEvent({
          lead_id: existing.lead_id, event_type: "lead_deduped", actor: "agent",
          channel: "none", channel_track: input.channel_track,
          notes: `collision on ${domain}`,
        });
        return { lead_id: existing.lead_id, deduped: true, merged_into: existing.lead_id };
      }

      const leadId = nextId("leads", "AKT-L-", 4);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO leads (
          lead_id, company_name, company_name_legal, edrpou, website, domain_normalized,
          city, regions_served, specialization, specialization_note, primary_trade,
          channel_track, size_signal, size_signal_source, icp_match_reason, job_fit_note,
          trade_transfer_note, personalization_signal, personalization_source_url,
          personalization_verified_at, contact_person, contact_role, contact_source_url,
          email, email_type,
          identity_verified, identity_source_url, identity_evidence_note,
          specialization_verified, specialization_source_url, specialization_evidence_note,
          contact_verified, email_source_url, contact_evidence_note,
          source_urls, outreach_status, next_action, ladder_rung, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        leadId, input.company_name, null, input.edrpou ?? null, input.website, domain,
        input.city, input.regions_served, input.specialization, null, input.primary_trade,
        input.channel_track, input.size_signal ?? null, input.size_signal_source ?? null,
        input.icp_match_reason, input.job_fit_note, input.trade_transfer_note ?? null,
        input.personalization_signal ?? null, input.personalization_source_url ?? null,
        input.personalization_verified_at ?? null, input.contact_person ?? null,
        input.contact_role ?? null, input.contact_source_url ?? null,
        input.email ?? null, input.email_type ?? null,
        input.identity_verified === true ? 1 : 0, input.identity_source_url ?? null,
        input.identity_evidence_note ?? null,
        input.specialization_verified === true ? 1 : 0, input.specialization_source_url ?? null,
        input.specialization_evidence_note ?? null,
        input.contact_verified === true ? 1 : 0, input.email_source_url ?? null,
        input.contact_evidence_note ?? null,
        input.source_urls, "new", "qualify", 1, now, now,
      );
      store.appendEvent({
        lead_id: leadId, event_type: "lead_created", actor: "agent",
        channel: "none", channel_track: input.channel_track,
        status_after: "new",
      });
      return { lead_id: leadId, deduped: false };
    },

    appendEvent(event) {
      const eventId = nextId("outreach_log", "AKT-E-", 6);
      db.prepare(`
        INSERT INTO outreach_log (
          event_id, event_timestamp, lead_id, event_type, actor, channel,
          channel_track, status_before, status_after, notes
        ) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        eventId, new Date().toISOString(), event.lead_id, event.event_type,
        event.actor, event.channel, event.channel_track,
        event.status_before ?? null, event.status_after ?? null, event.notes ?? null,
      );
      return eventId;
    },

    addSuppression(entry) {
      db.prepare(`INSERT INTO suppression (email_normalized, domain_normalized, reason, date, note)
                  VALUES (?,?,?,?,?)`).run(
        entry.email_normalized, entry.domain_normalized, entry.reason, entry.date, entry.note ?? null,
      );
    },

    getLead(leadId) {
      const row = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(leadId);
      return row === undefined ? undefined : (row as LeadRecord);
    },

    allLeads() {
      return db.prepare("SELECT * FROM leads ORDER BY lead_id").all() as LeadRecord[];
    },

    allEvents() {
      return db.prepare("SELECT * FROM outreach_log ORDER BY event_id").all() as Array<Record<string, unknown>>;
    },

    allSuppressions() {
      return db.prepare("SELECT * FROM suppression ORDER BY date, email_normalized").all() as Array<Record<string, unknown>>;
    },

    allTouchCounts() {
      return db.prepare("SELECT lead_id, touch_count FROM lead_touch_counts").all() as Array<{ lead_id: string; touch_count: number }>;
    },

    setFitScore(leadId, score) {
      db.prepare("UPDATE leads SET fit_score = ?, updated_at = ? WHERE lead_id = ?")
        .run(score, new Date().toISOString(), leadId);
    },

    setTriage(leadId, triage) {
      db.prepare("UPDATE leads SET triage_q1 = ?, triage_q2 = ?, triage_q3 = ?, updated_at = ? WHERE lead_id = ?")
        .run(triage[0], triage[1], triage[2], new Date().toISOString(), leadId);
    },

    setStatus(leadId, status) {
      // Lets the schema CHECK reject `qualified` on an incomplete lead (D-3).
      db.prepare("UPDATE leads SET outreach_status = ?, updated_at = ? WHERE lead_id = ?")
        .run(status, new Date().toISOString(), leadId);
    },

    setVerification(leadId, dimension, evidence) {
      // A flag may only be raised together with its URL and its evidence note.
      if (evidence.verified && (evidence.source_url === "" || evidence.evidence_note === "")) {
        throw new Error(`setVerification: ${dimension} verified requires a source_url and an evidence_note`);
      }
      const cols = VERIFICATION_COLUMNS[dimension];
      db.prepare(`UPDATE leads SET ${cols[0]} = ?, ${cols[1]} = ?, ${cols[2]} = ?, updated_at = ? WHERE lead_id = ?`)
        .run(evidence.verified ? 1 : 0, evidence.source_url, evidence.evidence_note, new Date().toISOString(), leadId);
    },

    update(leadId, patch) {
      const entries = Object.entries(patch).filter(([column]) => UPDATABLE.has(column));
      if (entries.length === 0) return;
      const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
      const values = entries.map(([, value]) => value);
      db.prepare(`UPDATE leads SET ${assignments}, updated_at = ? WHERE lead_id = ?`)
        .run(...values, new Date().toISOString(), leadId);
    },

    rawExec(sql) { db.exec(sql); },

    close() { db.close(); },
  };

  return store;
}
