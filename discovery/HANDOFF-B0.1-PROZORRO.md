# Child B0.1 — ProZorro enrichment pass

**Date:** 26.07.2026 · **Branch:** `feat/phase1-child-b-outreach` · **Status:** stopped at
condition 2 · **Awaiting founder review — not merged.**

> **B0.1 is a separate versioned layer.** The frozen B0 dataset (24 qualified leads, top 10) was
> **not reopened, overwritten or reinterpreted**. Its checksums verify unchanged. Nothing here has
> entered the outreach pool.

**No contact was made. No Gmail label or draft was created. No procurement-correspondent address
was used.**

---

## 1. Extraction window and CPVs

| | |
|---|---|
| Window | Awards dated on or after **2024-07-26** (24 months); in practice the feed returned 2026 awards |
| Primary CPVs | `45310` `45311` `45312` `45313` `45314` `45315` `45316` `45317` — electrical installation, fire-alarm, access-control, building-automation |
| Secondary (comparison only) | `45330` `45331` `45332` `45333` `45350` — plumbing / HVAC / engineering networks |
| Excluded | Solar — no new solar candidates added, per instruction |
| Method | The flow verified in `prozorro-contractor-extraction-spike.md`: feed with `opt_fields=tenderID,status` → internal UUID → `GET /tenders/{uuid}` → `awards[].suppliers[]` |

---

## 2. Extraction volume

| Metric | Value |
|---|---|
| Feed records scanned | **24,100** |
| Tender details fetched | **15,913** |
| Feed pages paged | 241 |
| Unique contractors extracted | **104** |
| — primary-CPV contractors | 63 |
| — 8-digit ЄДРПОУ legal entities | 68 |
| — **primary CPV + legal entity** | **45** |
| — 10-digit ІПН (ФОП) | 36 |
| **Duplicates against the frozen 24 B0 leads** | **0** |

Deduplication was by **ЄДРПОУ first, domain second**. Zero overlap: ProZorro and the
website-first path B0 used reach almost entirely disjoint populations.

**No ФОП was carried forward.** All 36 appear only in the raw extraction. Per instruction a
10-digit identifier alone is insufficient, and none showed public evidence of a real field crew.

---

## 3. Qualification yield

**30 unique contractors examined in depth**, plus 5 excluded upfront on legal form
(4 municipal/utility, 1 state body) without individual research.

| Outcome | Count |
|---|---|
| **Qualified** — all three dimensions | **4** |
| Researching — verification incomplete | 3 |
| **Unreachable — no public business email** | **21** |
| Rejected — wrong ICP | 6 |
| Rejected — product-only supplier | 1 |

### Rejection reasons in detail

| Reason | Count | Notes |
|---|---|---|
| **No public business email anywhere company-owned** | **21** | 20 have no findable website at all; 1 (ПП «Максвел») has a genuine installation site but publishes no address on it or its contacts page |
| Wrong ICP — municipal / utility / state | 5 | Communal enterprises, an oblenergo, a police-protection directorate |
| Wrong ICP — general contractor | 1 | КВЕД 41.10, organisation of building construction (D1) |
| Product-only supplier | 1 | КВЕД 27.12, manufacture of switchgear; no field-crew evidence on its own site |
| Specialization unconfirmed | 3 | Mixed profiles (general construction / engineering) or brand-to-entity link unproven |

**Contact discovery was the binding constraint, exactly as predicted.** 21 of 30 (**70%**) failed
on it. ProZorro proves the company exists and won installation work last month; it says nothing
about whether they publish an address you may write to.

---

## 4. New electrical-group leads: 4

All four are `electrical_group`. **No other trade was added** — HVAC and engineering-network
tenders were used only as comparison and produced no qualified lead.

| # | Company | Sub-trade | ProZorro evidence | Why it passed |
|---|---|---|---|---|
| 1 | **ПП «ЗАХІДЕНЕРГОМОНТАЖ»** | electrical | Award 24.07.2026 — new 35 kV overhead line for wind-farm capacity output | Own site confirms self-performed electrical installation, horizontal directional drilling and an electrical laboratory; team of 100+ specialists; dated 2024–2025 articles |
| 2 | **ТОВ «ВБ СТРАЖ»** | low_voltage | Award 24.07.2026 — automatic fire-alarm and evacuation-control system installation | Own site confirms self-performed installation of fire alarm, suppression, smoke protection and lightning protection |
| 3 | **ТОВ «НІК»** | electrical | Award 22.07.2026 — automated commercial electricity-metering system | Own site states installation is performed by its own qualified specialists; substation construction and backup power |
| 4 | **ПП «ПОЖМАСТЕР»** | low_voltage | Award 24.07.2026 — automatic fire alarm and fire-notification installation | Own site confirms design, installation and maintenance of fire-alarm, suppression, fire-resistant treatment and lightning protection; operating since 2010 |

Contact-quality note: **all four publish a free mailbox** (`gmail`/`ukr.net`) rather than an
address on their own domain. Each is explicitly published by the company for business use, so per
the standing rule it is recorded as a **deliverability risk**, not a rejection. **None came from
ProZorro's `contactPoint`.**

Concealed-work fit is strong across all four: buried 35 kV cable and directional-drilled runs,
earthing loops, fire-alarm shleifs and suppression pipework above ceilings, metering and
switchgear enclosures.

---

## 5. Verification methodology

Unchanged from B0 — all three dimensions, independently, or the lead does not qualify.

| Dimension | Source used in B0.1 |
|---|---|
| **Identity** | ProZorro `awards[].suppliers[].identifier` — official registry record with legal name and `UA-EDR` code, cross-checked against the company's own site |
| **Specialization** | **Two sources required.** ProZorro supplies dated award evidence that installation work was contracted; the company's **own website** must then confirm it **self-performs** that work rather than supplying product |
| **Public business contact** | **Company-owned website only.** ProZorro cannot satisfy this dimension |

> **The contact rule, applied without exception:** `suppliers[].contactPoint.email` was never used.
> It names an individual acting as procurement correspondent for one tender and is frequently a
> personal address. Every address in this dataset was found independently on the company's own
> site and stored with the page that publishes it.

**A ProZorro award proves work was contracted, not self-performed.** That is why the
product-only manufacturer was rejected despite holding a valid installation-CPV award.

---

## 6. Source-bias warning

**Keep this pool separate from B0's in every analysis until the founder decides otherwise. The
two carry different, non-neutral biases.**

- **B0.1 selects for firms that bid for public work.** They have tender-administration capacity,
  tolerate state paperwork, and serve budget-funded buyers. That is a real slice of the market —
  and it is not the market. Firms working purely for private developers are invisible here.
- **B0 selected for firms with a maintained website and a published address.** Also a slice, also
  not the market.
- **The 0% overlap is itself the evidence.** 45 primary legal entities, zero shared with B0's 24.
  Two sourcing paths, two disjoint populations. Neither is representative; pooling them without
  saying so would manufacture a false sense of coverage.
- **Public-sector award work may differ in evidence practice** from private commercial work —
  state acceptance procedures are more prescribed. The concealed-work pain may present
  differently, which is a question to ask, not an assumption to carry.

> **Extraction yield is not market demand.** 4 qualified from 30 examined measures how many
> ProZorro-derived contractors publish a reachable business address. It says nothing about whether
> any of them wants this product. The same caution recorded for the ASEU result applies here:
> **source accessibility and contact completeness, not validated demand.**

---

## 7. Comparison with the original B0 sourcing path

| | **B0** (website-first) | **B0.1** (ProZorro-first) |
|---|---|---|
| Entry point | KVED catalogues, association directory, job boards | Official procurement awards |
| Examined in depth | 62 | 30 |
| Qualified | 24 (39%) | 4 (13%) |
| Identity provenance | Company-published requisites + aggregator ЄДРПОУ cross-check | **Official registry record** — stronger |
| Dated activity | Weak — the top attribute gap across B0's 24 | **Strong — every lead has a dated award, most within the last month** |
| Failure mode | 13% no email, 19% site unloadable | **70% no public email** (mostly no website at all) |
| Trade reach | 6 groups | electrical_group only |
| Cost per qualified lead | ~2.6 examined | ~7.5 examined |

**Read together:** ProZorro is the **better identity and activity source** and the **worse contact
source**. B0's approach found companies that market themselves; B0.1 found companies that win
work. The overlap is zero, and the second group is largely unreachable by email.

The dated-award evidence is genuinely valuable — it fixes B0's weakest attribute. All four new
leads carry an award from within the last month, against B0's 24 where dated activity was often
absent or over a year old.

---

## 8. Recommendation

**Merge the four qualified B0.1 leads into the outreach pool — but keep the two pools labelled
and reported separately.**

Reasons to merge:

- All four passed the identical three-dimension gate. None is padding.
- They are `electrical_group`, the bucket that finished **5 below floor** in B0. Merging brings
  it from 11 to **15**, inside touching distance of the 16–18 range.
- Their dated award evidence is the strongest personalization material in either pool.
- Zero duplication risk — verified by ЄДРПОУ and domain.

Reasons to keep the pools labelled:

- Different sampling biases (§6). A blended reply rate across them would be uninterpretable.
- `channel_track` should record the sourcing path so per-source reply rates stay separable — this
  is exactly what §B.0.7's attribution rule exists for.

**Recommendation against a larger B0.1 pass right now.** At 70% contact failure, another
30 contractors would be expected to yield ~4 more leads for a similar research cost, and would
deepen the public-sector bias. Better next moves: ASEU pages 2–6 (67% proven yield), or finding an
electrical/HVAC association catalogue — still the highest-leverage unknown.

**If the founder approves the merge**, the four records move from the B0.1 store into the main
dataset with `channel_track` marking their origin, and the top 10 is re-ranked at that point —
**not before**. The frozen B0 top 10 stands until then.

---

## 9. Private dataset location

```
~/Documents/AktFlow-private/b0.1-prozorro-enrichment-2026-07-26/
```

`b0.1-prozorro.db` (35 rows), `candidates.csv`, `rejected.csv`, `SHA256SUMS.txt`, `README.txt`.
All three data files checksum-verified at creation.

```bash
cd ~/Documents/AktFlow-private/b0.1-prozorro-enrichment-2026-07-26 && shasum -a 256 -c SHA256SUMS.txt
```

**The frozen B0 dataset at `~/Documents/AktFlow-private/b0-outreach-2026-07-26/` was not modified**
— its four checksums verify unchanged after this pass.

No email address, phone number, CSV or database file appears in this tracked document or anywhere
in the repository.
