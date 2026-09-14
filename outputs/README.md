# Prospecting session outputs

> **Personal data of natural persons.** Read [BL-079](../docs/BACKLOG.md#bl-079) and [BL-080](../docs/BACKLOG.md#bl-080) before copying, sharing or adding anything here. Written by DEV-007 on 2026-09-14.

One agent session, `01a033d9-c008-7011-bf7b-e1dbd14e2e9d`, dated 2026-08-24 and 2026-08-25, built the pilot prospect base: public procurement records from ProZorro, company sites, scoring, a shortlist and an outreach pack. Commit `bbfc705` (2026-08-28) added the directory together with an unrelated landing change. The owner keeps it as the client-prospecting record (2026-09-13).

| Group | Files |
|---|---:|
| Analysis notebooks and their generators | 4 |
| Pilot shortlist, conversion workbook, workbook screenshots and the unsent A1-N01 outreach pack | 28 |
| Candidate and ProZorro waves 2–7: collection, normalisation, validation and browser checks | 110 |
| Unified prospect bases, prospecting workbooks and their inspection dumps | 68 |
| Workbook preview screenshots | 40 |
| **Total** | **250** |

## What to know before reading

- **Outreach.** The A1-N01 pack (`pilot_outreach_A1-N01_2026-08-25.md` and `.json`) was prepared and never sent; [docs/STATUS.md](../docs/STATUS.md) «Outreach» carries the current state.
- **Personal data.** DEV-007's security review found buyer-side contact persons in the raw ProZorro search dumps, sole traders under their personal names with personal tax numbers, private customers named in tender titles, and outreach routes that are free-mail addresses or mobile numbers. How the directory is kept is an owner decision (BL-079); the review deleted nothing.
- **Scripts are a dated record, not runnable.** They load their inputs by absolute paths on the operator's disk on the day they ran, and some of those names carry the product's pre-rename name, so `scripts/validate-canonical-docs.mjs` exempts this directory from the rename guard.
- **Large files.** The `*.xlsx.inspect.ndjson` files are text dumps of the workbooks, up to about 49 MB each.
