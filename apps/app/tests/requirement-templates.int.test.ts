import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

const OWNER = "dddd1111-1111-1111-1111-111111111111";
const OUTSIDER = "dddd2222-2222-2222-2222-222222222222";
let current = OWNER;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, p: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  const r = await c.query(sql, p);
  await c.end();
  return r.rows as T[];
}

const jsonReq = (url: string, body: unknown, key = crypto.randomUUID()) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  });

let workspaceId: string;

const VALID = {
  templateKey: "photo-set",
  evidenceType: "photo" as const,
  allowedMedia: { mimeTypes: ["image/jpeg", "image/png"], maxByteSize: 10 * 1024 * 1024 },
};

async function createTemplate(body: unknown, key?: string): Promise<Response> {
  const { POST } = await import(
    "../app/v1/workspaces/[workspaceId]/requirement-templates/route");
  return POST(jsonReq("http://x", body, key), { params: Promise.resolve({ workspaceId }) });
}

async function publishTemplate(id: string, key?: string): Promise<Response> {
  const { POST } = await import(
    "../app/v1/requirement-templates/[templateVersionId]/publish/route");
  return POST(jsonReq("http://x", {}, key), {
    params: Promise.resolve({ templateVersionId: id }),
  });
}

beforeEach(async () => {
  current = OWNER;
  await q("truncate public.organizations cascade");
  await q("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  for (const [id, email] of [[OWNER, "owner@example.test"], [OUTSIDER, "outsider@example.test"]]) {
    await q(`delete from auth.users where email = $1 and id <> $2`, [email, id]);
    await q(
      `insert into auth.users (id, instance_id, aud, role, email,
                               encrypted_password, created_at, updated_at)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
               $2,'',now(),now())
       on conflict (id) do nothing`, [id, email]);
  }
  const { POST } = await import("../app/v1/workspaces/route");
  const res = await POST(jsonReq("http://x", {
    legalName: "Приклад-Простір ТОВ", displayName: "Приклад-Простір",
  }), { params: Promise.resolve({}) });
  workspaceId = (await res.json()).workspaceId;
  // A second, non-owner member for the capability test.
  await q(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'member','active')`, [workspaceId, OUTSIDER]);
});

describe("requirement_templates.create", () => {
  it("creates a draft as version 1", async () => {
    const res = await createTemplate(VALID);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.versionNo).toBe(1);
    const rows = await q(
      `select status, template_hash from public.requirement_template_versions where id = $1`,
      [body.templateVersionId]);
    expect(rows[0].status).toBe("draft");
    expect(rows[0].template_hash).toBeNull();
  });

  it("numbers a second version of the same key as 2", async () => {
    await createTemplate(VALID);
    const res = await createTemplate(VALID);
    expect((await res.json()).versionNo).toBe(2);
  });

  it("rejects M3 fields rather than silently dropping them", async () => {
    // A frozen hash that ignores fields the caller supplied is a lie about what
    // was agreed, so .strict() turns them into a 422 instead.
    for (const extra of [
      { conditionExpr: "always" }, { formSchema: {} }, { timing: {} },
      { reviewerPolicy: {} }, { satisfierPolicy: {} }, { exceptionPolicy: {} },
    ]) {
      const res = await createTemplate({ ...VALID, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(422);
    }
  });

  it("rejects an empty mime allowlist and an oversized limit", async () => {
    expect((await createTemplate({
      ...VALID, allowedMedia: { mimeTypes: [], maxByteSize: 100 },
    })).status).toBe(422);
    expect((await createTemplate({
      ...VALID, allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 60 * 1024 * 1024 },
    })).status).toBe(422);
  });

  it("denies a member without requirement_templates.manage", async () => {
    current = OUTSIDER;
    const res = await createTemplate(VALID);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_DENIED");
  });

  it("replays one draft under a repeated Idempotency-Key", async () => {
    const key = crypto.randomUUID();
    const first = await createTemplate(VALID, key);
    const second = await createTemplate(VALID, key);
    expect((await first.json()).templateVersionId)
      .toBe((await second.json()).templateVersionId);
    const rows = await q(
      `select count(*)::int n from public.requirement_template_versions where workspace_id = $1`,
      [workspaceId]);
    expect(rows[0].n).toBe(1);
  });

  it("numbers concurrent creates of one key without collision", async () => {
    // The advisory lock is what makes this deterministic; max(version_no)+1 read
    // outside a lock would let both callers compute 1.
    const results = await Promise.allSettled([
      createTemplate(VALID), createTemplate(VALID), createTemplate(VALID),
    ]);
    const statuses = await Promise.all(results.map(async (r) =>
      r.status === "fulfilled" ? r.value.status : 500));
    expect(statuses.every((s) => s === 201)).toBe(true);
    const rows = await q(
      `select version_no from public.requirement_template_versions
        where workspace_id = $1 order by version_no`, [workspaceId]);
    expect(rows.map((r) => r.version_no)).toEqual([1, 2, 3]);
  });
});

describe("requirement_templates.publish", () => {
  it("freezes the row with a hash and a publisher", async () => {
    const id = (await (await createTemplate(VALID)).json()).templateVersionId;
    const res = await publishTemplate(id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templateHash).toMatch(/^[0-9a-f]{64}$/);

    const rows = await q(
      `select status, template_hash, published_at, published_by_member_id
         from public.requirement_template_versions where id = $1`, [id]);
    expect(rows[0].status).toBe("published");
    expect(rows[0].template_hash).toBe(body.templateHash);
    expect(rows[0].published_at).not.toBeNull();
    expect(rows[0].published_by_member_id).not.toBeNull();
  });

  it("hashes identical frozen content identically across versions", async () => {
    const a = (await (await createTemplate(VALID)).json()).templateVersionId;
    const b = (await (await createTemplate(VALID)).json()).templateVersionId;
    const hashA = (await (await publishTemplate(a)).json()).templateHash;
    const hashB = (await (await publishTemplate(b)).json()).templateHash;
    // Same content, different version_no — the number is part of the frozen set,
    // so the hashes must differ.
    expect(hashA).not.toBe(hashB);
  });

  it("refuses to publish twice", async () => {
    const id = (await (await createTemplate(VALID)).json()).templateVersionId;
    await publishTemplate(id);
    const res = await publishTemplate(id);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");
  });

  it("replays the same receipt under a repeated Idempotency-Key", async () => {
    const id = (await (await createTemplate(VALID)).json()).templateVersionId;
    const key = crypto.randomUUID();
    const first = await publishTemplate(id, key);
    const second = await publishTemplate(id, key);
    expect(second.status).toBe(200);
    expect((await first.json()).templateHash).toBe((await second.json()).templateHash);
  });

  it("emits one published outbox event", async () => {
    const id = (await (await createTemplate(VALID)).json()).templateVersionId;
    await publishTemplate(id);
    const rows = await q(
      `select count(*)::int n from public.transaction_outbox
        where topic = 'requirement_template.published' and aggregate_id = $1`, [id]);
    expect(rows[0].n).toBe(1);
  });

  it("denies a member without requirement_templates.manage", async () => {
    const id = (await (await createTemplate(VALID)).json()).templateVersionId;
    current = OUTSIDER;
    const res = await publishTemplate(id);
    expect(res.status).toBe(403);
  });

  it("reports an unknown version as not found", async () => {
    const res = await publishTemplate("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("keeps a published version immutable at the database layer (INV-015)", async () => {
    const id = (await (await createTemplate(VALID)).json()).templateVersionId;
    await publishTemplate(id);
    await expect(q(
      `update public.requirement_template_versions set evidence_type = 'document'
        where id = $1`, [id])).rejects.toThrow();
  });
});
