#!/usr/bin/env node
// Canonical GoProceed documentation validator (plan Task 9).
// Guards the source-of-truth package against drift:
//   1. required active paths exist;
//   2. active human-readable docs carry the metadata contract;
//   3. active AktFlow branding appears only in legacy/history context;
//   4. relative doc links resolve;
//   5. technical/migration CSVs are well-shaped; dispositions are unique and known;
//   6. catalog/SQL coherence: entity catalog <-> design DDL, invariant refs;
//   7. no deployed table is tagged to a future version;
//   8. every table ADR-006 decision 4 builds in v0.1 still carries a v0.1 marker;
//   9. capability <-> route-set coherence;
//  10. event-producer <-> route-set coherence;
//  11. ADR-006 decision 4's and roadmap.md's milestone tables enumerate exactly
//      the transcribed build list, and no fully-built milestone (M3-M6) carries
//      a catalog row the list forgot;
//  12. the transcribed list is the size the package states in prose;
//  13. version-0.1.md's per-milestone `v0.1 tables` and `already in the
//      runtime` counts are the ones the list projects through the catalog and
//      the migration FILES. Read `deployedTables` before trusting the word
//      "runtime" here: since 2026-08-06 ten migration files exist that have
//      never been executed, so this guard answers "is the DDL written" and NOT
//      "does the table exist". version-0.1.md carries the applied-only counts
//      in prose beneath the table this guard checks.
// Guards 11-13 were added on 2026-08-06 after the final audit: three tables
// moved into v0.1 that day, four copies of the build list were edited by four
// hands, three of them ended up disagreeing, and this file passed anyway
// because guard 8 held its own private copy of the list and ran one way only.
// Guards 7-10 were added on 2026-08-06 after the ADR-006/ADR-007 re-cut audit
// found the same three shapes in three separate catalogs: a v0.2 marker on a
// table that exists in an applied migration, a v0.1 capability naming a v0.2
// operation (or an operation id that was renamed out of both scope CSVs), and a
// v0.1 event whose only producer had moved to v0.2. Each is invisible to a
// human reader of one row and mechanical to catch across files.
// Exits non-zero with every failure listed in one run.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// `git ls-files` for the stale-role-name guard: it enumerates TRACKED files
// only, which is both what that guard wants (never scan node_modules, a build
// output directory or a gitignored QA artifact) and the same source the P1
// entry's own measurement commands used, so the guard and the entry count the
// same tree.
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (msg) => failures.push(msg);
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// --------------------------------------------------------------------------
// Parsers (pure, so the self-test below can exercise them in memory)
// --------------------------------------------------------------------------

const METADATA_KEYS = ["Status", "Applies to", "Last reviewed", "Related decisions"];

export function missingMetadata(markdown) {
  return METADATA_KEYS.filter((key) => !new RegExp(`\\*\\*${key}:\\*\\*`).test(markdown));
}

// AktFlow may appear only on lines that are explicitly historical/legacy
// context (docs/legacy/README.md policy).
//
// THE ROLE-NAME EXEMPTION IS NARROWER THAN IT WAS, and the comment that stood
// here was the reason to revisit it. It read: «The PostgreSQL role identifiers
// (aktflow_app, aktflow_app_login, aktflow_worker, aktflow_service,
// aktflow_service_login) are runtime names, not doc branding, and are not being
// renamed — they are ignored here.» The last clause stopped being true on
// 2026-08-17 (migration 0057), and the strip below went on excusing the old
// names from the branding rule regardless.
//
// The strip is kept, because the premise still holds — a role identifier IS a
// runtime name rather than branding, and `goproceed_app` on a line would
// otherwise have to be spelled around. It now matches BOTH spellings, so a
// stale `aktflow_app` is still not reported as branding here; it is reported by
// `staleRoleNameErrors` below, which says the right thing about it instead of
// calling it a branding violation.
const LEGACY_CONTEXT = /legacy|historic|supersede|era|migration|former|old /i;
export function brandingViolations(markdown) {
  const bad = [];
  markdown.split("\n").forEach((line, i) => {
    const stripped = line.replace(/(?:aktflow|goproceed)_[\w]+/g, "");
    if (/AktFlow/i.test(stripped) && !LEGACY_CONTEXT.test(line)) bad.push(i + 1);
  });
  return bad;
}

/**
 * THE FIVE OLD POSTGRESQL ROLE NAMES MAY APPEAR ONLY IN A RECORD OF WHAT
 * HAPPENED — never in a file that describes the system as it is.
 *
 * Migration 0057 renamed `aktflow_app`, `aktflow_app_login`, `aktflow_worker`,
 * `aktflow_service` and `aktflow_service_login` to `goproceed_*`. The rename
 * was landed while it was still free: no environment had ever applied this
 * migration chain (`infra/README-staging.md` §Status), so there was no live
 * connection string to coordinate — which is precisely the condition that
 * disappears the day the P0 origin is provisioned.
 *
 * This guard is what stops the old names creeping back into live code and
 * documents afterward. It is deliberately a PATH rule rather than a content
 * rule: the question is not whether a line looks historical, it is whether the
 * FILE is a record. Four directories are records and are exempt in full —
 *
 *   supabase/migrations/     a migration is history; 0003 and 0034 created the
 *                            roles under the old names and must go on saying so
 *   docs/legacy/             the AktFlow era, by that directory's own policy
 *   docs/superpowers/        dated plans, specs and evidence — artefacts of the
 *                            session that produced them, annotated when they go
 *                            stale and never rewritten
 *   migration/               the canonical-package transfer record and its
 *                            catalog snapshots
 *
 * — plus the two dated review records named individually below, and TODOS.md,
 * whose closed entry quotes the old names as the measurement it was tracking.
 *
 * Anything else naming an old role is a stale reference, and the message says
 * which file and which name so the fix is one substitution.
 */
const ROLE_RECORD_DIRS = [
  "supabase/migrations/",
  "docs/legacy/",
  "docs/superpowers/",
  "migration/",
];
const ROLE_RECORD_FILES = new Set([
  // A dated package review: it records what the roles were called on the day it
  // was written, and rewriting it would falsify the review.
  "docs/delivery/package-review-2026-08-04.md",
  // The P1 entry that tracked this rename, including the grep commands whose
  // output only makes sense against the old names.
  "TODOS.md",
  // The handoff is a session record too, and §0a.3 of it is the account OF
  // this rename — it has to be able to say which names moved to which.
  "HANDOFF.md",
]);
// The five whole names, AND the SQL LIKE prefix that was written to match them
// as a set. `aktflow%` was missed by the first version of this guard and cost a
// silent defect: `scripts/snapshot-db-catalog.mjs` selected roles with
// `rolname like 'aktflow%'`, so after migration 0057 it went on succeeding and
// simply returned no project roles — the catalog snapshot lost the five rows a
// reviewer reads to see who can log in and who bypasses RLS, with nothing
// failing. A guard that only knows whole identifiers cannot see a prefix that
// was built to match them, so the prefix is named here explicitly.
const OLD_ROLE_RE = /\baktflow_(app_login|app|service_login|service|worker)\b|aktflow%/g;

/**
 * THIS FILE, and it is not filed with the records above because it is not one.
 *
 * A rule that forbids a string has to be able to write that string down: the
 * pattern, the message that names the replacement, and the self-test fixtures
 * that prove the detector fires all contain the five old names on purpose. The
 * alternative — assembling them from fragments so the literal never appears —
 * would hide the rule from anyone grepping for it, which is a worse outcome
 * than one exemption stated out loud.
 *
 * It is deliberately a single file and not a `scripts/` directory rule:
 * `set-local-app-password.mjs` and `validate_package.py` live there too and are
 * live code with no business naming a pre-rename role.
 */
const ROLE_RULE_DEFINITION = "scripts/validate-canonical-docs.mjs";

export function isRoleRecordPath(relPath) {
  return relPath === ROLE_RULE_DEFINITION
    || ROLE_RECORD_DIRS.some((d) => relPath.startsWith(d))
    || ROLE_RECORD_FILES.has(relPath);
}

/**
 * NO LIVE FILE MAY NAME A PRE-RENAME DOMAIN.
 *
 * The product was renamed to GoProceed on 2026-08-03, and the old domains
 * outlived it in the worst possible place: `infra/README-staging.md` — the
 * runbook an operator follows to PROVISION the P0 — spelled the old product's
 * hostnames in nine places, including every `curl` of its verification
 * checklist. Following it would have bound DNS and a Vercel domain to a product
 * that no longer exists, at the one moment where that is expensive to undo.
 *
 * They are placeholder tokens now (`{{APP_HOSTNAME}}`, `{{LANDING_HOSTNAME}}`,
 * defined in that runbook's §0) rather than corrected literals, because nobody
 * has decided the real domain and `apps/demo/README.md` §2 forbids inventing
 * one. This guard is what stops a literal — old OR newly invented — creeping
 * back in, and it shares `isRoleRecordPath`'s record exemptions for the same
 * reason: the question is whether the FILE is a record, not whether the line
 * reads as historical.
 *
 * `aktflow.pilot` is deliberately NOT matched. It is a localStorage key
 * namespace, not a hostname, and it survives on purpose as
 * `LEGACY_DRAFT_KEY` in `apps/demo/src/pilot/draft.ts` — the constant that
 * migrates a visitor's saved draft forward instead of orphaning it.
 */
const OLD_DOMAIN_RE = /\baktflow\.(com|app|example)\b/g;

export function staleDomainErrors(relPath, text) {
  if (isRoleRecordPath(relPath)) return [];
  const seen = new Set();
  for (const m of text.matchAll(OLD_DOMAIN_RE)) seen.add(m[0]);
  return [...seen].sort().map((d) =>
    `${relPath}: names the pre-rename domain \`${d}\` — the product is GoProceed and no domain for it is `
    + "recorded as registered anywhere in this repository. Use a placeholder token "
    + "({{APP_HOSTNAME}}/{{LANDING_HOSTNAME}}, see infra/README-staging.md §0) rather than inventing one");
}

export function staleRoleNameErrors(relPath, text) {
  if (isRoleRecordPath(relPath)) return [];
  const seen = new Set();
  for (const m of text.matchAll(OLD_ROLE_RE)) seen.add(m[0]);
  return [...seen].sort().map((name) => name === "aktflow%"
    ? `${relPath}: uses the SQL LIKE prefix \`aktflow%\`, which matched the project's PostgreSQL `
      + "roles until migration 0057 renamed them and now matches nothing — a query written this way "
      + "keeps SUCCEEDING and silently returns no project roles. Use `goproceed%`"
    : `${relPath}: names the pre-rename PostgreSQL role \`${name}\` — migration 0057 renamed it to `
      + `\`${name.replace("aktflow_", "goproceed_")}\`. Only a record of what happened may keep the old `
      + "name (see isRoleRecordPath in scripts/validate-canonical-docs.mjs)");
}

export function relativeLinks(markdown) {
  const links = [];
  const re = /\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    links.push(target.split("#")[0]);
  }
  return links.filter(Boolean);
}

export function parseCsv(text) {
  // Catalog CSVs are written without embedded newlines; quoted fields may
  // contain commas (entity catalog does not use them, but the parser stays
  // honest about quotes).
  const rows = [];
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

export function csvShapeErrors(text, name) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [`${name}: no data rows`];
  const width = rows[0].length;
  return rows.flatMap((r, i) => (r.length === width ? [] : [`${name}: ragged row ${i + 1} (${r.length} != ${width})`]));
}

const DISPOSITIONS = new Set(["keep", "rewrite", "merge", "defer", "archive", "delete_after_transfer"]);
export function dispositionErrors(text) {
  const rows = parseCsv(text);
  const header = rows[0];
  const src = header.indexOf("source_path");
  const disp = header.indexOf("disposition");
  const reason = header.indexOf("reason");
  const errs = [];
  const seen = new Set();
  for (const r of rows.slice(1)) {
    if (seen.has(r[src])) errs.push(`duplicate disposition source: ${r[src]}`);
    seen.add(r[src]);
    if (!DISPOSITIONS.has(r[disp])) errs.push(`unknown disposition '${r[disp]}' for ${r[src]}`);
    if (!r[reason]) errs.push(`missing reason for ${r[src]}`);
  }
  return errs;
}

// Per-milestone operation counts, from the CSV that docs/README.md precedence
// level 3 makes the v0.1 route-set authority.
export function scopeMilestoneCounts(text) {
  const rows = parseCsv(text);
  const col = rows[0].indexOf("milestone");
  const counts = new Map();
  if (col === -1) return counts;
  for (const r of rows.slice(1)) {
    if (r.length <= col) continue;
    counts.set(r[col], (counts.get(r[col]) ?? 0) + 1);
  }
  return counts;
}

// Counts a prose document states about a milestone. Digits and spelled-out
// numbers both count; anything else in the slot ("the seven-odd", "the
// remaining") is reported as unparseable rather than silently skipped, because
// a count the guard cannot read is a count nothing checks.
const NUMBER_WORDS = new Map(Object.entries({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, "twenty-one": 21, "twenty-two": 22, "twenty-three": 23,
  "twenty-four": 24, "twenty-five": 25, "twenty-six": 26, "twenty-seven": 27,
  "twenty-eight": 28, "twenty-nine": 29, thirty: 30,
}));

export function statedOperationCounts(markdown) {
  const stated = [];
  const push = (milestone, token) => {
    const n = /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS.get(token.toLowerCase());
    stated.push({ milestone, token, count: n === undefined ? null : n });
  };
  // Prose: "the 14 `v0.1-M2` operations" / "the two `v0.1-M6` operations".
  const prose = /\bthe ([A-Za-z-]+|\d+) `(v0\.1-M\d)` (?:operations|queries)\b/g;
  let m;
  while ((m = prose.exec(markdown)) !== null) push(m[2], m[1]);
  // Table: "| `v0.1-M2` | 14 |".
  const table = /^\|\s*`(v0\.1-M\d)`\s*\|\s*(\d+)\s*\|/gm;
  while ((m = table.exec(markdown)) !== null) push(m[1], m[2]);
  return stated;
}

// Fails in both directions: a stated count the CSV contradicts (or names a
// milestone the CSV has no rows for), and a milestone in the CSV that the
// document never states a count for.
export function operationCountErrors(markdown, scopeCsv, docName) {
  const errs = [];
  const actual = scopeMilestoneCounts(scopeCsv);
  const stated = statedOperationCounts(markdown);
  for (const s of stated) {
    if (s.count === null) {
      errs.push(`${docName}: unreadable operation count '${s.token}' for ${s.milestone}`);
    } else if (!actual.has(s.milestone)) {
      errs.push(`${docName}: states ${s.count} ${s.milestone} operations; scope-v0.1.csv has no ${s.milestone} rows`);
    } else if (actual.get(s.milestone) !== s.count) {
      errs.push(`${docName}: states ${s.count} ${s.milestone} operations; scope-v0.1.csv has ${actual.get(s.milestone)}`);
    }
  }
  const seen = new Set(stated.map((s) => s.milestone));
  for (const [milestone, count] of actual) {
    if (!seen.has(milestone)) {
      errs.push(`${docName}: states no operation count for ${milestone}, which has ${count} row(s) in scope-v0.1.csv`);
    }
  }
  return errs;
}

// --------------------------------------------------------------------------
// Cross-catalog coherence (guards 7-9)
// --------------------------------------------------------------------------

/**
 * Table names a migration FILE creates.
 *
 * NAME CORRECTED IN INTENT 2026-08-08 (the identifier stays `deployedTables`
 * because three guards and the self-test call it). This reads every `.sql` under
 * `supabase/migrations/`, applied or not, so what it answers is «is the DDL
 * WRITTEN», not «does the table exist». Until 2026-08-06 the two were the same
 * question: every migration in the tree had run. They are not the same now —
 * `0041`–`0050` are ten files that have never been executed anywhere — and the
 * gap is exactly seventeen of the twenty-six tables in ADR006_V01_BUILD_LIST.
 *
 * Guard 7 is unaffected and stays right for the stronger reason: a marker saying
 * a table arrives in v0.2 while a committed migration file creates it is false
 * whether or not that file has run.
 *
 * Guard 13's `already` column inherits the same meaning, and
 * `docs/delivery/version-0.1.md` now says so beneath the table it checks, with
 * the applied-only counts written out beside it.
 */
export function deployedTables(sqlTexts) {
  const found = new Set();
  for (const sql of sqlTexts) {
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/g)) found.add(m[1]);
  }
  return found;
}

// A `status_version` naming a version later than v0.1. Applied migrations are
// precedence level 1 in docs/README.md, so a marker that says a deployed table
// arrives later is false about the world, whatever the build plan says. The
// deferral is of the WORK, and the entity catalog records that in `purpose`.
const FUTURE_VERSIONS = new Set(["v0.2", "v0.3"]);
export function futureVersionOnDeployedTableErrors(entityCsv, deployed) {
  const rows = parseCsv(entityCsv);
  const ent = rows[0].indexOf("entity");
  const ver = rows[0].indexOf("status_version");
  if (ent === -1 || ver === -1) return ["entity-catalog.csv: missing entity or status_version column"];
  return rows.slice(1).flatMap((r) => (FUTURE_VERSIONS.has(r[ver]) && deployed.has(r[ent])
    ? [`entity-catalog.csv: ${r[ent]} is tagged ${r[ver]} but an applied migration creates it`]
    : []));
}

// ADR-006 decision 4's build list, transcribed, as amended by the owner on
// 2026-08-06 (amendment note in decision 4): `requirement_exception_heads` and
// `requirement_evidence_decision_heads` entered v0.1-M3 and
// `external_decision_batches` entered v0.1-M5, moving the list from 23 to 26
// and the new build from 14 to 17.
//
// The entity catalog is an inventory and legitimately carries more v0.1 rows
// than this — every table already deployed in an applied migration keeps its
// marker even when no numbered step extends it (version-0.1.md §"Operations and
// tables per milestone"). That is why the catalog check below runs one way for
// M1 and M2. M3 through M6 build every table they mark, so for those the check
// runs both ways: guard 11 catches a row the catalog carries at v0.1-M3..M6
// that this list forgot.
const ADR006_V01_BUILD_LIST = [
  "parties", "projects", "contracts", "contract_versions", "work_items",
  "requirement_rule_versions", "requirement_library_items", "contract_version_rule_bindings",
  "work_assignments", "requirement_occurrences", "progress_entries", "upload_intents", "evidence_objects",
  "work_stages", "stage_closures", "requirement_evidence_decisions", "requirement_exceptions",
  "requirement_exception_heads", "requirement_evidence_decision_heads",
  "readiness_projection", "blocked_reasons",
  "statutory_acts", "statutory_act_versions",
  "external_access_grants", "external_sessions", "external_decision_batches",
];
// The size the four documents state in prose. Pinned here so that editing the
// array without editing the documents (or the reverse) is a failure and not a
// silent 23-versus-26 disagreement, which is what happened on 2026-08-06.
const ADR006_V01_BUILD_TOTAL = 26;
// Milestones that build every table they mark. M1 and M2 also carry
// deployed-but-not-extended rows, so only these are checked in both directions.
const FULLY_BUILT_MILESTONES = new Set(["v0.1-M3", "v0.1-M4", "v0.1-M5", "v0.1-M6"]);

export function buildListErrors(entityCsv, buildList) {
  const rows = parseCsv(entityCsv);
  const ent = rows[0].indexOf("entity");
  const ver = rows[0].indexOf("status_version");
  if (ent === -1 || ver === -1) return ["entity-catalog.csv: missing entity or status_version column"];
  const versionOf = new Map(rows.slice(1).map((r) => [r[ent], r[ver]]));
  const listed = new Set(buildList);
  const errs = buildList.flatMap((t) => {
    if (!versionOf.has(t)) return [`entity-catalog.csv: ADR-006 decision 4 builds ${t} in v0.1 and the catalog has no row for it`];
    const v = versionOf.get(t);
    return v.startsWith("v0.1") ? [] : [`entity-catalog.csv: ADR-006 decision 4 builds ${t} in v0.1 but the catalog marks it ${v}`];
  });
  for (const [t, v] of versionOf) {
    if (FULLY_BUILT_MILESTONES.has(v) && !listed.has(t)) {
      errs.push(`entity-catalog.csv: ${t} is marked ${v} but the transcribed ADR-006 decision 4 build list does not name it`);
    }
  }
  return errs;
}

// --------------------------------------------------------------------------
// Guards 11-13: the build list is transcribed in four places — the array
// above, ADR-006 decision 4's own milestone table, roadmap.md's milestone
// table, and version-0.1.md's `v0.1 tables` column. On 2026-08-06 three tables
// moved into v0.1; the array, the ADR's table and version-0.1.md's slices were
// each updated by a different hand and disagreed for a day, and nothing failed
// because guard 8 held its own private copy and ran one way. These guards make
// every copy answerable to the same 26 names.
// --------------------------------------------------------------------------

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/**
 * Rows of the first markdown table whose header cells start with `headerCells`.
 * Returns null when no such table exists, so a renamed heading is a failure
 * rather than a guard that quietly checks nothing.
 */
export function markdownTableRows(markdown, headerCells) {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trimStart().startsWith("|")) continue;
    const head = splitTableRow(lines[i]);
    if (!headerCells.every((c, j) => (head[j] ?? "").toLowerCase() === c.toLowerCase())) continue;
    if (!/^\s*\|[\s|:-]+$/.test(lines[i + 1])) continue;
    const rows = [];
    for (let k = i + 2; k < lines.length && lines[k].trimStart().startsWith("|"); k++) rows.push(splitTableRow(lines[k]));
    return rows;
  }
  return null;
}

/** Guard 11: a milestone table that enumerates table names must enumerate exactly these. */
export function milestoneTableNameErrors(markdown, docName, buildList) {
  const rows = markdownTableRows(markdown, ["Milestone", "Tables", "Already in the runtime"]);
  if (!rows) return [`${docName}: no "| Milestone | Tables | Already in the runtime |" table found`];
  const named = [];
  for (const r of rows) {
    const cell = r[1] ?? "";
    if (/^none\b/i.test(cell)) continue; // "none. It is a query over `x` and `y`"
    for (const m of cell.matchAll(/`([a-z_]+)`/g)) named.push(m[1]);
  }
  const errs = [];
  const want = new Set(buildList);
  const got = new Set(named);
  if (named.length !== got.size) errs.push(`${docName}: its milestone table names some table twice`);
  for (const t of want) if (!got.has(t)) errs.push(`${docName}: its milestone table omits ${t}, which ADR-006 decision 4 builds in v0.1`);
  for (const t of got) if (!want.has(t)) errs.push(`${docName}: its milestone table names ${t}, which is not in ADR-006 decision 4's v0.1 build list`);
  return errs;
}

/**
 * Guard 12: per-milestone build and already-deployed counts, derived from the
 * build list projected through the entity catalog's markers and the applied
 * migrations. No second private copy: the numbers come from the same three
 * sources the rest of this file uses.
 */
export function buildListMilestoneCounts(entityCsv, buildList, deployed) {
  const rows = parseCsv(entityCsv);
  const ent = rows[0].indexOf("entity");
  const ver = rows[0].indexOf("status_version");
  const versionOf = new Map(rows.slice(1).map((r) => [r[ent], r[ver]]));
  const builds = new Map();
  const already = new Map();
  for (const t of buildList) {
    const v = versionOf.get(t);
    if (!v) continue; // reported by buildListErrors
    builds.set(v, (builds.get(v) ?? 0) + 1);
    if (deployed.has(t)) already.set(v, (already.get(v) ?? 0) + 1);
  }
  return { builds, already };
}

/** Guard 13: version-0.1.md states these counts rather than the names. */
export function milestoneTableCountErrors(markdown, docName, counts, total) {
  const rows = markdownTableRows(markdown, ["Milestone", "Operations", "v0.1 tables", "Already in the runtime"]);
  if (!rows) return [`${docName}: no "| Milestone | Operations | v0.1 tables | Already in the runtime |" table found`];
  const errs = [];
  const seen = new Set();
  for (const r of rows) {
    const label = (r[0] ?? "").replace(/`/g, "");
    const num = (cell) => (/^-?\d+$/.test(cell ?? "") ? Number(cell) : null);
    if (/^Total\b/i.test(label)) {
      if (num(r[2]) !== total) errs.push(`${docName}: its Total row says ${r[2]} v0.1 tables; the build list has ${total}`);
      const deployedTotal = [...counts.already.values()].reduce((a, b) => a + b, 0);
      if (num(r[3]) !== deployedTotal) errs.push(`${docName}: its Total row says ${r[3]} already in the runtime; the build list has ${deployedTotal}`);
      continue;
    }
    if (!/^v0\.1-M[0-9]$/.test(label)) continue; // the M0 row carries no table count
    seen.add(label);
    const wantBuild = counts.builds.get(label) ?? 0;
    const wantDeployed = counts.already.get(label) ?? 0;
    if (num(r[2]) !== wantBuild) errs.push(`${docName}: ${label} states ${r[2]} v0.1 tables; the build list has ${wantBuild}`);
    if (wantBuild > 0 && num(r[3]) !== wantDeployed) {
      errs.push(`${docName}: ${label} states ${r[3]} already in the runtime; the build list has ${wantDeployed}`);
    }
  }
  for (const m of counts.builds.keys()) {
    if (!seen.has(m)) errs.push(`${docName}: its milestone table has no row for ${m}, which builds ${counts.builds.get(m)} tables`);
  }
  return errs;
}

function operationIds(scopeCsv) {
  const rows = parseCsv(scopeCsv);
  const col = rows[0].indexOf("operation_id");
  return new Set(rows.slice(1).map((r) => r[col]).filter(Boolean));
}

/**
 * Every capability names operations that exist; a v0.1 capability names no
 * operation that lives only in the v0.2 scope; and every v0.1 operation is
 * named by some capability. `exempt` carries the operations deliberately
 * governed by no capability, listed with their reason in
 * technical/openapi/README.md §Conventions.
 */
export function capabilityCoherenceErrors(capCsv, scope1, scope2, exempt) {
  const v1 = operationIds(scope1);
  const v2 = operationIds(scope2);
  const rows = parseCsv(capCsv);
  const idCol = rows[0].indexOf("capability_id");
  const opCol = rows[0].indexOf("related_operations");
  const msCol = rows[0].indexOf("milestone");
  if (idCol === -1 || opCol === -1 || msCol === -1) return ["capabilities.csv: missing a required column"];
  const errs = [];
  const named = new Set();
  for (const r of rows.slice(1)) {
    const milestone = r[msCol] ?? "";
    for (const op of (r[opCol] ?? "").split(" ").filter((o) => o && o !== "none")) {
      named.add(op);
      if (!v1.has(op) && !v2.has(op)) {
        errs.push(`capabilities.csv: ${r[idCol]} names ${op}, which is in neither scope CSV`);
      } else if (milestone.startsWith("v0.1") && !v1.has(op)) {
        errs.push(`capabilities.csv: ${r[idCol]} is ${milestone} but names ${op}, which is v0.2`);
      }
    }
  }
  for (const op of v1) {
    if (!named.has(op) && !exempt.has(op)) {
      errs.push(`capabilities.csv: no capability governs the v0.1 operation ${op}`);
    }
  }
  return errs;
}

/**
 * Every `bff.<operation>` producer resolves to a route-set row, and a v0.1
 * event that names any BFF producer names at least one v0.1 operation —
 * otherwise the event cannot be raised in the version it claims.
 */
export function eventProducerErrors(eventCsv, scope1, scope2) {
  const v1 = operationIds(scope1);
  const v2 = operationIds(scope2);
  const rows = parseCsv(eventCsv);
  const evCol = rows[0].indexOf("event");
  const prCol = rows[0].indexOf("producer");
  const msCol = rows[0].indexOf("milestone");
  if (evCol === -1 || prCol === -1 || msCol === -1) return ["event-catalog.csv: missing a required column"];
  const errs = [];
  for (const r of rows.slice(1)) {
    const ops = [...(r[prCol] ?? "").matchAll(/\bbff\.([a-z_]+(?:\.[a-z_]+)+)/g)].map((m) => m[1]);
    for (const op of ops) {
      if (!v1.has(op) && !v2.has(op)) {
        errs.push(`event-catalog.csv: ${r[evCol]} is produced by ${op}, which is in neither scope CSV`);
      }
    }
    if ((r[msCol] ?? "").startsWith("v0.1") && ops.length && !ops.some((op) => v1.has(op))) {
      errs.push(`event-catalog.csv: ${r[evCol]} is ${r[msCol]} but every named producer is v0.2`);
    }
  }
  return errs;
}

/**
 * THE PRESET CONTRACT — three rules, and the reason all three exist.
 *
 * Six v0.1 capabilities — `stage_closures.close`, `evidence_decisions.decide`,
 * `requirement_exceptions.decide`, `progress.adjust`, `readiness.view`,
 * `statutory_acts.compose` — sat in NO preset's `maps_to_capabilities` column
 * for the whole of M3–M6. Every route was built, every invariant enforced,
 * every integration suite green, and no named persona could invoke any of them:
 * the suites granted the capabilities by hand, which is exactly the shape of a
 * gap a fixture hides. Nothing in this validator noticed, because
 * `responsibility-presets.csv` was on the REQUIRED list and therefore checked
 * only for EXISTENCE. Mapped 2026-08-17 by owner decision; these rules are what
 * stop the class rather than the instance.
 *
 * 1. REACHABILITY — every v0.1 capability ON THE PROJECT PLANE is in at least
 *    one preset, or is in `exempt` with its reason recorded at the call site.
 *    This is the rule that was missing.
 *
 *    PROJECT PLANE ONLY, and the restriction is the rule rather than a
 *    convenience: a preset is a documented bundle of `project_access_grants`
 *    rows, so the project plane is the only one it can grant. The other three
 *    v0.1 planes reach a caller by mechanisms presets cannot express —
 *    `workspace` from the governance role via `workspaceCapabilities(role)`
 *    (packages/domain/src/authz.ts), `service` from the service principal's own
 *    login (`goproceed_service_login`, migration 0034), `external` from a bearer
 *    grant held by someone who is not a member at all. Requiring a preset for
 *    those would demand a persona for a capability no persona can hold; the
 *    first draft of this guard did exactly that and reported 13 false
 *    positives, which is how the restriction came to be written down.
 *
 * 2. RESOLVABILITY — every capability a preset names exists in
 *    `capabilities.csv`, and names a PROJECT-plane one. A typo is invisible in
 *    review and silently makes a persona weaker than its description claims;
 *    `maps_to_capabilities` is space-separated free text with nothing else
 *    checking it. A preset naming a workspace- or service-plane capability is
 *    the same error in a subtler form — a grant that could never be issued.
 *
 * 3. SEPARATION OF DUTIES — no single preset holds `stage_closures.close`
 *    together with either capability that can SATISFY an occurrence.
 *
 *    Not a style rule, and not derivable from reading the two capability
 *    descriptions. `readiness.ts`'s `satisfiedFor()` treats a current `waiver`
 *    or `accept_risk` exception head as satisfying an occurrence, exactly as an
 *    accepting evidence decision does, and INV-063 keeps both kinds available
 *    even on a `hold`. So an exception is a SECOND route past
 *    `can_close_stage`. A preset holding the escape and the closure together
 *    lets one member clear his own blocker and close over it, without the
 *    independent accepting decision INV-061 exists to require — and INV-069's
 *    «may not decide their own capture» would not fire, because he never
 *    captured anything.
 *
 *    `readiness.ts:407` already reasons from this being false: it justifies an
 *    advisory lock over `select ... for update` with «The CLOSER holds
 *    stage_closures.close and need not hold either». That sentence was an
 *    assumption about a CSV nothing validated. It is a rule now.
 */
export function presetCoherenceErrors(presetCsv, capCsv, exempt) {
  const capRows = parseCsv(capCsv);
  const capIdCol = capRows[0].indexOf("capability_id");
  const capMsCol = capRows[0].indexOf("milestone");
  const capPlCol = capRows[0].indexOf("plane");
  if (capIdCol === -1 || capMsCol === -1 || capPlCol === -1) {
    return ["capabilities.csv: missing a required column"];
  }

  const known = new Set();
  const projectCaps = new Set();
  const v1ProjectCaps = new Set();
  for (const r of capRows.slice(1)) {
    const id = r[capIdCol];
    if (!id) continue;
    known.add(id);
    if (r[capPlCol] !== "project") continue;
    projectCaps.add(id);
    if ((r[capMsCol] ?? "").startsWith("v0.1")) v1ProjectCaps.add(id);
  }

  const rows = parseCsv(presetCsv);
  const pidCol = rows[0].indexOf("preset_id");
  const mapCol = rows[0].indexOf("maps_to_capabilities");
  if (pidCol === -1 || mapCol === -1) return ["responsibility-presets.csv: missing a required column"];

  const errs = [];
  const granted = new Set();
  // The two capabilities that can make a blocking occurrence satisfied. Both,
  // not just the evidence decision — see rule 3 above.
  const SATISFIES_OCCURRENCE = ["evidence_decisions.decide", "requirement_exceptions.decide"];

  for (const r of rows.slice(1)) {
    const preset = r[pidCol];
    if (!preset) continue;
    // `none` is the documented spelling for a preset that grants nothing —
    // `performer` is party-level provenance and never a member permission.
    const caps = (r[mapCol] ?? "").split(" ").filter((c) => c && c !== "none");
    for (const c of caps) {
      granted.add(c);
      if (!known.has(c)) {
        errs.push(`responsibility-presets.csv: ${preset} names ${c}, which is in no capabilities.csv row`);
      } else if (!projectCaps.has(c)) {
        errs.push(
          `responsibility-presets.csv: ${preset} names ${c}, which is not on the project plane — `
          + "a preset is a bundle of project_access_grants rows and can grant nothing else");
      }
    }
    if (caps.includes("stage_closures.close")) {
      for (const c of SATISFIES_OCCURRENCE) {
        if (caps.includes(c)) {
          errs.push(
            `responsibility-presets.csv: ${preset} holds stage_closures.close together with ${c} — `
            + "one member could satisfy a blocking occurrence and then close over it, without the "
            + "independent decision INV-061 requires (see this file's presetCoherenceErrors header)");
        }
      }
    }
  }

  for (const c of v1ProjectCaps) {
    if (!granted.has(c) && !exempt.has(c)) {
      errs.push(`responsibility-presets.csv: no preset grants the v0.1 project capability ${c}, so no named persona can invoke it`);
    }
  }
  return errs;
}

// --------------------------------------------------------------------------
// Step 1: self-test against in-memory failing fixtures — the validator must
// prove it can detect each failure class before it validates the real tree.
// --------------------------------------------------------------------------

function selfTest() {
  const t = [];
  if (missingMetadata("# doc\n**Status:** Approved\n").length !== 3) t.push("metadata detector");
  if (brandingViolations("AktFlow is our product\n").length !== 1) t.push("branding detector (positive)");
  if (brandingViolations("the legacy AktFlow package\n").length !== 0) t.push("branding detector (legacy context)");
  if (relativeLinks("see [x](../a.md) and [y](https://z)")[0] !== "../a.md") t.push("link extractor");
  if (csvShapeErrors("a,b\n1,2,3\n", "fx").length !== 1) t.push("ragged CSV detector");
  if (!dispositionErrors("source_path,disposition,reason\nx,keep,ok\nx,keep,ok\n")[0]?.includes("duplicate")) t.push("duplicate disposition detector");
  if (!dispositionErrors("source_path,disposition,reason\ny,destroy,ok\n")[0]?.includes("unknown")) t.push("unknown disposition detector");
  if (existsSync(join(ROOT, "docs/definitely-missing-fixture.md"))) t.push("missing-file probe");

  // Operation-count guard: one CSV fixture, several failing documents.
  const fxCsv = "operation_id,milestone\na,v0.1-M1\nb,v0.1-M1\nc,v0.1-M2\n";
  if (scopeMilestoneCounts(fxCsv).get("v0.1-M1") !== 2) t.push("scope milestone counter");
  if (statedOperationCounts("the two `v0.1-M1` operations").at(0)?.count !== 2) t.push("stated-count extractor (spelled)");
  if (statedOperationCounts("| `v0.1-M1` | 2 | 9 |").at(0)?.count !== 2) t.push("stated-count extractor (table)");
  const ok2 = "the 2 `v0.1-M1` operations and the 1 `v0.1-M2` operations";
  if (operationCountErrors(ok2, fxCsv, "fx").length !== 0) t.push("operation-count guard (agreeing doc)");
  if (!operationCountErrors("the 7 `v0.1-M1` operations and the 1 `v0.1-M2` operations", fxCsv, "fx")[0]?.includes("scope-v0.1.csv has 2")) {
    t.push("operation-count guard (doc overstates)");
  }
  if (!operationCountErrors("the 2 `v0.1-M1` operations", fxCsv, "fx")[0]?.includes("states no operation count for v0.1-M2")) {
    t.push("operation-count guard (doc omits a milestone)");
  }
  if (!operationCountErrors(`${ok2} and the 3 \`v0.1-M9\` operations`, fxCsv, "fx")[0]?.includes("no v0.1-M9 rows")) {
    t.push("operation-count guard (doc invents a milestone)");
  }
  if (!operationCountErrors(`${ok2} and the several \`v0.1-M1\` operations`, fxCsv, "fx")[0]?.includes("unreadable")) {
    t.push("operation-count guard (unreadable count)");
  }

  // Guard 7: a future-version marker on a deployed table.
  const fxDeployed = deployedTables(["create table public.parties (\n);\ncreate table if not exists public.locations (\n);"]);
  if (!(fxDeployed.has("parties") && fxDeployed.has("locations") && fxDeployed.size === 2)) t.push("deployed-table extractor");
  const fxEnt = "entity,status_version\nparties,v0.2\nlocations,v0.1-M1\npackages,v0.2\n";
  const fxFut = futureVersionOnDeployedTableErrors(fxEnt, fxDeployed);
  if (fxFut.length !== 1 || !fxFut[0].includes("parties")) t.push("future-version-on-deployed-table guard");

  const fxBuild = buildListErrors("entity,status_version\nparties,v0.2\nlocations,v0.1-M1\n", ["parties", "projects"]);
  if (!fxBuild.some((e) => e.includes("parties") && e.includes("marks it v0.2"))) t.push("build-list guard (build target moved out of v0.1)");
  if (!fxBuild.some((e) => e.includes("projects") && e.includes("no row for it"))) t.push("build-list guard (build target missing)");
  if (buildListErrors("entity,status_version\nparties,v0.1-M1\n", ["parties"]).length !== 0) t.push("build-list guard (agreeing catalog)");
  // The direction the 2026-08-06 drift travelled: the catalog moved a table
  // into a fully-built milestone and the transcribed list never learned of it.
  if (!buildListErrors("entity,status_version\nparties,v0.1-M1\nsome_head,v0.1-M3\n", ["parties"])
    .some((e) => e.includes("some_head") && e.includes("does not name it"))) {
    t.push("build-list guard (catalog gained a v0.1-M3 table the list omits)");
  }
  if (buildListErrors("entity,status_version\nextra,v0.1-M1\n", []).length !== 0) t.push("build-list guard (M1 inventory row is not a build target)");

  // Guards 11-13: the four transcriptions of the build list.
  const fxTable = [
    "| Milestone | Tables | Already in the runtime |",
    "|---|---|---|",
    "| M1 — a | `parties`, `projects` | first one |",
    "| M2 — b | `work_stages` | none |",
    "| M3 — c | none. It is a query over `parties` | — |",
    "",
  ].join("\n");
  if (markdownTableRows(fxTable, ["Milestone", "Tables", "Already in the runtime"])?.length !== 3) t.push("markdown table reader");
  if (markdownTableRows(fxTable, ["Milestone", "Operations"]) !== null) t.push("markdown table reader (absent table must be null)");
  if (milestoneTableNameErrors(fxTable, "fx", ["parties", "projects", "work_stages"]).length !== 0) t.push("milestone-name guard (agreeing table)");
  if (!milestoneTableNameErrors(fxTable, "fx", ["parties", "projects", "work_stages", "stage_closures"])
    .some((e) => e.includes("omits stage_closures"))) {
    t.push("milestone-name guard (table omits a build target)");
  }
  if (!milestoneTableNameErrors(fxTable, "fx", ["parties", "projects"]).some((e) => e.includes("names work_stages"))) {
    t.push("milestone-name guard (table names a non-build target)");
  }
  if (!milestoneTableNameErrors("# no table here\n", "fx", ["parties"]).some((e) => e.includes("no \"| Milestone"))) {
    t.push("milestone-name guard (missing table)");
  }
  const fxCounts = buildListMilestoneCounts(
    "entity,status_version\nparties,v0.1-M1\nprojects,v0.1-M1\nwork_stages,v0.1-M3\n",
    ["parties", "projects", "work_stages"],
    new Set(["parties"]),
  );
  if (fxCounts.builds.get("v0.1-M1") !== 2 || fxCounts.builds.get("v0.1-M3") !== 1) t.push("build-list milestone counter (builds)");
  if (fxCounts.already.get("v0.1-M1") !== 1 || fxCounts.already.has("v0.1-M3")) t.push("build-list milestone counter (already deployed)");
  const fxCountDoc = (m1Tables, totalTables) => [
    "| Milestone | Operations | v0.1 tables | Already in the runtime |",
    "|---|---|---|---|",
    "| M0 — cross-cutting | — | — | — |",
    `| \`v0.1-M1\` | 32 | ${m1Tables} | 1 |`,
    "| `v0.1-M3` | 6 | 1 | 0 |",
    `| Total | 38 | ${totalTables} | 1 |`,
    "",
  ].join("\n");
  if (milestoneTableCountErrors(fxCountDoc(2, 3), "fx", fxCounts, 3).length !== 0) t.push("milestone-count guard (agreeing doc)");
  if (!milestoneTableCountErrors(fxCountDoc(6, 3), "fx", fxCounts, 3).some((e) => e.includes("v0.1-M1 states 6"))) {
    t.push("milestone-count guard (per-milestone count drifted)");
  }
  if (!milestoneTableCountErrors(fxCountDoc(2, 23), "fx", fxCounts, 3).some((e) => e.includes("Total row says 23"))) {
    t.push("milestone-count guard (total drifted)");
  }

  // Guards 8 and 9: capability and event producers against the route set.
  const fxScope1 = "operation_id,milestone\nalpha.create,v0.1-M1\nbeta.get,v0.1-M2\n";
  const fxScope2 = "operation_id,milestone\ngamma.freeze,v0.2\n";
  const fxCaps = "capability_id,related_operations,milestone\ngood,alpha.create,v0.1-M1\nlate,gamma.freeze,v0.1-M1\nghost,delta.gone,v0.2\nfine,none,v0.2\n";
  const capErrs = capabilityCoherenceErrors(fxCaps, fxScope1, fxScope2, new Set());
  if (!capErrs.some((e) => e.includes("late") && e.includes("which is v0.2"))) t.push("capability guard (v0.1 naming a v0.2 operation)");
  if (!capErrs.some((e) => e.includes("delta.gone") && e.includes("neither scope CSV"))) t.push("capability guard (operation in neither CSV)");
  if (!capErrs.some((e) => e.includes("no capability governs the v0.1 operation beta.get"))) t.push("capability guard (ungoverned v0.1 operation)");
  if (capabilityCoherenceErrors(fxCaps, fxScope1, fxScope2, new Set(["beta.get"])).some((e) => e.includes("beta.get"))) {
    t.push("capability guard (exemption ignored)");
  }
  const fxEvents = "event,producer,milestone\nok.raised,bff.alpha.create,v0.1-M1\nstale.raised,bff.gamma.freeze,v0.1-M5\nunknown.raised,bff.delta.gone,v0.2\nworkerish.raised,worker.thing,v0.1-M2\n";
  const evErrs = eventProducerErrors(fxEvents, fxScope1, fxScope2);
  if (!evErrs.some((e) => e.includes("stale.raised") && e.includes("every named producer is v0.2"))) t.push("event guard (v0.1 event with only v0.2 producers)");
  if (!evErrs.some((e) => e.includes("delta.gone") && e.includes("neither scope CSV"))) t.push("event guard (producer in neither CSV)");
  if (evErrs.some((e) => e.includes("workerish"))) t.push("event guard (non-BFF producer misread)");

  // Guard 10: the preset contract. One capability fixture, one preset fixture
  // carrying all three failure classes at once — an orphaned v0.1 capability,
  // a preset naming a capability that does not exist, and a preset that holds
  // the closure together with an escape from it.
  const fxPresetCaps = "capability_id,plane,milestone\n"
    + "progress.record,project,v0.1-M2\n"
    + "stage_closures.close,project,v0.1-M3\n"
    + "requirement_exceptions.decide,project,v0.1-M3\n"
    + "evidence_decisions.decide,project,v0.1-M3\n"
    + "orphan.cap,project,v0.1-M3\n"
    + "later.cap,project,v0.2\n"
    + "elsewhere.manage,workspace,v0.1-M1\n"
    + "worker.purge,service,v0.1-M2\n";
  const fxPresets = "preset_id,kind,maps_to_capabilities,description\n"
    + "recorder,responsibility,progress.record,ok\n"
    + "nobody,responsibility,none,party-level provenance only\n"
    + "typoed,ui_persona,progres.record,a capability that does not exist\n"
    + "selfclearing,ui_persona,stage_closures.close requirement_exceptions.decide,the SoD violation\n";
  const presetErrs = presetCoherenceErrors(fxPresets, fxPresetCaps, new Set());
  if (!presetErrs.some((e) => e.includes("no preset grants the v0.1 project capability orphan.cap"))) {
    t.push("preset guard (orphaned v0.1 project capability)");
  }
  if (presetErrs.some((e) => e.includes("later.cap"))) t.push("preset guard (v0.2 capability wrongly required)");
  // PLANE SCOPING, BOTH WAYS. A workspace- or service-plane capability reaches
  // its caller by a mechanism a preset cannot express, so demanding a preset
  // for one is a false positive — the shape the first draft of this guard
  // produced thirteen of against the real tree.
  if (presetErrs.some((e) => e.includes("elsewhere.manage") || e.includes("worker.purge"))) {
    t.push("preset guard (non-project plane wrongly required)");
  }
  // …and naming one inside a preset is a grant that could never be issued.
  const fxWrongPlane = "preset_id,kind,maps_to_capabilities,description\n"
    + "confused,ui_persona,progress.record elsewhere.manage,names a workspace capability\n";
  if (!presetCoherenceErrors(fxWrongPlane, fxPresetCaps, new Set(["orphan.cap", "stage_closures.close",
    "requirement_exceptions.decide", "evidence_decisions.decide"]))
    .some((e) => e.includes("elsewhere.manage") && e.includes("not on the project plane"))) {
    t.push("preset guard (preset naming a non-project capability)");
  }
  if (!presetErrs.some((e) => e.includes("typoed names progres.record"))) {
    t.push("preset guard (capability that does not exist)");
  }
  if (!presetErrs.some((e) => e.includes("selfclearing") && e.includes("requirement_exceptions.decide"))) {
    t.push("preset guard (closure bundled with the exception escape)");
  }
  // The evidence-decision half of the same rule, and the `none` spelling.
  const fxSoD2 = "preset_id,kind,maps_to_capabilities,description\n"
    + "verifierandcloser,ui_persona,stage_closures.close evidence_decisions.decide,the other SoD violation\n";
  if (!presetCoherenceErrors(fxSoD2, fxPresetCaps, new Set(["orphan.cap", "requirement_exceptions.decide", "progress.record"]))
    .some((e) => e.includes("evidence_decisions.decide"))) {
    t.push("preset guard (closure bundled with the evidence decision)");
  }
  if (presetCoherenceErrors(fxPresets, fxPresetCaps, new Set(["orphan.cap"]))
    .some((e) => e.includes("orphan.cap"))) {
    t.push("preset guard (exemption ignored)");
  }
  if (presetErrs.some((e) => e.includes("nobody"))) t.push("preset guard (the `none` spelling misread)");

  // Guard 11: the five pre-rename role names, allowed only in a record.
  const fxRole = "connect as aktflow_app_login and set role aktflow_app; the worker is aktflow_worker\n";
  const roleErrs = staleRoleNameErrors("packages/database/src/tx.ts", fxRole);
  if (!roleErrs.some((e) => e.includes("aktflow_app_login"))) t.push("role guard (login role)");
  if (!roleErrs.some((e) => e.includes("aktflow_app`"))) t.push("role guard (group role, not swallowed by the _login alternative)");
  if (!roleErrs.some((e) => e.includes("aktflow_worker"))) t.push("role guard (worker)");
  if (!roleErrs.some((e) => e.includes("goproceed_app_login"))) t.push("role guard (message names the replacement)");
  if (roleErrs.length !== 3) t.push(`role guard (expected 3 distinct names, got ${roleErrs.length})`);
  // Records keep the old names — by PATH, not by how the line reads.
  for (const rec of ["supabase/migrations/0003_roles_and_grants.sql", "docs/legacy/07-technical-architecture.md",
    "docs/superpowers/plans/2026-08-03-rename-slice3-packages.md", "migration/goproceed-canonical-v0.1/x.md",
    "TODOS.md", "docs/delivery/package-review-2026-08-04.md"]) {
    if (staleRoleNameErrors(rec, fxRole).length !== 0) t.push(`role guard (record path not exempt: ${rec})`);
  }
  // The LIKE prefix, which whole-identifier matching cannot see.
  const likeErrs = staleRoleNameErrors("scripts/snapshot.mjs", "where rolname like 'aktflow%' order by 1\n");
  if (!likeErrs.some((e) => e.includes("silently returns no project roles"))) t.push("role guard (SQL LIKE prefix)");
  if (likeErrs.some((e) => e.includes("renamed it to"))) t.push("role guard (prefix given the whole-name message)");
  if (staleRoleNameErrors("x.mjs", "like 'goproceed%'\n").length !== 0) t.push("role guard (new prefix wrongly reported)");
  // A file that merely SITS BESIDE a record directory is not one.
  if (staleRoleNameErrors("docs/architecture/tenancy-and-security.md", fxRole).length === 0) {
    t.push("role guard (live doc wrongly exempt)");
  }
  // The NEW names must never be reported, or the guard would fight the rename.
  if (staleRoleNameErrors("packages/database/src/tx.ts",
    "set role goproceed_app; session_user = 'goproceed_service_login'\n").length !== 0) {
    t.push("role guard (new names wrongly reported)");
  }
  // …and a longer identifier that merely starts with an old name is not one.
  if (staleRoleNameErrors("x.ts", "aktflow_apparatus aktflow_services\n").length !== 0) {
    t.push("role guard (word boundary)");
  }
  // Guard 12: pre-rename domains.
  const domErrs = staleDomainErrors("infra/README-staging.md", "curl https://app.aktflow.com/v1 and aktflow.example\n");
  if (!domErrs.some((e) => e.includes("aktflow.com"))) t.push("domain guard (app subdomain)");
  if (!domErrs.some((e) => e.includes("aktflow.example"))) t.push("domain guard (example domain)");
  if (!domErrs.some((e) => e.includes("{{APP_HOSTNAME}}"))) t.push("domain guard (message names the remedy)");
  if (staleDomainErrors("x.md", "the {{APP_HOSTNAME}} token and goproceed.example\n").length !== 0) {
    t.push("domain guard (token or new example wrongly reported)");
  }
  // The localStorage namespace is not a hostname and must survive.
  if (staleDomainErrors("apps/demo/src/pilot/draft.ts", "const LEGACY_DRAFT_KEY = 'aktflow.pilot.draft'\n").length !== 0) {
    t.push("domain guard (localStorage key misread as a domain)");
  }
  if (staleDomainErrors("docs/legacy/x.md", "aktflow.com\n").length !== 0) t.push("domain guard (record path not exempt)");

  // The branding strip must cover BOTH spellings now, or `goproceed_app` on a
  // line with the word AktFlow would be mis-parsed the way the old comment
  // assumed only the old spelling needed excusing.
  if (brandingViolations("the goproceed_app role replaced AktFlow's, in the old scheme\n").length !== 0) {
    t.push("branding strip (legacy-context line wrongly reported)");
  }
  if (brandingViolations("AktFlow ships goproceed_app\n").length !== 1) {
    t.push("branding strip (real branding hidden by the role strip)");
  }

  if (t.length) {
    console.error("validator self-test FAILED:", t.join("; "));
    process.exit(2);
  }
}

// --------------------------------------------------------------------------
// Step 2: required active paths (hard-coded from the implementation plan)
// --------------------------------------------------------------------------

const REQUIRED = [
  "README.md",
  "docs/README.md",
  "docs/product/vision-and-positioning.md",
  "docs/product/scope-and-boundaries.md",
  "docs/product/personas-and-workflows.md",
  "docs/product/roadmap.md",
  "docs/domain/glossary.md",
  "docs/domain/domain-model.md",
  "docs/domain/execution-and-evidence.md",
  "docs/domain/packages-and-acceptance.md",
  "docs/domain/value-at-risk.md",
  "docs/architecture/system-overview.md",
  "docs/architecture/data-model.md",
  "docs/architecture/tenancy-and-security.md",
  "docs/architecture/files-and-storage.md",
  "docs/architecture/jobs-events-and-audit.md",
  "docs/delivery/version-0.0.md",
  "docs/delivery/version-0.1.md",
  "docs/delivery/test-strategy.md",
  "docs/delivery/production-readiness.md",
  "docs/discovery/outreach-log.md",
  "docs/discovery/validated-assumptions.md",
  "docs/decisions/ADR-001-product-boundary.md",
  "docs/decisions/ADR-002-tenancy-parties-and-contracts.md",
  "docs/decisions/ADR-003-evidence-packages-and-acceptance.md",
  "docs/decisions/ADR-004-roadmap-demo-and-documentation.md",
  "docs/decisions/ADR-005-readiness-gate-and-hidden-works.md",
  "docs/decisions/ADR-007-pilot-field-client.md",
  "docs/decisions/ADR-008-valuation-carves-at-admission.md",
  "docs/legacy/README.md",
  "docs/superpowers/specs/2026-07-30-goproceed-canonical-design.md",
  "docs/superpowers/plans/2026-07-30-goproceed-canonical-package.md",
  "technical/database/entity-catalog.csv",
  "technical/database/relationship-catalog.csv",
  "technical/database/invariant-catalog.csv",
  "technical/database/schema-v0.1.sql",
  "technical/openapi/README.md",
  "technical/openapi/scope-v0.1.csv",
  "technical/permissions/capabilities.csv",
  "technical/permissions/responsibility-presets.csv",
  "technical/states/state-catalog.csv",
  "technical/states/transition-catalog.csv",
  "technical/events/event-catalog.csv",
  "technical/templates/README.md",
  "migration/goproceed-canonical-v0.1/README.md",
  "migration/goproceed-canonical-v0.1/baseline-verification.md",
  "migration/goproceed-canonical-v0.1/source-inventory.csv",
  "migration/goproceed-canonical-v0.1/document-disposition.csv",
  "migration/goproceed-canonical-v0.1/conflict-register.md",
  "migration/goproceed-canonical-v0.1/decision-register.md",
  "migration/goproceed-canonical-v0.1/transfer-checklist.md",
];

// Active human-readable docs held to the metadata contract (Step 3).
const METADATA_DOCS = REQUIRED.filter(
  (p) => p.endsWith(".md")
    && p.startsWith("docs/")
    && !p.startsWith("docs/superpowers/"),
).concat(["technical/openapi/README.md", "technical/templates/README.md"]);

// Docs held to branding + link validation (Step 4). Legacy README documents
// the AktFlow era by name and is governed by its own context rule.
const BRANDING_DOCS = METADATA_DOCS;

function main() {
  selfTest();

  for (const p of REQUIRED) {
    if (!existsSync(join(ROOT, p))) fail(`missing required path: ${p}`);
  }

  for (const p of METADATA_DOCS) {
    if (!existsSync(join(ROOT, p))) continue; // already reported
    const md = read(p);
    for (const key of missingMetadata(md)) fail(`${p}: missing metadata '**${key}:**'`);
  }

  for (const p of BRANDING_DOCS) {
    if (!existsSync(join(ROOT, p))) continue;
    for (const line of brandingViolations(read(p))) {
      fail(`${p}:${line}: active AktFlow branding outside legacy context`);
    }
  }

  for (const p of METADATA_DOCS) {
    if (!existsSync(join(ROOT, p))) continue;
    for (const target of relativeLinks(read(p))) {
      const resolved = join(ROOT, dirname(p), target);
      if (!existsSync(resolved)) fail(`${p}: broken relative link -> ${target}`);
    }
  }

  const CSVS = REQUIRED.filter((p) => p.endsWith(".csv"));
  for (const p of CSVS) {
    if (!existsSync(join(ROOT, p))) continue;
    for (const e of csvShapeErrors(read(p), p)) fail(e);
  }
  if (existsSync(join(ROOT, "migration/goproceed-canonical-v0.1/document-disposition.csv"))) {
    for (const e of dispositionErrors(read("migration/goproceed-canonical-v0.1/document-disposition.csv"))) fail(e);
  }

  // Step: catalog/SQL coherence (entity catalog <-> design DDL <-> invariants).
  if (existsSync(join(ROOT, "technical/database/entity-catalog.csv"))
    && existsSync(join(ROOT, "technical/database/schema-v0.1.sql"))) {
    const ents = parseCsv(read("technical/database/entity-catalog.csv"));
    const header = ents[0];
    const entCol = header.indexOf("entity");
    const entities = new Set(ents.slice(1).map((r) => r[entCol]));
    const sql = read("technical/database/schema-v0.1.sql");
    const tables = new Set([...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]));
    for (const e of entities) if (!tables.has(e)) fail(`entity-catalog entity without design table: ${e}`);
    for (const t of tables) if (!entities.has(t)) fail(`design table missing from entity catalog: ${t}`);

    const invs = new Set(
      parseCsv(read("technical/database/invariant-catalog.csv")).slice(1).map((r) => r[0]),
    );
    const rels = parseCsv(read("technical/database/relationship-catalog.csv"));
    const invCol = rels[0].indexOf("invariant_id");
    for (const r of rels.slice(1)) {
      if (!invs.has(r[invCol])) fail(`relationship-catalog references unknown invariant: ${r[invCol]}`);
    }
    for (const ref of new Set(sql.match(/INV-\d{3}/g) ?? [])) {
      if (!invs.has(ref)) fail(`schema-v0.1.sql references unknown invariant: ${ref}`);
    }
    const relEnts = rels.slice(1).flatMap((r) => [r[0], r[2]]);
    for (const e of new Set(relEnts)) {
      if (e !== "auth.users" && !entities.has(e)) fail(`relationship-catalog references unknown entity: ${e}`);
    }
  }

  // Version/scope language: milestones referenced by catalogs must be real.
  // "v0.2" entered the catalogs with ADR-006, which re-cut v0.1 down to the six
  // steps a pilot customer can use and moved packages, per-segment acceptance,
  // the value-at-risk projection, the statutory cost forms and import expansion
  // out of it. A later version is named as a whole (v0.2), not per milestone,
  // because its milestones are not fixed until v0.1 closes — so this set stays
  // deliberately narrow rather than admitting an open "v0.N" pattern that would
  // let a typo pass.
  const MILESTONES = new Set([
    "v0.0", "v0.1-M1", "v0.1-M2", "v0.1-M3", "v0.1-M4", "v0.1-M5", "v0.1-M6", "v0.2",
  ]);
  for (const p of ["technical/openapi/scope-v0.1.csv", "technical/permissions/capabilities.csv", "technical/events/event-catalog.csv"]) {
    if (!existsSync(join(ROOT, p))) continue;
    const rows = parseCsv(read(p));
    const msCol = rows[0].indexOf("milestone");
    if (msCol === -1) { fail(`${p}: missing milestone column`); continue; }
    rows.slice(1).forEach((r, i) => {
      if (!MILESTONES.has(r[msCol])) fail(`${p}: row ${i + 2} has unknown milestone '${r[msCol]}'`);
    });
  }

  // Guard 7: applied migrations are precedence level 1, so no entity that one
  // of them creates may carry a marker naming a later version.
  const MIGRATIONS = join(ROOT, "supabase/migrations");
  if (existsSync(MIGRATIONS) && existsSync(join(ROOT, "technical/database/entity-catalog.csv"))) {
    const sqls = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"));
    for (const e of futureVersionOnDeployedTableErrors(read("technical/database/entity-catalog.csv"), deployedTables(sqls))) fail(e);
  }
  if (existsSync(join(ROOT, "technical/database/entity-catalog.csv"))) {
    for (const e of buildListErrors(read("technical/database/entity-catalog.csv"), ADR006_V01_BUILD_LIST)) fail(e);
  }

  // Guards 11-13: the transcription above is pinned to its stated size, and
  // the three documents that restate it must restate exactly it.
  if (new Set(ADR006_V01_BUILD_LIST).size !== ADR006_V01_BUILD_LIST.length) {
    fail("validate-canonical-docs.mjs: ADR006_V01_BUILD_LIST names a table twice");
  }
  if (ADR006_V01_BUILD_LIST.length !== ADR006_V01_BUILD_TOTAL) {
    fail(`validate-canonical-docs.mjs: ADR006_V01_BUILD_LIST has ${ADR006_V01_BUILD_LIST.length} entries and the package states ${ADR006_V01_BUILD_TOTAL}`);
  }
  for (const doc of ["docs/decisions/ADR-006-pilot-shaped-v0.1.md", "docs/product/roadmap.md"]) {
    if (!existsSync(join(ROOT, doc))) continue;
    for (const e of milestoneTableNameErrors(read(doc), doc, ADR006_V01_BUILD_LIST)) fail(e);
  }
  if (existsSync(join(ROOT, "technical/database/entity-catalog.csv")) && existsSync(MIGRATIONS)
      && existsSync(join(ROOT, "docs/delivery/version-0.1.md"))) {
    const deployed = deployedTables(readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8")));
    const counts = buildListMilestoneCounts(read("technical/database/entity-catalog.csv"), ADR006_V01_BUILD_LIST, deployed);
    for (const e of milestoneTableCountErrors(read("docs/delivery/version-0.1.md"), "docs/delivery/version-0.1.md", counts, ADR006_V01_BUILD_TOTAL)) fail(e);
  }

  // Guards 8 and 9: the machine-readable authorisation surface and the event
  // producers must both point at operations the route set actually has. The
  // three exemptions are listed with their reason in technical/openapi/README.md
  // §Conventions: `me.context` is governed by the session, and the two
  // `public`-plane external rows change no state and can consume no grant.
  const SCOPE1 = "technical/openapi/scope-v0.1.csv";
  const SCOPE2 = "technical/openapi/scope-v0.2.csv";
  const CAPS = "technical/permissions/capabilities.csv";
  const EVENTS = "technical/events/event-catalog.csv";
  const CAPABILITY_EXEMPT = new Set(["me.context", "external.review_shell", "external.exchange"]);
  if ([SCOPE1, SCOPE2, CAPS].every((p) => existsSync(join(ROOT, p)))) {
    for (const e of capabilityCoherenceErrors(read(CAPS), read(SCOPE1), read(SCOPE2), CAPABILITY_EXEMPT)) fail(e);
  }
  if ([SCOPE1, SCOPE2, EVENTS].every((p) => existsSync(join(ROOT, p)))) {
    for (const e of eventProducerErrors(read(EVENTS), read(SCOPE1), read(SCOPE2))) fail(e);
  }

  // Guard 10: the preset contract — reachability, resolvability, separation of
  // duties. See presetCoherenceErrors's own header for the six-capability gap
  // this exists because of, and why the SoD rule is not a style preference.
  //
  // THE EXEMPTION LIST IS EMPTY, AND KEEPING IT THAT WAY IS THE POINT. Every
  // v0.1 capability is reachable from some preset as of 2026-08-17. A future
  // capability that genuinely must belong to no persona goes here WITH ITS
  // REASON on the line above it — the way CAPABILITY_EXEMPT above carries its
  // three — and never by widening the rule. An empty set is the strongest
  // state this guard can be in; adding to it is a decision, not a fix.
  const PRESETS = "technical/permissions/responsibility-presets.csv";
  const PRESET_EXEMPT = new Set([]);
  if ([PRESETS, CAPS].every((p) => existsSync(join(ROOT, p)))) {
    for (const e of presetCoherenceErrors(read(PRESETS), read(CAPS), PRESET_EXEMPT)) fail(e);
  }

  // Guard 11: no live file names a pre-rename PostgreSQL role. Walked over
  // every TRACKED file rather than a curated list — the point of a rename gate
  // is that it covers the files nobody thought to add to a list. `git ls-files`
  // is the same source the P1 entry's own measurement commands used, so this
  // guard and that entry are counting the same tree.
  //
  // Binary and vendored paths are excluded by the extension filter rather than
  // by a directory list: a role name is an ASCII identifier and only ever
  // appears in source, SQL, config, CSV or prose.
  try {
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(Boolean)
      .filter((p) => /\.(ts|tsx|mjs|js|sql|md|csv|yml|yaml|json|py|toml|example|sh)$/.test(p) || p.endsWith(".env.example"));
    for (const p of tracked) {
      if (isRoleRecordPath(p)) continue;
      let text;
      try { text = read(p); } catch { continue; }
      for (const e of staleRoleNameErrors(p, text)) fail(e);
      for (const e of staleDomainErrors(p, text)) fail(e);
    }
  } catch (err) {
    fail(`stale-role-name guard could not enumerate tracked files: ${err.message}`);
  }

  // version-0.1.md declares scope-v0.1.csv authoritative for its row-level
  // lists, so every per-milestone operation count it states must agree with it.
  const SCOPE_CSV = "technical/openapi/scope-v0.1.csv";
  const DELIVERY_DOC = "docs/delivery/version-0.1.md";
  if (existsSync(join(ROOT, SCOPE_CSV)) && existsSync(join(ROOT, DELIVERY_DOC))) {
    for (const e of operationCountErrors(read(DELIVERY_DOC), read(SCOPE_CSV), DELIVERY_DOC)) fail(e);
  }

  if (failures.length) {
    console.error(`canonical documentation: ${failures.length} problem(s)`);
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("canonical documentation: OK");
}

main();
