import { readFileSync } from "node:fs";

/**
 * The tenant-isolation coverage registry (DEV-013, readiness gate 11, INV-060).
 *
 * `technical/database/rls-coverage.csv` holds one row per relation this
 * database exposes to a tenant-facing principal — by a DIRECT table or column
 * grant — and one `exempt_no_grant` row per in-scope relation nobody is
 * granted. The validator checks the registry against the migrations and the
 * cited tests; `rls-coverage.test.ts` checks it against the running database.
 */

/** The principals whose direct grants make a relation exposed. */
export const PRINCIPALS = ["anon", "authenticated", "goproceed_app", "goproceed_service", "goproceed_worker"];

export const COVERAGE_COLUMNS = [
  "schema", "relation", "principal", "module", "classification",
  "positive_test", "negative_test", "backlog_id", "reason",
] as const;

export interface CoverageRow {
  schema: string;
  relation: string;
  principal: string;
  module: string;
  classification: string;
  positive_test: string;
  negative_test: string;
  backlog_id: string;
  reason: string;
}

export interface ExposedPair { schema: string; relation: string; principal: string }

export interface CoverageComparison {
  /** Exposed `(relation, principal)` pairs with no covered or gap row. */
  unclassified: string[];
  /** Registry rows the database does not have. */
  stale: string[];
  /** In-scope relations with no row of any class. */
  unlisted: string[];
  /** `exempt_no_grant` relations the database exposes. */
  brokenExemptions: string[];
}

const REGISTRY_URL = new URL("../../../technical/database/rls-coverage.csv", import.meta.url);

/** RFC 4180 fields: quoted when they contain a comma, a quote or a newline. */
function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field); field = "";
      if (record.some((f) => f !== "")) records.push(record);
      record = [];
    } else field += ch;
  }
  if (field !== "" || record.length) { record.push(field); if (record.some((f) => f !== "")) records.push(record); }
  return records;
}

export function parseCoverageCsv(text: string): CoverageRow[] {
  const [header, ...rest] = csvRecords(text);
  if (!header || header.join(",") !== COVERAGE_COLUMNS.join(",")) {
    throw new Error(`rls-coverage.csv: header must be ${COVERAGE_COLUMNS.join(",")}`);
  }
  return rest.map((fields, index) => {
    if (fields.length !== COVERAGE_COLUMNS.length) {
      throw new Error(`rls-coverage.csv: row ${index + 2} has ${fields.length} fields, not ${COVERAGE_COLUMNS.length}`);
    }
    return Object.fromEntries(COVERAGE_COLUMNS.map((k, i) => [k, fields[i]!])) as unknown as CoverageRow;
  });
}

export function readCoverageRegistry(): CoverageRow[] {
  return parseCoverageCsv(readFileSync(REGISTRY_URL, "utf8"));
}

/** Base tables in `public` and `app`, and views in `api`. */
export const IN_SCOPE_RELATIONS_SQL = `
  select n.nspname || '.' || c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname in ('public', 'app') and c.relkind in ('r', 'p'))
      or (n.nspname = 'api' and c.relkind in ('v', 'm'))
   order by 1`;

/** One row per in-scope relation and principal ($1) holding a direct table or column privilege. */
export const EXPOSED_RELATIONS_SQL = `
  with rels as (
    select c.oid, n.nspname, c.relname, c.relacl
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where (n.nspname in ('public', 'app') and c.relkind in ('r', 'p'))
        or (n.nspname = 'api' and c.relkind in ('v', 'm'))
  ), grants as (
    select r.nspname, r.relname, a.grantee
      from rels r cross join lateral aclexplode(r.relacl) a
     where r.relacl is not null
    union
    select r.nspname, r.relname, a.grantee
      from rels r
      join pg_attribute att on att.attrelid = r.oid and att.attnum > 0 and not att.attisdropped and att.attacl is not null
      cross join lateral aclexplode(att.attacl) a
  )
  select distinct g.nspname as schema, g.relname as relation, pr.rolname as principal
    from grants g join pg_roles pr on pr.oid = g.grantee
   where pr.rolname = any($1::text[])
   order by 1, 2, 3`;

/** Principals ($2) holding any privilege, direct or inherited, on relation $1. */
export function exemptionPrivilegeSql(): string {
  return `
    select p as principal
      from unnest($2::text[]) as p
     where has_table_privilege(p, $1, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege(p, $1, 'SELECT, INSERT, UPDATE, REFERENCES')
     order by 1`;
}

export function compareCoverage(rows: CoverageRow[], exposed: ExposedPair[], inScope: string[]): CoverageComparison {
  const key = (x: { schema: string; relation: string; principal: string }) => `${x.schema}.${x.relation} ${x.principal}`;
  const rel = (x: { schema: string; relation: string }) => `${x.schema}.${x.relation}`;
  const classified = new Set(rows.filter((r) => r.classification !== "exempt_no_grant").map(key));
  const exempt = new Set(rows.filter((r) => r.classification === "exempt_no_grant").map(rel));
  const exposedKeys = new Set(exposed.map(key));
  const exposedRels = new Set(exposed.map(rel));
  const scope = new Set(inScope);
  const listed = new Set(rows.map(rel));
  const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();
  return {
    unclassified: sorted([...exposedKeys].filter((k) => !classified.has(k))),
    stale: sorted([
      ...[...classified].filter((k) => !exposedKeys.has(k)),
      ...[...exempt].filter((r) => !scope.has(r)).map((r) => `${r} none`),
    ]),
    unlisted: sorted([...scope].filter((r) => !listed.has(r))),
    brokenExemptions: sorted([...exempt].filter((r) => exposedRels.has(r))),
  };
}
