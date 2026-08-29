import type { LeadRecord, Store } from "./store";

const BOM = "﻿";

/**
 * Columns 1–42 verbatim from doc 40 §B.4 in their documented order, then the B0
 * additions at 43+ (D-4). Renumbering a documented contract is not permitted.
 */
export const LEADS_COLUMNS = [
  "lead_id", "company_name", "company_name_legal", "edrpou", "website", "domain_normalized",
  "city", "regions_served", "specialization", "specialization_note", "size_signal",
  "size_signal_source", "icp_match_reason", "personalization_signal",
  "personalization_source_url", "personalization_verified_at", "contact_person",
  "contact_role", "contact_source_url", "email", "email_normalized", "email_source_url",
  "email_type", "source_urls", "confidence_score", "fit_score", "fit_band",
  "outreach_status", "last_contact_date", "last_reply_date", "next_action",
  "next_action_date", "touch_count", "gmail_thread_id", "template_variant",
  "experiment_id", "reply_class", "disqualify_reason", "ladder_rung", "notes",
  "created_at", "updated_at",
  // 43+ — ER-3c, §B.0.7, trade mandate, D-3 verification evidence
  "last_processed_message_id", "channel_track", "primary_trade", "quota_bucket",
  "job_fit_note", "trade_transfer_note",
  "identity_verified", "identity_source_url", "identity_evidence_note",
  "specialization_verified", "specialization_source_url", "specialization_evidence_note",
  "contact_verified", "contact_evidence_note",
  "verification_complete",
  "triage_q1", "triage_q2", "triage_q3", "recheck_after",
] as const;

/** §B.5 columns; `hash` dropped per ER-2 (21 → 20). */
export const OUTREACH_LOG_COLUMNS = [
  "event_id", "event_timestamp", "lead_id", "event_type", "actor", "channel",
  "channel_track", "template_variant", "experiment_id", "subject", "gmail_draft_id",
  "gmail_thread_id", "gmail_message_id", "status_before", "status_after", "reply_class",
  "personalization_signal_used", "approval_state", "approved_by", "approved_at", "notes",
] as const;

export const SUPPRESSION_COLUMNS = [
  "email_normalized", "domain_normalized", "reason", "date", "note",
] as const;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(","));
  return BOM + lines.join("\n") + "\n";
}

export function exportLeadsCsv(store: Store): string {
  // touch_count is a view over outreach_log (ER-2), never a stored column.
  const touches = new Map(store.allTouchCounts().map((t) => [t.lead_id, t.touch_count]));
  const rows = store.allLeads().map((lead: LeadRecord) => ({
    ...lead,
    touch_count: touches.get(lead.lead_id) ?? 0,
  }));
  return toCsv(LEADS_COLUMNS, rows);
}

export function exportOutreachLogCsv(store: Store): string {
  return toCsv(OUTREACH_LOG_COLUMNS, store.allEvents());
}

export function exportSuppressionCsv(store: Store): string {
  return toCsv(SUPPRESSION_COLUMNS, store.allSuppressions());
}
