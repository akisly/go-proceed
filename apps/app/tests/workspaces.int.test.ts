import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
// Toggle per-test to impersonate A or B. Specifier must match the routes'
// resolved import (apps/app/src/lib/auth) so the mock intercepts.
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function count(sql: string, p: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return Number(r.rows[0].n);
}
async function rows<T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return r.rows as T[];
}
async function exec(sql: string): Promise<void> {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query(sql); await c.end();
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
  current = A;
});

const create = async (key: string, body: Record<string, unknown> = { displayName: "Приклад-Простір" }) => {
  const { POST } = await import("../app/v1/workspaces/route");
  return POST(new Request("http://x/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({}) });
};

describe("POST /v1/workspaces", () => {
  it("creates workspace + owner membership + audit + outbox atomically; NO legal entity", async () => {
    const res = await create("w1");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(body.workspaceId).toBeTruthy();
    expect(await count("select count(*) n from public.organizations", [])).toBe(1);
    expect(await count("select count(*) n from public.legal_entities", [])).toBe(0);
    expect(await count("select count(*) n from public.memberships where role='owner' and status='active'", [])).toBe(1);
    expect(await count("select count(*) n from public.audit_events where action='workspace.created'", [])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where topic='workspace.created'", [])).toBe(1);
    const replayUntil = res.headers.get("Idempotency-Replay-Until");
    expect(replayUntil).toBeTruthy();
  });

  /**
   * M1 REVIEW FINDING 2. Nothing in production seeded these rows, so in a real
   * workspace `requirement_library.list` answered `{items: []}`,
   * `requirement_rule_versions.publish` refused every id, nothing could be
   * bound, and INV-083 then refused every baseline forever. The CONTENT of the
   * twelve rows is asserted against the CSV in
   * requirement-library-fidelity.int.test.ts; what is asserted here is that
   * provisioning produces them and cannot produce a workspace without them.
   */
  it("provisions the twelve Додаток Н rows and says so in the audit", async () => {
    const body = await (await create("lib")).json();
    expect(await count(
      "select count(*) n from public.requirement_library_items where workspace_id=$1",
      [body.workspaceId])).toBe(12);

    const audit = await rows<{ details: Record<string, unknown> }>(
      "select details from public.audit_events where action='workspace.created' and object_id=$1",
      [body.workspaceId]);
    // Recorded, not assumed: a workspace whose audit says 12 and whose table
    // holds fewer is a discrepancy somebody can date.
    expect(audit[0]!.details.requirementLibraryItemCount).toBe(12);
    expect(audit[0]!.details.sourceStandard).toBe("ДБН А.3.1-5:2016");
  });

  it("cannot produce a workspace whose library is missing", async () => {
    // The atomicity claim in the route's own comment, attempted rather than
    // asserted from reading: a workspace without the library is a workspace in
    // which every rule publication is refused and therefore every baseline is
    // unpublishable, so provisioning must either complete or leave nothing.
    //
    // The failure is induced on the library insert specifically — a refusal a
    // test can trigger from the outside would land BEFORE any write and would
    // prove nothing about rollback.
    await exec(`create or replace function public.goproceed_test_block_library()
                  returns trigger language plpgsql as $fn$
                begin
                  raise exception 'induced failure inside the provisioning transaction';
                end $fn$`);
    await exec(`create trigger goproceed_test_block_library
                  before insert on public.requirement_library_items
                  for each row execute function public.goproceed_test_block_library()`);
    try {
      // `commandRoute` turns an uncaught error into a problem response rather
      // than rejecting, so the 500 is the observation and the tables are the
      // assertion.
      const res = await create("atomic");
      expect(res.status).toBe(500);
    } finally {
      await exec("drop trigger if exists goproceed_test_block_library on public.requirement_library_items");
      await exec("drop function if exists public.goproceed_test_block_library()");
    }
    expect(await count("select count(*) n from public.organizations", [])).toBe(0);
    expect(await count("select count(*) n from public.memberships", [])).toBe(0);
    expect(await count("select count(*) n from public.requirement_library_items", [])).toBe(0);
    expect(await count("select count(*) n from public.audit_events where action='workspace.created'", [])).toBe(0);
    expect(await count("select count(*) n from public.transaction_outbox where topic='workspace.created'", [])).toBe(0);
    // No idempotency record claims the command completed, so an honest retry
    // re-executes rather than replaying a success that never happened.
    expect(await count(
      "select count(*) n from public.idempotency_records where operation_id='workspaces.create'", []))
      .toBe(0);

    // POSITIVE CONTROL for the probe itself. Without it, a trigger left behind
    // by a failed cleanup would make the assertions above pass for the wrong
    // reason — and so would every later test in this file.
    const after = await create("atomic-after");
    expect(after.status, await after.clone().text()).toBe(201);
    expect(await count(
      "select count(*) n from public.requirement_library_items where workspace_id=$1",
      [(await after.json()).workspaceId])).toBe(12);
  });

  it("replays idempotently — same key does not create a second workspace", async () => {
    const r1 = await create("dup");
    const b1 = await r1.json();
    const r2 = await create("dup");
    const b2 = await r2.json();
    expect(await count("select count(*) n from public.organizations", [])).toBe(1);
    expect(r2.status).toBe(201);
    expect(b2).toEqual(b1);
  });

  it("rejects a missing Idempotency-Key with 422 VALIDATION_FAILED", async () => {
    const { POST } = await import("../app/v1/workspaces/route");
    const res = await POST(new Request("http://x/v1/workspaces", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "X" }),
    }), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");
  });
});

describe("GET /v1/workspaces/{workspaceId}/members", () => {
  it("an active member lists members; an outsider gets 403 MEMBERSHIP_INACTIVE", async () => {
    const created = await (await create("m1")).json();
    const workspaceId = created.workspaceId as string;
    const { GET } = await import("../app/v1/workspaces/[workspaceId]/members/route");
    const okRes = await GET(new Request("http://x"), { params: Promise.resolve({ workspaceId }) });
    expect(okRes.status).toBe(200);
    const ok = await okRes.json();
    expect(ok.members).toHaveLength(1);
    expect(ok.members[0].userId).toBe(A);
    expect(ok.members[0].role).toBe("owner");

    current = B; // B has no membership in this workspace
    const denied = await GET(new Request("http://x"), { params: Promise.resolve({ workspaceId }) });
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("MEMBERSHIP_INACTIVE");
  });
});

describe("GET /v1/me/context (workspace naming)", () => {
  it("each membership row carries workspaceId equal to organizationId", async () => {
    await create("ctx");
    const { GET } = await import("../app/v1/me/context/route");
    const res = await GET(new Request("http://x/v1/me/context"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memberships).toHaveLength(1);
    expect(body.memberships[0].workspaceId).toBe(body.memberships[0].organizationId);
  });
});
