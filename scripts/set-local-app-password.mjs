// scripts/set-local-app-password.mjs
// Sets the dev-only password for aktflow_app_login on the LOCAL Supabase
// database. This replaces the former seed.sql statement so that no Supabase
// tooling path (--include-seed, db reset --linked, Branching preview reseed)
// can ever plant a known password on a reachable database.
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
// Identifier is fixed; the password value is escaped as a SQL literal.
await client.query(`alter role aktflow_app_login password '${password.replaceAll("'", "''")}'`);
await client.end();
console.log("aktflow_app_login password set on", url.hostname);
