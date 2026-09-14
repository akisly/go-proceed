# technical/requirements

Primary sources for the requirement library and the statutory act, and the records that make their `VERIFIED_PRIMARY` tags re-derivable.

| File | What it is | Bound by |
|---|---|---|
| `dbn-a31-5-2016.pdf` | The official file of ДБН А.3.1-5:2016 «Організація будівельного виробництва», as published on e-construction.gov.ua. Building norms are not an object of copyright (ЗУ «Про будівельні норми» № 1704-VI, ст. 12 ч. 2) | `apps/app/src/lib/statutory-act-form.test.ts` hashes these bytes against `DBN_RETRIEVAL` |
| `dbn-a31-5-2016.retrieval.json` | The retrieval record: page URL, file URL, retrieval date, SHA-256, byte count, and every later reproduction of the same bytes | The same test compares it with `DBN_RETRIEVAL` in `apps/app/src/lib/statutory-act-form.ts` |
| `dbn-a31-5-2016.registry-checks.json` | Dated checks of the norm's registration: what was read, when, by whom, and the result | This procedure; M0 readiness gate 10 (`docs/delivery/production-readiness.md` §10) |
| `dbn-a31-5-2016-dodatok-n.csv`, `dbn-a31-5-2016-dodatok-v.csv` | Machine transcriptions of Додаток Н and Додаток В; every row's source column repeats the retrieval record's URL, date and hash | `apps/app/tests/requirement-library-fidelity.int.test.ts`, `apps/app/src/lib/dodatok-v-fidelity.test.ts` |

## What «the Реєстр будівельних норм» means here

The printed act footer says «Перевірено за Реєстром будівельних норм: {дата}». ЗУ «Про будівельні норми» ст. 10 ч. 6 registers building norms and their changes «шляхом внесення запису до Єдиної державної електронної системи у сфері будівництва» (ЄДЕССБ, e-construction.gov.ua), and names no «Реєстр будівельних норм»; neither do the ЄДЕССБ pages read on 2026-09-14. A check of «the Реєстр будівельних норм» in this repository is therefore a check of the norm's ЄДЕССБ entry. The footer's wording is BL-084.

## Repeating the registry check

Run it before a statutory act is frozen with a `registry_checked_on` later than the last recorded check, and at least whenever a new check date would be printed.

1. **Open the entry.** `https://e-construction.gov.ua/laws_detail/3879707932224390963`. Record the access time in UTC. Read and write down: «Статус», the «Редакція від» date, the registration number (`BN01:4205-4602-0357-0183` on 2026-09-14), the approving order, and whether any «Зміна» or later edition is listed. Keep the response headers (`curl -D`); their `date` is the access time.
2. **Open the listing.** `https://e-construction.gov.ua/laws/doc_type=2` («Державні будівельні норми»). Find the row for ДБН А.3.1-5:2016 and record its status.
3. **Re-fetch the file and hash it.** Follow the PDF link on the entry page, save it outside the repository, and compare `shasum -a 256` and the byte count with `dbn-a31-5-2016.retrieval.json`. Append a `reproductions` item there when they match.
4. **Append a check** to `dbn-a31-5-2016.registry-checks.json` with what steps 1–3 showed, who checked and who confirmed. The owner confirms a check performed by an agent.
5. **Decide what the result means.**
   - Same status «Діючий», no change listed, same bytes: the check date may be printed; nothing else changes.
   - Different bytes, a new edition, a «Зміна», or a status other than «Діючий»: do not print the new date. The rows resting on these bytes downgrade to `VERIFIED_SECONDARY` (`docs/delivery/production-readiness.md` §10), and the owner decides the next step in a task record. Do not replace the committed PDF, `dbn-a31-5-2016.retrieval.json` or `DBN_RETRIEVAL` to make new bytes pass: the committed bytes are what the rows were verified against, and the change goes through that task.
   - The entry or the listing cannot be reached: record the failed attempt; the previous check stands, and no later date is printed.

A check performed from a summary (a search result, a model's reading of a page) is not a check. Record what the page itself said.
