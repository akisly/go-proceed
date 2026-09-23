import type { CreateUploadIntentResponse, FinalizeUploadIntentResponse, GetUploadIntentResponse } from "@goproceed/contracts";
import { buildCreateIntentBody } from "../capture/upload";
import type { VaultAPI, VaultContext, VaultItem } from "../vault";

export class QueueRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message = code) { super(message); }
}
export interface QueueAPI {
  get(path: string, signal?: AbortSignal): Promise<unknown>;
  post(path: string, body: unknown, idempotencyKey: string, signal?: AbortSignal): Promise<unknown>;
}
interface QueueDependencies {
  vault: VaultAPI;
  api: QueueAPI;
  authorize(item: VaultItem, signal: AbortSignal): Promise<void>;
  changed(): Promise<void>;
}

const TERMINAL_STATES = new Set(["expired", "scan_blocked", "orphaned_for_purge"]);
const sameIdentity = (a: VaultContext | null, b: VaultContext) => a?.subjectId === b.subjectId && a.workspaceId === b.workspaceId;

/** Foreground, serial orchestration. This module imports no React Native runtime. */
export class NativeQueue {
  private context: VaultContext | null = null;
  private generation = 0;
  private controller: AbortController | null = null;
  private running: Promise<void> | null = null;
  private foreground = true;
  private revokedFlag = false;

  constructor(private readonly deps: QueueDependencies) {}
  get identity(): VaultContext | null { return this.context; }
  /** True only when the server refused this identity (401/403) — not a switch or sign-out. */
  get revoked(): boolean { return this.revokedFlag; }

  async activate(context: VaultContext): Promise<void> {
    if (sameIdentity(this.context, context)) return;
    if (this.context) await this.quarantine();
    this.revokedFlag = false;
    const generation = ++this.generation;
    await this.deps.vault.authenticate(context);
    // A caller must never believe a workspace is open when a later activation won.
    if (generation !== this.generation) throw new QueueRequestError(0, "SUPERSEDED");
    this.context = { ...context };
    await this.deps.vault.restore();
    if (generation !== this.generation) throw new QueueRequestError(0, "SUPERSEDED");
    await this.deps.changed();
  }

  /** Does not await the request: it may itself be waiting for Supabase's auth lock. */
  async quarantine(): Promise<void> {
    this.generation += 1;
    this.controller?.abort();
    this.context = null;
    await this.deps.vault.quarantine();
    await this.deps.changed();
  }

  async pause(): Promise<void> {
    this.foreground = false;
    this.generation += 1;
    this.controller?.abort();
    await this.deps.vault.cancelUpload();
  }

  resume(): void { this.foreground = true; }

  /**
   * Explicit, confirmed deletion. Stops any send first, then deletes only when
   * «the server will not receive it» is true. Once an intent exists, bytes may be
   * in storage and a finalize may still be running server-side (an aborted fetch
   * does not stop it, nor does a restart), so only a terminal intent qualifies.
   */
  async discard(id: string): Promise<void> {
    const identity = this.context;
    const inFlight = this.running;
    if (inFlight) {
      this.generation += 1;
      this.controller?.abort();
      await this.deps.vault.cancelUpload();
      await inFlight.catch(() => undefined);
    }
    const rows = await this.deps.vault.list();
    // The list covers only the open identity; after a switch the row may be
    // quarantined elsewhere, which is neither gone nor received.
    if (!identity || !sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
    const item = rows.find((row) => row.id === id);
    // Gone from the journal means confirmed OR already deleted: say neither.
    if (!item) throw new QueueRequestError(0, "ITEM_GONE");
    if (item.intentId) {
      let receipt: GetUploadIntentResponse;
      try {
        receipt = await this.deps.api.get(`/v1/upload-intents/${item.intentId}`) as GetUploadIntentResponse;
      } catch {
        // A switch during the read sends it with another session; the row is now quarantined.
        if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
        throw new QueueRequestError(0, "RECEIPT_PENDING");
      }
      if (receipt.status === "available") throw new QueueRequestError(0, "ALREADY_RECEIVED");
      if (!TERMINAL_STATES.has(receipt.status)) throw new QueueRequestError(0, "RECEIPT_PENDING");
    }
    // The receipt GET awaited: a switch meanwhile moved the row under another owner.
    if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
    try {
      await this.deps.vault.discard(id, { confirmed: true });
    } catch (error) {
      if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
      // A concurrent discard of the same item removed it first. iOS rejects with the
      // bare code; Android wraps it («…Caused by: …: VAULT_NOT_FOUND»).
      if (error instanceof Error && /(^|\W)VAULT_NOT_FOUND$/.test(error.message.trim())) throw new QueueRequestError(0, "ITEM_GONE");
      throw error;
    }
    await this.deps.changed();
  }

  run(): Promise<void> {
    if (this.running) return this.running;
    if (!this.context || !this.foreground) return Promise.resolve();
    const context = this.context, generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const check = () => {
      if (!this.foreground || generation !== this.generation || controller.signal.aborted || !sameIdentity(this.context, context)) {
        throw new QueueRequestError(0, "CANCELLED");
      }
    };
    const work = async () => {
      const items = await this.deps.vault.list();
      for (const item of items) {
        if (item.state === "server_confirmed" || item.state === "quarantined" || !sameIdentity(item, context)) continue;
        try {
          check();
          await this.process(item, controller.signal, check);
        } catch (error) {
          if (generation !== this.generation || controller.signal.aborted) break;
          // A project grant lost between authorize and create/finalize fails only this item.
          if (error instanceof QueueRequestError && (error.status === 401 || error.status === 403) && error.code !== "SCOPE_PROJECT_DENIED") {
            // Set before awaiting: an activation during the native quarantine must be able to clear it.
            this.revokedFlag = true;
            await this.quarantine();
            break;
          }
          const code = error instanceof QueueRequestError ? error.code : "NETWORK_OR_STORAGE_ERROR";
          // A row discarded or quarantined mid-send cannot be marked; the rest of the queue still runs.
          await this.deps.vault.markFailed(item.id, code).catch(() => undefined);
        }
        await this.deps.changed();
      }
    };
    this.running = work().finally(() => {
      this.running = null;
      if (this.controller === controller) this.controller = null;
    });
    return this.running;
  }

  private async process(item: VaultItem, signal: AbortSignal, check: () => void): Promise<void> {
    if (item.intentId) {
      const receipt = await this.deps.api.get(`/v1/upload-intents/${item.intentId}`, signal) as GetUploadIntentResponse;
      check();
      if (receipt.uploadIntentId !== item.intentId) throw new QueueRequestError(0, "RECEIPT_MISMATCH");
      if (receipt.status === "available") { await this.confirm(item, receipt, check); return; }
      if (TERMINAL_STATES.has(receipt.status)) throw new QueueRequestError(0, receipt.failureCode || "UPLOAD_EXPIRED_OR_REJECTED");
    }

    await this.deps.authorize(item, signal);
    check();

    if (item.intentId) {
      // A crash can leave bytes in storage while the intent still says authorized.
      // Finalize is safe to replay; probing it avoids uploading an existing object.
      try {
        await this.finalize(item, signal, check);
        return;
      } catch (error) {
        check();
        if (!(error instanceof QueueRequestError && error.status === 409 && error.code === "UPLOAD_INTENT_CONFLICT")) throw error;
      }
    }

    const created = await this.deps.api.post(
      `/v1/assignments/${item.assignmentId}/upload-intents`,
      buildCreateIntentBody(item), item.createIdempotencyKey, signal,
    ) as CreateUploadIntentResponse;
    check();
    if (created.workspaceId !== item.workspaceId || typeof created.uploadIntentId !== "string"
      || (item.intentId && item.intentId !== created.uploadIntentId) || typeof created.upload?.signedUrl !== "string") {
      throw new QueueRequestError(0, "INTENT_MISMATCH");
    }
    await this.deps.vault.setUploadIntent(item.id, { intentId: created.uploadIntentId });
    check();
    const pinned = { ...item, intentId: created.uploadIntentId };
    // The native module validates destination and headers. No bearer or grant
    // reaches the journal. Photo bytes never enter JavaScript.
    const result = await this.deps.vault.upload(item.id, {
      url: created.upload.signedUrl, headers: { "Content-Type": item.mimeType },
    });
    check();
    // A storage 401/403 is an expired signed grant, not a revoked member: fail the item only.
    if (result.status < 200 || result.status >= 300) throw new QueueRequestError(0, "STORAGE_UPLOAD_FAILED");
    await this.deps.vault.markAwaitingReceipt(item.id);
    check();
    await this.deps.changed();
    await this.finalize(pinned, signal, check);
  }

  private async finalize(item: VaultItem, signal: AbortSignal, check: () => void): Promise<void> {
    const finalized = await this.deps.api.post(
      `/v1/upload-intents/${item.intentId}/finalize`, {}, item.finalizeIdempotencyKey, signal,
    ) as FinalizeUploadIntentResponse;
    check();
    if (finalized.uploadIntentId !== item.intentId) throw new QueueRequestError(0, "RECEIPT_MISMATCH");
    if (finalized.status !== "available") throw new QueueRequestError(0, finalized.failureCode || "RECEIPT_NOT_AVAILABLE");
    if (!finalized.evidenceObjectId || finalized.contentHash !== item.sha256 || !finalized.serverReceivedAt
      || (item.evidenceId && item.evidenceId !== finalized.evidenceObjectId)) throw new QueueRequestError(0, "RECEIPT_MISMATCH");
    await this.deps.vault.setUploadIntent(item.id, { intentId: item.intentId!, evidenceId: finalized.evidenceObjectId });
    check();
    const receipt = await this.deps.api.get(`/v1/upload-intents/${item.intentId}`, signal) as GetUploadIntentResponse;
    check();
    await this.confirm({ ...item, evidenceId: finalized.evidenceObjectId }, receipt, check);
  }

  private async confirm(item: VaultItem, receipt: GetUploadIntentResponse, check: () => void): Promise<void> {
    if (receipt.status !== "available" || receipt.uploadIntentId !== item.intentId
      || receipt.contentHash !== item.sha256 || receipt.byteSize !== item.byteSize
      || !receipt.evidenceObjectId || !receipt.serverReceivedAt
      || (item.evidenceId && receipt.evidenceObjectId !== item.evidenceId)) throw new QueueRequestError(0, "RECEIPT_MISMATCH");
    await this.deps.vault.setUploadIntent(item.id, { intentId: item.intentId!, evidenceId: receipt.evidenceObjectId });
    check();
    await this.deps.vault.confirmReceipt(item.id, {
      status: "available", evidenceId: receipt.evidenceObjectId, sha256: receipt.contentHash, byteSize: receipt.byteSize,
    });
    check();
  }
}
