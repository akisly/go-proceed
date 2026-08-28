import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { consumeBindingCommand, consumeMemberLinkCommand } from "../src/lib/telegram/linking";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, params: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  try { return (await c.query<T>(sql, params)).rows; }
  finally { await c.end(); }
}

const jsonReq = (url: string, body: unknown) => new Request(url, {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
  body: JSON.stringify(body),
});

function tokenFrom(url: string, parameter: "start" | "startgroup"): string {
  const raw = new URL(url).searchParams.get(parameter);
  if (!raw) throw new Error(`missing ${parameter} token`);
  return raw;
}

let workspaceId: string;
let projectId: string;
let memberId: string;

async function createBindingIntent() {
  const { POST } = await import("../app/v1/projects/[projectId]/telegram/binding-intents/route");
  return POST(jsonReq(`http://x/v1/projects/${projectId}/telegram/binding-intents`, {}),
    { params: Promise.resolve({ projectId }) });
}

async function createMemberLinkIntent() {
  const { POST } = await import("../app/v1/projects/[projectId]/telegram/member-link-intents/route");
  return POST(jsonReq(`http://x/v1/projects/${projectId}/telegram/member-link-intents`, {}),
    { params: Promise.resolve({ projectId }) });
}

const databaseDescribe = process.env.APP_DB_URL && process.env.SERVICE_DB_URL ? describe : describe.skip;

databaseDescribe("Telegram group binding and membership links", () => {
  beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
  vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
  vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
  vi.stubEnv("TELEGRAM_LINK_PEPPER", "p".repeat(32));
  vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
  current = A;
  workspaceId = "";
  projectId = "";
  memberId = "";

  const { POST: createWorkspace } = await import("../app/v1/workspaces/route");
  const workspace = await createWorkspace(jsonReq("http://x/v1/workspaces", { displayName: "Telegram-простір" }),
    { params: Promise.resolve({}) });
  workspaceId = (await workspace.json()).workspaceId;

  const { POST: createProject } = await import("../app/v1/workspaces/[workspaceId]/projects/route");
  const project = await createProject(jsonReq(`http://x/v1/workspaces/${workspaceId}/projects`, { name: "Telegram-проєкт" }),
    { params: Promise.resolve({ workspaceId }) });
  projectId = (await project.json()).projectId;
  [memberId] = (await q<{ id: string }>(
    "select id from public.memberships where organization_id=$1 and user_id=$2", [workspaceId, A],
  )).map((r) => r.id);

  const { POST: configure } = await import("../app/v1/projects/[projectId]/field-channel/route");
  const configured = await configure(jsonReq(`http://x/v1/projects/${projectId}/field-channel`, {
    channel: "telegram", expectedVersion: 1,
  }), { params: Promise.resolve({ projectId }) });
  expect(configured.status).toBe(200);
  });

  afterEach(async () => {
    if (workspaceId) await q("delete from public.organizations where id=$1", [workspaceId]);
  });

  it("consumes a group-binding token exactly once", async () => {
    const issued = await createBindingIntent();
    expect(issued.status).toBe(201);
    const rawToken = tokenFrom((await issued.json()).telegramUrl, "startgroup");

    expect((await consumeBindingCommand({
      rawToken, chatId: "-100123", chatType: "supergroup", title: "Будівництво", telegramUserId: "8001",
    })).kind).toBe("connected");
    expect((await consumeBindingCommand({
      rawToken, chatId: "-100999", chatType: "supergroup", title: "Інша група", telegramUserId: "8001",
    })).kind).toBe("invalid_or_expired");
  });

  it("does not consume a group-binding token from a private chat", async () => {
    const issued = await createBindingIntent();
    expect(issued.status).toBe(201);
    const rawToken = tokenFrom((await issued.json()).telegramUrl, "startgroup");

    expect((await consumeBindingCommand({
      rawToken, chatId: "8001", chatType: "private", title: null, telegramUserId: "8001",
    })).kind).toBe("wrong_group_type");
    expect((await consumeBindingCommand({
      rawToken, chatId: "-100123", chatType: "group", title: "Будівництво", telegramUserId: "8001",
    })).kind).toBe("connected");
  });

  it("does not link a Telegram identity to an inactive membership", async () => {
    const issued = await createMemberLinkIntent();
    expect(issued.status).toBe(201);
    const rawToken = tokenFrom((await issued.json()).telegramUrl, "start");
    await q("update public.memberships set status='ended' where id=$1", [memberId]);

    expect((await consumeMemberLinkCommand({
      rawToken, telegramUserId: "8002", displayName: "Учасник", username: "member",
    })).kind).toBe("membership_inactive");
  });
});
