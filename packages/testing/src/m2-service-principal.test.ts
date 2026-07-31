import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";

// The whole boundary is role membership. If aktflow_app_login can reach
// aktflow_service, every guarantee built on top of it is decoration.

let c: Client;

beforeAll(async () => { c = await adminClient(); });
afterAll(async () => { await c.end(); });

/** Direct grants only — pg_auth_members is not transitive. */
async function memberOf(role: string): Promise<string[]> {
  const r = await c.query<{ grantee: string }>(
    `select r.rolname as grantee
       from pg_auth_members am
       join pg_roles r on r.oid = am.member
       join pg_roles g on g.oid = am.roleid
      where g.rolname = $1
      order by 1`, [role]);
  return r.rows.map((x) => x.grantee);
}

describe("the service principal is a separate identity", () => {
  it("exists as a nologin role with a login of its own", async () => {
    const r = await c.query<{ rolname: string; rolcanlogin: boolean; rolbypassrls: boolean }>(
      `select rolname, rolcanlogin, rolbypassrls from pg_roles
        where rolname in ('aktflow_service','aktflow_service_login') order by 1`);
    expect(r.rows).toEqual([
      { rolname: "aktflow_service", rolcanlogin: false, rolbypassrls: false },
      { rolname: "aktflow_service_login", rolcanlogin: true, rolbypassrls: false },
    ]);
  });

  it("can do everything the application role can", async () => {
    // Membership, not a duplicated grant surface: the server is the app plus
    // the right to speak for itself.
    expect(await memberOf("aktflow_app")).toContain("aktflow_service");
  });

  it("is unreachable from the application login", async () => {
    // The direction that matters. aktflow_app_login must never be able to
    // SET ROLE its way into asserting server facts.
    expect(await memberOf("aktflow_service")).toEqual(["aktflow_service_login"]);
    expect(await memberOf("aktflow_service")).not.toContain("aktflow_app_login");
    expect(await memberOf("aktflow_service")).not.toContain("aktflow_app");
  });

  it("refuses the application login an actual SET ROLE", async () => {
    // Asserting the catalog is not the same as attempting the move.
    const { Client } = await import("pg");
    const app = new Client({ connectionString: process.env.APP_DB_URL
      ?? "postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" });
    await app.connect();
    try {
      let code = "";
      try { await app.query("set role aktflow_service"); }
      catch (e) { code = (e as { code?: string }).code ?? "unknown"; }
      expect(code).toBe("42501");
    } finally { await app.end(); }
  });
});
