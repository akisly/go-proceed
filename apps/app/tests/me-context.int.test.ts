import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";
import { meContextResponse } from "@goproceed/contracts";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
// Toggle per-test to impersonate A or B without re-mocking. Must match the
// route's own import specifier exactly ("../src/lib/auth" relative to
// apps/app/app/v1/me/context/route.ts, i.e. apps/app/src/lib/auth with no
// extension — Turbopack does not resolve ".js" -> ".ts") so this mock
// actually intercepts.
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function seedOrgFor(userId: string): Promise<string> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  // Random suffix keeps re-runs collision-free even without a full truncate.
  const suffix = Math.random().toString(36).slice(2, 10);
  const org = await c.query(
    "insert into public.organizations (legal_name, display_name) values ($1,$2) returning id",
    [`L-${suffix}`, `D-${userId}-${suffix}`],
  );
  await c.query(
    "insert into public.memberships (organization_id,user_id,role,status,all_projects) values ($1,$2,'owner','active',true)",
    [org.rows[0].id, userId],
  );
  await c.end();
  return org.rows[0].id as string;
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin });
  await c.connect();
  await c.query("truncate public.organizations, public.memberships cascade");
  await c.end();
  current = A;
});

describe("GET /v1/me/context", () => {
  it("returns only the caller's memberships and never another org's data (RLS isolation)", async () => {
    const orgA = await seedOrgFor(A);
    const orgB = await seedOrgFor(B);
    const { GET } = await import("../app/v1/me/context/route");

    current = A;
    const res = await GET(new Request("http://x/v1/me/context"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Must validate against the shared contract exactly (membershipVersion is
    // a real number, not a bigint-as-string — node-postgres returns int8 as
    // string, so the route must cast).
    const parsed = meContextResponse.parse(body);
    expect(parsed.userId).toBe(A);
    expect(parsed.memberships).toHaveLength(1);
    expect(parsed.memberships[0].role).toBe("owner");
    expect(parsed.memberships[0].organizationId).toBe(orgA);
    expect(typeof parsed.memberships[0].membershipVersion).toBe("number");

    // No trace of B's org anywhere in the response.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(orgB);
    expect(raw).not.toContain(`D-${B}`);
  });

  it("is org-agnostic: a supplied X-Organization-Id for an org the caller does not belong to changes nothing", async () => {
    const orgA = await seedOrgFor(A);
    const orgB = await seedOrgFor(B);
    const { GET } = await import("../app/v1/me/context/route");

    current = A;
    const res = await GET(
      new Request("http://x/v1/me/context", { headers: { "x-organization-id": orgB } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = meContextResponse.parse(body);
    expect(parsed.userId).toBe(A);
    expect(parsed.memberships).toHaveLength(1);
    expect(parsed.memberships[0].organizationId).toBe(orgA);

    const raw = JSON.stringify(body);
    expect(raw).not.toContain(orgB);
  });

  it("does not require X-Organization-Id at all", async () => {
    await seedOrgFor(A);
    const { GET } = await import("../app/v1/me/context/route");
    current = A;
    const res = await GET(new Request("http://x/v1/me/context"));
    expect(res.status).toBe(200);
  });
});
