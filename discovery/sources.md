# Source registry (doc 40 §B.3)

**Verified 26.07.2026.** Nothing in this file is assumed from the spec — every entry was
fetched. Sources marked `not_usable` must not be relied on, and the reason is recorded.

**Rule:** a source listed here as `verified` may be used for *candidate discovery*. It does not
by itself verify a claim. Identity, specialization and public contact are each verified by
opening the page and confirming it supports that specific claim (D-3), preferring
**company-owned websites and official public registries over aggregators**.

---

## Tier 1 — registries and procurement

| Source | URL | Status | Finding |
|---|---|---|---|
| ProZorro open API | `public.api.openprocurement.org/api/2.5/tenders` | **verified** | Live, no auth, returns today's data (checked 26.07.2026, most recent record `2026-07-26T18:33:00`). The usable official procurement surface |
| ProZorro web UI | `prozorro.gov.ua/tender/search` | **not_usable here** | SPA rejects this browser's version — "версія вашого браузера застаріла, фільтри можуть не працювати". Redirects to home; filters do not render. Use the API instead |
| Clarity Project | `clarity-project.info` | **not_usable** | Paywalled. 24-hour demo requires contact-details registration; plans from 450 UAH/day. Circumventing a paywall is prohibited (§B.3) |
| YouControl | `youcontrol.com.ua` | **not_usable by the agent** | Free "OpenData" tier exists (22 registers, 7 dossiers/day) but **requires account registration**. Creating accounts is outside what this agent may do. Available to the founder directly |
| Opendatabot | `opendatabot.ua` | **not_usable** | HTTP 403 Forbidden to automated fetch |
| data.gov.ua | `data.gov.ua` | **verified** | Portal loads; 127 datasets match ЄДР, including a downloadable «Витяг з ЄДР» (ZIP). CC-BY 4.0. Bulk ЄДР is obtainable without login |

**Consequence for identity verification.** Three of the five registry front-ends are unusable
(paywall, registration, 403). Identity is therefore verified from **the company's own legal
requisites** (legal form, ЄДРПОУ, address published on their own domain) cross-checked against
the ЄДРПОУ in a public catalogue record, and — where the company appears — against a ProZorro
award. This is recorded per lead in `identity_evidence_note`.

### KVED codes used for candidate discovery

| Code | Activity | ICP trade |
|---|---|---|
| 43.21 | Електромонтажні роботи | electrical |
| 43.22 | Монтаж водопровідних мереж, систем опалення та кондиціонування | hvac, plumbing |
| 43.29 | Інші будівельно-монтажні роботи | low_voltage |
| 42.21 | Будівництво трубопроводів | plumbing / engineering networks |
| 42.22 | Будівництво споруд електропостачання та телекомунікацій | telecom, power |
| 33.20 | Установлення та монтаж машин і устатковання | maintenance |
| 80.20 | Обслуговування систем безпеки | low_voltage, security |

**A KVED code neither qualifies nor disqualifies** (§B.2 registry note). Many Ukrainian firms
carry both 41.20 and 43.21. The test is **observed installation delivery** on the company's own
site or an award record — which is exactly why `specialization_verified` is a separate manual
check and a KVED code alone never satisfies it.

---

## Tier 2 — vendor partner and installer directories

| Vendor | Status | Finding |
|---|---|---|
| Ajax Systems | **not_found (public locator)** | `ajax.systems/ua/where-to-buy/` exposes a partner *portal* login and a "Партнерам" page, but **no public installer directory** with company names. Cannot be used as a lead source |
| ABB, Schneider, Hager, DKC, Legrand | **not verified** | Not confirmed in this pass. Not used. Do not cite as sources until checked |
| Daikin, Mitsubishi, Systemair, Vaillant | **not verified** | Not confirmed in this pass. Not used |
| Hikvision, Dahua | **not verified** | Not confirmed in this pass. Not used |

**Tier 2 did not produce leads in this pass.** The spec rated this the highest-precision class;
that expectation was not borne out for the one vendor checked in depth, and the rest remain
unverified. Recorded as a source-tier failure rather than quietly substituted.

---

## Tier 3 — hiring signals

| Source | URL | Status | Finding |
|---|---|---|---|
| work.ua | `work.ua/jobs-інженер+ПТО/` | **verified** | **144 live vacancies** for «інженер ПТО» on 26.07.2026, with employer names visible. A live PTO-engineer vacancy is a direct documentation-burden signal and a first-class personalization hook |
| robota.ua | — | **not verified** | Not checked in this pass |

---

## Tier 4 — associations

| Organization | URL | Status | Finding |
|---|---|---|---|
| Асоціація сонячної енергетики України (АСЕУ) | `aseu.org.ua`, catalogue at `catalog.aseu.org.ua` | **verified** | Real association (ЄДРПОУ 41769391). Runs a **public online installer catalogue** listing **119+ solar installer companies** across Ukrainian regions. Contact `office@aseu.org.ua`. The single best verified source for the `solar` bucket |
| HVAC / electrical contractor associations | — | **not verified** | No Ukrainian trade association with a public member list confirmed for these trades in this pass. **Deliberately not named** — §B.3 forbids inventing association names |

---

## Tier 5 — company-owned surfaces (preferred for verification)

Per founder instruction, **company-owned websites are preferred over aggregators** for every
recorded claim. In practice the verification pages are:

| Page | Verifies |
|---|---|
| `/contacts`, `/kontakty`, footer, «Реквізити» | Public business email (verbatim), legal name, ЄДРПОУ |
| `/services`, `/poslugy`, «Послуги» | Specialization — installation work actually performed |
| «Проєкти», «Об'єкти», «Новини» | Personalization signal, activity within 12 months |

---

## Aggregators — discovery only, never proof

| Source | Status | Use |
|---|---|---|
| ua-region.com.ua | **verified, discovery only** | Business catalogue indexed by KVED. Confirmed volumes: **3,822** companies at KVED 43.21, **3,468** at 43.22, **1,279** at 33.20, **456** at 80.20. Lists company name, ЄДРПОУ, city and own-site URL |

**Never used as proof of a claim.** It supplies a candidate and a hypothesis; the claim is then
verified on the company's own site. Its ЄДРПОУ is used only to cross-check what the company
publishes about itself.

---

## Track P — public procurement document availability (§B.0.9)

Track P is ungated and needs no human. Required output is a map of **which document types are
actually obtainable publicly** versus which still require a human.

| Document type | Obtainable publicly? | Evidence |
|---|---|---|
| Tender notice (sign.p7s) | **yes** | `public.api.openprocurement.org/api/2.5/tenders/{id}` returns a `documents[]` array; the sampled tender carried a signed notice |
| локальні кошториси, ТЗ, contracts, ВОР | **partially — size-dependent** | Present on larger works tenders, absent on small goods tenders. The sampled record (`c46ce583…`, bituminous strip, CPV 44170000-2, a village medical centre) carried **only** `sign.p7s` |
| КБ-2в, КБ-3 | **not observed** | Not present in the sampled record |
| Акти прихованих робіт, defect acts | **not observed** | Not present in the sampled record |

**The §B.0.9 limitation is confirmed empirically, not merely quoted.** Published material skews
**tender-stage** (кошториси, ТЗ, contracts) rather than **closing-stage** (a returned АВР
carrying reviewer comments, hidden-work acts with photographs). AktFlow's thesis lives at
closing. Track P therefore likely yields the estimate half of doc 30 **V-001** and **not** the
returned-package half — which is the half that matters most.

> **Do not let an easy source quietly redefine what evidence you are looking for.**

### Track P harvest attempted 26.07.2026 — supplier identities are NOT publicly reachable

The POST search API **works**: `prozorro.gov.ua/api/search/tenders` with
`{"cpv":["45310000-3"],"status":["complete"],"page":1}` returns **10,000 electrical-works
tenders**. But each result exposes only the **procuring entity** — the hospital or municipality
*buying* the work — plus `tenderID`, `title`, `value` and `status`. The **contractor performing
the work** lives in `awards[].suppliers[]` on the tender detail, and reaching it needs the
openprocurement internal UUID:

- `prozorro.gov.ua/api/tenders/{tenderID}` → **404**
- `public.api.openprocurement.org/api/2.5/tenders?tenderID=…` → **ignores the parameter**,
  returning the chronological feed from February 2015

Mapping `tenderID` → UUID would require paging the entire feed since 2015. **Yield from this
source: 0 leads.** It remains the best *document* source (Track P) and a poor *lead* source.

---

## Warm paths (doc 14 §3) — recorded, nobody contacted

doc 14 §3 names: open company registers, association/member directories, tender/award data, job
listings, project signage, supplier/estimator referrals, LinkedIn, GC ecosystems. §B.0.1 records
that §B.3 absorbed every warm path into cold list-building — the relationship-holders became a
data source and were never approached as a channel.

**Verified warm surface:** АСЕУ (above) is a real association with a public catalogue and a
published contact address, reachable when the founder chooses to open Track W.

**Not verified in this pass, and therefore not to be cited as existing:** the ukrsmeta.ua
«Форум кошторисників», the АВК-5 training-provider networks (ДАНКО, Тренд) and the estimating
vendors (Укрсмєта, msmeta) named in §B.0.4. Check each before use.

### Role boundaries to carry into any warm contact (§B.0.4)

| Intermediary | What they ARE | What they are NOT |
|---|---|---|
| Estimators / кошторисники | Expert informants and referral filters | **Not artifact providers.** They often serve whoever controls the package — frequently the GC, not your subcontractor. They see *estimate* pain, not *field-evidence* pain, and a tool automating documentation workflow can read as a commercial threat |
| Distributor / wholesaler reps | Name producers | **Not document sources.** They do not see returned evidence packages, hidden-work disputes or billing proof |

### Third-party artifact consent — hard rule (§B.0.6)

An estimator's КБ-2в and АВР packages **are not theirs.** Before accepting any artifact from an
intermediary, obtain explicit attestation that they are entitled to share it. Require removal of
precise site locations and coordinates, EXIF and embedded geodata, identifiable infrastructure
(substations, switchgear rooms, transformer yards, comms nodes), and references identifying
critical facilities or reconstruction sites. **If material arrives unstripped, do not store it** —
delete, say what was wrong, offer to receive a corrected version. Full text in
`artifacts/artifact-checklist.md`.
