import { describe, it, expect } from "vitest";
import { appClient, asActor, resetDb } from "./pg";

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

  it("a caller with no membership sees zero api.me_context rows regardless of the app.organization_id GUC value", async () => {
    // No policy in this slice reads app.organization_id at all — api.me_context
    // and every RLS policy here key off app.actor_user_id (app.current_actor())
    // only. This test proves that setting app.organization_id to A's org (a
    // value B has no membership in) has no effect either way: B still sees
    // nothing, because B has no membership anywhere, not because the org GUC
    // was "rejected". A prior version of this test asserted
    // `rows.every(row => row.user_id === B)`, which is vacuously true on an
    // empty array and would still pass even if org-substitution somehow leaked
    // another user's rows in — assert the row count explicitly instead.
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const r = await asActor(B, orgId, (c) =>
      c.query("select * from api.me_context"));
    expect(r.rowCount).toBe(0);
  });

  it("actor B cannot self-insert an owner membership into actor A's existing org", async () => {
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await expect(
      asActor(B, orgId, (c) =>
        c.query(
          "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
          [orgId, B])),
    ).rejects.toThrow(/row-level security|violates/i);
    const seenByB = await asActor(B, orgId, (c) =>
      c.query("select id from public.organizations where id=$1", [orgId]));
    expect(seenByB.rowCount).toBe(0);
  });

  it("actor B cannot inject a legal entity into actor A's org", async () => {
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await expect(
      asActor(B, orgId, (c) =>
        c.query(
          "insert into public.legal_entities (organization_id, legal_name) values ($1,'Injected')",
          [orgId])),
    ).rejects.toThrow(/row-level security|violates/i);
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
