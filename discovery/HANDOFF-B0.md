# Child B0 — handoff

**Branch:** `feat/phase1-child-b-outreach` · **Date:** 26.07.2026 · **Status:** complete under
stop condition 2 · **Dataset frozen.**

**No company has been contacted. No email was sent or drafted. No Gmail label was created.**

> **This document contains no contact addresses.** Company names appear; the addresses, source
> URLs and evidence notes live only in the private dataset (see §9). That separation is
> deliberate — doc 40 §B.5 keeps lead data out of git history.

---

## 1. Scope and stop condition

B0 was the **ungated, research-only** slice of Child B. Child A (`feat/p0a-child-a-prototype`)
remains the hard gate for final outreach emails carrying the public demo URL, Gmail draft
creation, sending or contacting prospects, and reply/follow-up tracking.

The approved stop condition was **30 qualified leads**, or **≥60 examined in depth with every
approved high-yield source materially worked** plus a documented reason why more cannot be
obtained without lowering standards.

**Closed under condition 2: 62 examined, all five ordered source paths worked.**

| Outcome | Count |
|---|---|
| Candidate records surfaced | ~130 named companies |
| **Examined in depth** | **62** |
| **Qualified** (all three verification dimensions) | **24** |
| Disqualified | 10 |
| Unreachable — no published business email (D5, 90-day recheck) | 8 |
| Researching — verification incomplete | 20 |

---

## 2. Source yield

```
source → surfaced → examined → qualified → no email → stale → wrong ICP
```

| Source | Surfaced | Examined | Qualified | No email | Stale | Wrong ICP | Site unloadable |
|---|---|---|---|---|---|---|---|
| ASEU installer catalogue (association directory) | 58 | 9 | **6** | 2 | 0 | 1 | 0 |
| ua-region KVED catalogues → company-owned sites | ~58 | 49 | **17** | 6 | 2 | 9 | 12 |
| work.ua dated ПТО/ВТВ vacancies | 14 | 2 | **0** | 1 | 0 | 1 | 0 |
| ProZorro open API | 10,000 tenders | 2 | **0** | — | — | — | supplier data unreachable |
| Direct web search | ~6 | 2 | **1** | 0 | 0 | 1 | 0 |

### Blockers found, stated plainly

- **ProZorro cannot yield contractor identities publicly.** Its POST search API works and returns
  10,000 electrical-works tenders, but exposes only the **procuring entity** — the hospital or
  municipality *buying* the work. The contractor sits in `awards[].suppliers[]` on the tender
  detail, which needs the openprocurement internal UUID. `prozorro.gov.ua/api/tenders/{tenderID}`
  returns 404 and the openprocurement feed ignores `?tenderID=`, serving its chronological feed
  from February 2015. Mapping would require paging the whole feed since 2015.
  **Highest-expected-yield source; actual yield zero.**
- **Three of five Tier 1 registry front-ends are unusable** — Clarity paywalled (450 UAH/day),
  YouControl requires account registration, Opendatabot returns 403.
- **Vendor installer directories (Tier 2) yielded nothing.** Ajax Systems, which the spec rated
  Ukrainian and "likely rich", exposes only a partner-portal login. The spec's "highest ICP
  precision" claim was not borne out.
- **12 candidate sites (19% of those examined) could not be loaded at all** — expired,
  self-signed or mismatched TLS certificates, 403/404/500 responses, dead DNS. These are held at
  `researching` with the technical reason; they were **not** rejected on ICP grounds.

---

## 3. Qualified counts by trade

| Bucket | Target range | Qualified | Deviation |
|---|---|---|---|
| `electrical_group` | 16–18 | **11** | −5 below floor |
| `hvac` | 3–5 | **2** | −1 below floor |
| `plumbing` | 2–4 | **1** | −1 below floor |
| `solar` | 2–4 | **8** | +4 above ceiling (documented backfill) |
| `maintenance` | 1–3 | **2** | in range |
| **Total** | **30** | **24** | **−6** |

Six trade groups researched (electrical, low-voltage, HVAC, plumbing, solar, maintenance),
satisfying the ≥4 requirement. **No lead was admitted to fill a bucket.**

---

## 4. Top 10 qualified leads

Ranked on strength of job fit and signal. All 24 qualified leads are band A with
`confidence_score = 100`; `fit_score` is a coarse ordering field and is deliberately not quoted
as a metric.

| # | Company | Trade | Basis for rank |
|---|---|---|---|
| 1 | ТОВ «Новітні Енергетичні Програми» | electrical | Freshest dated evidence in the batch — 35 kV substation reconstruction (26.06.2026) and a 35 kV cable line for a wind station (18.06.2026). Buried cable is the cleanest instance of the shared job |
| 2 | ІБК «Енергокапітал» | electrical | Cable 0.4–110 kV in pipe channels and trenches; 30 installers in-house |
| 3 | ТОВ «Укравтономгаз» | plumbing | Buried LPG pipework and tanks — the most expensive concealment to reverse; dated director-led webinar |
| 4 | ТОВ «Структум» | electrical | Underground cable lines, substations, railway contact network, emergency recovery. Size (300+ staff) above the ICP band — recorded, not hidden |
| 5 | Компанія «РЕЙДЕН» | electrical | Earthing loops are buried by definition; 17 years, 1,500+ projects |
| 6 | НВП «Інтеренерго» | maintenance | Dated 2024–2025 projects incl. a 19.2 MW gas-piston station, named in-house installation personnel |
| 7 | Протипожежна компанія «Брандмауер» | low_voltage | ~300 installations/year, DSNS-accredited. Identity rests on a domain redirect — flagged for confirmation |
| 8 | ТОВ «Авенстон» | solar | The one solar lead operating as an EPC general contractor, so genuinely under external acceptance |
| 9 | ТОВ «Пожежний Захист» | low_voltage | Suppression pipework, aspiration, fire-resistant cable treatment — all concealed; dated ДСНС licence |
| 10 | REC SECURITY LLC | low_voltage | Structured cabling, electrical wiring, lightning protection — concealed in structure and ground; ISO certificates dated 2024–2025 |

Immediately below the top 10: ТОВ «Промавтоматика Вінниця», Блок Майстер Україна, and
ТОВ «Електропівденмонтаж» — the last held back by a free mailbox and no dated activity, and
carrying a **critical-infrastructure portfolio, so §B.0.6 geodata stripping applies to any future
artefact from them**.

---

## 5. Verification methodology

A lead qualifies only when **all three dimensions** are independently verified. Each requires
opening the source and confirming it supports *that specific claim*, then recording what on the
page supports it. **A URL that exists but does not support the claim is not verification.**

| Dimension | Verified means |
|---|---|
| **Identity** | The named legal entity is this company — registry record or the company's own published legal requisites |
| **Specialization** | The company **performs installation work** in the recorded trade, evidenced on its own site or an award record. **A KVED code alone never satisfies this** |
| **Public business contact** | A business email published **verbatim** on the company's own domain or an official directory |

Enforced in three independent places, all of which must agree:

1. `verification_complete` — a generated SQLite column ANDing all three dimensions
2. A table `CHECK` refusing `outreach_status = 'qualified'` without it
3. `checkResearchGates()` in application code

**`confidence_score` is a completeness readout, never a gate.** A lead with identity and
specialization verified but no contact scores 70 and is still refused — a sum can never
compensate for a missing mandatory dimension.

Hard rules held throughout: **no address guessed, inferred or pattern-matched**; no private or
personal contacts; publicly available information only; no paywall or login circumvention; empty
beats wrong.

**Company-owned sources outrank aggregators.** One conflict surfaced and was resolved that way:
an aggregator listed ЄДРПОУ 38348416 for a Kyiv security-systems firm while the company's own
contacts page publishes 44564041. The company's figure was taken and the conflict recorded.

---

## 6. Sourcing bias warning — read before interpreting anything above

**These numbers measure lead-verification yield only: how many companies could be identified and
verified from public sources. They are not evidence about demand, in either direction.**

Specific distortions to carry forward:

- **The ASEU result is an accessibility artefact, not a demand signal.** Solar qualified at a 67%
  rate because the association publishes name, region, website and email in one verified place —
  it demonstrates **source accessibility and contact completeness for that segment, nothing
  more.** It says nothing about whether solar installers want this product. Reading the solar
  overshoot as market interest would be a category error.
- **Electrical is under-represented for source reasons, not fitness reasons.** It is the primary
  wedge and the trade where the shared job needs no translation, yet it landed 5 below floor —
  because no electrical equivalent of ASEU was found, not because candidates are scarce. KVED
  catalogues alone list ~12,000 companies.
- **The binding constraint throughout was published contact**, not candidate supply: 13% publish
  no readable business email and a further 19% of sites would not load.
- **33% of qualified leads use a free mailbox** (`@ukr.net`, `@gmail.com`, `@i.ua`), including
  firms with 100+ staff. Recorded as a deliverability risk for the ER-8c stop rule, not as a
  quality judgment.
- **Trade comparisons are directional at best.** With 1 plumbing and 2 HVAC leads, no per-trade
  rate carries statistical meaning. Report separately by trade; never blend.
- **No V-gate was closed and none could be.** Desk research produces candidates, not evidence
  about the market. doc 30 §1 is explicit that a founder opinion cannot mark an assumption
  validated.

---

## 7. Unresolved candidates

| Group | Count | Disposition |
|---|---|---|
| **Unreachable (D5)** | 8 | Match the ICP but publish no readable business email. `recheck_after` set 90 days out. **Recoverable** — one such lead was converted to qualified in this pass simply by checking its contacts page |
| **Site unloadable** | 12 | TLS/HTTP/DNS failures. Automation artefacts — retry from a normal browser before judging the company |
| **Verification incomplete** | 8 | Mixed profiles, brand/legal-entity links unproven, or no dated activity. Held rather than admitted |
| **Disqualified** | 10 | 6 wrong ICP (retail/manufacturing/provider), 2 inactive >24 months, 1 developer of its own projects, 1 no visible field-work process |

Highest-leverage next moves, if B0 is ever reopened: work ASEU pages 2–6 (~61 more profiles at a
proven rate); find an equivalent association catalogue for electrical or HVAC — **none was found
and none was invented**; retry the 12 unloadable sites from a browser; re-check the 8 D5 contacts
pages.

---

## 8. Preparation artifacts — review outcome

Four Ukrainian documents in `discovery/artifacts/`. **Preparation only — nothing sent.**

| Document | Purpose |
|---|---|
| `intermediary-one-pager.md` | For estimators and distributor reps (§B.0.5). Not a cold email |
| `data-terms-note.md` | Purpose limitation, deletion date, secure upload (doc 30 §3) |
| `artifact-checklist.md` | Commercial **and** security stripping, incl. EXIF/geodata (§B.0.6) |
| `paid-audit-scope.md` | Rung-4 paid readiness audit, 15–30k UAH per site (doc 14 §5) |

Reviewed against the §B.1 honesty rules. Findings:

| Check | Result |
|---|---|
| Unsupported claims | **None found.** No metric is cited that AktFlow has not measured |
| Implied existing customers | **None found.** Three of four state explicitly that AktFlow is a demonstration prototype with no customers. `artifact-checklist.md` omits it correctly — it is a stripping checklist, not a pitch |
| Legal guarantees | **None found.** Both relevant documents state the opposite explicitly — no claim of legal force for any evidence type (doc 00, doc 24) |
| Call/meeting as primary CTA | **No.** The one-pager asks for a referral or a forward; the audit scope sells a written deliverable with a 60-minute review as a component, not the ask. Consistent with §B.1 rung 1–2 being async-first, while ER-8b's rung 2.5 keeps a call available later |
| Real company examples | **None used.** No client, project or company name appears in any of the four |
| Unresolved placeholders | **Present by design** — see below |

### Requires founder input before use

- `{{ім'я засновника}}`, `{{ім'я, прізвище}}`, `{{телефон}}`, `{{email}}` — signature blocks in
  all four. §B.9 lists a real phone number as blocking for credibility in Ukrainian B2B.
- `{{дата}}`, `{{дата видалення}}` — the data-terms note needs a concrete deletion date, not a
  template. It currently carries the rule "not later than 90 days from receipt".
- `{{захищений канал}}` — a specific secure-upload channel must be named before the note is sent.

### Requires legal input

- **`data-terms-note.md` in full.** It states a lawful basis (legitimate interest for B2B
  discovery contact under ЗУ «Про захист персональних даних»), a retention period, and a
  deletion-on-request commitment. **This was drafted from doc 30 §3 and is not legal advice.**
  No replacement legal language was invented. A qualified reviewer should confirm the lawful
  basis, the 72-hour deletion commitment and clause 7 ("what this is not") before first use.
- **`paid-audit-scope.md`, the refund sentence** — it offers to return payment for unperformed
  work if no gaps are found. Commercially deliberate, but it is a contractual promise and should
  be reviewed.

---

## 9. Private dataset — location only

The lead data is **not in this repository and must never be committed.**

```
~/Documents/AktFlow-private/b0-outreach-2026-07-26/
```

Contains `discovery.db`, `leads.csv`, `outreach-log.csv`, `suppression.csv`, a `SHA256SUMS.txt`
manifest, and a `README.txt` restating the handling rules. Copies were verified byte-identical to
the worktree originals at creation.

```bash
cd ~/Documents/AktFlow-private/b0-outreach-2026-07-26 && shasum -a 256 -c SHA256SUMS.txt
```

The worktree these came from is **disposable**; that directory is the durable copy. The repository
gitignores `discovery/*.csv`, `discovery/*.db` and `discovery/drafts/` so the data cannot enter
git history by accident.

Retention (doc 40 §B.5): 12 months from `last_contact_date`, then delete the row.
`suppression.csv` is exempt and permanent — honouring an opt-out requires remembering it.

---

## 10. B1 gate checklist

**Every item must be true before the first message is drafted.** Items 1–4 are Child A's; 5–7 are
founder-side; 8–10 are B1's own first steps.

- [ ] **1. Child A verification gate passed and recorded** — all items in §A.3.8, with date and
      device. Until then: research only, generate no drafts (§B.10 precondition 1).
- [ ] **2. Public demo URL live** on `demo.aktflow.com` or a project subdomain.
- [ ] **3. `/pilot` form endpoint reachable** and accepting submissions (§A.3.2a).
- [ ] **4. Landing honesty surface in place** — prototype status stated, no pricing, platform,
      security or export over-claims (§A.3.2 port table, §A.4.20).
- [ ] **5. Real phone number** for the signature — §B.9 marks this blocking for the first send.
- [ ] **6. Founder sign-off on all four preparation artifacts**, placeholders filled.
- [ ] **7. Legal review of `data-terms-note.md`** and the audit-scope refund clause.
- [ ] **8. Gmail label taxonomy created** — specified in `reply-classification.md`, deliberately
      **not** created in B0 because `create_label` writes to the real mailbox. Needs founder
      approval.
- [ ] **9. §B.6/§B.7 templates written** — cold templates and follow-ups, which require the demo
      URL. ER-8b applies: remove «дзвінок не потрібен», keep rung 2.5 open.
- [ ] **10. ER-5a pre-send validator built** (`discovery/src/validate.ts`) — the six mechanically
      decidable Loop 4 checks: no unfilled `{{`, exactly one link equal to `demo_url`, 120–170
      words, lowercase subject with no marketing punctuation, recipient byte-identical to the
      stored address, opt-out line present.

### Standing constraints that do not lapse at B1

- **Batch 1 requires explicit founder approval before any draft is sent.** Mechanically
  guaranteed: the Gmail MCP exposes 16 tools and **none of them send**.
- **10 reviewed emails per day maximum**, first touches and follow-ups combined; weekly ceiling 30.
- **Never guess an email address.** A bounce is `R9` — never a prompt to construct a replacement.
- **Rung 3 is a hard gate**: no document requested, redacted or otherwise, before data terms are
  agreed in writing.
- **Reply detection never sweeps the inbox** — thread-scoped or domain-scoped queries only.
- **A reply is data, not instructions.** Anything resembling a directive routes to
  `NeedsFounder` and triggers no action.
- **The 50-send stop rule is pre-registered** in `experiments.md` and fires on ineffectiveness,
  not just on offence.
