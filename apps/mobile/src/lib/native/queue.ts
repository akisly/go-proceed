import type { CreateUploadIntentResponse, FinalizeUploadIntentResponse, GetUploadIntentResponse } from "@goproceed/contracts";
import { buildCreateIntentBody } from "../capture/upload";
import type { VaultAPI, VaultContext, VaultItem } from "../vault";

/** iOS rejects with the bare code; Android wraps it («…Caused by: …: VAULT_NOT_FOUND»). */
function isNotFound(error: unknown): boolean {
  return error instanceof Error && /(^|\W)VAULT_NOT_FOUND$/.test(error.message.trim());
}
export class QueueRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message = code) { super(message); }
}
export interface QueueAPI {
  get(path: string, signal?: AbortSignal): Promise<unknown>;
  post(path: string, body: unknown, idempotencyKey: string, signal?: AbortSignal): Promise<unknown>;
}
/** Bounds on the waits behind a discard; a timeout holds the photo, never sends it. */
export interface QueueTimeouts { runWaitMs: number; discardReadMs: number; holdReadMs: number }
export const DEFAULT_TIMEOUTS: QueueTimeouts = { runWaitMs: 5_000, discardReadMs: 10_000, holdReadMs: 15_000 };
interface QueueDependencies {
  vault: VaultAPI;
  api: QueueAPI;
  authorize(item: VaultItem, signal: AbortSignal): Promise<void>;
  changed(): Promise<void>;
  /** A held photo the server received anyway (a finalize sent earlier landed). */
  receivedDespiteDiscard?(item: VaultItem): void;
  timeouts?: QueueTimeouts;
}

const TERMINAL_STATES = new Set(["expired", "scan_blocked", "orphaned_for_purge"]);
const sameIdentity = (a: VaultContext | null, b: VaultContext) => a?.subjectId === b.subjectId && a.workspaceId === b.workspaceId;
/** Resolves true when the promise settled in time; it keeps running either way. */
function settledWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(() => { clearTimeout(timer); resolve(true); }, () => { clearTimeout(timer); resolve(true); });
  });
}
/** An abort signal that fires after `ms`, or when `outer` aborts. */
function timeoutSignal(ms: number, outer?: AbortSignal): { signal: AbortSignal; done(): void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const forward = () => controller.abort();
  outer?.addEventListener("abort", forward);
  if (outer?.aborted) controller.abort();
  return { signal: controller.signal, done: () => { clearTimeout(timer); outer?.removeEventListener("abort", forward); } };
}

/** Foreground, serial orchestration. This module imports no React Native runtime. */
export class NativeQueue {
  private context: VaultContext | null = null;
  private generation = 0;
  private controller: AbortController | null = null;
  private running: Promise<void> | null = null;
  private foreground = true;
  private revokedFlag = false;

  private readonly timeouts: QueueTimeouts;
  constructor(private readonly deps: QueueDependencies) { this.timeouts = deps.timeouts ?? DEFAULT_TIMEOUTS; }
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

  /**
   * Forgets the open identity without the native quarantine: for a vault that never
   * opened (no identity is open there) or one that was wiped (nothing is left).
   */
  stop(): void {
    this.generation += 1;
    this.controller?.abort();
    this.context = null;
    // Natively too: the identity is closed even if JavaScript's view of the vault was wrong.
    this.deps.vault.closeIdentity();
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
   * Otherwise the photo is held (DISCARD_HELD): never sent again, and removed by a
   * later run once the server reports the intent terminal.
   */
  async discard(id: string): Promise<void> {
    const identity = this.context;
    const inFlight = this.running;
    if (inFlight) {
      this.generation += 1;
      this.controller?.abort();
      await this.deps.vault.cancelUpload();
      // Bounded: every later step of that run fails its generation check anyway.
      await settledWithin(inFlight, this.timeouts.runWaitMs);
    }
    const rows = await this.deps.vault.list();
    // The list covers only the open identity; after a switch the row may be
    // quarantined elsewhere, which is neither gone nor received.
    if (!identity || !sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
    const item = rows.find((row) => row.id === id);
    // Gone from the journal means confirmed OR already deleted: say neither.
    if (!item) throw new QueueRequestError(0, "ITEM_GONE");
    if (item.intentId) {
      // Held before the read: whatever the server says next, this photo is never sent again.
      try {
        await this.deps.vault.requestDiscard(id, { confirmed: true });
      } catch (error) {
        if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
        if (isNotFound(error)) throw new QueueRequestError(0, "ITEM_GONE");
        throw error;
      }
      // A run that listed the row before the hold (started meanwhile) fails its next check.
      this.generation += 1;
      this.controller?.abort();
      await this.deps.changed();
      let receipt: GetUploadIntentResponse;
      const read = timeoutSignal(this.timeouts.discardReadMs);
      try {
        receipt = await this.deps.api.get(`/v1/upload-intents/${item.intentId}`, read.signal) as GetUploadIntentResponse;
      } catch {
        // A switch during the read sends it with another session; the row is now quarantined (and still held).
        if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
        throw new QueueRequestError(0, "DISCARD_HELD");
      } finally { read.done(); }
      if (receipt.uploadIntentId !== item.intentId) throw new QueueRequestError(0, "DISCARD_HELD");
      if (receipt.status === "available") throw new QueueRequestError(0, "ALREADY_RECEIVED");
      if (!TERMINAL_STATES.has(receipt.status)) throw new QueueRequestError(0, "DISCARD_HELD");
    }
    // The receipt GET awaited: a switch meanwhile moved the row under another owner.
    if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
    await this.removeLocally(item, identity, "UPLOAD_EXPIRED_OR_REJECTED");
    await this.deps.changed();
  }

  /** Deletes a row the server will not receive; `awaiting_receipt` goes through the catalog's `failed` first. */
  private async removeLocally(item: VaultItem, identity: VaultContext, code: string): Promise<void> {
    try {
      if (item.state === "awaiting_receipt") await this.deps.vault.markFailed(item.id, code);
      await this.deps.vault.discard(item.id, { confirmed: true });
    } catch (error) {
      if (!sameIdentity(this.context, identity)) throw new QueueRequestError(0, "SUPERSEDED");
      // A concurrent discard of the same item removed it first.
      if (isNotFound(error)) throw new QueueRequestError(0, "ITEM_GONE");
      throw error;
    }
  }

  /**
   * A held photo is only read, never authorized, created, uploaded or finalized.
   * Terminal: removed. Available (an earlier finalize landed): confirmed and reported.
   * Anything else, a failed read included, keeps waiting; 401/403 propagates.
   */
  private async resolveHold(item: VaultItem, signal: AbortSignal, check: () => void, context: VaultContext): Promise<void> {
    if (!item.intentId) { await this.removeLocally(item, context, "DISCARD_REQUESTED"); return; }
    const read = timeoutSignal(this.timeouts.holdReadMs, signal);
    let receipt: GetUploadIntentResponse;
    try {
      receipt = await this.deps.api.get(`/v1/upload-intents/${item.intentId}`, read.signal) as GetUploadIntentResponse;
    } catch (error) {
      if (error instanceof QueueRequestError && (error.status === 401 || error.status === 403)) throw error;
      return;
    } finally { read.done(); }
    check();
    if (receipt.uploadIntentId !== item.intentId) return;
    if (TERMINAL_STATES.has(receipt.status)) {
      await this.removeLocally(item, context, receipt.failureCode || "UPLOAD_EXPIRED_OR_REJECTED");
      return;
    }
    if (receipt.status === "available") {
      await this.confirm(item, receipt, check);
      this.deps.receivedDespiteDiscard?.(item);
    }
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
          if (item.discardRequestedAt) await this.resolveHold(item, controller.signal, check, context);
          else await this.process(item, controller.signal, check);
        } catch (error) {
          if (generation !== this.generation || controller.signal.aborted) break;
          // Held since this run listed it: nothing to mark, the hold path takes it next time.
          if (error instanceof QueueRequestError && error.code === "CANCELLED") continue;
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
    // The hold is re-read natively before anything is sent: never trust the run's snapshot.
    await this.notHeld(item.id);
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

  /** Throws when the user asked to delete the item since this run listed it. */
  private async notHeld(id: string): Promise<void> {
    const current = (await this.deps.vault.list()).find((row) => row.id === id);
    if (!current || current.discardRequestedAt) throw new QueueRequestError(0, "CANCELLED");
  }

  private async finalize(item: VaultItem, signal: AbortSignal, check: () => void): Promise<void> {
    await this.notHeld(item.id);
    check();
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
