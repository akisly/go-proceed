import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq } from "./helpers/fixtures";

/**
 * ADR-010's project-sourced requirement items: a workspace authors a
 * requirement from its own робоча документація, in a table of its own,
 * alongside — and never inside — the shipped Додаток Н library (migration
 * 0059). Three routes, driven here rather than by inserting rows directly,
 * the same choice requirement-library-fidelity.int.test.ts makes for the
 * sibling table: what is asserted is what the COMMAND produces.
 *
 *   project_requirements.create  POST /v1/workspaces/{workspaceId}/project-requirements
 *   project_requirements.archive POST /v1/project-requirements/{itemId}/archive
 *   project_requirements.list    GET  /v1/workspaces/{workspaceId}/project-requirements
 */

// OWNER and MEMBER are two of the three canonical ids supabase/seed.sql plants
// in auth.users ('aaaaaaaa'/'a', 'cccccccc'/'c'). FOREIGN_OWNER and
// SECOND_ADMIN are not — see ensureAuthUser below for why that matters.
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MEMBER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const FOREIGN_OWNER = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const SECOND_ADMIN = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
let current = OWNER;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));
function asUser(id: string): void { current = id; }

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

/**
 * memberships.user_id is a foreign key to auth.users, and auth.users is
 * truncated by nothing in truncateAll — signatory-participants.int.test.ts's
 * own beforeEach documents exactly this: a row one suite inserts is a row
 * every later suite silently inherits, so whether an uncanonical id like
 * FOREIGN_OWNER or SECOND_ADMIN already exists depends on what has run
 * against this database before, not on anything this file controls. This
 * file owns both of its own uncanonical actors rather than depending on
 * either having been left behind by an earlier run or an earlier session.
 */
async function ensureAuthUser(id: string, email: string): Promise<void> {
  await q(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())
     on conflict (id) do nothing`,
    [id, email]);
}

async function createWorkspace(displayName: string): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/route");
  const res = await POST(jsonReq("http://x", { displayName }), params({}));
  if (res.status !== 201) throw new Error(`workspaces.create returned ${res.status} ${await res.text()}`);
  return (await res.json()).workspaceId as string;
}

async function createProject(workspaceId: string, name: string): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/projects/route");
  const res = await POST(jsonReq("http://x", { name }), params({ workspaceId }));
  if (res.status !== 201) throw new Error(`projects.create returned ${res.status} ${await res.text()}`);
  return (await res.json()).projectId as string;
}

async function createProjectRequirement(
  workspaceId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { POST } = await import(
    "../app/v1/workspaces/[workspaceId]/project-requirements/route");
  return POST(jsonReq("http://x", body), params({ workspaceId }));
}

async function archiveProjectRequirement(itemId: string): Promise<Response> {
  const { POST } = await import(
    "../app/v1/project-requirements/[itemId]/archive/route");
  return POST(jsonReq("http://x", {}), params({ itemId }));
}

async function listProjectRequirements(workspaceId: string): Promise<Response> {
  const { GET } = await import(
    "../app/v1/workspaces/[workspaceId]/project-requirements/route");
  return GET(new Request("http://x"), params({ workspaceId }));
}

async function listRequirementLibrary(workspaceId: string): Promise<Response> {
  const { GET } = await import(
    "../app/v1/workspaces/[workspaceId]/requirement-library/route");
  return GET(new Request("http://x"), params({ workspaceId }));
}

/** The stored row, read straight from the table rather than through a route. */
async function readItem(
  itemId: string,
): Promise<{ itemTextUk: string; sourceDrawingNo: string; status: string }> {
  const rows = await q<{ item_text_uk: string; source_drawing_no: string; status: string }>(
    `select item_text_uk, source_drawing_no, status
       from public.project_sourced_requirement_items where id = $1`,
    [itemId]);
  const row = rows[0];
  if (!row) throw new Error(`readItem: no row for ${itemId}`);
  return { itemTextUk: row.item_text_uk, sourceDrawingNo: row.source_drawing_no, status: row.status };
}

let WS: string;
let PROJECT: string;
let OTHER_WS_PROJECT: string;
let valid: Record<string, unknown>;

beforeEach(async () => {
  await truncateAll();
  await ensureAuthUser(FOREIGN_OWNER, "project-requirements-foreign-owner@example.test");
  await ensureAuthUser(SECOND_ADMIN, "project-requirements-second-admin@example.test");
  current = OWNER;
  WS = await createWorkspace("Приклад-Простір");
  PROJECT = await createProject(WS, "Приклад-Проєкт");
  await q(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'member','active')`,
    [WS, MEMBER]);
  // A project that is real, but in a DIFFERENT workspace than WS — the shape
  // create's tenant-boundary refusal is tested against.
  const otherWs = await createWorkspace("Приклад-Інший Простір");
  OTHER_WS_PROJECT = await createProject(otherWs, "Приклад-Чужий Проєкт");
  valid = {
    projectId: PROJECT, itemTextUk: "Приховані роботи з гідроізоляції санвузла",
    sourceDocument: "Приклад-РД-2026-014", sourceSheet: "12", sourceDrawingNo: "АР-07",
  };
});

describe("project_requirements.create", () => {
  it("creates an item and returns it tagged PROJECT_DOCUMENTATION", async () => {
    const res = await createProjectRequirement(WS, valid);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.verification).toBe("PROJECT_DOCUMENTATION");
    expect(body.status).toBe("active");
  });

  it("refuses a project of another workspace without disclosing it exists", async () => {
    const res = await createProjectRequirement(WS, { ...valid, projectId: OTHER_WS_PROJECT });
    expect(res.status).toBe(422);
  });

  it("refuses a plain member, who holds no project_requirements.manage", async () => {
    asUser(MEMBER);
    expect((await createProjectRequirement(WS, valid)).status).toBe(403);
  });

  // Review fix round 1, finding 1 (Critical). project_requirements.manage is a
  // WORKSPACE capability (ADR-010 decision 5), and the project mark on a
  // requirement item is metadata, not an access boundary (decision 4) — so a
  // second admin who never created PROJECT, and therefore holds no
  // project_access_grants row on it (INV-019 grants only the creator), must
  // still be able to cite it. Minted the same way projects.int.test.ts and
  // parties.int.test.ts mint a second admin: a direct membership insert, no
  // invitation round-trip.
  it("succeeds for a second admin who did not create the project", async () => {
    await q(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'admin','active')`,
      [WS, SECOND_ADMIN]);
    asUser(SECOND_ADMIN);
    const res = await createProjectRequirement(WS, valid);
    expect(res.status).toBe(201);
  });
});

describe("project_requirements.archive", () => {
  // FOREIGN_OWNER, not OWNER, creates the foreign workspace: OWNER must hold
  // NO membership there, or the RLS-scoped resolve inside the archive route
  // would find the row anyway and the 404 would prove nothing about the
  // tenant boundary.
  let item: string;
  let otherWorkspaceItem: string;

  beforeEach(async () => {
    current = OWNER;
    item = (await (await createProjectRequirement(WS, valid)).json()).itemId as string;

    current = FOREIGN_OWNER;
    const foreignWs = await createWorkspace("Приклад-Чужий Простір");
    const foreignProject = await createProject(foreignWs, "Приклад-Чужий Проєкт-2");
    otherWorkspaceItem = (await (await createProjectRequirement(foreignWs, {
      projectId: foreignProject, itemTextUk: "Приклад-Чужий пункт вимоги",
      sourceDocument: "Приклад-РД-2026-099", sourceSheet: "1", sourceDrawingNo: "К-01",
    })).json()).itemId as string;
    current = OWNER;
  });

  it("archives an item and is idempotent on replay by state", async () => {
    expect((await archiveProjectRequirement(item)).status).toBe(200);
    expect((await archiveProjectRequirement(item)).status).toBe(200);
  });

  it("refuses an unknown or foreign item with 404 and no oracle", async () => {
    expect((await archiveProjectRequirement(randomUUID())).status).toBe(404);
    expect((await archiveProjectRequirement(otherWorkspaceItem)).status).toBe(404);
  });

  it("refuses a plain member with 403", async () => {
    asUser(MEMBER);
    expect((await archiveProjectRequirement(item)).status).toBe(403);
  });

  it("leaves the text and the citation untouched", async () => {
    const before = await readItem(item);
    await archiveProjectRequirement(item);
    const after = await readItem(item);
    expect(after.itemTextUk).toBe(before.itemTextUk);
    expect(after.sourceDrawingNo).toBe(before.sourceDrawingNo);
    expect(after.status).toBe("archived");
  });
});

describe("project_requirements.list", () => {
  let item: string;

  beforeEach(async () => {
    item = (await (await createProjectRequirement(WS, valid)).json()).itemId as string;
  });

  it("returns the workspace's project-sourced items and never a Додаток Н row", async () => {
    const body = await (await listProjectRequirements(WS)).json();
    expect(body.items.every((i: { verification: string }) =>
      i.verification === "PROJECT_DOCUMENTATION")).toBe(true);
  });

  it("is not the library: requirement_library.list returns no project-sourced row", async () => {
    const lib = await (await listRequirementLibrary(WS)).json();
    expect(lib.items.every((i: { verification: string }) =>
      i.verification !== "PROJECT_DOCUMENTATION")).toBe(true);
  });

  it("shows archived items with their status rather than hiding them", async () => {
    await archiveProjectRequirement(item);
    const body = await (await listProjectRequirements(WS)).json();
    expect(body.items.find((i: { itemId: string }) => i.itemId === item).status).toBe("archived");
  });
});
