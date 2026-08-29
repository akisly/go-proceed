export const PRIMARY_TRADES = [
  "electrical", "low_voltage", "hvac", "plumbing",
  "solar", "maintenance", "telecom", "general_construction",
] as const;
export type PrimaryTrade = (typeof PRIMARY_TRADES)[number];

export const QUOTA_BUCKETS = [
  "electrical_group", "hvac", "plumbing", "solar", "maintenance", "none",
] as const;
export type QuotaBucket = (typeof QUOTA_BUCKETS)[number];

/**
 * Target RANGES for the first 30 qualified leads (founder correction 26.07.2026).
 * These are a research mix, NOT a hard quota. Never admit a weak lead to fill a
 * bucket; record the shortfall and backfill from the strongest verified segment.
 */
export const QUOTA_RANGES: Record<Exclude<QuotaBucket, "none">, { min: number; max: number }> = {
  electrical_group: { min: 16, max: 18 },
  hvac: { min: 3, max: 5 },
  plumbing: { min: 2, max: 4 },
  solar: { min: 2, max: 4 },
  maintenance: { min: 1, max: 3 },
};

export const TOTAL_QUALIFIED_TARGET = 30;
export const MIN_TRADE_GROUPS_RESEARCHED = 4;

/** The three mandatory verification dimensions (D-3). All three are required. */
export const VERIFICATION_DIMENSIONS = ["identity", "specialization", "contact"] as const;
export type VerificationDimension = (typeof VERIFICATION_DIMENSIONS)[number];

export const CHANNEL_TRACKS = ["cold", "warm", "community", "referral"] as const;
export type ChannelTrack = (typeof CHANNEL_TRACKS)[number];

export const OUTREACH_STATUSES = [
  "new", "researching", "qualified", "unreachable", "drafted", "approved", "sent",
  "replied", "no_reply", "followup_1_sent", "followup_2_sent",
  "interview_scheduled", "artifacts_received", "pilot_discussion",
  "closed_won", "closed_lost", "opted_out", "bounced", "disqualified", "suppressed",
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const DISQUALIFY_REASONS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"] as const;
export type DisqualifyReason = (typeof DISQUALIFY_REASONS)[number];

export const REPLY_CLASSES = [
  "R1_interested_workflow", "R2_wants_call", "R3_wants_artifacts_exchange",
  "R4_interested_later", "R5_wrong_person", "R6_not_interested", "R7_opt_out",
  "R8_auto_reply", "R9_bounce", "R10_vendor_spam", "R11_ambiguous",
] as const;
export type ReplyClass = (typeof REPLY_CLASSES)[number];

export const EVENT_TYPES = [
  "lead_created", "lead_enriched", "lead_scored", "lead_disqualified", "lead_deduped",
  "draft_created", "draft_edited", "draft_rejected", "draft_approved",
  "email_sent", "email_bounced", "reply_received", "reply_classified",
  "followup_scheduled", "followup_sent", "pilot_form_submitted",
  "opt_out_received", "suppression_added", "interview_scheduled",
  "artifacts_received", "status_changed", "note_added",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface LeadInput {
  company_name: string;
  website: string;
  city: string;
  regions_served: string;
  specialization: string;
  primary_trade: PrimaryTrade;
  channel_track: ChannelTrack;
  icp_match_reason: string;
  job_fit_note: string;
  source_urls: string;
  edrpou?: string;
  email?: string;
  email_type?: "personal_business" | "department" | "general";

  // D-3: each dimension needs a manual claim-support check, its URL, and a note
  // saying WHAT on that page supports the claim. A URL alone is not verification.
  identity_verified?: boolean;
  identity_source_url?: string;
  identity_evidence_note?: string;
  specialization_verified?: boolean;
  specialization_source_url?: string;
  specialization_evidence_note?: string;
  contact_verified?: boolean;
  email_source_url?: string;
  contact_evidence_note?: string;

  personalization_signal?: string;
  personalization_source_url?: string;
  personalization_verified_at?: string;
  trade_transfer_note?: string;
  contact_person?: string;
  contact_role?: string;
  contact_source_url?: string;
  size_signal?: string;
  size_signal_source?: string;
}
