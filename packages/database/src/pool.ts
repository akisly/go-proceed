import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.APP_DB_URL;
    if (!connectionString) throw new Error("APP_DB_URL is not set");
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}
