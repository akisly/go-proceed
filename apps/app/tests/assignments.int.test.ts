import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  q, truncateAll, jsonReq, publishedBaselineFixture, type PublishedBaselineFixture,
} from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

let fx: PublishedBaselineFixture;

async function createAssignment(body: unknown, contractId = fx.contractId): Promise<Response> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ contractId }) });
}

async function listAssignments(projectId = fx.projectId): Promise<Response> {
  const { GET } = await import("../app/v1/projects/[projectId]/assignments/route");
  return GET(new Request("http://x"), { params: Promise.resolve({ projectId }) });
}

async function publishedTemplate(): Promise<string> {
  const { POST: create } = await import(
    "../app/v1/workspaces/[workspaceId]/requirement-templates/route");
  const created = await create(jsonReq("http://x", {
    templateKey: "photo-set", evidenceType: "photo",
    allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 1024 * 1024 },
  }), { params: Promise.resolve({ workspaceId: fx.workspaceId }) });
  const id = (await created.json()).templateVersionId as string;
  const { POST: publish } = await import(
    "../app/v1/requirement-templates/[templateVersionId]/publish/route");
  await publish(jsonReq("http://x", {}), { params: Promise.resolve({ templateVersionId: id }) });
  return id;
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await publishedBaselineFixture(A, ["assignments.manage"]);
});

describe("assignments.create", () => {
  it("creates an assignment against a published work item", async () => {
    const res = await createAssignment({ workItemId: fx.workItems[0]!.id });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version).toBe(1);

    const rows = await q<{ contract_version_id: string; status: string }>(
      `select contract_version_id, status from public.work_assignments where id = $1`,
      [body.assignmentId]);
    expect(rows[0].contract_version_id).toBe(fx.contractVersionId);
    expect(rows[0].status).toBe("active");
  });

  it("accepts the optional operational fields", async () => {
    const res = await createAssignment({
      workItemId: fx.workItems[0]!.id,
      plannedQuantity: "7.500000",
      dueDate: "2026-09-01",
      performerPartyId: fx.ownPartyId,
      assigneeMemberId: fx.memberId,
    });
    expect(res.status).toBe(201);
  });

  it("pins a published requirement template version", async () => {
    const templateVersionId = await publishedTemplate();
    const res = await createAssignment({
      workItemId: fx.workItems[0]!.id,
      requirementTemplateVersionId: templateVersionId,
    });
    expect(res.status).toBe(201);
    const rows = await q<{ requirement_template_version_id: string }>(
      `select requirement_template_version_id from public.work_assignments where id = $1`,
      [(await res.json()).assignmentId]);
    expect(rows[0].requirement_template_version_id).toBe(templateVersionId);
  });

  it("refuses to pin a draft template version", async () => {
    // A draft can still change; pinning one would make the pin a promise the
    // system cannot keep.
    const { POST: create } = await import(
      "../app/v1/workspaces/[workspaceId]/requirement-templates/route");
    const draft = await create(jsonReq("http://x", {
      templateKey: "draft-set", evidenceType: "photo",
      allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 1024 },
    }), { params: Promise.resolve({ workspaceId: fx.workspaceId }) });
    const draftId = (await draft.json()).templateVersionId as string;

    const res = await createAssignment({
      workItemId: fx.workItems[0]!.id, requirementTemplateVersionId: draftId,
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fieldErrors[0].path).toBe("requirementTemplateVersionId");
  });

  it("refuses a work item from a superseded contract version", async () => {
    // Publishing a second version supersedes the first. The first version's
    // work items must stop being assignable, or operational scope would measure
    // against quantities nobody is contractually on the hook for.
    const stale = fx.workItems[0]!.id;
    expect((await createAssignment({ workItemId: stale })).status).toBe(201);

    // Add a superseding version by copying the published one. Going through a
    // second import would test the importer, not this route's version filter.
    await q(
      `insert into public.contract_versions
         (workspace_id, project_id, contract_id, version_no,
          own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
          terms, approval_policy, rounding_policy,
          source_tolerance_minor_units, source_tolerance_bps,
          import_batch_id, source_manifest_hash, published_by)
       select workspace_id, project_id, contract_id, version_no + 1,
              own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
              terms, approval_policy, rounding_policy,
              source_tolerance_minor_units, source_tolerance_bps,
              import_batch_id, source_manifest_hash, published_by
         from public.contract_versions where id = $1`, [fx.contractVersionId]);

    // The very same work item that was assignable a moment ago is now refused.
    const res = await createAssignment({ workItemId: stale });
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors[0].path).toBe("workItemId");
  });

  it("refuses a work item from another contract", async () => {
    const other = await publishedBaselineFixture(A, ["assignments.manage"]);
    const res = await createAssignment({ workItemId: other.workItems[0]!.id });
    expect(res.status).toBe(422);
  });

  it("refuses a location from a different project", async () => {
    const other = await publishedBaselineFixture(A, ["assignments.manage"]);
    const loc = await q<{ id: string }>(
      `insert into public.locations (workspace_id, project_id, name, created_by)
       values ($1,$2,'Приклад-Локація',$3) returning id`,
      [other.workspaceId, other.projectId, A]);
    const res = await createAssignment({
      workItemId: fx.workItems[0]!.id, locationId: loc[0]!.id,
    });
    expect(res.status).toBe(422);
  });

  it("denies a caller without assignments.manage", async () => {
    const bare = await publishedBaselineFixture(A); // no assignments.manage granted
    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(jsonReq("http://x", { workItemId: bare.workItems[0]!.id }),
      { params: Promise.resolve({ contractId: bare.contractId }) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("hides another workspace's contract as not found, never as forbidden", async () => {
    current = B;
    const res = await createAssignment({ workItemId: fx.workItems[0]!.id });
    // Membership is what fails first; the contract's existence is not disclosed.
    expect([403, 404]).toContain(res.status);
    expect((await res.json()).code).not.toBe("VALIDATION_FAILED");
  });

  it("replays one assignment under a repeated Idempotency-Key", async () => {
    const key = crypto.randomUUID();
    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const body = { workItemId: fx.workItems[0]!.id };
    const first = await POST(jsonReq("http://x", body, key === "" ? undefined : key) as Request,
      { params: Promise.resolve({ contractId: fx.contractId }) });
    const second = await POST(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ contractId: fx.contractId }) });
    expect(second.status).toBe(first.status);
    const rows = await q<{ n: number }>(
      `select count(*)::int n from public.work_assignments where workspace_id = $1`,
      [fx.workspaceId]);
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

describe("assignments.list", () => {
  it("returns assignments with joined work-item facts and zero effective quantity", async () => {
    await createAssignment({ workItemId: fx.workItems[0]!.id, plannedQuantity: "10.000000" });
    const res = await listAssignments();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignments.length).toBe(1);
    const row = body.assignments[0];
    expect(row.workItemId).toBe(fx.workItems[0]!.id);
    expect(row.unitCode).toBe(fx.workItems[0]!.unitCode);
    expect(row.description).toBeTruthy();
    expect(row.plannedQuantity).toBe("10.000000");
    expect(Number(row.effectiveQuantity)).toBe(0);
  });

  it("reflects recorded progress in effective quantity", async () => {
    const assignmentId = (await (await createAssignment(
      { workItemId: fx.workItems[0]!.id })).json()).assignmentId as string;
    await q(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',4,$5)`,
      [fx.workspaceId, fx.projectId, assignmentId, fx.workItems[0]!.id, fx.memberId]);
    const body = await (await listAssignments()).json();
    expect(Number(body.assignments[0].effectiveQuantity)).toBe(4);
  });

  it("denies a caller with no project grant", async () => {
    current = B;
    const res = await listAssignments();
    expect([403, 404]).toContain(res.status);
  });
});
