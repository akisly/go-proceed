import { readFileSync } from "node:fs";

/**
 * The tenant-isolation coverage registry (DEV-013, readiness gate 11, INV-060).
 *
 * `technical/database/rls-coverage.csv` holds one row per relation this
 * database exposes to a tenant-facing principal (`EXPOSED_RELATIONS_SQL`) and one
 * `exempt_no_grant` row per in-scope relation no principal can reach. The validator checks the registry against the migrations and the
 * cited tests; `rls-coverage.test.ts` checks it against the running database.
 */

/** The tenant-facing principals whose reach makes a relation exposed. */
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

/** Roles that bypass RLS, so a policy test says nothing about them. */
export const BYPASS_ROLES = ["postgres", "service_role", "supabase_admin"];

const IN_SCOPE_RELS = `
  select c.oid, n.nspname, c.relname, c.relacl, c.relowner
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname in ('public', 'app') and c.relkind in ('r', 'p', 'v', 'm', 'f'))
      or (n.nspname = 'api' and c.relkind in ('v', 'm'))`;

const ACL_ENTRIES = `
    select r.oid as rel, a.grantee
      from rels r cross join lateral aclexplode(r.relacl) a
     where r.relacl is not null
    union
    select r.oid, a.grantee
      from rels r
      join pg_attribute att on att.attrelid = r.oid and att.attnum > 0 and not att.attisdropped and att.attacl is not null
      cross join lateral aclexplode(att.attacl) a`;

/** Tables, views and foreign tables in `public` and `app`, and views in `api`. */
export const IN_SCOPE_RELATIONS_SQL = `
  with rels as (${IN_SCOPE_RELS})
  select nspname || '.' || relname as name from rels order by 1`;

/**
 * One row per in-scope relation and principal ($1) that can reach it: a direct
 * table or column grant; a grant to PUBLIC (grantee 0), which reaches every
 * principal; ownership; or a policy naming the principal, or PUBLIC, on a
 * relation the principal can reach through an inherited privilege — the path
 * `goproceed_service` has to every `goproceed_app` table (BL-019). Inherited
 * reach with no policy naming the service is judged by the member-plane row,
 * because those policies key off `app.current_actor()`.
 */
export const EXPOSED_RELATIONS_SQL = `
  with rels as (${IN_SCOPE_RELS}),
  principals as (select r.oid, r.rolname from pg_roles r where r.rolname = any($1::text[])),
  acl as (${ACL_ENTRIES}),
  pairs as (
    select acl.rel, p.rolname from acl join principals p on p.oid = acl.grantee
    union
    select acl.rel, p.rolname from acl cross join principals p where acl.grantee = 0
    union
    select r.oid, p.rolname from rels r join principals p on p.oid = r.relowner
    union
    select r.oid, p.rolname
      from rels r
      join pg_policy pol on pol.polrelid = r.oid
      cross join lateral unnest(pol.polroles) as pr(roleoid)
      join principals p on pr.roleoid = p.oid or pr.roleoid = 0
     where has_table_privilege(p.rolname, r.oid, 'SELECT, INSERT, UPDATE, DELETE')
        or has_any_column_privilege(p.rolname, r.oid, 'SELECT, INSERT, UPDATE')
  )
  select distinct r.nspname as schema, r.relname as relation, pairs.rolname as principal
    from pairs join rels r on r.oid = pairs.rel
   order by 1, 2, 3`;

/** Direct grants on an in-scope relation to any role outside $1 (the five principals and the bypass roles). */
export const FOREIGN_GRANTEES_SQL = `
  with rels as (${IN_SCOPE_RELS}),
  acl as (${ACL_ENTRIES})
  select distinct r.nspname || '.' || r.relname as name, ro.rolname as grantee
    from acl join rels r on r.oid = acl.rel join pg_roles ro on ro.oid = acl.grantee
   where acl.grantee <> 0 and not (ro.rolname = any($1::text[]))
   order by 1, 2`;

/**
 * In-scope tables whose owner is not one of $1 (the bypass roles) and that do
 * not FORCE ROW LEVEL SECURITY: an owning principal bypasses its own policies.
 */
export const OWNER_WITHOUT_FORCED_RLS_SQL = `
  with rels as (${IN_SCOPE_RELS})
  select r.nspname || '.' || r.relname as name
    from rels r join pg_class c on c.oid = r.oid
   where c.relkind in ('r', 'p', 'f')
     and not (pg_get_userbyid(r.relowner) = any($1::text[]))
     and not c.relforcerowsecurity
   order by 1`;

/** Views and materialized views in `public` and `app` that run as their owner: no security_invoker, or materialized. */
export const UNSAFE_VIEWS_SQL = `
  select n.nspname || '.' || c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'app') and c.relkind in ('v', 'm')
     and (c.relkind = 'm' or not coalesce(
       (select lower(o.option_value) in ('true', 'on', '1') from pg_options_to_table(c.reloptions) o where o.option_name = 'security_invoker'),
       false))
   order by 1`;

/** Base tables among the names in $1 whose row level security is off. */
export const RLS_OFF_SQL = `
  select n.nspname || '.' || c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname || '.' || c.relname) = any($1::text[]) and c.relkind in ('r', 'p') and not c.relrowsecurity
   order by 1`;

/** Principals ($2) holding any privilege, direct or inherited, on relation $1 (PostgreSQL 17 adds MAINTAIN). */
export function exemptionPrivilegeSql(): string {
  return `
    select p as principal
      from unnest($2::text[]) as p
     where has_table_privilege(p, $1, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
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

// --------------------------------------------------------------------------
// The cross-workspace write minimum (DEV-076, BL-099, INV-060).
// --------------------------------------------------------------------------

/**
 * `technical/database/rls-write-coverage.csv` holds one row per `covered` row
 * of the read registry whose principal holds INSERT, UPDATE or DELETE, whole or
 * on some columns: the write it holds, and the test proving a member of
 * another workspace cannot write there — or a gap with its backlog entry.
 * `privileges` is `INSERT|UPDATE|DELETE` in that order; a column-only grant is
 * `VERB(col col)`, the columns sorted by name.
 */
export const WRITE_COVERAGE_COLUMNS = [
  "schema", "relation", "principal", "module", "privileges",
  "classification", "negative_test", "backlog_id", "reason",
] as const;

export interface WriteCoverageRow {
  schema: string;
  relation: string;
  principal: string;
  module: string;
  privileges: string;
  classification: string;
  negative_test: string;
  backlog_id: string;
  reason: string;
}

export interface WritePrivilege { schema: string; relation: string; principal: string; privileges: string }

export interface WriteCoverageComparison {
  /** Covered pairs holding a write with no row in the write registry. */
  unclassified: string[];
  /** Write-registry rows whose pair holds no write. */
  stale: string[];
  /** Rows whose `privileges` differ from what the database grants: `key: registry → database`. */
  mismatched: string[];
  /** Write-registry rows with no `covered` row of the same key and module in the read registry. */
  notCovered: string[];
}

const WRITE_REGISTRY_URL = new URL("../../../technical/database/rls-write-coverage.csv", import.meta.url);

export function parseWriteCoverageCsv(text: string): WriteCoverageRow[] {
  const [header, ...rest] = csvRecords(text);
  if (!header || header.join(",") !== WRITE_COVERAGE_COLUMNS.join(",")) {
    throw new Error(`rls-write-coverage.csv: header must be ${WRITE_COVERAGE_COLUMNS.join(",")}`);
  }
  return rest.map((fields, index) => {
    if (fields.length !== WRITE_COVERAGE_COLUMNS.length) {
      throw new Error(`rls-write-coverage.csv: row ${index + 2} has ${fields.length} fields, not ${WRITE_COVERAGE_COLUMNS.length}`);
    }
    return Object.fromEntries(WRITE_COVERAGE_COLUMNS.map((k, i) => [k, fields[i]!])) as unknown as WriteCoverageRow;
  });
}

export function readWriteCoverageRegistry(): WriteCoverageRow[] {
  return parseWriteCoverageCsv(readFileSync(WRITE_REGISTRY_URL, "utf8"));
}

/**
 * The writes each `(schema, relation, principal)` of $1, $2, $3 holds, direct
 * or inherited — the path `goproceed_service` has to every `goproceed_app`
 * table (BL-019) counts. A whole-table privilege is its verb; a privilege on
 * some columns only is `VERB(col col)`. Pairs holding no write are omitted.
 */
export const WRITE_PRIVILEGES_SQL = `
  with pairs as (
    select p.schema, p.relation, p.principal, to_regclass(format('%I.%I', p.schema, p.relation)) as rel
      from unnest($1::text[], $2::text[], $3::text[]) as p(schema, relation, principal)
  ),
  verbs as (
    select pairs.schema, pairs.relation, pairs.principal, v.ord, v.verb,
           has_table_privilege(pairs.principal, pairs.rel, v.verb) as whole,
           (select string_agg(a.attname, ' ' order by a.attname)
              from pg_attribute a
             where a.attrelid = pairs.rel and a.attnum > 0 and not a.attisdropped and v.verb <> 'DELETE'
               and has_column_privilege(pairs.principal, pairs.rel, a.attname, v.verb)) as cols
      from pairs cross join (values (1, 'INSERT'), (2, 'UPDATE'), (3, 'DELETE')) as v(ord, verb)
     where pairs.rel is not null
  )
  select schema, relation, principal,
         string_agg(case when whole then verb else verb || '(' || cols || ')' end, '|' order by ord) as privileges
    from verbs
   where whole or cols is not null
   group by schema, relation, principal
   order by 1, 2, 3`;

/**
 * Any of the five principals holding TRUNCATE or TRIGGER on an in-scope
 * relation ($1): row level security does not apply to TRUNCATE, and a trigger
 * its holder creates runs with its own rights.
 */
export const TRUNCATE_OR_TRIGGER_SQL = `
  with rels as (${IN_SCOPE_RELS})
  select r.nspname || '.' || r.relname as name, p as principal
    from rels r cross join unnest($1::text[]) as p
   where exists (select 1 from pg_roles where rolname = p)
     and (has_table_privilege(p, r.oid, 'TRUNCATE') or has_table_privilege(p, r.oid, 'TRIGGER'))
   order by 1, 2`;

export function compareWriteCoverage(
  writeRows: WriteCoverageRow[], readRows: CoverageRow[], measured: WritePrivilege[],
): WriteCoverageComparison {
  const key = (x: { schema: string; relation: string; principal: string }) => `${x.schema}.${x.relation} ${x.principal}`;
  const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();
  const registry = new Map(writeRows.map((r) => [key(r), r]));
  const granted = new Map(measured.map((m) => [key(m), m.privileges]));
  const covered = new Map(readRows.filter((r) => r.classification === "covered").map((r) => [key(r), r.module]));
  return {
    unclassified: sorted([...granted.keys()].filter((k) => !registry.has(k))),
    stale: sorted([...registry.keys()].filter((k) => !granted.has(k))),
    mismatched: sorted([...registry].filter(([k, r]) => granted.has(k) && granted.get(k) !== r.privileges)
      .map(([k, r]) => `${k}: ${r.privileges} → ${granted.get(k)}`)),
    notCovered: sorted([...registry].filter(([k, r]) => covered.get(k) !== r.module).map(([k]) => k)),
  };
}
