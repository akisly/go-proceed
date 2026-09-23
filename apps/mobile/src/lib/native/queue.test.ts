import { describe, expect, it, vi } from "vitest";
import type { VaultAPI, VaultItem } from "../vault";
import { NativeQueue, QueueRequestError } from "./queue";

const context = { subjectId: "subject", workspaceId: "workspace" };
function item(overrides: Partial<VaultItem> = {}): VaultItem {
  return { ...context, id: "capture", assignmentId: "assignment", occurrenceId: "occurrence",
    originMethod: "native_camera", mimeType: "image/jpeg", sha256: "a".repeat(64), byteSize: 10,
    claimedCaptureTime: "2026-09-23T00:00:00.000Z", sourceAppVersion: "1.0.0",
    createdAt: "2026-09-23T00:00:00.000Z", createIdempotencyKey: "create-key",
    finalizeIdempotencyKey: "finalize-key", state: "not_sent", ...overrides };
}
const available = { uploadIntentId: "intent", status: "available", evidenceObjectId: "evidence",
  contentHash: "a".repeat(64), byteSize: 10, serverReceivedAt: "2026-09-23T00:00:01.000Z",
  failureCode: null, expiresAt: "2026-09-24T00:00:00.000Z" };
const created = { uploadIntentId: "intent", workspaceId: "workspace", status: "intent_authorized",
  upload: { signedUrl: "https://storage.example/signed?token=secret", token: "secret" } };

function fixture(initial: VaultItem = item()) {
  let row = { ...initial };
  const events: string[] = [];
  const vault: VaultAPI = {
    initialize: async () => {}, authenticate: async () => { events.push("authenticate"); },
    importPhoto: async () => row, list: async () => [{ ...row }],
    setUploadIntent: async (_, value) => { row = { ...row, intentId: value.intentId, ...(value.evidenceId ? { evidenceId: value.evidenceId } : {}) }; events.push("pin"); },
    markAwaitingReceipt: async () => { row.state = "awaiting_receipt"; },
    markFailed: async (_, code) => { row.state = "failed"; row.errorCode = code; },
    upload: vi.fn(async () => { events.push("put"); return { status: 200 }; }),
    cancelUpload: async () => { events.push("cancel"); },
    confirmReceipt: vi.fn(async () => { events.push("cleanup"); row.state = "server_confirmed"; }),
    quarantine: async () => { events.push("quarantine"); row.state = "quarantined"; },
    restore: async () => { if (row.state === "quarantined") row.state = "not_sent"; },
    warnQuarantine: async () => {}, discard: async () => {}, purgeExpired: async () => {},
  };
  const get = vi.fn(async () => { events.push("get"); return available; });
  const post = vi.fn(async (path: string, _body?: unknown, _key?: string) => { events.push(path.endsWith("finalize") ? "finalize" : "create"); return path.endsWith("finalize") ? available : created; });
  const authorize = vi.fn(async () => { events.push("authorize"); });
  const queue = new NativeQueue({ vault, api: { get, post }, authorize, changed: async () => {} });
  return { queue, vault, get, post, authorize, events, current: () => row };
}

describe("native durable queue", () => {
  it("pins intent before PUT and deletes only after a matching GET receipt", async () => {
    const f = fixture(); await f.queue.activate(context); f.events.length = 0;
    await f.queue.run();
    expect(f.events).toEqual(["authorize", "create", "pin", "put", "finalize", "pin", "get", "pin", "cleanup"]);
    expect(f.post.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ deviceCaptureId: "capture", originMethod: "native_camera" }));
    expect(f.post.mock.calls[0]?.[2]).toBe("create-key");
    expect(f.post.mock.calls[1]?.[2]).toBe("finalize-key");
    expect(JSON.stringify(f.current())).not.toMatch(/signedUrl|Bearer|token=/);
  });
  it("coalesces concurrent retry taps into one native upload", async () => {
    const f = fixture(); await f.queue.activate(context);
    await Promise.all([f.queue.run(), f.queue.run(), f.queue.run()]);
    expect(f.vault.upload).toHaveBeenCalledTimes(1);
  });
  it("recovers a lost final response using GET without sending again", async () => {
    const f = fixture(item({ state: "awaiting_receipt", intentId: "intent" }));
    await f.queue.activate(context); await f.queue.run();
    expect(f.vault.upload).not.toHaveBeenCalled(); expect(f.post).not.toHaveBeenCalled();
    expect(f.vault.confirmReceipt).toHaveBeenCalledTimes(1);
  });
  it("probes finalize before retrying bytes already sent before a restart", async () => {
    const f = fixture(item({ intentId: "intent", state: "sending" }));
    f.get.mockResolvedValueOnce({ ...available, status: "intent_authorized", evidenceObjectId: null } as unknown as typeof available);
    await f.queue.activate(context); await f.queue.run();
    expect(f.vault.upload).not.toHaveBeenCalled();
    expect(f.post.mock.calls[0]?.[0]).toBe("/v1/upload-intents/intent/finalize");
  });
  it("replays immutable create after missing staging bytes, keeping its keys", async () => {
    const f = fixture(item({ intentId: "intent" }));
    f.get.mockResolvedValueOnce({ ...available, status: "intent_authorized" });
    f.post.mockRejectedValueOnce(new QueueRequestError(409, "UPLOAD_INTENT_CONFLICT"));
    await f.queue.activate(context); await f.queue.run();
    expect(f.vault.upload).toHaveBeenCalledTimes(1);
    expect(f.post.mock.calls.find(([path]) => path.endsWith("upload-intents"))?.[2]).toBe("create-key");
  });
  it.each([
    { contentHash: "b".repeat(64) }, { byteSize: 11 }, { uploadIntentId: "wrong" },
    { evidenceObjectId: "wrong" }, { serverReceivedAt: null },
  ])("retains encrypted original on receipt mismatch %j", async (mismatch) => {
    const f = fixture(item({ intentId: "intent", evidenceId: "evidence" }));
    f.get.mockResolvedValue({ ...available, ...mismatch } as typeof available);
    await f.queue.activate(context); await f.queue.run();
    expect(f.vault.confirmReceipt).not.toHaveBeenCalled(); expect(f.current().errorCode).toBe("RECEIPT_MISMATCH");
  });
  it("quarantines when authorization refuses the identity, without sending", async () => {
    const f = fixture(); f.authorize.mockRejectedValue(new QueueRequestError(403, "ACCESS_REVOKED"));
    await f.queue.activate(context); await f.queue.run();
    expect(f.current().state).toBe("quarantined"); expect(f.vault.upload).not.toHaveBeenCalled();
    expect(f.queue.identity).toBeNull(); expect(f.queue.revoked).toBe(true);
  });
  it("does not flag a workspace opened while the revoked one was still quarantining", async () => {
    const f = fixture(); f.authorize.mockRejectedValueOnce(new QueueRequestError(403, "ACCESS_REVOKED"));
    await f.queue.activate(context);
    let release: () => void = () => {};
    f.vault.quarantine = () => new Promise<void>((resolve) => { release = resolve; });
    const running = f.queue.run();
    await vi.waitFor(() => expect(f.queue.identity).toBeNull());
    f.vault.quarantine = async () => {};
    const opening = f.queue.activate({ ...context, workspaceId: "other" });
    release(); await running; await opening;
    expect(f.queue.revoked).toBe(false); expect(f.queue.identity?.workspaceId).toBe("other");
  });
  it("does not report a switch or sign-out as a revocation", async () => {
    const f = fixture(); await f.queue.activate(context); await f.queue.quarantine();
    expect(f.queue.revoked).toBe(false);
  });
  it("keeps running later items after an item vanished mid-send", async () => {
    const f = fixture(); f.authorize.mockRejectedValueOnce(new QueueRequestError(0, "TRANSIENT"));
    f.vault.markFailed = async () => { throw new Error("VAULT_NOT_FOUND"); };
    const second = item({ id: "second", createIdempotencyKey: "second-create", finalizeIdempotencyKey: "second-finalize" });
    const listed = f.vault.list;
    f.vault.list = async () => [...await listed(), second];
    await f.queue.activate(context); await expect(f.queue.run()).resolves.toBeUndefined();
    expect(f.authorize).toHaveBeenCalledTimes(2);
  });
  it("aborts before account replacement and ignores the old response", async () => {
    const f = fixture(); let complete: (value: typeof created) => void = () => {};
    f.post.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    await f.queue.activate(context); const running = f.queue.run();
    await vi.waitFor(() => expect(f.post).toHaveBeenCalledTimes(1));
    await f.queue.quarantine(); complete(created); await running;
    expect(f.vault.upload).not.toHaveBeenCalled(); expect(f.current().intentId).toBeUndefined();
    expect(f.current().state).toBe("quarantined");
  });
  it("fails only the item when storage refuses the signed grant", async () => {
    const f = fixture(); (f.vault.upload as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 403 });
    await f.queue.activate(context); await f.queue.run();
    expect(f.current().state).toBe("failed"); expect(f.current().errorCode).toBe("STORAGE_UPLOAD_FAILED");
    expect(f.queue.identity).toEqual(context);
  });
  it("rejects an activation that a later one superseded", async () => {
    const f = fixture(); let release: () => void = () => {};
    f.vault.authenticate = () => new Promise<void>((resolve) => { release = resolve; });
    const first = f.queue.activate(context);
    f.vault.authenticate = async () => {};
    await f.queue.activate({ ...context, workspaceId: "other" });
    release();
    await expect(first).rejects.toMatchObject({ code: "SUPERSEDED" });
    expect(f.queue.identity?.workspaceId).toBe("other");
  });
  it("stops a finalize in flight and refuses to discard while the server may still finalize", async () => {
    const f = fixture(item({ intentId: "intent", state: "failed" }));
    f.get.mockResolvedValue({ ...available, status: "intent_authorized" });
    let finalizeStarted = false; let finalizeSignal: AbortSignal | undefined;
    f.post.mockImplementation((path: string, _body?: unknown, _key?: string, signal?: AbortSignal) => {
      finalizeStarted = true; finalizeSignal = signal;
      // Like fetch: an aborted request rejects.
      return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("AbortError"))));
    });
    f.vault.discard = vi.fn(async () => {});
    await f.queue.activate(context); const running = f.queue.run();
    await vi.waitFor(() => expect(finalizeStarted).toBe(true));
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "RECEIPT_PENDING" }); await running;
    expect(finalizeSignal?.aborted).toBe(true);
    expect(f.vault.discard).not.toHaveBeenCalled();
    expect(f.vault.confirmReceipt).not.toHaveBeenCalled();
  });
  it("discards once the server has terminally refused the intent", async () => {
    const f = fixture(item({ intentId: "intent", state: "failed" }));
    f.get.mockResolvedValue({ ...available, status: "expired", evidenceObjectId: null } as unknown as typeof available);
    f.vault.discard = vi.fn(async () => {});
    await f.queue.activate(context); await f.queue.discard("capture");
    expect(f.vault.discard).toHaveBeenCalledWith("capture", { confirmed: true });
  });
  it("discards an item that never got an intent", async () => {
    const f = fixture(item({ state: "failed" }));
    f.vault.discard = vi.fn(async () => {});
    await f.queue.activate(context); await f.queue.discard("capture");
    expect(f.vault.discard).toHaveBeenCalledWith("capture", { confirmed: true });
    expect(f.get).not.toHaveBeenCalled();
  });
  it("refuses to discard when the intent cannot be read", async () => {
    const f = fixture(item({ intentId: "intent", state: "failed" }));
    f.get.mockRejectedValue(new Error("offline"));
    f.vault.discard = vi.fn(async () => {});
    await f.queue.activate(context);
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "RECEIPT_PENDING" });
    expect(f.vault.discard).not.toHaveBeenCalled();
  });
  it("does not claim receipt when a second discard finds the row already gone", async () => {
    const f = fixture(item({ state: "failed" }));
    let gone = false;
    const listed = f.vault.list;
    f.vault.list = async () => gone ? [] : listed();
    f.vault.discard = vi.fn(async () => { gone = true; });
    await f.queue.activate(context);
    await f.queue.discard("capture");
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "ITEM_GONE" });
    expect(f.vault.discard).toHaveBeenCalledTimes(1);
  });
  it("reports a lost race with a concurrent discard as gone, not as a failure", async () => {
    const f = fixture(item({ state: "failed" }));
    f.vault.discard = vi.fn(async () => { throw new Error("VAULT_NOT_FOUND"); });
    await f.queue.activate(context);
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "ITEM_GONE" });
  });
  it("a switch during the receipt GET is SUPERSEDED and deletes nothing", async () => {
    const f = fixture(item({ intentId: "intent", state: "failed" }));
    await f.queue.activate(context);
    f.get.mockImplementationOnce(async () => { await f.queue.activate({ ...context, workspaceId: "other" }); return { ...available, status: "expired" }; });
    f.vault.discard = vi.fn(async () => { throw new Error("VAULT_NOT_FOUND"); });
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "SUPERSEDED" });
    expect(f.vault.discard).not.toHaveBeenCalled();
  });
  it("recognises the Android-wrapped VAULT_NOT_FOUND as gone", async () => {
    const f = fixture(item({ state: "failed" }));
    f.vault.discard = vi.fn(async () => { throw new Error("Call to function 'GoProceedVault.call' has been rejected.\n→ Caused by: java.lang.IllegalStateException: VAULT_NOT_FOUND"); });
    await f.queue.activate(context);
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "ITEM_GONE" });
  });
  it("does not call a row gone when the workspace changed during the discard", async () => {
    const f = fixture(item({ state: "failed" }));
    await f.queue.activate(context);
    const listed = f.vault.list;
    f.vault.list = async () => { await f.queue.activate({ ...context, workspaceId: "other" }); f.vault.list = listed; return []; };
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "SUPERSEDED" });
  });
  it("refuses to discard what the server already received", async () => {
    const f = fixture(item({ intentId: "intent", state: "failed" }));
    f.vault.discard = vi.fn(async () => {});
    await f.queue.activate(context);
    await expect(f.queue.discard("capture")).rejects.toMatchObject({ code: "ALREADY_RECEIVED" });
    expect(f.vault.discard).not.toHaveBeenCalled();
  });
  it("fails only the item when a project grant is lost at create", async () => {
    const f = fixture(); f.post.mockRejectedValueOnce(new QueueRequestError(403, "SCOPE_PROJECT_DENIED"));
    await f.queue.activate(context); await f.queue.run();
    expect(f.current().state).toBe("failed"); expect(f.queue.identity).toEqual(context);
  });
  it("pauses foreground work without discarding or quarantining the original", async () => {
    const f = fixture(); await f.queue.activate(context); await f.queue.pause(); await f.queue.run();
    expect(f.post).not.toHaveBeenCalled(); expect(f.current().state).toBe("not_sent");
    expect(f.queue.identity).toEqual(context);
  });
});
