import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.APP_DB_URL;
    if (!connectionString) throw new Error("APP_DB_URL is not set");
    pool = new Pool({ connectionString, max: 10 });
    pool.on("error", (err) => { console.error("[db] idle client error", err); });
  }
  return pool;
}

let servicePool: pg.Pool | null = null;
/**
 * The server's own connection.
 *
 * Separate from getPool() on purpose: sharing a pool would mean sharing a
 * login, and the boundary this exists for is exactly that a connection
 * authenticated as aktflow_app_login cannot become the service role. Smaller
 * max than the application pool because only the finalize path uses it.
 */
export function getServicePool(): pg.Pool {
  if (!servicePool) {
    const connectionString = process.env.SERVICE_DB_URL;
    if (!connectionString) throw new Error("SERVICE_DB_URL is not set");
    servicePool = new Pool({ connectionString, max: 4 });
    servicePool.on("error", (err) => { console.error("[db] idle service client error", err); });
  }
  return servicePool;
}
