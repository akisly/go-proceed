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
 * authenticated as goproceed_app_login cannot become the service role. Smaller
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

/**
 * Test-only. Drops the cached service pool so the next getServicePool() reads
 * SERVICE_DB_URL again — the only way to exercise a MISCONFIGURED service URL,
 * which is what withServiceTx's identity assertion exists to catch. Nothing in
 * the application calls this: the pool is a process-lifetime singleton and
 * re-reading its configuration at runtime is not a behaviour the server wants.
 */
export async function resetServicePoolForTests(): Promise<void> {
  const previous = servicePool;
  servicePool = null;
  if (previous) await previous.end();
}
