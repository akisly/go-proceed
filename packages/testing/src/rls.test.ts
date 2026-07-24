import { describe, it, expect } from "vitest";
import { appClient, asActor, resetDb } from "./pg.js";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("RLS tenant isolation", () => {
  it("actor B cannot see actor A's organization", async () => {
    await resetDb();
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    // A bootstraps an org + owner membership
    await asActor(A, orgId, async (c) => {
      await c.query(
        "insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      await c.query(
        "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
        [orgId, A]);
    });
    // A sees it
    const seenByA = await asActor(A, orgId, (c) =>
      c.query("select id from public.organizations where id=$1", [orgId]));
    expect(seenByA.rowCount).toBe(1);
    // B does not
    const seenByB = await asActor(B, orgId, (c) =>
      c.query("select id from public.organizations where id=$1", [orgId]));
    expect(seenByB.rowCount).toBe(0);
  }, 120_000);

  it("substituting app.organization_id does not grant cross-tenant read", async () => {
    // B claims A's orgId in context but has no membership → still zero rows
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const r = await asActor(B, orgId, (c) =>
      c.query("select * from api.me_context"));
    expect(r.rows.every((row: { user_id: string }) => row.user_id === B)).toBe(true);
  });

  it("aktflow_app role has nobypassrls and cannot see any org row without actor context", async () => {
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const c = appClient();
    await c.connect();
    try {
      const roleAttrs = await c.query(
        "select rolbypassrls from pg_roles where rolname = 'aktflow_app'");
      expect(roleAttrs.rows[0].rolbypassrls).toBe(false);

      await c.query("begin");
      await c.query("set local role aktflow_app");
      // no app.actor_user_id set → app.current_actor() is null → RLS hides all rows
      const r = await c.query("select id from public.organizations where id=$1", [orgId]);
      expect(r.rowCount).toBe(0);
      await c.query("rollback");
    } finally {
      await c.end();
    }
  });
});
