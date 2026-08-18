import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

/**
 * `project_parties.create` and `party_contacts.create` — the two commands that
 * make the act's signatory slots reachable. The M4 suite proves the HAPPY path
 * end to end (its fixture now creates every signatory row through these routes
 * and composes an act on top). This file is the other half: who is refused, on
 * what grounds, and that a foreign tenant cannot learn anything through them.
 *
 * Authorization was decided by migration 0010's policies, and each case below
 * is written against THAT — `pp_write` requires project.admin on the project;
 * `pc_insert` requires workspace owner/admin, which is what parties.manage maps
 * to, tightened by INV-020 to own_legal_profiles.manage for an OWN party. A
 * route that refused where the policy admits, or admitted where the policy
 * refuses, is the bug class src/lib/authz.ts:70-75 records; these cases are how
 * that stays measured rather than assumed.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // owner
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // admin
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // member
const Z = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // owner of ANOTHER workspace
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return r.rows as T[];
}
const jsonReq = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

let workspaceId: string; let projectId: string; let partyId: string; let ownPartyId: string;
let otherWorkspaceId: string; let otherPartyId: string;

async function createWorkspace(as: string, name: string): Promise<string> {
  current = as;
  const { POST } = await import("../app/v1/workspaces/route");
  const res = await POST(jsonReq("http://x/v1/workspaces", { displayName: name }), params({}));
  return (await res.json()).workspaceId;
}
async function createProject(ws: string): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/projects/route");
  const res = await POST(jsonReq("http://x", { name: "Приклад-Обʼєкт" }), params({ workspaceId: ws }));
  return (await res.json()).projectId;
}
async function createParty(ws: string, displayName: string): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/parties/route");
  const res = await POST(jsonReq("http://x", { displayName }), params({ workspaceId: ws }));
  return (await res.json()).partyId;
}
async function linkParty(pid: string, body: unknown): Promise<Response> {
  const { POST } = await import("../app/v1/projects/[projectId]/parties/route");
  return POST(jsonReq("http://x", body), params({ projectId: pid }));
}
async function addContact(party: string, body: unknown): Promise<Response> {
  const { POST } = await import("../app/v1/parties/[partyId]/contacts/route");
  return POST(jsonReq("http://x", body), params({ partyId: party }));
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();

  workspaceId = await createWorkspace(A, "Приклад-Простір");
  projectId = await createProject(workspaceId);
  partyId = await createParty(workspaceId, "Приклад-Замовник");
  // An OWN party — INV-020's stricter branch. Marked by the own-profile route
  // rather than by SQL, so this test stands on the same rows a member would make.
  ownPartyId = await createParty(workspaceId, "Приклад-Власна");
  await q(`insert into public.party_legal_profiles (workspace_id, party_id, official_name, edrpou, updated_by) values ($1,$2,'ТОВ Приклад-Власна','12345678',$3)`, [workspaceId, ownPartyId, A]);
  {
    const { POST } = await import("../app/v1/parties/[partyId]/own-profile/route");
    const r = await POST(jsonReq("http://x", {}), params({ partyId: ownPartyId }));
    if (r.status !== 201) throw new Error(`own-profile setup ${r.status} ${await r.text()}`);
  }
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'admin','active')", [workspaceId, B]);
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')", [workspaceId, C]);

  otherWorkspaceId = await createWorkspace(Z, "Приклад-Чужий");
  otherPartyId = await createParty(otherWorkspaceId, "Приклад-Чужий-Учасник");
  current = A;
});

describe("project_parties.create — who may name a project's participants", () => {
  it("lets the project admin link a workspace party in a named relationship", async () => {
    const res = await linkParty(projectId, { partyId, relationship: "customer" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version).toBe(1);
    const rows = await q<{ relationship: string }>(
      `select relationship from public.project_parties where id = $1 and project_id = $2`, [body.projectPartyId, projectId]);
    expect(rows.map((r) => r.relationship)).toEqual(["customer"]);
  });

  it("is a 404 to a workspace admin with no grant on THIS project — the project is invisible before it is forbidden", async () => {
    // FIRST DRAFT EXPECTED 403 SCOPE_PROJECT_DENIED HERE, AND THE DATABASE
    // ANSWERED 404. B is a workspace admin and holds parties.manage — but
    // `projects_select` (RLS) requires an active project.view/project.admin
    // grant, so to B this project ROW does not exist, and the route's
    // existence-safe lookup 404s before `requireProjectCapability` is ever
    // reached. That is the stronger property, not a weaker one: a member with
    // no grant on a project learns nothing about it, not even that it is
    // there to be denied. The 403 branch is reachable only by a member who can
    // SEE the project but may not administer it — covered below.
    current = B;
    const res = await linkParty(projectId, { partyId, relationship: "customer" });
    expect(res.status).toBe(404);
  });

  it("is likewise a 404 to an ordinary member with no project grant", async () => {
    current = C;
    const res = await linkParty(projectId, { partyId, relationship: "customer" });
    expect(res.status).toBe(404);
  });

  it("refuses with 403 SCOPE_PROJECT_DENIED a member who can SEE the project but holds only project.view", async () => {
    // The route-level refusal, reached only once RLS lets the row through:
    // give C project.view (so projects_select admits it) and nothing else, and
    // requireProjectCapability(project.admin) is what says no. This is the
    // case that proves the ROUTE matches pp_write, rather than the policy
    // doing all the work in front of it.
    const me = await q<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [workspaceId, C]);
    await q(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`, [workspaceId, projectId, me[0]!.id, A]);
    current = C;
    const res = await linkParty(projectId, { partyId, relationship: "customer" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("returns 409 VERSION_CONFLICT on the same party in the same relationship twice", async () => {
    // The table's own (workspace, project, party, relationship) unique. Without
    // the route's branch this is a 23505 surfacing as a 500 — and the
    // constraint's auto-generated name is TRUNCATED to 63 bytes, which is why
    // the route matches a prefix. If this ever returns 500, that match broke.
    expect((await linkParty(projectId, { partyId, relationship: "customer" })).status).toBe(201);
    const dup = await linkParty(projectId, { partyId, relationship: "customer" });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("VERSION_CONFLICT");
  });

  it("allows the same party in a DIFFERENT relationship — a customer can also be the performer", async () => {
    expect((await linkParty(projectId, { partyId, relationship: "customer" })).status).toBe(201);
    expect((await linkParty(projectId, { partyId, relationship: "performer" })).status).toBe(201);
  });

  it("refuses a party from another workspace as a field error, without disclosing whether it exists", async () => {
    // Same 422 as a made-up uuid — parties_select hides the row, so the route
    // cannot tell the two apart and neither can the caller.
    const foreign = await linkParty(projectId, { partyId: otherPartyId, relationship: "customer" });
    const invented = await linkParty(projectId, { partyId: crypto.randomUUID(), relationship: "customer" });
    expect(foreign.status).toBe(422);
    expect(invented.status).toBe(422);
    expect((await foreign.json()).fieldErrors?.[0]?.path).toBe("partyId");
    expect((await invented.json()).fieldErrors?.[0]?.path).toBe("partyId");
  });

  it("is a 404 for a project the caller cannot see, existence-safe", async () => {
    current = Z; // owner of the OTHER workspace, project.admin there and nowhere else
    // A DIAGNOSTIC PRECONDITION, not a tautology. This case failed ONCE in a
    // full serialized run with «expected 422 to be 404» — a 422 here can only
    // mean Z SAW A's project (the route reached the party check) — and passed
    // 17/17 alone, three times in a row, and in the same file order as the
    // failing run. The database, the auth mock, the neighbouring suites and
    // app.has_project_capability (STABLE, keyed on the actor) were all
    // checked and none explains it. So before asserting, MEASURE the thing the
    // assertion depends on: does Z hold any grant on this project? If this ever
    // fires, the failure names the leaked row instead of a status code.
    const leaked = await q<{ capability: string; member_id: string }>(
      `select g.capability, g.member_id from public.project_access_grants g
         join public.memberships m on m.id = g.member_id
        where g.project_id = $1 and m.user_id = $2`, [projectId, Z]);
    expect(leaked, "Z must hold NO grant on A's project before this case means anything").toEqual([]);
    const res = await linkParty(projectId, { partyId: otherPartyId, relationship: "customer" });
    expect(res.status, `body: ${await res.clone().text()}`).toBe(404);
  });

  it("refuses a relationship outside the table's CHECK as a 422, not a 500", async () => {
    // The contract's enum mirrors project_parties.relationship's CHECK exactly;
    // this is the assertion that keeps them from drifting apart.
    const res = await linkParty(projectId, { partyId, relationship: "auditor" });
    expect(res.status).toBe(422);
  });
});

describe("party_contacts.create — a named person at a party", () => {
  it("lets the owner add a contact to an ordinary party", async () => {
    const res = await addContact(partyId, { fullName: "Приклад-Особа", roleTitle: "Головний інженер" });
    expect(res.status).toBe(201);
    const { partyContactId } = await res.json();
    const rows = await q<{ full_name: string; role_title: string | null }>(
      `select full_name, role_title from public.party_contacts where id = $1 and party_id = $2`, [partyContactId, partyId]);
    expect(rows).toEqual([{ full_name: "Приклад-Особа", role_title: "Головний інженер" }]);
  });

  it("lets a workspace admin add one too — parties.manage is owner OR admin", async () => {
    current = B;
    expect((await addContact(partyId, { fullName: "Приклад-Особа" })).status).toBe(201);
  });

  it("refuses an ordinary member (SCOPE_DENIED)", async () => {
    current = C;
    const res = await addContact(partyId, { fullName: "Приклад-Особа" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_DENIED");
  });

  it("applies INV-020: an OWN party's contacts need own_legal_profiles.manage, which an admin lacks", async () => {
    // The person who signs for the workspace's own legal entity is part of an
    // identity that is frozen into every published contract version. The
    // legal-profile route already enforces this; this route calls the same
    // function, and this case is what keeps them agreeing.
    current = B;
    const asAdmin = await addContact(ownPartyId, { fullName: "Приклад-Підписант" });
    expect(asAdmin.status).toBe(403);
    current = A;
    const asOwner = await addContact(ownPartyId, { fullName: "Приклад-Підписант" });
    expect(asOwner.status).toBe(201);
  });

  it("is a 404 for a party in another workspace, existence-safe", async () => {
    const res = await addContact(otherPartyId, { fullName: "Приклад-Особа" });
    expect(res.status).toBe(404);
  });

  it("refuses a blank name as a 422 — the table would too, but the caller gets a field error", async () => {
    const res = await addContact(partyId, { fullName: "   " });
    expect(res.status).toBe(422);
  });

  it("does not accept qualification-certificate fields, because the runtime table has none", async () => {
    // .strict() on the contract. If someone adds the columns (TODOS.md records
    // the schema-v0.1.sql divergence) the contract and this test move together.
    const res = await addContact(partyId, { fullName: "Приклад-Особа", qualificationCertificateNumber: "АР 001234" });
    expect(res.status).toBe(422);
  });
});

describe("the two together — what the act's signatory slot needs", () => {
  it("produces the (projectPartyId, partyContactId) pair composeSignatorySlot requires", async () => {
    // Not a compose test — m4-act.int.test.ts is that. This is the contract
    // between these two commands and the slot: both ids exist, both are the
    // party's, and a stranger's contact does NOT pair with this project's party.
    const pp = await (await linkParty(projectId, { partyId, relationship: "technical_supervision" })).json();
    const pc = await (await addContact(partyId, { fullName: "Приклад-Технагляд" })).json();
    const pair = await q<{ ok: boolean }>(
      `select exists (
         select 1 from public.project_parties pp
           join public.party_contacts pc on pc.workspace_id = pp.workspace_id and pc.party_id = pp.party_id
          where pp.id = $1 and pc.id = $2) as ok`, [pp.projectPartyId, pc.partyContactId]);
    expect(pair[0]!.ok).toBe(true);
  });
});
