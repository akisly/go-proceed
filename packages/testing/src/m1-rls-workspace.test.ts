import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, resetDb } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const W1 = "11111111-1111-1111-1111-111111111111";
const W2 = "22222222-2222-2222-2222-222222222222";
const P1 = "31111111-1111-1111-1111-111111111111";

let admin: Client;
beforeAll(async () => {
  await resetDb();
  admin = await adminClient();
  for (const [w, u, name] of [[W1, A, "Приклад-Перший"], [W2, B, "Приклад-Другий"]] as const) {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ($1,$2,$2)`, [w, name]);
    await admin.query(`insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'owner','active')`, [w, u]);
  }
  await admin.query(`insert into public.projects (id, workspace_id, name, created_by) values ($1,$2,'Приклад-Обʼєкт',$3)`, [P1, W1, A]);
}, 180_000);
afterAll(async () => { await admin.end(); });

describe("INV-001 — workspace-access module isolation", () => {
  it("A cannot insert a party into B's workspace (WITH CHECK denial)", async () => {
    await expect(asActor(A, W2, (c) => c.query(
      `insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Чужий',$2)`,
      [W2, A]))).rejects.toThrow(/row-level security|violates/i);
  });

  it("A cannot see B's workspace parties", async () => {
    await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Б-Партія',$2)`, [W2, B]);
    const r = await asActor(A, W1, (c) => c.query(`select * from public.parties where workspace_id = $1`, [W2]));
    expect(r.rows).toHaveLength(0);
  });

  it("B cannot see W1 projects even with a stolen project id", async () => {
    const r = await asActor(B, W2, (c) => c.query(`select * from public.projects where id = $1`, [P1]));
    expect(r.rows).toHaveLength(0);
  });

  it("A member without a grant cannot see a project in their OWN workspace", async () => {
    const r = await asActor(A, W1, (c) => c.query(`select * from public.projects where id = $1`, [P1]));
    expect(r.rows).toHaveLength(0); // visibility requires an explicit grant (plan decision 6)
  });

  it("a project.view grant makes the project visible", async () => {
    const m = await admin.query(`select id from public.memberships where organization_id=$1 and user_id=$2`, [W1, A]);
    await admin.query(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`, [W1, P1, m.rows[0].id, A]);
    const r = await asActor(A, W1, (c) => c.query(`select * from public.projects where id = $1`, [P1]));
    expect(r.rows).toHaveLength(1);
  });

  it("cross-workspace composite-FK injection is impossible: grant in W1 for a W2 project", async () => {
    const m = await admin.query(`select id from public.memberships where organization_id=$1 and user_id=$2`, [W1, A]);
    const p2 = await admin.query(`insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Б-Обʼєкт',$2) returning id`, [W2, B]);
    await expect(admin.query(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`, [W1, p2.rows[0].id, m.rows[0].id, A],
    )).rejects.toThrow(/foreign key/i); // even a superuser cannot join W1+W2 (INV-001 FK layer)
  });

  it("any active member can list workspace memberships (members.list policy)", async () => {
    await admin.query(
      `insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')`,
      [W1, B]);
    const r = await asActor(B, W1, (c) => c.query(
      `select user_id from public.memberships where organization_id = $1 order by created_at`, [W1]));
    expect(r.rows.map((x) => x.user_id).sort()).toEqual([A, B].sort());
    await admin.query(`delete from public.memberships where organization_id=$1 and user_id=$2`, [W1, B]);
  });

  it("app.accept_invitation creates an active membership exactly once and is existence-safe", async () => {
    const tokenHash = "ab".repeat(32);
    await admin.query(
      `insert into public.invitations (workspace_id, email, role, token_hash, expires_at, invited_by)
       values ($1,'c@example.test','member',$2, now() + interval '1 day', $3)`,
      [W2, tokenHash, B]);
    // A (authenticated, not yet a member of W2) accepts:
    const r = await asActor(A, null, (c) => c.query(`select * from app.accept_invitation($1)`, [tokenHash]));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].workspace_id).toBe(W2);
    expect(r.rows[0].member_role).toBe("member");
    // second accept: invitation no longer pending → existence-safe error
    await expect(asActor(A, null, (c) => c.query(`select * from app.accept_invitation($1)`, [tokenHash])))
      .rejects.toThrow(/INVITATION_NOT_FOUND/);
    // unknown token → same error shape
    await expect(asActor(A, null, (c) => c.query(`select * from app.accept_invitation($1)`, ["cd".repeat(32)])))
      .rejects.toThrow(/INVITATION_NOT_FOUND/);
    await admin.query(`delete from public.invitations where workspace_id=$1`, [W2]);
    await admin.query(`delete from public.memberships where organization_id=$1 and user_id=$2`, [W2, A]);
  });
});
