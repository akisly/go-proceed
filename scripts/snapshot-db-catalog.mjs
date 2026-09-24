// scripts/snapshot-db-catalog.mjs
// Dumps the live catalog (tables, RLS, policies, grants, functions, roles,
// triggers, default ACLs) so staging/production drift stops being unknown
// (baseline-verification "What is not verified"). Run per environment before
// and after every deploy; commit local snapshots under
// migration/goproceed-canonical-v0.1/catalog-snapshots/ and diff. A snapshot of
// a hosted project is NOT committed (owner, 2026-09-24, DEV-071): record only
// its INV-116 result in the task record and infra/README-staging.md §2.3.
//
// DEV-071 / BL-157: it also runs INV-116's catalog checks
// (technical/database/checks/inv-116-temporary-privilege.sql, the file
// packages/testing's temporary-privilege suite runs) and EXITS 1 when they
// return a row. It prints the host, never the URL. Everything runs in one
// READ ONLY transaction with search_path = pg_catalog.
//
// Against a non-local host (gp-security DEV-071 S1-02, S1-03) it refuses to
// connect without sslmode=verify-full and an sslrootcert, and it writes the
// snapshot to the OS temporary directory, never into the tracked directory.
import pg from "pg";
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const c = new pg.Client({ connectionString: url });
const host = String(c.host);
// pg reports an IPv6 host bracketed, so [::1] counts as remote and needs TLS (fails closed).
const local = ["127.0.0.1", "localhost"].includes(host);
if (!local && !(/[?&]sslmode=verify-full(&|$)/.test(url) && c.ssl && typeof c.ssl === "object"
                && c.ssl.ca && c.ssl.rejectUnauthorized !== false
                && typeof c.ssl.checkServerIdentity !== "function")) {
  console.error(`refusing ${host}: a non-local database needs sslmode=verify-full and sslrootcert=<CA file> in its URL`);
  process.exit(2);
}

const inv116 = readFileSync(
  new URL("../technical/database/checks/inv-116-temporary-privilege.sql", import.meta.url), "utf8");
// gp-security DEV-071 S1-05: an empty or truncated check file would pass on no rows.
for (const id of ["T1", "T2", "T3", "T6", "T8"]) {
  if (!inv116.includes(`'${id}'::pg_catalog.text`)) {
    console.error(`the INV-116 check file lacks ${id}; refusing to report on it`);
    process.exit(2);
  }
}

await c.connect();
await c.query("begin transaction read only");
await c.query("set local search_path = pg_catalog");
const q = async (sql) => (await c.query(sql)).rows;

const sections = {
  tables: await q(`select schemaname, tablename, rowsecurity from pg_tables
                   where schemaname in ('public','api','app') order by 1,2`),
  policies: await q(`select schemaname, tablename, policyname, cmd, roles::text as roles
                     from pg_policies order by 1,2,3`),
  grants: await q(`select table_schema, table_name, grantee, privilege_type
                   from information_schema.role_table_grants
                   where table_schema in ('public','api','app')
                     and grantee not in ('postgres','PUBLIC','supabase_admin')
                   order by 1,2,3,4`),
  functions: await q(`select n.nspname, p.proname, p.prosecdef as security_definer
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname in ('public','api','app') order by 1,2`),
  // `goproceed%` since 2026-08-17 (migration 0057). THIS PREFIX SPELLED THE OLD
  // PRODUCT NAME AND THE RENAME BROKE IT SILENTLY: the query still succeeded and
  // still returned `anon`/`authenticated`/`service_role`, so a snapshot taken
  // after the rename simply had no project roles in it — no error, no empty
  // result, just five missing rows in the one section a reviewer reads to check
  // who can log in and who bypasses RLS. A LIKE prefix is invisible to a guard
  // that matches whole role names, which is why `staleRoleNameErrors` now
  // matches this spelling too.
  roles: await q(`select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles
                  where rolname like 'goproceed%' or rolname in ('anon','authenticated','service_role')
                  order by 1`),
  // The database's own ACL. acldefault() stands in for a NULL (default) ACL, which
  // grants PUBLIC CONNECT and TEMPORARY: aclexplode(NULL) would show nothing.
  database_acl: await q(`select case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
                                a.privilege_type, a.is_grantable, pg_get_userbyid(a.grantor) as grantor,
                                d.datacl is not null as explicit
                           from pg_database d
                           cross join lateral aclexplode(coalesce(d.datacl, acldefault('d', d.datdba))) a
                          where d.datname = current_database() order by 1, 2`),
  // Informational: a role created after 0102 without TEMPORARY shows here; only
  // the seven goproceed_* roles and cli_login_* are meant to lack it.
  temp_privilege: await q(`select r.rolname, has_database_privilege(r.oid, d.oid, 'TEMPORARY') as temp,
                                  exists (select 1 from aclexplode(d.datacl) a
                                           where a.grantee = r.oid and a.privilege_type = 'TEMPORARY') as direct,
                                  r.rolsuper, r.rolcanlogin
                             from pg_roles r cross join pg_database d
                            where d.datname = current_database() and r.rolname !~ '^pg_' order by 1`),
  // INV-116: every row is a violation (no .catch: an error must surface).
  inv116_violations: await q(inv116),
  triggers: await q(`select event_object_table, trigger_name, action_timing, event_manipulation
                     from information_schema.triggers where trigger_schema='public' order by 1,2,4`),
  default_acls: await q(`select pg_get_userbyid(defaclrole) as owner,
                                case defaclnamespace when 0 then '<global>'
                                  else defaclnamespace::regnamespace::text end as schema,
                                defaclobjtype, defaclacl::text as acl
                         from pg_default_acl order by 1,2,3`),
  // Checked first, not caught: inside the read-only transaction a failed query
  // would abort every section after it (review DEV-071 R2-01).
  cron_jobs: (await q(`select to_regclass('cron.job') is not null as present`))[0].present
    ? await q(`select jobname, schedule, command from cron.job order by 1`)
    : [{ note: "pg_cron not installed" }],
};
await c.query("rollback").catch(() => undefined);
await c.end();

// The INV-116 result first, so a failed write cannot hide it (review DEV-071 R1-05).
console.log(`INV-116 on ${host}: ${sections.inv116_violations.length} violation(s)`);
if (sections.inv116_violations.length > 0) {
  for (const v of sections.inv116_violations) console.error(`INV-116 ${v.check_id} ${v.subject}: ${v.detail}`);
  process.exitCode = 1;
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
// A hosted snapshot goes to a fresh private directory, readable by its owner only
// (gp-security DEV-071 S2-01): /tmp is shared on a Linux host.
const dir = local ? "migration/goproceed-canonical-v0.1/catalog-snapshots"
  : mkdtempSync(join(tmpdir(), "goproceed-catalog-"));
if (local) mkdirSync(dir, { recursive: true });
const out = join(dir, `${stamp}.md`);
let md = `# DB catalog snapshot ${new Date().toISOString()}\n\nSource host: ${host}\n`;
for (const [name, rows] of Object.entries(sections)) {
  md += `\n## ${name} (${rows.length})\n\n\`\`\`json\n${JSON.stringify(rows, null, 1)}\n\`\`\`\n`;
}
writeFileSync(out, md, { mode: local ? 0o644 : 0o600 });
console.log("snapshot written:", out);
