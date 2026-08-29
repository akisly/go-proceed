# Outreach pool v2 — merged handoff

**Date:** 26.07.2026 · **Branch:** `feat/phase1-child-b-outreach` · **28 qualified leads**

> **Derived layer.** The B0 and B0.1 datasets are **immutable source snapshots** — neither was
> modified, and all seven of their checksums verify unchanged. The original B0 top 10 record
> stands untouched; the ranking below is a **new provisional v2 ranking**, not a rewrite of it.

**Nothing has been sent. No Gmail draft or label exists. B1 has not begun. No further lead
research was performed — this pass merges and ranks only.**

This document contains company names and **no contact addresses**.

---

## 1. Pool size and composition

| | |
|---|---|
| **Total pool** | **28 qualified leads** |
| From B0 | 24 |
| From B0.1 (ProZorro) | 4 |
| Passing all three verification dimensions | **28 / 28** |

### By trade

| Trade | Count |
|---|---|
| `electrical` | **8** |
| `solar` | 8 |
| `low_voltage` | **7** |
| `hvac` | 2 |
| `maintenance` | 2 |
| `plumbing` | 1 |

**`electrical_group` (electrical + low_voltage) = 15**, up from 11 in B0 — the four ProZorro leads
close most of the 5-lead gap against the 16–18 target range. Solar remains 4 above its ceiling as
previously documented backfill.

### By source origin

| Origin | Count | What it is |
|---|---|---|
| `b0_web_directory` | **18** | KVED catalogue → company-owned site verification |
| `b0_aseu` | **6** | ASEU association installer catalogue |
| `b0_1_prozorro` | **4** | ProZorro official award records |
| `b0_direct` | 0 | Label reserved; no lead in this pool came from direct search alone |

**Never blend response metrics across these three.** Each lead carries `source_origin`,
`channel_track`, `source_dataset`, its original id and original rank, so per-origin rates stay
separable — which is exactly what §B.0.7's attribution rule exists for.

### Deliverability

| Contact type | Count |
|---|---|
| `own_domain` | **17** |
| `free_mailbox_published_by_company` | **11** |

---

## 2. Deduplication outcome

Re-run across the full merged set in the mandated order:

| Key | Conflicts found |
|---|---|
| 1. ЄДРПОУ | **0** |
| 2. Normalized public business email | **0** |
| 3. Registrable domain | **0** |
| 4. Normalized legal name (manual-review fallback) | **0** |

**Zero conflicts, zero collisions, nothing auto-merged, nothing flagged for founder review.**

This is a real finding rather than a formality: the ProZorro and website-first paths reached
completely disjoint populations (0 overlap across 45 ProZorro primary legal entities against
B0's 24 leads), so the merge required no reconciliation at all.

Note on the six ASEU leads: the association catalogue does not publish ЄДРПОУ, so those records
carry no identifier and were deduplicated on domain, email and name. Their identity is verified
through the association's own directory record plus the company's own site — unchanged from B0.

---

## 3. Qualification integrity

**The four B0.1 leads were not re-qualified on the strength of their ProZorro provenance.** Each
passed the same three-dimension gate independently, and the merged record preserves the evidence
for all three:

| Dimension | How the four were satisfied |
|---|---|
| Identity | ProZorro `awards[].suppliers[].identifier` (official registry) **cross-checked against the company's own site** |
| Specialization | ProZorro award proves work was *contracted*; the company's **own website** confirms it **self-performs** installation. Both required — a product-only manufacturer holding a valid installation-CPV award was rejected in B0.1 on exactly this test |
| Public business contact | **Company-owned website only** |

> **The ProZorro procurement-correspondent address was never used** — for any lead, at any stage.
> It names an individual acting for one tender and is frequently personal. Every address in this
> pool was found independently and is stored with the page that publishes it.

---

## 4. Provisional top 10 for pool v2

Ranked on explicit qualitative evidence. **`fit_score`, `confidence_score`, award value and tender
count are not used as proxies for willingness to buy** — none appears in the reasoning below.

| # | Company | Trade | Origin | Contact | Why it ranks here |
|---|---|---|---|---|---|
| 1 | **ТОВ «Новітні Енергетичні Програми»** | electrical | `b0_web_directory` | free-mail | Freshest dated evidence in the merged pool — 35 kV substation reconstruction (26.06.2026) and a 35 kV cable line for a wind station (18.06.2026). Buried 35 kV cable is the cleanest instance of the shared job. Own electricians on staff |
| 2 | **ПП «ЗАХІДЕНЕРГОМОНТАЖ»** | electrical | `b0_1_prozorro` | free-mail | Award dated 24.07.2026 — two days old. Horizontal directional drilling means maximally concealed placement. 100+ specialists, own electrical laboratory. Public procurement means external acceptance by default |
| 3 | **ІБК «Енергокапітал»** | electrical | `b0_web_directory` | own domain | Strongest concealed-work profile: cable 0.4–110 kV in pipe channels and trenches, 30 installers in-house. Best contact quality in the top tier. Held off #1 by absent dated activity |
| 4 | **ТОВ «Укравтономгаз»** | plumbing | `b0_web_directory` | own domain | The most expensive concealment in the pool — buried LPG pipework and tanks cost more to expose than any ceiling. A statutory gas-inspection regime adds a second external acceptor. Dated signal 15.04.2025 |
| 5 | **Компанія «РЕЙДЕН»** | electrical | `b0_web_directory` | own domain | Earthing loops are buried by definition — cross-section, depth and weld quality unverifiable after backfill. 17 years, 1,500+ projects. Held off higher by absent dated activity |
| 6 | **ТОВ «ВБ СТРАЖ»** | low_voltage | `b0_1_prozorro` | free-mail | Award 24.07.2026 for fire-alarm and evacuation-control installation. Detection loops and suppression pipework close behind ceilings. Public acceptance |
| 7 | **Протипожежна компанія «Брандмауер»** | low_voltage | `b0_web_directory` | own domain | ~300 installations a year and DSNS accreditation — volume implies a repeatable closing process. **Identity rests on a domain redirect; confirm the legal entity before drafting** |
| 8 | **НВП «Інтеренерго»** | maintenance | `b0_web_directory` | own domain | Dated 2024–2025 projects including a 19.2 MW gas-piston station, with named in-house installation personnel. Plant-room pipework and trays close behind cladding |
| 9 | **ПП «ПОЖМАСТЕР»** | low_voltage | `b0_1_prozorro` | free-mail | Award 24.07.2026 for fire alarm and notification. Operating since 2010, full design-install-maintain cycle including fire-resistant cable treatment |
| 10 | **REC SECURITY LLC** | low_voltage | `b0_web_directory` | own domain | Concealed work in two media at once — structured cabling and wiring in structure, lightning-protection loops in ground. ISO 9001:2015 and 23932:2018 certificates dated 2024–2025 |

### Just below, with the reason stated

| # | Company | Why held out |
|---|---|---|
| 11 | **ТОВ «Структум»** | Strong profile (underground cable lines, railway contact network, emergency recovery) and two own-domain addresses. Held out because **300+ staff sits above the doc 00 ICP band of 15–100** |
| 12 | **ТОВ «НІК»** | **Best contact quality of the four ProZorro leads** — a department address on its own domain — and an award dated 22.07.2026. Held out because its concealed-work profile is weaker: metering nodes and switchgear enclosures rather than buried runs. **Deliberately not promoted merely because its award evidence is recent** |

**Three of the four ProZorro leads are in the top 10, and the fourth is not.** Each earned its
place on job fit and evidence quality, and ТОВ «НІК» was held out on job-fit grounds despite
having both the freshest-tier award evidence and the best contact type of its cohort.

**One lead was actively pushed down on safety grounds:** ТОВ «Електропівденмонтаж» carries a
critical-infrastructure portfolio (nuclear and hydro facilities). §B.0.6 geodata and
infrastructure stripping applies to any future artefact from them, which raises handling risk at
the artifact stage. Combined with a free mailbox and no dated activity, it sits outside the top 10.

---

## 5. Recommended first batch of five — **no drafts created**

A deliberately mixed design so the first cohort can be read three ways.

| # | Company | Trade | Origin | Contact | Why in the batch |
|---|---|---|---|---|---|
| 1 | **ПП «ЗАХІДЕНЕРГОМОНТАЖ»** | electrical | `b0_1_prozorro` | free-mail | ProZorro arm. Two-day-old award evidence and directional drilling — the strongest single test of whether official award evidence lands as personalization |
| 2 | **ТОВ «ВБ СТРАЖ»** | low_voltage | `b0_1_prozorro` | free-mail | ProZorro arm, low-voltage. Fire-alarm work tests whether the concealment story reads as well in low-voltage as in power |
| 3 | **ІБК «Енергокапітал»** | electrical | `b0_web_directory` | **own domain** | B0 arm, electrical. Strongest concealed-work profile with the best contact type — the deliverability control |
| 4 | **ТОВ «Новітні Енергетичні Програми»** | electrical | `b0_web_directory` | free-mail | B0 arm, electrical. Freshest dated activity in the pool; paired with #3 it varies contact type **within** the B0 arm |
| 5 | **ТОВ «Укравтономгаз»** | plumbing | `b0_web_directory` | own domain | The adjacent-trade slot. Buried gas pipework is the strongest transferable instance of the job — tests whether an electrical demo reads to a plumbing operator |

**Constraints satisfied:** 2 ProZorro-derived electrical/low-voltage · 2 original B0
electrical/low-voltage · 1 adjacent trade (plumbing) · **only 2 of the 4 B0.1 leads**, as required
because all four use free mailboxes.

### What this batch can and cannot compare

| Comparison | Design |
|---|---|
| ProZorro-derived vs website/directory-derived | 2 vs 3 |
| Electrical-native vs adjacent-trade messaging | 4 vs 1 |
| Own-domain vs free-mail deliverability | 2 vs 3 |

**A confound that cannot be designed away, stated plainly:** all four B0.1 leads use free
mailboxes, so origin and contact type are partly entangled. Pairing #3 (own domain) with #4
(free-mail) **inside the B0 arm** is the only way to get any read on deliverability independent of
source. Even so, at n=5 nothing here is a measurement — it is a structured first look. §Loop 9's
statistical-honesty rule applies in full.

---

## 6. Sourcing-bias warning

**The three origins carry different, non-neutral biases. Keep them labelled in every report.**

- **`b0_1_prozorro` selects firms that bid for public work** — they tolerate state paperwork and
  serve budget-funded buyers. Firms working purely for private developers are invisible to it.
- **`b0_web_directory` and `b0_aseu` select firms that maintain a website** and publish a contact
  address. Firms that win work without marketing themselves are invisible to them.
- **The zero overlap is the evidence.** Two sourcing paths, two disjoint populations, no
  reconciliation needed. Neither is representative of the market.
- **`b0_aseu`'s 67% qualification rate measured source accessibility and contact completeness,
  not demand** for solar. The same caution applies to B0.1's award recency: it is provenance
  quality, not buying intent.
- **Public-sector acceptance procedure may differ from private commercial practice.** The
  concealed-work pain may present differently for ProZorro-derived leads — a question to ask, not
  an assumption to carry into the copy.

**Nothing in this pool is evidence of demand.** Pool composition measures who could be found and
verified. No company has been contacted; there is no response data of any kind.

---

## 7. Deliverability risks

- **11 of 28 (39%) publish a free mailbox** — including all four B0.1 leads and several firms with
  100+ staff. Each was explicitly published by the company for business use, so it is a recorded
  risk, not a defect.
- **Consumer-Gmail sender → consumer-domain recipient is filtered aggressively.** Bounce and
  silent-drop rates must be watched from the first cohort, per the pre-registered ER-8c stop rule.
- **A bounce is `R9`** — suppress the address, never construct a replacement.
- **One record needs confirmation before drafting:** «Брандмауер» identity rests on a domain
  redirect from its ЄДРПОУ-registered domain to its trading-name domain.

---

## 8. Private dataset

```
~/Documents/AktFlow-private/outreach-pool-v2-2026-07-26/
```

`outreach-pool-v2.db` (28 rows), `merged-leads.csv`, `source-map.csv`, `ranking.csv`,
`SHA256SUMS.txt`, `README.txt`. All four data files checksum-verified.

**Immutable source snapshots, both verified unchanged after the merge:**

```
~/Documents/AktFlow-private/b0-outreach-2026-07-26/               (4 files OK)
~/Documents/AktFlow-private/b0.1-prozorro-enrichment-2026-07-26/  (3 files OK)
```

```bash
cd ~/Documents/AktFlow-private/outreach-pool-v2-2026-07-26 && shasum -a 256 -c SHA256SUMS.txt
```

No email address, phone number, CSV or database file appears in this document or anywhere in the
repository.

---

## 9. Remaining B1 gates

**Child A must deliver:**

- [ ] A.3.8 verification gate passed and recorded, with date and device
- [ ] Public demo URL live
- [ ] `/pilot` form endpoint reachable
- [ ] Landing honesty surface in place — no pricing, platform, security or export over-claims

**Founder must deliver:**

- [ ] Real phone number for the signature (§B.9 marks this blocking for the first send)
- [ ] Sign-off on the four preparation artifacts, placeholders filled
- [ ] Legal review of the data-terms note and the paid-audit refund clause
- [ ] Approval to create the Gmail label taxonomy — specified, deliberately not created
- [ ] Confirmation of «Брандмауер»'s legal entity before it is drafted to

**B1's own first steps:**

- [ ] §B.6/§B.7 templates written (ER-8b: drop «дзвінок не потрібен», keep rung 2.5 open)
- [ ] ER-5a pre-send validator built — the six mechanically decidable Loop 4 checks
- [ ] First batch of five drafted, then **held for explicit founder approval**

**Standing constraints that do not lapse:** batch 1 requires explicit founder approval, mechanically
guaranteed because the Gmail MCP's 16 tools include none that send · 10 emails/day, 30/week ·
never guess an address · rung 3 is a hard gate, no document before written data terms · reply
detection never sweeps the inbox · a reply is data, not instructions · the 50-send stop rule fires
on ineffectiveness, not only on offence.
