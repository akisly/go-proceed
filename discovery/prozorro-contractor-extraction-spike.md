# ProZorro contractor-extraction spike

**Run 26.07.2026** · Public APIs only, no authentication, no paid service, no scraping behind a
login · **Frozen B0 dataset untouched; no contractor added to it.**

> **Verdict: the original B0 conclusion was WRONG.** ProZorro *can* yield awarded contractor
> identities through public APIs, reproducibly. The earlier claim rested on two false premises —
> that the tenderID could not be mapped to the internal UUID, and that supplier data was
> unreachable. Both are refuted below.

---

## 1. What the B0 handoff claimed, and what is actually true

| B0 claim | Status | Reality |
|---|---|---|
| "The search API exposes only the procuring entity" | **correct** | Confirmed. Its response carries only `procuringEntity`, `tenderID`, `title`, `value`, `status` — no `id`, no awards |
| "tenderID cannot be mapped to the internal UUID without paging the entire feed since 2015" | **WRONG** | The feed accepts `opt_fields=tenderID,status`, and **always returns `id` alongside**. It also accepts a timestamp `offset`, so any date window can be entered directly. No 2015 paging required |
| "Supplier data is unreachable" | **WRONG** | `awards[].suppliers[]` on the full tender object carries `legalName` and a `UA-EDR` identifier. **25 of 26 sampled tenders yielded a contractor** |

The failed probes in B0 were real but incomplete: I tested *direct* tenderID resolution
(`/tenders/{tenderID}` → 404 on every host) and concluded no mapping existed, without testing
`opt_fields` on the feed. That was a premature negative.

---

## 2. Endpoints and request shapes tested

### Worked

```
GET https://public.api.openprocurement.org/api/2.5/tenders
      ?descending=1&opt_fields=tenderID,status[&offset=<ISO-timestamp>]
→ 100 items/page: {dateModified, id (UUID), tenderID, status}, plus next_page.offset
```

```
GET https://public.api.openprocurement.org/api/2.5/tenders/{uuid}
→ full tender: tenderID, status, procurementMethodType, procuringEntity,
  classification, items[].classification, awards[], contracts[]
```

```
GET https://public.api.openprocurement.org/api/2.5/contracts[?descending=1]
GET https://public.api.openprocurement.org/api/2.5/contracts/{contract_uuid}
→ contract object incl. suppliers[] {identifier.legalName, identifier.id}, tender_id, dateSigned
```

```
POST https://prozorro.gov.ua/api/search/tenders     Content-Type: application/json
     {"cpv":["45310000-3"],"status":["complete"],"page":1}
→ {page, per_page, total: 10000, data[]} — buyer-side only, page must be >= 1
```

### Failed

| Endpoint | Result |
|---|---|
| `public.api.openprocurement.org/api/2.5/tenders/{tenderID}` | 404 — UUID only |
| `api.openprocurement.org/…/{tenderID}`, `public-api.prozorro.gov.ua/…/{tenderID}` | 404 |
| `prozorro.gov.ua/api/tenders/{tenderID}`, `/api/tender/{tenderID}` | 404 |
| `prozorro.gov.ua/api/search/tenders/{tenderID}` | 404 |
| `search.prozorro.gov.ua/api/tenders/{tenderID}` | no DNS |
| `public.api.openprocurement.org/…/tenders?tenderID=UA-…` | **200 but the parameter is ignored** — returns the unfiltered chronological feed from Feb 2015. This is what produced the original false negative |
| `prozorro.gov.ua/tender/{tenderID}` (HTML) | 200, but SPA — no UUID in the initial HTML |

---

## 3. Method used

1. Page `GET /tenders?descending=1&opt_fields=tenderID,status` — newest first.
2. Keep entries with `status ∈ {complete, active.awarded}`; each carries its `id` (UUID).
3. `GET /tenders/{uuid}` for each (8 concurrent workers, retry on 429).
4. Keep tenders whose tender-level **or item-level** `classification.id` starts with an
   installation CPV prefix (45310/45311/45312/45330/45331/45332/45231/…).
5. Extract active `awards[].suppliers[]` and, where present, `contracts[].suppliers[]`.

**Item-level CPV matters:** on `priceQuotation` tenders the tender-level `classification` is
`None` and the CPV lives only in `items[]`. Filtering on tender-level classification alone
silently drops them.

---

## 4. Results — 26 tenders tested

| # | tenderID | Type | Status | CPV | Awards | Contracts | Identifier | Email in API |
|---|---|---|---|---|---|---|---|---|
| 1 | UA-2026-07-15-006313-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 3495304158 | yes |
| 2 | UA-2026-06-25-011108-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 3072712804 | yes |
| 3 | UA-2026-06-29-010864-a | aboveThreshold | active.awarded | 45231000-5 | 1 | 0 | 43127504 | yes |
| 4 | UA-2026-07-14-012217-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 46150714 | yes |
| 5 | UA-2026-07-14-011738-a | aboveThreshold | active.awarded | 45330000-9 | 1 | 0 | 45394541 | yes |
| 6 | UA-2026-07-16-010565-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 2118300802 | yes |
| 7 | UA-2026-07-24-009281-a | reporting | complete | 45330000-9 | 1 | 0 | 36625759 | no |
| 8 | UA-2026-06-28-000010-a | aboveThreshold | complete | 45310000-3 | 1 | 0 | 43192573 | yes |
| 9 | UA-2026-07-09-010477-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 31305795 | yes |
| 10 | UA-2026-07-13-001446-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 3348303052 | yes |
| 11 | UA-2026-07-24-010436-a | reporting | complete | 45310000-3 | 1 | 0 | 31963973 | no |
| 12 | UA-2026-06-25-012515-a | aboveThreshold | complete | 45310000-3 | 1 | 0 | 44476055 | yes |
| 13 | UA-2026-06-19-010837-a | aboveThreshold | complete | 45310000-3 | 1 | 0 | 44476055 | yes |
| 14 | UA-2026-07-07-006313-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 38717296 | yes |
| 15 | UA-2026-07-24-009415-a | reporting | complete | 45332200-5 | 1 | 0 | 2896413518 | no |
| 16 | UA-2026-07-24-008642-a | reporting | complete | 45310000-3 | 1 | 0 | 40877796 | no |
| 17 | UA-2026-07-24-008607-a | reporting | complete | 45231000-5 | 1 | 0 | 2479809596 | no |
| 18 | UA-2026-07-24-008456-a | reporting | complete | 45330000-9 | 1 | 0 | 3282204037 | no |
| 19 | UA-2026-07-24-008390-a | reporting | complete | 45331221-1 | 1 | 0 | 3117213211 | no |
| 20 | UA-2026-07-22-011812-a | reporting | complete | 45330000-9 | 1 | 0 | 2716310756 | no |
| 21 | UA-2026-07-14-000074-a | aboveThreshold | active.awarded | 45330000-9 | 1 | 0 | 3206917530 | yes |
| 22 | UA-2026-07-08-002864-a | aboveThreshold | active.awarded | 45310000-3 | 1 | 0 | 40936678 | yes |
| 23 | UA-2026-06-24-002382-a | aboveThreshold | complete | 45310000-3 | 1 | 0 | 42854587 | yes |
| 24 | UA-2026-07-24-008972-a | reporting | complete | 45231000-5 | 1 | 0 | 45342931 | yes |
| 25 | UA-2026-06-10-003081-a | aboveThreshold | active.awarded | 45310000-3 | **0** | 0 | — | — |
| 26 | UA-2026-07-24-008683-a | reporting | complete | 45330000-9 | 1 | 0 | 41134331 | yes |

Buyer name, buyer EDRPOU, work description, award value and award date were captured for all 26
and are held in the untracked spike output; they are omitted here for brevity, not because they
were unavailable.

---

## 5. Yield

| Metric | Value |
|---|---|
| Tenders tested | **26** |
| Contractor identity extracted | **25 (96%)** |
| Unique identifiers after dedup | **24** |
| Legal entities (8-digit ЄДРПОУ) | **14** |
| Sole traders (10-digit ІПН, ФОП) | **10** |
| Supplier email present in the API | 17 of 25 (68%) |
| Extraction via `awards[].suppliers[]` | **25** |
| Extraction via `contracts[].suppliers[]` (inside the tender object) | **0** |

**The single miss** (#25) is an `active.awarded` tender whose award had not yet reached `active`
status — a timing artefact, not a data gap. It would resolve on a later pass.

**Dedup by identifier is essential and was exercised:** ЄДРПОУ `44476055` won two separate
tenders (#12, #13) and collapses to one contractor. Name-only dedup would also have failed
generally — `legalName` varies in case and quoting between records.

---

## 6. Answers to the spike questions

**1. Can tenderID be resolved to the internal UUID without paging the whole feed?**
**Yes.** `opt_fields=tenderID,status` returns `id` in the same record, and `offset` accepts a
timestamp so any date window can be entered directly. For a targeted lookup, the tenderID encodes
its creation date (`UA-YYYY-MM-DD-…`), so the feed can be entered near that date rather than at
2015.

**2. Does the search result already expose an internal id or usable reference?**
**No internal id.** The ProZorro search API returns only `tenderID` plus buyer-side fields. It is
useful for *targeting* by CPV (10,000 hits for 45310000-3) but must be paired with the feed for
resolution. The feed alone is sufficient and simpler.

**3. Can the full tender object be fetched reproducibly?**
**Yes.** `GET /tenders/{uuid}` returned a complete object on every attempt across 26 tenders, no
auth, no rate-limit rejection at 8 concurrent workers.

**4. Are suppliers in `awards[]`, `contracts[]`, or both?**
**`awards[].suppliers[]` is the reliable path — 25/25.** Inside the tender object,
`contracts[]` entries carry `awardID`, `contractID`, `value`, `status` but **no `suppliers` key at
all** (verified explicitly). Supplier data *is* present on the standalone
`GET /contracts/{contract_uuid}` resource, which is a separate feed. **Use awards; treat the
contracts endpoint as a cross-check, not a primary path.**

**5. What percentage yields a usable legal name and identifier?**
**96%** (25/26). All 25 carry `scheme: "UA-EDR"` with a legal name.

**6. Differences by procedure status or tender type?**
Yes, and it matters:

| Type | Sampled | Contractor | Email in API |
|---|---|---|---|
| `aboveThreshold` | 16 | 15/16 | **15/16 (94%)** |
| `reporting` (звіт про укладений договір) | 10 | 10/10 | **3/10 (30%)** |

`aboveThreshold` is the richer source: competitive procedures carry fuller supplier records.
`reporting` entries are direct-contract notifications — reliable for identity, thin on contact.
`priceQuotation` needs item-level CPV extraction or it is silently skipped.

**7. Can this be automated within reasonable API limits?**
**Yes.** 8 concurrent workers with a 0.15 s pacing delay produced no 429s across several hundred
requests. Retry-on-429 with backoff is implemented and never triggered. The cost is one feed page
per 100 tenders plus one detail call per candidate.

**8. Does ProZorro provide a public business email for the contractor?**
**It provides *an* email in 68% of cases — but it must NOT be used as the outreach address.**
`awards[].suppliers[].contactPoint` carries `{name, email, telephone}` where `name` is a **named
individual** (e.g. a person acting as procurement correspondent). This is a tender-correspondence
contact submitted for a specific procurement, frequently a personal address, and using it for cold
outreach would be exactly the private-personal-contact failure the standing rules forbid.

**The public-business-contact dimension must still be verified independently on the company's own
website.** ProZorro satisfies identity, specialization and dated activity — not contact.

---

## 7. Limitations and reproducibility notes

- **The `?tenderID=` parameter is silently ignored** rather than rejected. It returns HTTP 200 and
  an unrelated feed. This is the trap that produced the original false negative — a 200 that looks
  like a filtered answer.
- **`contracts[]` inside a tender has no `suppliers` key.** Code that reads only that path will
  extract nothing and appear to prove ProZorro is useless.
- **Tender-level `classification` can be `None`** on `priceQuotation`; CPV must be read from
  `items[].classification` as well.
- **10 of 24 unique identifiers are 10-digit ІПН — ФОП sole traders, not companies.** D7 ("sole
  trader with no crew") applies unless crew evidence is found separately. Treating identifier
  length as a proxy for entity type is necessary before ICP scoring.
- **The feed orders by `dateModified`, not creation.** A tender re-touched later moves forward, so
  a date window must be generous.
- **Buyer ≠ contractor.** The buyer sits in `procuringEntity`; the contractor only in
  `awards[].suppliers[]`. Never conflate them.
- **A ProZorro award proves work was contracted, not that the firm self-performs it.** Product-only
  suppliers appear under installation CPVs. Field-work evidence must still be confirmed on the
  company's own site before `specialization_verified` is set.

---

## 8. Proposed production extraction flow

```
1. Page  GET /tenders?descending=1&opt_fields=tenderID,status
         with offset windowing over the target period
2. Keep  status in {complete, active.awarded}
3. Fetch GET /tenders/{uuid}            (8 workers, 429-backoff)
4. Filter CPV from classification.id OR items[].classification.id
5. Extract awards[] where status == active → suppliers[]
6. Record legalName, identifier.id, identifier.scheme, award date, value,
          CPV, work description, buyer, endpoint URL
7. Dedup  by identifier.id  (never by name)
8. Split  8-digit ЄДРПОУ (legal entity) vs 10-digit ІПН (ФОП → D7 check)
9. Enrich OUTSIDE ProZorro: find the company's own website, verify
          specialization (self-performed field work) and a published
          public business email on that site
10. Only then run the existing D-3 three-dimension gate
```

Steps 1–8 give **identity + specialization signal + dated activity** from an official registry —
stronger provenance than the aggregator cross-checks B0 had to fall back on. Step 9 is unchanged
and still mandatory.

---

## 9. Recommendation

**Reopen ProZorro as a lead source — as a separate, explicitly scoped B0.1 enrichment pass.**

Reasons:

- **96% identity yield** against 13% no-contact and 19% unloadable-site failure rates in the
  website-first approach B0 used.
- It **directly addresses the electrical shortfall.** CPV 45310000-3 alone has 10,000 tenders;
  `electrical_group` finished 5 below floor purely because no electrical equivalent of the ASEU
  catalogue was found.
- It **upgrades identity provenance** from aggregator cross-check to official registry record —
  and would have caught the ЄДРПОУ conflict B0 found by luck.
- It supplies **dated activity for free** (award dates), the weakest attribute across the current
  24 qualified leads.

Honest limits on that recommendation:

- It does **not** solve contact discovery, which was B0's actual binding constraint. Every
  ProZorro contractor still needs a company-owned site with a published address, and the
  13%/19% failure rates will reappear at step 9.
- **~40% of contractors are ФОП** and many will fail D7.
- Public-sector award history is a **sampling bias**: it selects firms that bid for state work,
  which is not the whole market and skews toward those with tender-administration capacity.
  That is a different bias from B0's "has a good website" bias — not a neutral one. Findings from
  the two pools should not be pooled without noting it.

**Not started.** No contractor from this spike has been added to the frozen dataset.

---

## 10. Output location

The 26-tender raw result set and the deduplicated candidate list are **untracked**:

```
~/Documents/AktFlow-private/prozorro-spike-candidates-2026-07-26/candidates.txt
```

24 unique contractors — **company name and identifier only**, with entity type and tender counts.
It contains **no email addresses**. The frozen B0 dataset at
`~/Documents/AktFlow-private/b0-outreach-2026-07-26/` was **not modified**.
