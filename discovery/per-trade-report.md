# Per-trade research report — B0 batch 1

**Date:** 26.07.2026 · **Status:** research complete for this pass · **Nothing has been sent.**

These are **research-stage counts, not response rates.** No email exists, no contact has been
made, and no reply data exists. Results are reported **separately by trade**; there is
deliberately **no aggregate row** and **no blended metric** across trades.

---

## Headline: verified shortfall, not a complete batch

**6 of 30 qualified.** The batch is **short by 24**. Per founder instruction, the shortfall is
reported rather than filled by lowering standards or padding buckets.

| Bucket | Target range | Qualified | In range? | Gap |
|---|---|---|---|---|
| `electrical_group` | 16–18 | **3** | ✗ | −13 |
| `hvac` | 3–5 | **1** | ✗ | −2 |
| `plumbing` | 2–4 | **1** | ✗ | −1 |
| `solar` | 2–4 | **0** | ✗ | −2 |
| `maintenance` | 1–3 | **1** | ✓ **in range** | — |
| **Total** | **30** | **6** | ✗ | **−24** |

**Trade groups researched: 6** (electrical, low-voltage, HVAC, plumbing, solar, maintenance) —
satisfies the ≥4 requirement.

**No backfill was performed.** Backfill moves places between buckets; with every bucket short
there was nothing to move. Padding `electrical_group` with weak companies would have breached
the explicit instruction not to.

---

## Funnel for this pass

| Stage | Count |
|---|---|
| Candidates surfaced from verified sources | 40+ (KVED catalogue rows and ASEU catalogue entries with own-site URLs) |
| **Examined in depth** (site fetched, claims checked) | **15** |
| **Qualified** (all three dimensions verified + live signal) | **6** |
| Not qualified | **9** |

### Why the 9 failed

| Reason | Count | Companies |
|---|---|---|
| **D5 — no readable public business email** | 3 | ВЕНБЕСТ (address obfuscated by Cloudflare, unreadable), Київ Клімат (phones and prices only), АЛЬЯНС-БЕЗПЕКА (none on main page) |
| **D6 — inactive, last dated content >24 months** | 2 | РС-Безпека (25.03.2019), АРТ-КОМФОРТ (18.10.2019 / 22.12.2018) |
| **D1 — developer of its own projects, not a subcontractor** | 1 | Будівельний Альянс |
| **Verification incomplete — held at `researching`** | 3 | Омега Клімат (no dated activity, © 2017), Unisolar (brand/legal-entity link unproven; contact on a different domain; portfolio Moldova-weighted), ДНІПРО-СГЕМ (site serves no content) |

**All 6 qualified leads carry `verification_complete = 1`** — identity, specialization and public
contact each confirmed on a page that supports that specific claim, with the evidence note
stored. `confidence_score = 100` and `fit_band = A` for all six. Domains are unique
(`uniq -d` returns empty).

---

## Results by trade

### `electrical_group` — 3 of 16–18

The largest shortfall, and the primary wedge. Three qualified:

- **ІБК «Енергокапітал»** (Київ) — cable networks 0.4–110 kV, cable in pipe channels,
  substations, 30 installers on staff. The strongest concealed-work profile in the batch.
- **ТОВ «Електропівденмонтаж»** (Харків) — electrical installation, КВПіА, relay protection,
  123 specialists, 26 years.
- **ТОВ «ШІЛД-ФАЄР»** (Київ, low-voltage) — fire alarm, suppression, smoke control installation.

**The job in this trade is unambiguous.** Cable in screed and in pipe channels, secondary
wiring, КВПіА loops and fire-detection shleifs are all closed behind structure. Depth of
laying, cable marking and joint condition cannot be re-verified after backfill without
excavation. This is the segment where the shared job needs no translation.

**Why only three:** the constraint was not candidate supply — KVED 43.21 alone lists 3,822
companies. It was that most small electrical contractors publish a phone and a Viber number
rather than a business email, or their sites have not been updated since before 2022.

### `hvac` — 1 of 3–5

- **ТОВ «ВКФ «Берком»** (Львів) — ventilation duct manufacture *and* installation, portfolio of
  15+ installed systems (extract hoods, roof fans, smoke removal).

**What transfers cleanly:** ducts, aspiration nodes and smoke-removal runs sit above suspended
ceilings and in shafts. Once the ceiling closes, joint quality and insulation cannot be checked
without dismantling. The evidence-before-concealment logic is the same as electrical.

**What is trade-specific:** the acceptance artefact differs — HVAC closing leans on
commissioning and airflow-balance protocols (аеродинамічні випробування) rather than
hidden-work acts alone. A demo built around an electrical scenario would need that named
differently before it reads as *their* process.

**Caution recorded:** Берком's newest dated portfolio item is 17.04.2025 — over 12 months old.
Activity within 12 months is **not** confirmed.

### `plumbing` / engineering networks — 1 of 2–4

- **ТОВ «Укравтономгаз»** (Ужгород) — autonomous LPG gas-supply systems, «проведення монтажних
  робіт», 650 turnkey objects.

**What transfers cleanly:** buried pipework and LPG tanks are backfilled. Trench routes, laying
depth and welded-joint condition are unverifiable afterwards without excavation — arguably a
*stronger* instance of the shared job than electrical, because excavation is more expensive
than opening a ceiling.

**What is trade-specific:** gas work carries a statutory inspection and commissioning regime of
its own, with an external authority in the loop. That raises the stakes on evidence but also
means part of the process is already prescribed — the tool would have to fit around it, not
replace it.

**This is the segment with the clearest dated activity signal** in the whole batch: a webinar on
15.04.2025 led by the named director, plus an April 2025 trade-journal interview.

### `solar` — 0 of 2–4

**Zero qualified, despite the best source in the registry.** АСЕУ (`catalog.aseu.org.ua`) is a
verified association with a public catalogue of **119+ installers** — precisely the pre-filtered
list §B.3 predicted would be the highest-precision class.

The one candidate examined (**Unisolar**) failed identity verification: the site runs on
`unisolar.energy` while the published address is on `unisolar.com.ua`, no full legal name is
published, the ЄДРПОУ in the catalogue belongs to a differently-named entity, and the visible
project portfolio is Moldova-weighted rather than Ukrainian.

**This is a shortfall of coverage, not of supply.** The ASEU catalogue was found late in the
pass and its individual company profiles were not worked through. It is the single highest-yield
next action.

### `maintenance` — 1 of 1–3 ✓ **the only bucket in range**

- **НВП «Інтеренерго»** (Харків) — cogeneration, biogas, biomass boilers: design, supply,
  installation and commissioning with its own installation personnel; 2024–2025 gas-piston
  projects including a 19.2 MW facility.

**What transfers cleanly:** plant-room pipework and cable trays are closed behind cladding and
insulation; commissioning evidence has to exist before that happens.

**What is trade-specific:** the acceptance counterparty is often the equipment owner's technical
service rather than a GC's ПТО, and the artefact is a commissioning protocol rather than КБ-2в.
The billing-proof half of the AktFlow thesis is weaker here.

---

## Is any adjacent segment showing stronger pain than electrical?

**Tentatively yes — plumbing / engineering networks.** Buried gas pipework is the most expensive
concealment to reverse in the batch: excavation costs far exceed opening a ceiling, and the
statutory inspection regime means missing evidence has a regulator attached, not just a client.

**This is a hypothesis from desk research on one company, not a finding.** No operator has said
it. doc 30 §1 forbids treating a founder inference as validated, and n=1 supports nothing. It is
recorded here as the question worth putting to the first plumbing respondents.

---

## Public-contact gaps — the dominant constraint

**4 of 15 companies examined (27%) published no readable public business email**, and a fifth
published only a personal-format address on a free domain.

| Company | Gap |
|---|---|
| ВЕНБЕСТ | Address obfuscated by Cloudflare email-protection — unreadable programmatically |
| Київ Клімат | Phones and a price list only |
| АЛЬЯНС-БЕЗПЕКА | None on the main page (contacts page not yet checked) |
| АРТ-КОМФОРТ | None published |
| РС-Безпека | `rostyslavs@ukr.net` — owner's personal-format address, not a business mailbox |

**No address was guessed, inferred, or pattern-matched.** Per ER-5b these are `unreachable` with
a 90-day `recheck_after`, not permanently disqualified — the contact may appear later, and the
ICP judgment was never the problem.

A further observation for the message itself: among those that *do* publish an address, free
mailboxes (`@ukr.net`, `@gmail.com`) are common even for companies with 100+ staff. Deliverability
from a consumer Gmail sender to these recipients is a real risk the ER-8c stop rule should watch.

---

## Deviations from the plan, stated explicitly

1. **Every bucket except `maintenance` is below its range floor.** Cause: verification standard
   held, candidate throughput too low in one pass. Not caused by candidate scarcity.
2. **Tier 2 vendor installer directories produced zero leads.** Ajax Systems — the vendor the
   spec rated most promising as Ukrainian and "likely rich" — exposes only a partner-portal
   login, no public installer directory. The other vendors were not verified and were therefore
   not used. The spec's expectation that this is the "highest ICP precision" source class was
   **not borne out**.
3. **Three of five Tier 1 registry front-ends are unusable** (Clarity paywalled, YouControl
   requires account registration, Opendatabot 403). Identity verification fell back to
   company-published legal requisites cross-checked against a catalogue ЄДРПОУ, which is
   recorded per lead in `identity_evidence_note`. The ProZorro open API *is* usable and remains
   the strongest untapped official source.
4. **No association was named that was not verified.** Only АСЕУ was confirmed; no HVAC or
   electrical contractor association with a public member list was found, and none was invented.

---

## Ranking of the qualified leads

Six qualified, so a top-10 cannot be produced. All six are band A with `confidence_score = 100`;
`fit_score` is a **coarse ordering field only and is not quoted as a metric** (D-2). The ordering
below is a judgment on the strength of the *job fit* and the *signal*, not a score.

| # | Company | Trade | Why it ranks here |
|---|---|---|---|
| 1 | **ІБК «Енергокапітал»** | electrical | Strongest concealed-work exposure in the batch — cable 0.4–110 kV in pipe channels and trenches. 30 installers in-house means real crews, real field evidence. Department mailbox on its own domain |
| 2 | **ТОВ «Укравтономгаз»** | plumbing | Buried LPG pipework is the most expensive concealment to reverse. **Best dated signal in the batch**: 15.04.2025 webinar by the named director. Own-domain address |
| 3 | **НВП «Інтеренерго»** | maintenance | Only lead with dated 2024–2025 project evidence *and* named in-house installation personnel. Own-domain address |
| 4 | **ТОВ «ШІЛД-ФАЄР»** | low_voltage | Clean pure-play installer, `info@` on its own domain, Kyiv address published. Signal is a 2025-standard review — topical but undated |
| 5 | **ТОВ «Електропівденмонтаж»** | electrical | Largest verified crew (123 specialists) and deep concealed-work profile. Held back by a free mailbox and no dated activity. **Critical-infrastructure portfolio → §B.0.6 geodata stripping applies to any future artefact** |
| 6 | **ТОВ «ВКФ «Берком»** | hvac | Real installed-systems portfolio with dated entries. Held back by newest date being 17.04.2025 (>12 months) and a free mailbox |

**Leads 4–6 carry named weaknesses.** Each is genuinely verified against all three dimensions;
none is padding. But 5 and 6 have no activity signal inside 12 months, and 4's signal is a blog
topic rather than a trigger event. Before any of the three is drafted to, §B.10 Loop 4 step 2
requires re-fetching the signal and blocking if it is no longer live.

---

## What would close the gap

In rough order of expected yield:

1. **Work the ASEU catalogue** (119+ verified solar installers, individual profiles unread) —
   the clearest path to filling `solar` and probably overshooting it.
2. **Harvest the ProZorro open API by works CPV** — official, no auth, live today. Yields award
   records that verify both identity *and* specialization from a single authoritative source,
   which is exactly the dimension pair that fell back to catalogue cross-checking here.
3. **Mine the 144 live «інженер ПТО» vacancies on work.ua** — a vacancy is simultaneously a
   documentation-burden signal and a **dated** personalization hook, which is the weakest
   attribute across the current six.
4. **Check contacts pages for the three D5 leads** before their 90-day recheck.
