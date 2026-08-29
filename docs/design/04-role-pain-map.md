# Role → pain → screen — what the dashboard is for

**Status:** Approved (owner instruction, 2026-08-21: «строили апку под боль под каждую роль»)
**Evidence base:** [`../discovery/research-ua-demand-2026-08-21.md`](../discovery/research-ua-demand-2026-08-21.md) — the demand scan of 2026-08-21, copied into this repository so the screens and their justification travel together.
**Read with:** [`03-ui-references.md`](03-ui-references.md), [`02-building-ui.md`](02-building-ui.md), [`../product/personas-and-workflows.md`](../product/personas-and-workflows.md)

## What the scan actually establishes

Four claims were separated, and they do NOT have equal support:

| Claim | Verdict in the scan |
|---|---|
| 1. The workflow is a real duty | **strongly supported** — ПКМУ 903, ДБН А.3.1-5:2016 (annex form for hidden-works acts naming contractor + technical supervision + designer), technical-supervision contracts filed in ЄДЕССБ that forbid following work before the act |
| 2. It causes recurring pain | **strongly supported** — forum and job-ad evidence across all three roles |
| 3. Software could reduce it | **moderately** — adoption evidence is positive but vendor-published; the counter-evidence (people returning to texts and spreadsheets, «expensive, slow, cluttered») is just as real |
| 4. A named buyer will adopt and pay **for GoProceed** | **not supported yet** — 21 outreach sends, zero replies, zero named projects, zero willingness-to-pay signals |

**This is the frame for every screen decision below.** We are not building on validated
demand for the product; we are building on a validated duty and a validated pain.
The consequence is concrete: **a screen that adds work to a role whose pain we have
not measured is a liability, not a feature.**

## The five roles, and what each one's pain actually is

### ПТВ (contractor documentation) — the champion, the one to design for first
Pain, from the scan: days spent **searching photos in chats**, transcribing into
Word, calling the foreman to assemble the monthly folder; customer-specific
formatting, repeated revisions, returns. Highest need, highest champion score,
medium payer.
**What the dashboard owes them:** retrieval and assembly without a phone call —
evidence found by assignment, not by scrolling; the act composed from what is
already recorded; the returns visible with their reasons.

### Foreman / виконроб — the one who can kill adoption
Pain: real duty (photos, logs, acts, KB-2v inputs) but **least tolerance for
administration**. The scan is blunt: «A product that adds fields after the same
photo was already sent to Telegram creates negative value.»
**What the dashboard owes them: nothing.** Their surface is the field client,
already built, one tap, no fields. The dashboard's obligation to the foreman is
negative — it must not become a reason to ask him for anything twice.

### Technical supervision (технагляд) — high need, low buyer, high refusal risk
Pain: accountability without tooling; signature-authority ambiguity; refusal when
the counterparty relationship is unclear. Adoption is «most plausible through a
**no-account review link**, neutral receipt, visible sources, and customer mandate».
**What the dashboard owes them:** nothing to log into. Their path is
`apps/app/app/external/**` — already built. The dashboard must make the link easy
to produce and must never require them to hold an account.

### Subcontractor owner / commercial director — the actual payer
Pain: **acceptance delays cash**. High economic buyer, high payer, and the scan
names what they need to see: «visible blocked value and cycle-time evidence».
**What the dashboard owes them:** the money view — what is blocked, why, and for
how long. We already have `GET /v1/projects/{id}/blocked-value` and
`/blocked-reasons` and `/readiness`; nothing on screen reads them yet.

### General contractor / customer — governance interest
Medium-high on both champion and payer, but «requires integration and control
over rules». Out of pilot scope; named here so a later screen is not mistaken for
a gap today.

## The screens, and the role each one serves

Owner's selection, 2026-08-21: the ADR-009 minimum **plus** the Dashboard overview
**plus** profile settings. Ordered by the pain they close:

| # | Screen | Serves | Closes which pain | Reference pattern |
|---|---|---|---|---|
| 1 | **Evidence by assignment** — photos with receipts (device time / server time / SHA-256), openable | ПТВ | «several days searching photos in chats» — the scan's single most concrete complaint | shadcn-admin `tasks-table` + a media panel |
| 2 | **Overview** — blocked value, blocked reasons, readiness | owner/commercial | «acceptance delays cash»; the one view the payer asks for | shadcn-admin `dashboard`, with our `viz-*` roles |
| 3 | **Assignments** — list + create (the full contract chain behind it) | ПТВ | reconstruction after the fact; today this is SQL | shadcn-admin `tasks` (`*-columns`, `*-mutate-drawer`, `*-provider`) |
| 4 | **Members & access** — who can do what on a project, invite | ПТВ / admin | signature-authority and «who is this subcontractor» ambiguity starts here | shadcn-admin `users` + `users-invite-dialog` |
| 5 | **Projects** — list + detail shell | all office roles | navigation spine; nothing else has a home without it | circle `app/[orgId]/projects` + `layout/sidebar` |
| 6 | **Profile & sign-out** | everyone | there is currently **no way to sign out** anywhere in the product | shadcn-admin `settings/profile`, `sign-out-dialog` |

**[Correction, 2026-08-28 — row 3's pain sentence is not in the scan, and half
of row 3 has shipped.]** «reconstruction after the fact; today this is SQL»
appears nowhere in
[the demand scan](../discovery/research-ua-demand-2026-08-21.md) this document
sources every row to — checked by string on 2026-08-28: neither
«reconstruction» nor «SQL» occurs in that file. What the scan does support for
ПТВ is the aggregation loop, in its §"Role evidence": «several days searching
photos in chats, transcribing passports into Word, and calling the foreman to
assemble the monthly customer folder» — which the scan itself labels vendor
evidence rather than independent measurement — «customer-specific formatting
requirements, repeated revisions», and «manually typing hidden-work acts,
maintaining an as-built register».

Those sentences justify the **list** half of row 3, and that half has shipped:
`/dash/projects/{projectId}/assignments`, its columns, and the link into row
1's evidence screen. They do **not** justify the **create** half, which is
carried by the operability section below instead — under a different role and
a different kind of justification. The row is left as written, per this
repository's rule that a correction is a dated addition and never a rewrite;
read this note with it.

### Deliberately NOT built, and why
- **Anything for the foreman in the dashboard** — see above; the field client is his surface.
- **An account for technical supervision** — the no-account link is the adoption path; an account is the refusal path.
- circle's issues / cycles / initiatives / reviews / inbox / agent, and its 30+ settings pages — a vocabulary from a different product.
- shadcn-admin's chats, apps, error pages, its own auth screens — we have OTP.
- The full register (imports, KB-2v, packages) — ADR-009 decision 3 says «Not the full register», and claim 4 is unvalidated: building it now is building on an unmeasured assumption.

## Screens that serve operability, not a measured pain

Added 2026-08-28 under
[ADR-009](../decisions/ADR-009-three-pilot-surfaces.md)'s amendment of the same
date.

Every screen in the table above is justified by a role and by a sentence
describing that role's pain. The screen below is justified by neither, and it
gets a section of its own precisely so that the difference stays visible. Put
into the same table it would inherit an authority it does not have.

| # | Screen | Serves | Justified by | NOT justified by |
|---|---|---|---|---|
| 7 | **The contract-baseline chain** — party + legal profile, contract, draft version, typed lines, rule-version publication, bindings, publication, and the assignment at the end | the owner or a workspace admin standing up a pilot | ADR-009 decision 3's operability clause: «the screens without which the owner cannot run the pilot without curl». Creating an assignment is already inside decision 3 and is unreachable until a published baseline exists | any sentence in the demand scan. Nothing in it says a ПТВ suffers from entering contract structure, and no such sentence may be invented to license polish here |

**What follows from being an operability screen, concretely:**

- **It is measured by completion, not by feel.** The test is the walk in
  ADR-009's amendment: browser and an email address to a created assignment,
  with no curl, no psql and no SQL. That is falsifiable in the browser harness;
  «pleasant to use» is not, and is not claimed.
- **It is not owed rows 1–4's polish, and must not spend their budget.**
- **The rule at the end of this document applies to it unchanged.** It must not
  add work to a role whose pain has not been measured — the foreman still owes
  the dashboard nothing, and no step of this chain may be pushed onto him.
- **It is provisional by construction.** If the pilot ever produces evidence
  that a ПТВ enters baselines themselves, this screen moves up into the table
  with a real pain sentence and its bar rises to match. Until such a sentence
  exists, it stays here — and «the pilot needed it» is not that sentence.

## The rule this document exists to enforce

Before adding a screen to the dashboard, name the role and the sentence in the
demand scan that describes its pain. If neither exists, the screen is a guess —
and the scan's own falsifiable conclusion applies: «There is not yet validated
demand for GoProceed as an application. The hypothesis should be tested against
one named project and the last five actual returns/delays, not through a feature
survey.»
