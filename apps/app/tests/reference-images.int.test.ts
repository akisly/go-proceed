import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTenantTx } from "@goproceed/database";
import { baselineFixture, hasIsolatedDatabaseCredentials, jsonReq, q, truncateAll } from "./helpers/fixtures";
import { addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary } from "./helpers/manual-baseline";
import { POST as publishRule } from "../app/v1/workspaces/[workspaceId]/requirement-rule-versions/route";
import { GET as listOccurrences } from "../app/v1/assignments/[assignmentId]/requirement-occurrences/route";
import { GET as getImage } from "../app/v1/occurrences/[occurrenceId]/reference-image/route";

const owner = "a0291111-1111-4111-8111-111111111111";
const stranger = "a0292222-2222-4222-8222-222222222222";
let current = owner;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

// These suites truncate the isolated database. They are deliberately NOT RUN
// during DEV-042 without owner authorization and migration 0095 applied there.
describe.skipIf(!hasIsolatedDatabaseCredentials())("DEV-042 reference pins and tenant isolation", () => {
  beforeEach(async () => {
    current = owner; await truncateAll();
    // memberships.user_id references auth.users, which truncateAll leaves alone and
    // no seed provides for these two ids (same pattern as project-requirements).
    for (const [id, email] of [[owner, "dev042-owner@fixture.test"], [stranger, "dev042-stranger@fixture.test"]]) {
      await q(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
        values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())
        on conflict (id) do nothing`, [id, email]);
    }
  });

  it("publishes a library rule unpinned while licensed content has not been provisioned", async () => {
    const world = await baselineFixture(owner);
    const [item] = await q("select id from public.requirement_library_items where workspace_id=$1 limit 1", [world.workspaceId]);
    const response = await publishRuleVersion(world.workspaceId, ruleVersionBody(item!.id as string));
    expect(response.status).toBe(201);
    const { ruleVersionId } = await response.json() as { ruleVersionId: string };
    const [row] = await q("select reference_image_version_id from public.requirement_rule_versions where id=$1", [ruleVersionId]);
    expect(row!.reference_image_version_id).toBeNull();
  });

  it("pins publication and occurrence; replay keeps the original pin after the library advances", async () => {
    const world = await baselineFixture(owner);
    const library = await seedRequirementLibrary(world.workspaceId);
    const itemId = library.get("Н.15/1")!;
    const [v1] = await q("select id from public.requirement_reference_image_versions where workspace_id=$1 and requirement_library_item_id=$2",
      [world.workspaceId, itemId]);
    const key = randomUUID();
    const request = () => new Request("http://test", { method: "POST", headers: {
      "content-type": "application/json", "idempotency-key": key,
    }, body: JSON.stringify(ruleVersionBody(itemId)) });
    const ctx = { params: Promise.resolve({ workspaceId: world.workspaceId }) };
    const first = await publishRule(request(), ctx);
    expect(first.status).toBe(201);
    const published = await first.json();
    const version2 = randomUUID();
    await q(`insert into public.requirement_reference_image_versions
      (id,workspace_id,requirement_library_item_id,version_no,storage_key,sha256,byte_size,
       mime_type,width,height,alt_text_uk,rights_holder,license,source_uri,manifest_sha256)
      values ($1,$2,$3,2,$4,repeat('c',64),3,'image/jpeg',1,1,'Приклад-новий ракурс',
        'TEST ONLY','TEST ONLY','https://example.com/test-only',repeat('d',64))`,
      [version2, world.workspaceId, itemId, `${randomUUID()}/${randomUUID()}`]);
    const replay = await publishRule(request(), ctx);
    expect(await replay.json()).toEqual(published);
    expect((await q("select reference_image_version_id from public.requirement_rule_versions where id=$1",
      [published.ruleVersionId]))[0]!.reference_image_version_id).toBe(v1!.id);
    const fresh = await publishRuleVersion(world.workspaceId, ruleVersionBody(itemId));
    expect(fresh.status).toBe(201);
    expect((await q("select reference_image_version_id from public.requirement_rule_versions where id=$1",
      [(await fresh.json()).ruleVersionId]))[0]!.reference_image_version_id).toBe(version2);

    const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
    expect((await grant(jsonReq("http://test", { memberId: world.memberId,
      capabilities: ["assignments.manage", "evidence.record", "rule_bindings.manage"] }),
    { params: Promise.resolve({ projectId: world.projectId }) })).status).toBe(201);
    const baseline = await (await createDraft(world.contractId)).json();
    const line = await (await addLine(baseline.contractVersionId, { sourceKey: "1", description: "Приклад-робота",
      workTypeKey: "montazh-elektrotekhnichnykh-ustanovok", unitCode: "м", contractQuantity: "1",
      unitPriceState: "known", unitPrice: "100.00" })).json();
    expect((await bindRules(baseline.contractVersionId, [published.ruleVersionId])).status).toBe(201);
    const view = await (await getVersion(world.contractId, 1)).json();
    expect((await publishVersion(baseline.contractVersionId, manifestOf(view))).status).toBe(201);
    const { POST: createAssignment } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const assignmentResponse = await createAssignment(jsonReq("http://test", { workItemId: line.workItem.workItemId }),
      { params: Promise.resolve({ contractId: world.contractId }) });
    expect(assignmentResponse.status).toBe(201);
    const [assignment] = await q("select id from public.work_assignments where workspace_id=$1", [world.workspaceId]);
    const assignmentId = assignment!.id as string;
    const routeCtx = { params: Promise.resolve({ assignmentId }) };
    const legacy = await (await listOccurrences(new Request("http://test"), routeCtx)).json();
    expect(legacy).not.toHaveProperty("workspaceId");
    expect(legacy.occurrences[0]).not.toHaveProperty("referenceImage");
    const enhanced = await (await listOccurrences(new Request("http://test?referenceImages=v1"), routeCtx)).json();
    expect(enhanced.workspaceId).toBe(world.workspaceId);
    expect(enhanced.captureAllowed).toBe(true);
    expect(enhanced.occurrences[0].referenceImage.imageVersionId).toBe(v1!.id);
    expect(JSON.stringify(enhanced)).not.toContain("storage_key");

    const occurrenceId = enhanced.occurrences[0].occurrenceId;
    const hidden = await withTenantTx({ actorUserId: stranger, organizationId: world.workspaceId, requestId: randomUUID() },
      (tx) => tx.query("select id from public.requirement_reference_image_versions where id=$1", [v1!.id]));
    expect(hidden.rows).toEqual([]);
    current = stranger;
    expect((await getImage(new Request("http://test"), { params: Promise.resolve({ occurrenceId }) })).status).toBe(404);
  });
});
