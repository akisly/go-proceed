// scripts/snapshot-db-catalog.mjs
// Dumps the live catalog (tables, RLS, policies, grants, functions, roles,
// triggers, default ACLs) so staging/production drift stops being unknown
// (baseline-verification "What is not verified"). Run per environment before
// and after every deploy; commit local snapshots under
// migration/goproceed-canonical-v0.1/catalog-snapshots/ and diff.
import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const c = new pg.Client({ connectionString: url });
await c.connect();
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
  roles: await q(`select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles
                  where rolname like 'aktflow%' or rolname in ('anon','authenticated','service_role')
                  order by 1`),
  triggers: await q(`select event_object_table, trigger_name, action_timing, event_manipulation
                     from information_schema.triggers where trigger_schema='public' order by 1,2,4`),
  default_acls: await q(`select pg_get_userbyid(defaclrole) as owner,
                                case defaclnamespace when 0 then '<global>'
                                  else defaclnamespace::regnamespace::text end as schema,
                                defaclobjtype, defaclacl::text as acl
                         from pg_default_acl order by 1,2,3`),
  cron_jobs: await q(`select jobname, schedule, command from cron.job order by 1`)
    .catch(() => [{ note: "pg_cron not installed" }]),
};
await c.end();

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
mkdirSync("migration/goproceed-canonical-v0.1/catalog-snapshots", { recursive: true });
const out = `migration/goproceed-canonical-v0.1/catalog-snapshots/${stamp}.md`;
let md = `# DB catalog snapshot ${new Date().toISOString()}\n\nSource host: ${new URL(url).hostname}\n`;
for (const [name, rows] of Object.entries(sections)) {
  md += `\n## ${name} (${rows.length})\n\n\`\`\`json\n${JSON.stringify(rows, null, 1)}\n\`\`\`\n`;
}
writeFileSync(out, md);
console.log("snapshot written:", out);
