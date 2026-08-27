import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq } from "./helpers/fixtures";
import { publishRuleVersion, ruleVersionBody } from "./helpers/manual-baseline";

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
 *
 * The last block drives a FOURTH route, `requirement_rule_versions.publish`,
 * because an authored item that no rule version can rest on is a table nobody
 * reaches: ADR-010's second source arm is what turns these three into a
 * feature, and the item it publishes from is authored here.
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

/**
 * ADR-010's second source arm on `requirement_rule_versions.publish`. The same
 * command, the same frozen content and the same INSERT — a different
 * documentation behind it — so this block asserts BOTH arms rather than only
 * the new one: this is the change that made the route branch, and «the shipped
 * Додаток Н still publishes» is a claim the branching change owes.
 *
 * It lives in this file rather than beside the other rule-version suites
 * because what it needs is a project-sourced item, and the three routes that
 * author, archive and list one are already driven above.
 */
describe("requirement_rule_versions.publish, the two source arms", () => {
  let item: string;
  let libraryItem: string;

  beforeEach(async () => {
    item = (await (await createProjectRequirement(WS, valid)).json()).itemId as string;
    // Read through the route rather than the table: `workspaces.create` seeds
    // the Додаток Н rows (apps/app/src/lib/dodatok-n.ts), and the library arm
    // must publish from a row the product itself put there.
    const lib = await (await listRequirementLibrary(WS)).json();
    libraryItem = lib.items[0].libraryItemId as string;
  });

  /**
   * The shared v0.1 rule shape with its source named explicitly.
   * `ruleVersionBody` spreads `over` last, so `requirementLibraryItemId:
   * undefined` genuinely REMOVES the library arm: `JSON.stringify` drops an
   * undefined value rather than sending the `null` the strict request schema
   * would refuse. Each caller then names the one source it publishes from,
   * which is what the request's exactly-one rule requires.
   */
  const ruleFrom = (source: Record<string, unknown>): Record<string, unknown> =>
    ruleVersionBody(libraryItem, { requirementLibraryItemId: undefined, ...source });

  it("publishes a rule version from a project-sourced item", async () => {
    const res = await publishRuleVersion(WS, ruleFrom({ projectSourcedRequirementItemId: item }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.normRefVerification).toBe("PROJECT_DOCUMENTATION");
    expect(body.normRefSource).toContain("Приклад-РД-2026-014");
    expect(body.normRefSource).toContain("арк. 12");
    expect(body.normRefSource).toContain("кресл. АР-07");
    // The site's own text is attributed to the site's own documentation and to
    // no standard's list: a project-sourced string never renders inside a
    // Додаток Н block (hidden-works-content-rules.md §"Project-sourced
    // strings"), so the position-level Додаток Н citation must not be here.
    expect(body.normRef).not.toContain("Додаток Н");
  });

  it("refuses publishing from an archived item", async () => {
    expect((await archiveProjectRequirement(item)).status).toBe(200);
    const res = await publishRuleVersion(WS, ruleFrom({ projectSourcedRequirementItemId: item }));
    expect(res.status).toBe(422);
    // Refused BY NAME, not as an absent row: archiving means «do not build new
    // obligations on this», and the caller can already see the item.
    const body = await res.json();
    expect(body.fieldErrors[0].path).toBe("projectSourcedRequirementItemId");
  });

  it("copies the item text as the default acceptance criterion", async () => {
    const body = await (await publishRuleVersion(WS, ruleFrom({
      acceptanceCriterion: undefined, projectSourcedRequirementItemId: item,
    }))).json();
    expect(body.acceptanceCriterion).toBe("Приховані роботи з гідроізоляції санвузла");
  });

  it("still publishes from the shipped library, tagged and cited as before", async () => {
    const res = await publishRuleVersion(WS, ruleFrom({ requirementLibraryItemId: libraryItem }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.normRef).toContain("Додаток Н");
    expect(body.normRefVerification).not.toBe("PROJECT_DOCUMENTATION");
    expect(body.normRefSource.length).toBeGreaterThan(0);
  });

  it("carries both provenance fields, exactly one of them filled", async () => {
    const fromProject = await (await publishRuleVersion(WS,
      ruleFrom({ projectSourcedRequirementItemId: item }))).json();
    expect(fromProject.projectSourcedRequirementItemId).toBe(item);
    expect(fromProject.requirementLibraryItemId).toBeNull();

    const fromLibrary = await (await publishRuleVersion(WS,
      ruleFrom({ requirementLibraryItemId: libraryItem }))).json();
    expect(fromLibrary.requirementLibraryItemId).toBe(libraryItem);
    expect(fromLibrary.projectSourcedRequirementItemId).toBeNull();

    // The column, not only the view: `requirement_rule_versions_one_provenance_check`
    // is what makes the pair exclusive, and a view that agreed with a row the
    // database stored differently would be the failure worth catching.
    const rows = await q<{ lib: string | null; psri: string | null }>(
      `select requirement_library_item_id as lib,
              project_sourced_requirement_item_id as psri
         from public.requirement_rule_versions where id = $1`,
      [fromProject.ruleVersionId]);
    expect(rows[0]).toEqual({ lib: null, psri: item });
  });

  it("refuses an unknown item on either arm, and claims no single source", async () => {
    const unknownProject = await publishRuleVersion(WS,
      ruleFrom({ projectSourcedRequirementItemId: randomUUID() }));
    expect(unknownProject.status).toBe(422);

    const unknownLibrary = await publishRuleVersion(WS,
      ruleFrom({ requirementLibraryItemId: randomUUID() }));
    expect(unknownLibrary.status).toBe(422);
    // ADR-010 supersedes ADR-006 decision 4.1's «the only rule source in v0.1
    // is the shipped library». The refusal survives that supersession; the
    // sentence «У v0.1 правило спирається лише на постачений перелік Додатка Н»
    // does not, and a refusal telling a caller the library is their only option
    // would now be false.
    expect(await unknownLibrary.text()).not.toContain("спирається лише");
  });
});
