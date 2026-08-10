# Hidden-works content: what may be asserted, and what may not

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md)

> **Why ADR-006 and ADR-007 are listed.** Each of them names this document as
> binding on the strings it touches — ADR-006 on the assurance ladder it defers
> КЕП to, ADR-007 on every regulatory string its field client renders — and each
> says in its own text that it adds no Додаток Н item, no Додаток В field and no
> clause number. Listing them records that relationship and nothing more. Neither
> adds a row to the allow-list below, and neither could: this document restricts
> at every precedence level, **including over ADRs**
> ([docs/README.md](../README.md) §"Source of truth").

> **What Approved means here.** Approved on 2026-08-06, promoted from Draft so
> that the authority ADR-005 §"Replacement rule" delegates to this document is
> an authority it can carry — a Draft is not an implementation authority under
> [docs/README.md](../README.md) §"Status meanings", and the rules below are
> binding on every regulatory string the product renders. Approved applies to
> the **rule set**: the allow-list, the prohibitions, the verification
> vocabulary, and the assurance ladder. It does **not** mean the Open items at
> the end of this document are closed, and it does not upgrade any row tagged
> `UNVERIFIED`. Adding a row to the allow-list is a change to an Approved
> document and follows [docs/README.md](../README.md) §"Change control".

> **Why this document exists.** GoProceed intends to ship Ukrainian regulatory
> content — a requirement library, a printable act, and later a free public
> generator. Regulatory content that is subtly wrong is worse than no content:
> an engineer's client's lawyer reads it. Six sourcing passes plus one
> adversarial fabrication audit established what is verifiable. The audit
> downloaded the official ДБН file from the state portal
> (`e-construction.gov.ua`, 636 603 bytes) and checked every load-bearing claim
> character by character. **That download is a single fetch that no reviewer
> can reproduce**: the file is not retained in this repository, no URL, date or
> hash of it was recorded, and `technical/requirements/` holds only the derived
> CSV. Read every `VERIFIED_PRIMARY` tag below and in that CSV as resting on
> that one unreproduced fetch — see Open items. This document is the standing
> rule set that came out of it.
>
> The verified list content lives in
> [`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv).

## Verification vocabulary

Every regulatory item carried by the product is tagged:

- **VERIFIED_PRIMARY** — the standard's own text was fetched and quoted.
- **VERIFIED_SECONDARY** — a named reputable source reproduces it.
- **UNVERIFIED** — believed but not sourced. Must never be shown as normative.

Several sites repeating an identical block is one source, not corroboration.

## What the product MAY assert, with attribution

1. The verbatim contents of **Додаток Н**, positions **Н.14** (5 items) and
   **Н.15** (7 items), attributed as: *«ДБН А.3.1-5:2016, Додаток Н
   (довідковий), позиція Н.15»*.
2. Verbatim quotes of **пп. 8.4.3.1–8.4.3.6**, definitions **3.2.9** and
   **3.2.5**, and the list at **4.8**.
3. The **Додаток В** form — every field of В.1 and В.2, in the standard's order,
   attributed as *«форма за Додатком В (обов'язковим)»*.
4. The **Додаток Г** form (4 items) and its differences from В, including
   «На **основі** викладеного» (В) versus «На **підставі** викладеного» (Г).
5. The **5-робочих-днів** notice примітка, verbatim, identical in В and Г.
6. **Таблиця А.2** (загальний журнал) and **Таблиця Б.2** (спецжурнал
   субпідрядника) — titles and columns.
7. That the form's correct title is **«АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ»**.
8. That the binding list for a given site comes from **робоча документація**
   (п. 8.4.3.3), and that Додаток Н is довідковий.
9. That ДБН are mandatory (ЗУ «Про будівельні норми», ст. 11 ч. 1) while ДСТУ
   are voluntary (ЗУ «Про стандартизацію», ст. 23).
10. That технагляд may **stop work** until acts are drawn up (ПКМУ № 903,
    п. 6 пп. 5), must participate in hidden-works inspection (п. 5 пп. 3), and
    holds a кваліфікаційний сертифікат (п. 3).
11. That the загальний журнал is, by the norm, a laced and sealed **paper** book
    (Додаток А, Вказівка 11) — the string «електронн-» does not occur once in
    the standard.
12. That **КБ-2в is Додаток 36** and **КБ-3 is Додаток 37** to the Настанова
    approved by **наказ Мінрегіону від 01.11.2021 № 281**, both «первинні
    облікові документи» (п. 6.1).
13. That наказ № 281 cancelled the eight ДСТУ Б Д.1.1:2013 family standards,
    including ДСТУ Б Д.1.1-1:2013.
14. That the **КБ-2в form changed on 16.06.2026** through Зміна № 6 (наказ
    Мінрозвитку від 08.06.2026 № 1069).
15. That a **second mandatory act form exists** — Додаток Е (обов'язковий) of
    ДСТУ 9254:2023, in force from 01.05.2024 — stating plainly that its text is
    paywalled and the product has not read it.

### Verification status of the allow-list itself

The rule above — every regulatory item carried by the product is tagged — applies
to this list before it applies to anything the product renders. Applied honestly,
the list does not pass it:

| Items | Tag | What the tag rests on |
|---|---|---|
| **1–8, 11** | `VERIFIED_PRIMARY` — **single unreproduced fetch**, see Open items | The one download of the official ДБН file described above. No reviewer can reopen it: no URL, no retrieval date and no hash were recorded. Item 11 belongs here rather than below: Додаток А, Вказівка 11 and the absence of «електронн-» are claims about the ДБН's own text, carried by that same fetch — the bin below was drawn by item number rather than by provenance and named no source for it |
| **9–10, 12–15** | **None. No verification tag and no retrieval record** | ЗУ «Про будівельні норми», ЗУ «Про стандартизацію», ПКМУ № 903, наказ Мінрегіону № 281, наказ Мінрозвитку № 1069, the eight cancelled ДСТУ Б Д.1.1:2013 standards, and ДСТУ 9254:2023. **No primary text of any of them is retained in this repository**, and the Open items below record several of them by name as unobtained |

**Until each of items 9–10 and 12–15 is fetched and tagged, none of them may be
printed in a customer-facing artifact** — not on a rendered act, not under a
requirement list, not on a screen, not in a demo, and not in sales copy. They stay
usable in internal decision documents, which is where they currently live. This
restriction removes no row and adds none: an allow-list row says what may be
asserted *once it carries a tag and a source*, and none of these six does.

Item **14** is named separately because it is the sharpest of the six: «the
КБ-2в form changed on 16.06.2026 through Зміна № 6 (наказ Мінрозвитку від
08.06.2026 № 1069)» is a **dated regulatory event** with nothing behind it in
this repository. Neither the date, nor the наказ, nor what the change altered may
be told to a customer until the наказ is fetched and recorded.

**The allow-list carries the verbatim contents of Н.14 and Н.15 only.** How many
other positions Додаток Н contains, what they are numbered, and what they cover
are assertions about the standard's structure that no item above carries.
«Н.1–Н.13» is not an allow-listed range and must not be written as one; a
document that needs to say general construction is out of scope says that the
Додаток Н positions outside Н.14 and Н.15 are not sourced here.

## What the product MUST NOT assert

**A. Never add an item to Н.15.** It has exactly seven lines. No cable trays, no
ВРУ/щити, no СКС, no low-voltage, no building lightning protection, no
fire-stopping penetrations, no thermographic survey. Anything else goes in a
separate block labelled **«Додатково рекомендуємо (не з Додатка Н)»** with no
normative citation.

**B. Never call Додаток Н an «орієнтовний перелік».** The string «орієнтовн»
occurs **zero** times in the standard. Correct: «довідковий додаток».

**C. Never present Додаток Н as mandatory or exhaustive.** The binding list is
in робоча документація (п. 8.4.3.3). This is the feature's largest legal risk.

**D. Never title the blank «Акт огляду прихованих робіт».** The form's heading
is «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ». **But do not tell users «акт огляду» is
obsolete** — it is live normative vocabulary in ДБН п. 8.6.3 в) and in ПКМУ
№ 903 п. 6 пп. 5, and an engineer will produce the постанова.

**E. Never add fields to Додаток В** that are not in it: «шифр», «аркуш», «ким
видана», «паспорт», «Акт №», «м.п.», or a fourth signatory.

**F. Never silently "fix" the original's language** — «На основі викладеного»,
«посада,номер» without a space, «Притітка» (the typo is in the official state
file). Normalise only deliberately and record it.

**G. Never auto-assign «форма В» or «форма Г» to Н.14/Н.15 items.** Established
negative: neither ДБН А.3.1-5:2016 nor ДСТУ 9258:2023 says which position takes
which act. Any mapping is the product's assumption and must be labelled so.

**H. Never call electrical installations «відповідальні конструкції».** No source.

**I. Never print the 2021 PDF of Додаток 36 as the current КБ-2в blank.** A 2026
change to the form is reported by allow-list item 14, and item 14 is untagged:
**what that change altered is not established here and must not be described.** A
blank whose currency cannot be established is not printed.

**J. Never print a ПУЕ clause number.** The 2017 edition's numbering may not be
current — a 2026 edition is reported (наказ № 283), its primary text was never
obtained (see Open items), and this row is a **prohibition, not an allow-list
entry for that report**. Nothing about the 2026 edition may be asserted to a
customer.

**K. Never cite «ДБН В.2.5-23:2010».** A ДБН В.2.5-23:2025 is reported to have
replaced it; that document's primary text was never obtained, the date from which
it applies is not established here, and this row is a **prohibition, not an
allow-list entry for either edition**. Nothing about ДБН В.2.5-23:2025 may be
asserted to a customer.

**L. Never generate measurement protocol blanks (опір ізоляції, фаза-нуль, опір
заземлення) styled as official forms.** No state-approved forms were found.

**M. Never claim electronic journals or acts are a lawful replacement for paper.**

**N. Never repeat the claim that ДБН А.3.1-5:2016 may have been cancelled.**
Three sourcing passes reported it «Архівний» from a state-portal card. The audit
disproved the indicator with a control: ДБН В.2.5-23:2025 — a later document that
no source in this repository reports as withdrawn — carries the same «Архівний»
label on the same portal, so the label does not mean withdrawn. Nothing further
about that document is asserted here; see prohibition **K**. A second card
for А.3.1-5:2016 reads «Діючий» with the same registry number; наказ № 115 was
never repealed; no replacement document exists. **Treat the standard as in
force.** Telling an engineer their base norm is in doubt manufactures false alarm.

**O. Never present agreement between ДБН А.3.1-5:2016 and ДСТУ 9258:2023 as two
independent sources** — they share a developer (ДП «НДІБВ»).

**P. Never claim ДСТУ 9254:2023 replaces or cancels Додаток В.** Unestablished.

**Q. Never print ДБН page numbers.** Three sourcing passes produced three
different paginations from three scans. Cite the clause or appendix.

**R. Never reproduce the «Простий примірний перелік» circulating on
marazm.org.ua** (10 positions, printed adjacent to a genuine ДБН extract so it
reads as a continuation). It is in no edition of the standard. This is the exact
class of fabrication the audit was run to catch.

**S. Never render the word «підпис» / «підписано» for a record below level 4 of
the assurance ladder below**, and never let a level-3 record be described,
labelled, exported or demonstrated as an electronic signature.

## Electronic-signature assurance ladder

> **Origin.** Transferred 2026-08-06 from the archived
> [`docs/legacy/24-legal-regulatory-gates.md`](../legacy/24-legal-regulatory-gates.md)
> §8, which was the repository's only record of it. It is governed by this
> document because it decides what a signature block on a generated act is
> allowed to *say*.
>
> **Why it matters now.**
> [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) ships
> `LINK_CONFIRMATION` in v0.1 and defers КЕП to v0.2 (assumption **d**). Those
> are levels 3 and 5 below. The ladder exists so the two can never be conflated —
> in the UI, on the printed page, in a demo, or in a sales conversation.
>
> **Approved is not deployed.** No level below exists in the runtime. The
> repository baseline is 33 tables plus migrations 0036–0040; requirement
> occurrences, evidence decisions and statutory acts have no tables at all, so
> nothing today records an assurance level of any kind.
>
> *(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
> is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
> which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
> **applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
> tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
> existing, and none of the ten files has ever been executed.)*
>
> **The consequence for this document is unchanged**: an assurance level is
> recorded by nothing that has ever run, and no level below may be described
> anywhere as a thing the product does.

Every recorded acknowledgement, decision or signature carries an **explicit
assurance level**, displayed in the UI and printed on the page. Five levels,
weakest first:

| # | Level | What the record actually is | What may be claimed for it |
|---|---|---|---|
| 1 | `workflow comment` | A comment inside the workflow. No assertion about the work or the signer | Nothing. It is not acceptance and not acknowledgement |
| 2 | `operational acknowledgement` | A recorded «ознайомлений» by an identified in-product actor | That a named actor acknowledged something at a server time. No legal effect |
| 3 | `authenticated acceptance record` | **v0.1's `LINK_CONFIRMATION`:** email link, IP, server time, no account | That this person opened this exact frozen version by this link at this server time and recorded this decision. **Explicitly not a signature** |
| 4 | `electronic signature` | A statutory category of Закон № 2155-VIII, weaker than qualified | Not shipped. Nothing in v0.1 or v0.2 currently targets this level |
| 5 | `qualified electronic signature` (КЕП) | Only through a validated КНЕДП provider flow that passes the whole gate below | v0.2 per ADR-005. Until the gate below is fully satisfied a record is **not** level 5 |

### Verification status of the legal claims attached to the ladder

The six sourcing passes and the fabrication audit behind this document covered
ДБН А.3.1-5:2016, ДСТУ 9258:2023, the КБ forms and ПКМУ № 903. **They did not
fetch Закон № 2155-VIII.** Applying this document's own vocabulary honestly:

| Claim | Source named | Verification | Consequence |
|---|---|---|---|
| «КЕП має таку саму юридичну силу, як і власноручний підпис, та має презумпцію його відповідності» | ЗУ № 2155-VIII, ст. 18 | **UNVERIFIED** — cited by ADR-005 assumption **d** and by [competitive-landscape.md](competitive-landscape.md) §5.1; the law's own text was never obtained here | Not renderable as a normative string until the primary text is fetched, by the architectural rule below. It may be discussed in internal decision documents, which is where it currently lives |
| «підтвердження за посиланням є допустимим доказом» | ЗУ № 2155-VIII, ст. 17 ч. 7 | **UNVERIFIED** — same origin, same gap. Beyond ADR-005 assumption **d**, this claim had also reached three canonical documents that stated it flatly, with no tag: [glossary.md](../domain/glossary.md) (LINK_CONFIRMATION), [vision-and-positioning.md](vision-and-positioning.md), and [scope-and-boundaries.md](scope-and-boundaries.md). All three were corrected on 2026-08-06 and now carry the `UNVERIFIED` status instead; a recurrence in any of them is a defect against this row | Same. v0.1 prints the **negative** statement instead — «це підтвердження, а не електронний підпис» — which asserts nothing and therefore needs no source. The glossary is the sharpest case: its terms are canonical in product copy, and its own usage rule forbids adding a clause number through it |
| That технагляд **holds** a кваліфікаційний сертифікат | ПКМУ № 903, п. 3 | **Allow-listed** — item 10 of «What the product MAY assert» above, and only in that form: the person holds one | Storable on the participant record. **Whether Додаток В has a field for its серія and номер is NOT established** — item 10 establishes possession, not a form slot, and prohibition **E** bans the adjacent «ким видана». Nothing is printed into the act for it (ADR-005 §10 prints nothing either). It is a **competence credential, never an assurance level**; one must never be substituted for the other |

This is a gap in sourcing, not a contradiction of ADR-005. ADR-005 decides
*which level ships when*; this document decides *which string may be printed*.
Nothing here reopens that decision.

### The КЕП gate — all of it, or the record is not level 5

A level-5 claim requires every one of these, and a missing item downgrades
nothing automatically — it means the record cannot be created at level 5:

1. provider and legal procurement of a КНЕДП flow;
2. certificate-chain and qualified-status validation;
3. revocation checking (OCSP / CRL);
4. a trusted timestamp;
5. container / document-hash binding — for GoProceed, the hash of the frozen
   version, per ADR-005;
6. signer authority;
7. multi-signer order;
8. a stored validation report;
9. a long-term archive strategy that keeps the above verifiable for years.

**Failure never downgrades silently to click acceptance.** If validation fails
or the provider is unreachable, the command fails and says so. A failed КЕП
attempt must not be written as a level-3 record, and a level-3 record must not
be relabelled upward later.

### Standing rules

- **The label is on the artifact, not in the vendor's head.** Every rendered
  decision block prints its level. A package or act that cannot state the level
  of a decision it carries must not render that decision.
- **Assurance is about the mechanism, never about authority.** v0.1 verifies no
  signatory's authority to sign for their organisation; it records the claimed
  assurance label and the actor of the record, and nothing more. No screen, PDF
  or sales sentence may imply otherwise. Authority verification is not in v0.1
  or v0.2 scope.
- **Three typed signatory slots is a separate axis.** ADR-005 §10 fixes *who*
  signs a Додаток В / Додаток Г act; this ladder fixes *how strongly*. A filled
  slot at level 3 is a filled slot at level 3.
- **The architectural rule applies here unchanged:** a normative string carries
  its `verification` tag and its source in the data. Both Закон № 2155-VIII
  citations above are therefore unrenderable today, by construction and not by
  discipline.

## Required disclaimers

**On every page of a generated act blank**, small, footer:

> Форма за Додатком В (обов'язковим) ДБН А.3.1-5:2016 «Організація будівельного
> виробництва». Документ сформовано автоматично й офіційним виданням норми не є.
> Перевірено за Реєстром будівельних норм: **{дата останньої перевірки}**.

The approving order — «затвердженого наказом Мінрегіону від 05.05.2016 № 115,
чинного з 01.01.2017» — **was removed from this disclaimer on 2026-08-06** and
must not be restored by a template edit. It is asserted by no allow-list item,
and the architectural requirement below makes a string with no source
unrenderable; a mandatory disclaimer that carries one makes the act blank itself
unrenderable. See Open items for the only way it comes back.

**Under every generated requirement list**, never collapsed:

> Наведений перелік — це **довідковий Додаток Н** ДБН А.3.1-5:2016 (позиція
> Н.15 «Монтаж електротехнічних установок» / Н.14 «Внутрішні санітарно-технічні
> роботи»), відтворений дослівно. **Обов'язковий перелік прихованих робіт для
> вашого об'єкта визначає робоча документація** (п. 8.4.3.3 ДБН А.3.1-5:2016).
> Цей перелік її не замінює. За потреби такими актами оформлюють й інші види
> робіт.

**Next to every rendered decision or signatory block**, on the same page as the
actor and the server time:

> Рівень підтвердження: **{level}**.

and, for level 3 only, immediately after it:

> Це підтвердження за електронним посиланням із зафіксованими IP та серверним
> часом. **Це не електронний підпис.**

**Architectural requirement**, not text: every normative string the product
displays carries its `verification` tag and its source in the data, not in a
template. A string with no source must be unrenderable, so a future contributor
cannot add an unsourced line to Н.15 by editing a view.

## Open items

- **The primary ДБН file is not retained in the repository, and the fetch was
  never recorded.** Every allow-list item and every `VERIFIED_PRIMARY` row in
  [`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv)
  rests on one download no reviewer can reopen: all that survives of it is a
  host name and a byte count — no retrieval URL, no retrieval date, no hash.
  Under this document's own
  vocabulary that leaves the tag asserted and the source gone. Close it by
  committing the file, or a retrieval record carrying the exact URL, the
  retrieval date and a SHA-256 of the bytes, under `technical/requirements/`;
  until then no row's tag can be independently re-checked, which is the failure
  mode the fabrication audit exists to prevent. Nothing here downgrades an
  existing tag on its own — but a re-fetch that does not reproduce the same
  bytes must downgrade every row it touches to `VERIFIED_SECONDARY`.
  **This is not a thirteenth M0 gate.** It is the evidence that closes M0's gate
  «no normative string renderable without its `verification` tag **and its
  source**» ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7) for
  every `VERIFIED_PRIMARY` row v0.1 ships: by the vocabulary above, a source no
  reviewer can reopen leaves the tag asserted and the source gone, and a gate
  that requires a source is not closed while it is gone. M0 has **twelve** exit
  gates and this closes one of them.
- **Items 9–10 and 12–15 of the allow-list carry no verification tag and no
  retrieval record.** The ЗУ «Про будівельні норми», ЗУ «Про стандартизацію»,
  ПКМУ № 903, наказ Мінрегіону № 281 and наказ Мінрозвитку № 1069 primary texts
  are not retained here, and item 14's 16.06.2026 КБ-2в change is the sharpest
  case because it is a dated regulatory event permitted to be told to a customer.
  Until each is fetched and tagged, no item 9–10 or 12–15 may be printed in a
  customer-facing artifact — see §"Verification status of the allow-list itself".
  Item **11** was moved out of this bin on 2026-08-06: it is a claim about the
  ДБН's own text and rests on the same single unreproduced fetch as items 1–8,
  so it carries that bin's tag and that bin's caveat, and no more.
- **The approving order of ДБН А.3.1-5:2016 is asserted by no allow-list item.**
  «наказ Мінрегіону від 05.05.2016 № 115» and «чинного з 01.01.2017» are relied
  on by prohibition **N**, and no item of §"What the product MAY assert" carries
  either. Until 2026-08-06 they were also printed by the required act disclaimer
  above, which made this document mandate, on every page of a customer artifact,
  a string it simultaneously ruled unlicensed. **The approval clause was removed
  from that disclaimer on 2026-08-06**; the gap itself is not closed by the
  removal, only stopped from reaching a customer. The one remaining way to
  restore the clause is to fetch the наказ and add an allow-list row with its
  source under [docs/README.md](../README.md) §"Change control". **Until that
  happens this is a recorded gap, not a licence** — an open item is never a
  licence to assert, and prohibition **N**'s internal reasoning is not one
  either: it may keep using the наказ to argue that the standard is in force,
  and may not print it.
- **A Додаток Г title is in use that no item carries.** Item 4 allow-lists the
  Додаток Г form's four items and its differences from В; item 7 allow-lists one
  title, «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ», and it is the В title. Any other
  Додаток Г heading appearing in a product or market document is outside this
  list and is either sourced into it or reduced to «Додаток Г (обов'язковий)».
- **The CSV's source column was corrected on 2026-08-06 and the underlying gap
  remains open.** It previously read «звірено з двома незалежними копіями» on
  every row, while this document rules above that several sites repeating an
  identical block is one source, not corroboration. Every row now names the
  single unreproduced fetch and records «незалежність будь-яких додаткових копій
  не встановлена». What is still owed is the retrieval record in the first Open
  item above, not a further edit to this column.
- Додаток Е of ДСТУ 9254:2023 is paywalled and unread; its relationship to
  Додаток В is unknown. Resolve before claiming either form is the one to use.
- The ПУЕ:2026 primary text (наказ № 283) was not obtained.
- **The primary text of Закон № 2155-VIII was never fetched.** Both ст. 17 ч. 7
  and ст. 18 are carried as UNVERIFIED. Obtain the law before any citation of
  either article is printed in a customer-facing artifact, and re-tag both rows
  in the ladder when it is obtained.
- **No КНЕДП provider has been selected**, and none of the nine КЕП gate items
  has an owner. ADR-005 places КЕП in v0.2; until the gate is designed, level 5
  is a name in a table and nothing else.
- ПТЕЕС п. 13.5 «атестовані» versus «акредитовані» laboratories — conflict noted,
  primary text not obtained.
- A Київводоканал blank reportedly carries a fourth signatory absent from the
  norm; two passes agree, neither fetched the file.
