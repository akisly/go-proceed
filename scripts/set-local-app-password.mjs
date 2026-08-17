// scripts/set-local-app-password.mjs
// Sets the dev-only passwords for goproceed_app_login and goproceed_service_login
// on the LOCAL Supabase database. This replaces the former seed.sql statement
// so that no Supabase tooling path (--include-seed, db reset --linked,
// Branching preview reseed) can ever plant a known password on a reachable
// database.
import pg from "pg";

const url = new URL(process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
  console.error(`refusing non-local host: ${url.hostname}`);
  process.exit(1);
}
const password = process.env.APP_DB_PASSWORD ?? "app_pw";
const client = new pg.Client({ connectionString: url.href });
await client.connect();
// Both logins, one script: a service credential that only exists in someone's
// shell is a credential CI does not have, and the finalize path would fail
// there for a reason that looks nothing like its cause.
const servicePassword = process.env.SERVICE_DB_PASSWORD ?? "service_pw";
for (const [role, secret] of [
  ["goproceed_app_login", password],
  ["goproceed_service_login", servicePassword],
]) {
  // Identifiers are fixed; the password value is escaped as a SQL literal.
  await client.query(`alter role ${role} password '${secret.replaceAll("'", "''")}'`);
}
await client.end();
console.log("goproceed_app_login and goproceed_service_login passwords set on", url.hostname);
