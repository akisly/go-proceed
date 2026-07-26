CREATE TABLE IF NOT EXISTS leads (
  lead_id                   TEXT PRIMARY KEY,
  company_name              TEXT NOT NULL,
  company_name_legal        TEXT,
  edrpou                    TEXT,
  website                   TEXT NOT NULL,
  domain_normalized         TEXT NOT NULL,
  city                      TEXT NOT NULL,
  regions_served            TEXT NOT NULL,
  specialization            TEXT NOT NULL,
  specialization_note       TEXT,
  primary_trade             TEXT NOT NULL,
  channel_track             TEXT NOT NULL,
  size_signal               TEXT,
  size_signal_source        TEXT,
  icp_match_reason          TEXT NOT NULL,
  job_fit_note              TEXT NOT NULL,
  trade_transfer_note       TEXT,
  personalization_signal    TEXT,
  personalization_source_url TEXT,
  personalization_verified_at TEXT,
  contact_person            TEXT,
  contact_role              TEXT,
  contact_source_url        TEXT,
  email                     TEXT,
  email_type                TEXT,

  -- D-3: three mandatory verification dimensions. `_verified` is the outcome of a
  -- MANUAL check that the source supports the claim; `_evidence_note` records what
  -- on the page supports it. A stored URL with no verified flag is not evidence.
  identity_verified         INTEGER NOT NULL DEFAULT 0 CHECK (identity_verified IN (0,1)),
  identity_source_url       TEXT,
  identity_evidence_note    TEXT,
  specialization_verified   INTEGER NOT NULL DEFAULT 0 CHECK (specialization_verified IN (0,1)),
  specialization_source_url TEXT,
  specialization_evidence_note TEXT,
  contact_verified          INTEGER NOT NULL DEFAULT 0 CHECK (contact_verified IN (0,1)),
  email_source_url          TEXT,
  contact_evidence_note     TEXT,

  source_urls               TEXT NOT NULL,
  triage_q1                 INTEGER NOT NULL DEFAULT 0 CHECK (triage_q1 IN (0,1)),
  triage_q2                 INTEGER NOT NULL DEFAULT 0 CHECK (triage_q2 IN (0,1)),
  triage_q3                 INTEGER NOT NULL DEFAULT 0 CHECK (triage_q3 IN (0,1)),
  fit_score                 INTEGER NOT NULL DEFAULT 0 CHECK (fit_score BETWEEN 0 AND 100),
  outreach_status           TEXT NOT NULL,
  recheck_after             TEXT,
  last_contact_date         TEXT,
  last_reply_date           TEXT,
  next_action               TEXT NOT NULL,
  next_action_date          TEXT,
  gmail_thread_id           TEXT,
  last_processed_message_id TEXT,
  template_variant          TEXT,
  experiment_id             TEXT,
  reply_class               TEXT,
  disqualify_reason         TEXT,
  ladder_rung               INTEGER NOT NULL DEFAULT 1 CHECK (ladder_rung BETWEEN 1 AND 4),
  notes                     TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,

  email_normalized TEXT GENERATED ALWAYS AS (lower(trim(email))) STORED,

  -- D-2: coarse score from the 3-question triage; bands stay ER-2's thresholds.
  -- fit_score is an ORDERING field only — not a probability, not a metric.
  fit_band TEXT GENERATED ALWAYS AS (
    CASE WHEN fit_score >= 75 THEN 'A'
         WHEN fit_score >= 55 THEN 'B'
         WHEN fit_score >= 40 THEN 'C'
         ELSE 'D' END) STORED,

  -- D-3: VERIFICATION COMPLETENESS ONLY. A dimension counts only when its manual
  -- check passed AND its URL is stored. This is a compatibility field — it is NOT
  -- the qualification gate, and a sum may never compensate for a missing dimension.
  confidence_score INTEGER GENERATED ALWAYS AS (
    (CASE WHEN identity_verified = 1
            AND identity_source_url       IS NOT NULL AND identity_source_url       <> '' THEN 40 ELSE 0 END) +
    (CASE WHEN specialization_verified = 1
            AND specialization_source_url IS NOT NULL AND specialization_source_url <> '' THEN 30 ELSE 0 END) +
    (CASE WHEN contact_verified = 1
            AND email_source_url          IS NOT NULL AND email_source_url          <> '' THEN 30 ELSE 0 END)
  ) STORED,

  -- The real gate: all three dimensions, ANDed. Never a threshold on the sum.
  verification_complete INTEGER GENERATED ALWAYS AS (
    CASE WHEN identity_verified = 1       AND identity_source_url       IS NOT NULL AND identity_source_url       <> ''
          AND specialization_verified = 1 AND specialization_source_url IS NOT NULL AND specialization_source_url <> ''
          AND contact_verified = 1        AND email_source_url          IS NOT NULL AND email_source_url          <> ''
         THEN 1 ELSE 0 END) STORED,

  quota_bucket TEXT GENERATED ALWAYS AS (
    CASE WHEN primary_trade IN ('electrical','low_voltage') THEN 'electrical_group'
         WHEN primary_trade = 'hvac'        THEN 'hvac'
         WHEN primary_trade = 'plumbing'    THEN 'plumbing'
         WHEN primary_trade = 'solar'       THEN 'solar'
         WHEN primary_trade = 'maintenance' THEN 'maintenance'
         ELSE 'none' END) STORED,

  UNIQUE (domain_normalized),
  UNIQUE (email_normalized),
  -- D-3 enforced in the database: a lead cannot sit at `qualified` unless it has a
  -- verbatim public email AND all three verification dimensions are complete.
  CHECK (outreach_status <> 'qualified' OR (
    email IS NOT NULL AND email <> '' AND verification_complete = 1))
);

CREATE TABLE IF NOT EXISTS outreach_log (
  event_id      TEXT PRIMARY KEY,
  event_timestamp TEXT NOT NULL,
  lead_id       TEXT NOT NULL REFERENCES leads(lead_id),
  event_type    TEXT NOT NULL,
  actor         TEXT NOT NULL,
  channel       TEXT NOT NULL,
  channel_track TEXT NOT NULL,
  template_variant TEXT,
  experiment_id TEXT,
  subject       TEXT,
  gmail_draft_id TEXT,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  status_before TEXT,
  status_after  TEXT,
  reply_class   TEXT,
  personalization_signal_used TEXT,
  approval_state TEXT,
  approved_by   TEXT,
  approved_at   TEXT,
  notes         TEXT
);

-- ER-2: the triggers replace the dropped hash chain. A self-signed chain proves
-- nothing to a third party; these give the property that actually matters.
CREATE TRIGGER IF NOT EXISTS outreach_log_no_update BEFORE UPDATE ON outreach_log
  BEGIN SELECT RAISE(ABORT, 'outreach_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS outreach_log_no_delete BEFORE DELETE ON outreach_log
  BEGIN SELECT RAISE(ABORT, 'outreach_log is append-only'); END;

CREATE TABLE IF NOT EXISTS suppression (
  email_normalized  TEXT,
  domain_normalized TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('opted_out','bounced','manual')),
  date   TEXT NOT NULL,
  note   TEXT
);

-- B.4.4: entries are never removed.
CREATE TRIGGER IF NOT EXISTS suppression_no_update BEFORE UPDATE ON suppression
  BEGIN SELECT RAISE(ABORT, 'suppression is append-only'); END;
CREATE TRIGGER IF NOT EXISTS suppression_no_delete BEFORE DELETE ON suppression
  BEGIN SELECT RAISE(ABORT, 'suppression is append-only'); END;

-- ER-2: touch_count is a view over the log, never a stored column.
CREATE VIEW IF NOT EXISTS lead_touch_counts AS
  SELECT lead_id, COUNT(*) AS touch_count
  FROM outreach_log
  WHERE event_type IN ('email_sent','followup_sent')
  GROUP BY lead_id;
