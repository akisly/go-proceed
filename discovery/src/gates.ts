import type { LeadRecord } from "./store";

export interface GateContext {
  today: string;
  suppressedEmails: Set<string>;
  suppressedDomains: Set<string>;
  seenDomains: Set<string>;
  seenEmails: Set<string>;
}

export interface GateFailure { code: string; detail: string }

const PERSONALIZATION_MAX_AGE_DAYS = 30;
const CONTACTABLE_BANDS = new Set(["A", "B"]);

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * §B.4.2 blocking validations, research-stage subset, plus the D-3 verification
 * dimensions. Returns EVERY failure, so one research pass fixes all of them.
 *
 * Omitted deliberately: touch_count (nothing sent in B0) and the composed-body
 * checks of ER-5a, which need a draft that Child A gates.
 *
 * `confidence_score` is deliberately NOT consulted here. It is a completeness
 * readout for reporting; the gate is the three-dimension AND below.
 */
export function checkResearchGates(lead: LeadRecord, ctx: GateContext): GateFailure[] {
  const failures: GateFailure[] = [];
  const email = lead.email as string | null;
  const emailSource = lead.email_source_url as string | null;
  const signalSource = lead.personalization_source_url as string | null;
  const verifiedAt = lead.personalization_verified_at as string | null;

  if (isBlank(email)) failures.push({ code: "NO_EMAIL", detail: "no public business email — never guess one (D5)" });
  if (isBlank(emailSource)) failures.push({ code: "NO_EMAIL_SOURCE", detail: "email_source_url is blocking" });
  if (isBlank(lead.personalization_signal)) failures.push({ code: "NO_PERSONALIZATION", detail: "personalization_signal is required" });
  if (isBlank(signalSource)) failures.push({ code: "NO_PERSONALIZATION_SOURCE", detail: "personalization_source_url is blocking" });

  if (!isBlank(verifiedAt) && daysBetween(verifiedAt as string, ctx.today) > PERSONALIZATION_MAX_AGE_DAYS) {
    failures.push({ code: "PERSONALIZATION_STALE", detail: `verified >${PERSONALIZATION_MAX_AGE_DAYS} days ago` });
  }

  // D-3: three mandatory dimensions, ANDed. NEVER a threshold on confidence_score —
  // a sum must not let two verified dimensions compensate for a missing third.
  if (lead.identity_verified !== 1 || isBlank(lead.identity_source_url)) {
    failures.push({ code: "IDENTITY_UNVERIFIED", detail: "identity not confirmed against a stored source" });
  }
  if (lead.specialization_verified !== 1 || isBlank(lead.specialization_source_url)) {
    failures.push({ code: "SPECIALIZATION_UNVERIFIED", detail: "installation work in the recorded trade not confirmed" });
  }
  if (lead.contact_verified !== 1 || isBlank(emailSource)) {
    failures.push({ code: "CONTACT_UNVERIFIED", detail: "business email not confirmed verbatim at a stored source" });
  }

  if (!CONTACTABLE_BANDS.has(lead.fit_band)) {
    failures.push({ code: "BAND_NOT_CONTACTABLE", detail: `band ${lead.fit_band} is not A or B` });
  }
  if ((email !== null && ctx.suppressedEmails.has(email)) || ctx.suppressedDomains.has(lead.domain_normalized)) {
    failures.push({ code: "SUPPRESSED", detail: "on the suppression list" });
  }
  if (ctx.seenDomains.has(lead.domain_normalized) || (email !== null && ctx.seenEmails.has(email))) {
    failures.push({ code: "DUPLICATE", detail: "domain or email already present" });
  }
  return failures;
}
