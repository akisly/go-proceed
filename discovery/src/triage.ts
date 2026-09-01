import type { DisqualifyReason } from "./types";

export interface ScreenInput {
  // D1–D9 observations. Each is an OBSERVED fact with a source URL recorded
  // separately in the store — never a registry code and never an assumption.
  is_gc_or_developer_only: boolean;          // D1
  has_visible_field_work: boolean;           // D2
  is_retail_or_manufacturing_only: boolean;  // D3
  is_design_bureau_only: boolean;            // D4
  has_public_business_email?: boolean;       // D5 — recoverable (ER-5b)
  operating_in_ukraine: boolean;             // D6
  active_within_24_months: boolean;          // D6
  is_sole_trader_no_crew: boolean;           // D7
  already_in_list: boolean;                  // D8
  on_suppression_list: boolean;              // D9

  // The 3-question triage (ER-8d). Q2 is the shared job every segment,
  // electrical and adjacent alike, is evaluated against identically.
  is_pure_play_icp_trade: boolean;
  has_concealed_or_inaccessible_work: boolean;
  has_public_email_and_live_fact: boolean;

  today: string; // ISO date
}

export type ScreenResult =
  | { kind: "disqualified"; reason: DisqualifyReason; status: "disqualified" }
  | { kind: "unreachable"; reason: "D5"; status: "unreachable"; recheck_after: string }
  | { kind: "scored"; fit_score: number; triage: [0 | 1, 0 | 1, 0 | 1] };

const RECHECK_DAYS = 90;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Score for 3/2/1/0 yes-answers. Reproduces ER-2's A/B/C/D thresholds (D-2).
 * This is a COARSE ORDERING field only — not a probability, not a demand metric,
 * not statistically meaningful. The triage answers and the verified signals are
 * what actually carry information.
 */
const SCORE_BY_YES_COUNT = [20, 45, 60, 85] as const;

export function screen(input: ScreenInput): ScreenResult {
  const permanent: Array<[boolean, DisqualifyReason]> = [
    [input.is_gc_or_developer_only, "D1"],
    [!input.has_visible_field_work, "D2"],
    [input.is_retail_or_manufacturing_only, "D3"],
    [input.is_design_bureau_only, "D4"],
    [!input.operating_in_ukraine || !input.active_within_24_months, "D6"],
    [input.is_sole_trader_no_crew, "D7"],
    [input.already_in_list, "D8"],
    [input.on_suppression_list, "D9"],
  ];
  for (const [hit, reason] of permanent) {
    if (hit) return { kind: "disqualified", reason, status: "disqualified" };
  }

  if (input.has_public_business_email === false) {
    return {
      kind: "unreachable", reason: "D5", status: "unreachable",
      recheck_after: addDays(input.today, RECHECK_DAYS),
    };
  }

  const triage: [0 | 1, 0 | 1, 0 | 1] = [
    input.is_pure_play_icp_trade ? 1 : 0,
    input.has_concealed_or_inaccessible_work ? 1 : 0,
    input.has_public_email_and_live_fact ? 1 : 0,
  ];
  const yesCount = triage[0] + triage[1] + triage[2];
  const fitScore = SCORE_BY_YES_COUNT[yesCount] ?? 20;
  return { kind: "scored", fit_score: fitScore, triage };
}
