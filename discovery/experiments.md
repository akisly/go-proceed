# Experiments and stop rule

**Registered 26.07.2026, before any data arrives.** Nothing has been sent; there is no reply
data. This file exists so the thresholds are fixed *before* results can influence them.

---

## The pre-registered stop rule (ER-8c / T27)

> **Stop rule, registered before any data arrives:** after 50 sends, if distinct replies < 4 or
> substantive replies < 2, stop scaling cold email and reallocate to the warm paths in doc 14 §3
> (estimator and supplier referrals, associations, vendor ecosystems). **This is a decision
> point, not a suggestion.**

### Why this rule exists

§B.1's assumed 20–30% reply rate is roughly **5× optimistic** for cold B2B email sent from a
consumer Gmail address that declares "no customers" in its second paragraph.

The §Risks rollback table fires only when opt-outs or bounces exceed 5%. That detects
**offensive**, never **ineffective** — months of polite silence trip nothing at all. The stop
rule closes that hole.

### The funnel restated honestly

§B.1's arithmetic used 20–30% / 50% / 20% and presented 150 leads as sufficient. At rates that
survive contact with a cold consumer-Gmail sender:

```
150 qualified leads
 → ~5%  reply rate                      =  7.5 replies
 → ~50% of replies substantive          =  3.75 workflow descriptions
 → ~15% share artifacts after terms     =  0.56 artifact providers      ✗ gate needs 3
```

**~0.6 artifact providers from 150 leads.** To reach the doc 12 Stage-0 gate of **≥3 artifact
providers** at those rates, the implied volume is roughly **800 qualified leads** — not 150.

That number is the argument for the channel mix in §B.0, not for sending harder. It is also what
makes the B0 yield rate load-bearing: 24 qualified from 62 examined, at ~10 min/lead (ER-8d),
implies roughly **340 hours of research** to reach 800 qualified leads. That is the real cost of
the cold path, and it is the strongest argument in this file for Track P, W and C.

### A deliverability risk measured across the 24 qualified leads

**8 of the 24 qualified leads (33%) use a free mailbox** (`@ukr.net`, `@gmail.com`, `@i.ua`) —
including companies with 100+ staff. Contact-type split: 14 department, 9 general, 1
personal-business. Consumer-to-consumer-domain cold mail is filtered aggressively, so bounce and
silent-drop rates must be watched from the first cohort. A bounce is `R9` — never a prompt to
guess a replacement address.

---

## Metric definitions — always grouped by trade

Per founder instruction, **every metric below is reported grouped by `quota_bucket`**, in
addition to any grouping by template or band. **A blended rate across five trades answers no
question the founder has**, and none is to be produced.

| Metric | Definition |
|---|---|
| Sent | `email_sent` events in the window |
| Reply rate | distinct leads with `reply_received` ÷ leads sent |
| Substantive rate | `R1 + R2 + R3` ÷ replies |
| Opt-out rate | `R7` ÷ sent |
| Bounce rate | `R9` ÷ sent |
| Per-template reply rate | grouped by `template_variant` |
| Per-source reply rate | grouped by primary source tier |
| Per-band reply rate | grouped by `fit_band` |
| **Per-trade reply rate** | **grouped by `quota_bucket` — mandatory** |
| Rung-2 conversions | leads reaching `ladder_rung = 2` |
| Rung-3 conversions | `artifacts_received` |
| Stage-0 progress | artifact providers ÷ 3; paid/conditional ÷ 1 |

`fit_score` is **never** aggregated or reported as a mean. It is a coarse ordering field, not a
metric (D-2).

---

## Statistical honesty (§Loop 9, carried verbatim in substance)

At 10 sends/day a weekly cohort is ~30 emails. **That is far too small for a valid A/B test**,
and any per-template difference at n=30 is noise. Template variants are assigned by **signal
type, not randomly**, so they are not comparable arms in the first place.

Treat this as **qualitative learning**: read every reply, look for repeated language, and change
the message when a human reason appears — not when a percentage moves. Only after ~200
cumulative sends per variant does a rate difference deserve any weight, and even then it is
directional.

**Splitting by trade makes each cell smaller still.** Per-trade rates at these volumes are
descriptive labels on a handful of replies, not measurements. They are reported separately
because blending them would hide which segment answered — not because any of them is
statistically meaningful.

Do not report any of this as a validated finding. doc 30 §1 is explicit that a founder opinion
cannot mark an assumption `validated`.

---

## Baseline recorded before batch 1

| Quantity | Value at 26.07.2026 |
|---|---|
| Qualified leads available | **24** (target 30) |
| Sends to date | **0** |
| Replies to date | **0** |
| Artifact providers | **0** (Stage-0 gate needs ≥3) |
| Paid/conditional pilots | **0** (gate needs ≥1) |
| V-001…V-012 | **all `unvalidated`** — unchanged by this pass |

**No V-gate was closed by B0, and none could be.** Desk research produces candidates, not
evidence about the market. Findings are mapped without closing anything.

**The 24/62 result measures lead-verification yield only.** It says how many companies could be
identified and verified from public sources. It says nothing whatsoever about demand — neither
for nor against. Any reading of it as market signal is a category error.
