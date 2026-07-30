#!/usr/bin/env node
// Canonical GoProceed documentation validator (plan Task 9).
// Guards the source-of-truth package against drift:
//   1. required active paths exist;
//   2. active human-readable docs carry the metadata contract;
//   3. active AktFlow branding appears only in legacy/history context;
//   4. relative doc links resolve;
//   5. technical/migration CSVs are well-shaped; dispositions are unique and known;
//   6. catalog/SQL coherence: entity catalog <-> design DDL, invariant refs.
// Exits non-zero with every failure listed in one run.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
// context (docs/legacy/README.md policy). Code identifiers (@aktflow/...,
// aktflow_app) are runtime names handled by the v0.0 rename gate, not doc
// branding — they are ignored here.
const LEGACY_CONTEXT = /legacy|historic|supersede|era|migration|former|old /i;
export function brandingViolations(markdown) {
  const bad = [];
  markdown.split("\n").forEach((line, i) => {
    const stripped = line.replace(/@aktflow\/[\w-]+/g, "").replace(/aktflow_[\w]+/g, "");
    if (/AktFlow/i.test(stripped) && !LEGACY_CONTEXT.test(line)) bad.push(i + 1);
  });
  return bad;
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
  const MILESTONES = new Set(["v0.0", "v0.1-M1", "v0.1-M2", "v0.1-M3", "v0.1-M4", "v0.1-M5", "v0.1-M6"]);
  for (const p of ["technical/openapi/scope-v0.1.csv", "technical/permissions/capabilities.csv", "technical/events/event-catalog.csv"]) {
    if (!existsSync(join(ROOT, p))) continue;
    const rows = parseCsv(read(p));
    const msCol = rows[0].indexOf("milestone");
    if (msCol === -1) { fail(`${p}: missing milestone column`); continue; }
    rows.slice(1).forEach((r, i) => {
      if (!MILESTONES.has(r[msCol])) fail(`${p}: row ${i + 2} has unknown milestone '${r[msCol]}'`);
    });
  }

  if (failures.length) {
    console.error(`canonical documentation: ${failures.length} problem(s)`);
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("canonical documentation: OK");
}

main();
