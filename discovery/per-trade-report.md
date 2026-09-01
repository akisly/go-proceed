# Per-trade research report — B0

**Date:** 26.07.2026 · **Nothing has been sent. No contact has been made.**

These are **lead-verification yield counts, not market signal.** They measure how many companies
could be identified and verified from public sources — **nothing here is evidence of demand or
lack of demand.** Results are reported **separately by trade**; there is deliberately **no
aggregate row** and **no blended metric** across trades.

---

## Headline

| | |
|---|---|
| Candidate records surfaced from verified sources | **~130 named companies** (58 ASEU catalogue entries, ~58 KVED rows carrying own-site URLs, 14 work.ua employers) |
| **Examined in depth** | **62** |
| **Qualified** | **24** |
| Disqualified | **10** |
| Unreachable (D5, recoverable) | **8** |
| Researching (verification incomplete) | **20** |

**24 of 30 qualified. Short by 6.** All 24 carry `verification_complete = 1` — identity,
specialization and public business contact each confirmed on a page that supports that specific
claim, with the evidence note stored. Verified by query: zero qualified leads have an incomplete
dimension.

---

## Formal stop condition

The approved stop condition was: **30 qualified**, or **≥60 examined in depth with all approved
high-yield sources materially worked** and a documented reason why more cannot be obtained
without lowering standards.

**Condition 2 is satisfied.** 62 examined (≥60). All five ordered sources were worked:

| # | Source | Materially worked? | Outcome |
|---|---|---|---|
| 1 | ASEU installer catalogue | **yes** | 58 entries enumerated, 9 profiles opened, **6 qualified** |
| 2 | ProZorro open API | **yes — to its accessible limit** | Search API works (10,000 electrical-works tenders). **Yield: 0 leads.** Blocker documented below |
| 3 | work.ua dated ПТО/ВТВ vacancies | **yes** | 14 dated vacancies captured, 2 employers pursued to registry level, **0 qualified** |
| 4 | Revisit blocked candidates | **yes** | АЛЬЯНС-БЕЗПЕКА **converted to qualified**; Антіфаєр contacts page 404 |
| 5 | Expand company-owned site searches | **yes** | The bulk of the 62 |

### Why the remaining 6 cannot be obtained without lowering standards

1. **ProZorro cannot yield supplier identities through its public surfaces.** The POST search API
   returns only the **procuring entity** — the hospital or municipality buying the work, not the
   contractor performing it. The contractor lives in `awards[].suppliers[]` on the tender detail,
   which needs the openprocurement internal UUID. `prozorro.gov.ua/api/tenders/{tenderID}` returns
   **404**, and the openprocurement feed **ignores `?tenderID=`**, returning its chronological feed
   from February 2015 instead. Mapping tenderID → UUID would require paging the entire feed since
   2015. This was the highest-expected-yield source and it produced **zero** leads.
2. **work.ua employers mostly have no findable website.** A dated ВТВ vacancy is an excellent
   signal, but the employer must still be verifiable on a company-owned page. Of the two pursued:
   ТОВ «Сігнум Газ Груп» (ЄДРПОУ 40075878) has no site and its registered activity is **wholesale
   fuel trading**, not installation; ТОВ «Прогрін» could not be located at all.
3. **The binding constraint is published contact, not candidate supply.** KVED catalogues alone
   list ~12,000 companies. **8 of 62 examined (13%) publish no readable business email**, and a
   further **12 sites could not be loaded at all** (expired/self-signed/mismatched TLS, 403, 404,
   500, DNS failure) — 19% of everything examined.

Closing the last 6 would require guessing addresses, using personal contacts, or admitting
companies whose specialization could not be verified. All three are forbidden, so the batch stops
at 24.

---

## Source yield

```
source → surfaced → examined → qualified → no email → stale → wrong ICP
```

| Source | Surfaced | Examined | Qualified | No email | Stale | Wrong ICP | Site unloadable |
|---|---|---|---|---|---|---|---|
| **ASEU installer catalogue** (official association directory) | 58 | 9 | **6** | 2 | 0 | 1 | 0 |
| **ua-region KVED catalogues** (aggregator → own sites) | ~58 with URLs | 49 | **17** | 6 | 2 | 9 | 12 |
| **work.ua** dated ПТО/ВТВ vacancies | 14 | 2 | **0** | 1 | 0 | 1 | 0 |
| **ProZorro open API** | 10,000 tenders | 2 sampled | **0** | — | — | — | supplier data unreachable |
| **Direct web search** | ~6 | 2 | **1** | 0 | 0 | 1 | 0 |

**ASEU is the standout: a 67% qualification rate.** It publishes company name, region, website,
email and phone in one verified place, and membership carries a documents-checked marker. The
association catalogue outperformed every other source by a wide margin — including the vendor
installer directories the spec predicted would be the highest-precision class, which produced
nothing.

### Disqualification reasons across all 62

| Reason | Count |
|---|---|
| **D5** — no readable public business email (recoverable, 90-day recheck) | 8 |
| **D3** — retail/wholesale/manufacturing/provider, no installation delivery | 6 |
| **D6** — inactive, last dated content >24 months | 2 |
| **D2** — no visible field-work process | 1 |
| **D1** — developer of its own projects, not a subcontractor | 1 |
| Verification incomplete → held at `researching` | 20 |

---

## Qualification yield by trade

| Bucket | Target range | Qualified | In range? | Deviation |
|---|---|---|---|---|
| `electrical_group` | 16–18 | **11** | ✗ | **−5** below floor |
| `hvac` | 3–5 | **2** | ✗ | **−1** below floor |
| `plumbing` | 2–4 | **1** | ✗ | **−1** below floor |
| `solar` | 2–4 | **8** | ✗ | **+4** above ceiling |
| `maintenance` | 1–3 | **2** | ✓ **in range** | — |
| **Total** | **30** | **24** | ✗ | **−6** |

**Trade groups researched: 6** (electrical, low-voltage, HVAC, plumbing, solar, maintenance) —
the ≥4 requirement is satisfied.

### The solar overshoot is documented backfill, not padding

`solar` sits **4 above its ceiling**. This is the sanctioned backfill mechanism: three buckets
fell short, and the approved rule is to fill remaining places with the strongest verified
candidates from another segment. Every solar lead passed the identical three-dimension standard —
none was admitted to reach a number. The overshoot exists because **ASEU is the only source in
the entire registry that publishes verified contact data at scale**, so the segment it serves was
the cheapest to qualify honestly. The shortfall in electrical is a source-access problem, not an
ICP or demand problem.

---

## Top 10 qualified leads

Ranked by strength of job fit and signal. **`fit_score` is a coarse ordering field and is not
quoted as a metric** (D-2); all 24 are band A with `confidence_score = 100`.

| # | Company | Trade | Why it ranks here |
|---|---|---|---|
| 1 | **ТОВ «Новітні Енергетичні Програми»** | electrical | **Freshest dated evidence in the whole batch**: PS 35 kV «Тлумач»/«Тисмениця» reconstruction published **26.06.2026** and a 35 kV cable line in Artsyz for a wind station **18.06.2026** — one month old. Buried 35 kV cable is the cleanest instance of the shared job. Own electricians on staff |
| 2 | **ІБК «Енергокапітал»** | electrical | Cable 0.4–110 kV in pipe channels and trenches; 30 installers in-house. Strongest concealed-work profile. Department mailbox on own domain |
| 3 | **ТОВ «Укравтономгаз»** | plumbing | Buried LPG pipework and tanks — the most expensive concealment to reverse in the batch. Dated signal: 15.04.2025 webinar by the named director. Own-domain address |
| 4 | **ТОВ «Структум»** | electrical | Underground cable lines, substations, railway contact network, emergency recovery works. Two own-domain mailboxes. Size (300+) above the ICP band — recorded, not hidden |
| 5 | **Компанія «РЕЙДЕН»** | electrical | Earthing loops are buried by definition — cross-section, depth and weld quality unverifiable after backfill. 17 years, 1,500+ projects, `info@` own domain |
| 6 | **НВП «Інтеренерго»** | maintenance | Dated 2024–2025 projects incl. a 19.2 MW gas-piston station, with named in-house installation personnel. Own-domain address |
| 7 | **Протипожежна компанія «Брандмауер»** | low_voltage | 500 designs / 300 installations per year, DSNS-accredited, clients incl. Coca-Cola and WOG. Own-domain address. Identity rests on a domain redirect — flagged |
| 8 | **ТОВ «Авенстон»** | solar | Commercial/industrial solar **general contracting** — the only solar lead whose model puts it under external acceptance, which is where the thesis lives. ASEU-verified |
| 9 | **ТОВ «Пожежний Захист»** | low_voltage | Suppression pipework, aspiration, smoke protection and fire-resistant cable treatment — all concealed. Dated licence (ДСНС order №621, 14.09.2021). Free mailbox flagged |
| 10 | **REC SECURITY LLC** | low_voltage | Structured cabling, electrical wiring and lightning protection — concealed in structure and in ground. ISO 9001:2015 / 23932:2018 certificates dated 2024–2025. Own-domain address |

Immediately below: **ТОВ «Промавтоматика Вінниця»** (400+ projects, 20 MW), **Блок Майстер
Україна** (175 MW built, own installation team), **ТОВ «Електропівденмонтаж»** (123 specialists —
held back by a free mailbox and no dated activity; **critical-infrastructure portfolio, so
§B.0.6 geodata stripping applies to any future artefact**).

---

## Public-contact gaps

**8 of 62 examined (13%) publish no readable public business email.** All are `unreachable` with
a 90-day `recheck_after` (ER-5b), not permanently burned — the ICP judgment was never the problem.
**No address was guessed, inferred or pattern-matched.**

| Company | Gap |
|---|---|
| ВЕНБЕСТ, ТОВ «Платінум Електрик» | Address obfuscated by Cloudflare email-protection — unreadable |
| Київ Клімат, ТОВ «Соленсі», ТОВ «КВК Електрик», ТОВ «АНІКО» | Phones only; no address published |
| ТОВ «Антіфаєр» | Phone, Viber and Telegram only; `/kontakty/` returns 404 |
| Rivne Solar Group | Only a personal address (`имя+рік народження@gmail.com`) — a private contact, excluded |

**Free-mail addresses were not treated as automatic rejections.** Where a company explicitly
publishes one for business use, it is recorded with a deliverability-risk note, per instruction.
**8 of the 24 qualified leads (33%) use a free mailbox** (`@ukr.net`, `@gmail.com`, `@i.ua`).
Contact-type split across the 24: 14 department, 9 general, 1 personal-business.

That 33% is a live risk for the ER-8c stop rule: consumer-Gmail-to-consumer-domain cold mail is
filtered aggressively, and a bounce is `R9` — never a prompt to guess a replacement.

**A further 12 candidate sites (19% of everything examined) could not be loaded at all** — expired,
self-signed or mismatched TLS certificates, 403/404/500 responses, and dead DNS. These are held at
`researching` with the exact technical reason, not rejected on ICP.

---

## Results by trade

### `electrical_group` — 11 of 16–18

Eleven qualified: НЕП, ІБК «Енергокапітал», Структум, РЕЙДЕН, Брандмауер, Пожежний Захист,
REC Security, Проектлінк, ШІЛД-ФАЄР, Електропівденмонтаж, АЛЬЯНС-БЕЗПЕКА.

**The job needs no translation here.** Cable in screed and pipe channels, buried earthing loops,
underground communication lines, fire-detection shleifs and suppression pipework above ceilings —
all closed behind structure, all unverifiable afterwards without excavation or demolition.

### `hvac` — 2 of 3–5

Берком (duct manufacture *and* installation, dated portfolio to 17.04.2025) and Здоровий клімат
(200+ commissioned objects, site-video documentation).

**Transfers cleanly:** ducts above suspended ceilings and in shafts. **Trade-specific:** closing
leans on aerodynamic testing and balancing protocols rather than hidden-work acts alone — a demo
built on an electrical scenario would need that named differently before it reads as their process.

### `plumbing` — 1 of 2–4

Укравтономгаз only. **Transfers strongly:** buried pipework costs more to expose than a ceiling.
**Trade-specific:** a statutory gas inspection regime already prescribes part of the process.

Two further candidates (АНІКО, Київська Бурова Компанія) match the job but failed on contact or
activity, and two pipeline sites could not be loaded.

### `solar` — 8 of 2–4 (over ceiling, documented backfill)

Правильне Електроживлення, Авенстон, УТЕМ СОЛАР, Промавтоматика Вінниця, Блок Майстер, DELA
ENERGY, Променергомонтаж, Академ Інвест.

**Transfers:** roof-mounting nodes and cable runs are closed by roofing details. **Trade-specific:**
acceptance rests on commissioning protocols and capacity tests rather than КБ-2в. Авенстон is the
exception worth noting — as an EPC general contractor it faces genuine external acceptance.

### `maintenance` — 2 of 1–3 ✓ in range

Інтеренерго (cogeneration/biogas, dated 2024–25 projects) and Агроремсервісприлад-М (fuel modules
and weighing systems; **underground tanks and pipework** — arguably the strongest concealment
instance outside plumbing, with a fuel-regulator inspection attached).

---

## Is any adjacent segment showing stronger pain than electrical?

**Plumbing/engineering networks and the fuel-infrastructure end of maintenance both look
structurally stronger** — buried assets cost far more to expose than a ceiling, and both carry a
statutory inspector as an additional acceptance counterparty.

**This is a hypothesis from desk research, not a finding.** No operator has said it. n is tiny,
doc 30 §1 forbids treating a founder inference as validated, and **nothing in this report measures
demand.** It is recorded as the question to put to the first plumbing and maintenance respondents.

---

## Deviations from the plan, stated explicitly

1. **Three buckets below floor** (electrical −5, hvac −1, plumbing −1); **solar +4 above ceiling**
   as documented backfill; maintenance in range. Cause: verification standard held, source access
   constrained. **No lead was admitted to fill a bucket.**
2. **ProZorro yielded zero leads** despite being accessible and the highest-expected-yield source.
   Exact blocker recorded above.
3. **Vendor installer directories (Tier 2) yielded zero leads.** Ajax Systems — rated "likely
   rich" by the spec — exposes only a partner-portal login. The spec's "highest ICP precision"
   claim was not borne out.
4. **Three of five Tier 1 registry front-ends remain unusable** (Clarity paywalled, YouControl
   requires registration, Opendatabot 403). Identity verification rests on company-published legal
   requisites cross-checked against catalogue ЄДРПОУ, recorded per lead.
5. **One aggregator/company ЄДРПОУ conflict found and resolved in favour of the company.**
   ua-region lists 38348416 for АЛЬЯНС-БЕЗПЕКА; the company's own contacts page publishes
   **44564041**. The company-owned source was taken as authoritative and the conflict recorded —
   a concrete demonstration of why aggregators are discovery-only.

---

## What would close the remaining 6

1. **Work ASEU pages 2–6** (~61 more installer profiles). Highest proven yield at 67%, though it
   would deepen the solar overshoot unless restricted to firms with commercial/industrial EPC
   profiles.
2. **Find an equivalent association catalogue for electrical or HVAC.** None with a public member
   list was found; none was invented. This is the single highest-leverage unknown.
3. **Retry the 12 unloadable sites** from a normal browser — TLS and 403 blocks are automation
   artefacts, not evidence about the companies.
4. **Check contacts pages for the 8 D5 leads** before their 90-day recheck; АЛЬЯНС-БЕЗПЕКА
   converted exactly this way.
