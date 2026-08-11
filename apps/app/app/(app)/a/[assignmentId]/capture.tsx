"use client";

import { useState } from "react";
import type {
  CreateUploadIntentRequest, CreateUploadIntentResponse, FinalizeUploadIntentResponse,
} from "@goproceed/contracts";

import { sha256Hex } from "../../../../src/lib/capture/hash";
import {
  CLIENT_STATE_LABEL, holdsUnsavedBytes, isSaved, type ClientState,
} from "../../../../src/lib/capture/state";
import { nextStateFor } from "../../../../src/lib/capture/recover";

/**
 * THE CAPTURE ISLAND — ADR-007 decision 4, obligation 2 of 2, and the
 * interaction the whole client is named after. `"use client"` because
 * `crypto.subtle.digest`, `File` and the `PUT` to Supabase Storage are
 * browser APIs the obligation screen (task 8, a server component) cannot
 * reach — this is the ONE island on that screen (design doc §5).
 *
 * ONE INTERACTION: picking a file starts the whole pipeline — hash, create,
 * PUT, finalize — with no separate "submit" step and no confirmation dialog
 * in between. A retry is the same interaction again: the file input stays
 * the only control, `photoId` (below) is not regenerated, and the label
 * changes to say a photo still needs saving rather than growing a second
 * button.
 */

type CaptureIslandProps = {
  assignmentId: string;
  occurrenceId: string;
  /**
   * A hint to the OS file/camera chooser, never a security boundary — the
   * server's own media policy (read from the occurrence's rule version) is
   * the actual gate, and `upload-intents.create` enforces it independently
   * of whatever this prop says. Defaults to images because `photo` is the
   * only evidence kind this client's obligation screen renders a capture
   * control for.
   */
  accept?: string;
};

/** Everything `buildCreateIntentBody` needs about the file and the attempt. */
type CaptureInput = {
  file: File;
  occurrenceId: string;
  expectedContentHash: string;
  deviceCaptureId: string;
};

/**
 * THE ONE PLACE THIS CLIENT'S REQUEST BODY IS ASSEMBLED, and the reason
 * INV-086 holds for a v0.1 PWA build: `originMethod` IS NOT A PARAMETER OF
 * THIS FUNCTION. `CaptureInput` carries no field a caller could route into
 * it, so there is no argument — not a typo, not a stray spread, not a future
 * caller reaching for "the same shape as the native client uses" — through
 * which `native_camera` could leave this module. The literal below is the
 * only value this build can ever send.
 *
 * `apps/app/tests/field-capture.int.test.ts` proves this two ways: the
 * honest call, and a call that smuggles `originMethod` in via a type-unsafe
 * cast (the compiler itself already refuses the honest attempt) — and shows
 * the smuggled property changes nothing, because the function body below
 * never reads `args.originMethod`.
 *
 * A browser has no camera-session identity and may be handed bytes the
 * browser itself stripped or transcoded, so the origin cannot be
 * established. `origin_not_distinguished` is the honest claim this build is
 * permitted to make — not a weaker version of a camera claim (ADR-007
 * decision 5; INV-086).
 */
export function buildCreateIntentBody(input: CaptureInput): CreateUploadIntentRequest {
  return {
    requirementOccurrenceId: input.occurrenceId,
    expectedContentHash: input.expectedContentHash,
    expectedByteSize: input.file.size,
    claimedMediaType: input.file.type,
    originalFilename: input.file.name,
    deviceCaptureId: input.deviceCaptureId,
    originMethod: "origin_not_distinguished",
    // DEVICE-CLAIMED, AND LABELLED SO WHEREVER IT IS SHOWN (see the receipt
    // rendering below). `file.lastModified` is the file's own mtime, which
    // the device asserts and nobody has verified — it is never rendered
    // beside the server receipt time without saying so (ADR-007 decision 5).
    claimedCaptureTime: new Date(input.file.lastModified).toISOString(),
  };
}

/** A fresh key per call attempt — NOT per photo. See `photoId` below for the contrast. */
function attemptKey(): string {
  return crypto.randomUUID();
}

type ProblemLike = { detail: string; userAction: string };

async function readProblem(res: Response): Promise<ProblemLike | null> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "userAction" in body
        && typeof (body as { userAction: unknown }).userAction === "string") {
      const detail = (body as { detail?: unknown }).detail;
      return { detail: typeof detail === "string" ? detail : "", userAction: (body as { userAction: string }).userAction };
    }
  } catch {
    // Not JSON — fall through to the generic message the caller supplies.
  }
  return null;
}

type UploadOutcome =
  | { state: "server_confirmed"; evidenceObjectId: string; contentHash: string; serverReceivedAt: string }
  | { state: Exclude<ClientState, "server_confirmed">; message: string };

/**
 * `nextStateFor` (task 6) is typed to return the full `ClientState` union,
 * though its own switch has no case that produces "server_confirmed" — only
 * `finalized.status === "available"` may. This turns that fact into an actual
 * type guard instead of an unsafe cast, and turns "it happened anyway" into
 * an honest `failed` rather than a silent, unearned claim that the photo is
 * saved.
 */
function nonConfirmed(s: ClientState): Exclude<ClientState, "server_confirmed"> {
  return s === "server_confirmed" ? "failed" : s;
}

const GENERIC_FAILURE = "Не вдалося зберегти фото. Перевірте з'єднання та спробуйте ще раз.";

/**
 * The body of the upload. Every state transition below is CLIENT-LOCAL and
 * never sent to the server — there is no server write path for `sending` or
 * `awaiting_receipt`, and INV-081 is decided entirely by `finalized.status
 * === "available"`, read through `isSaved` (task 6), not by anything this
 * function narrates along the way.
 */
async function upload(
  file: File, occurrenceId: string, assignmentId: string, photoId: string,
  onStateChange: (s: ClientState) => void,
): Promise<UploadOutcome> {
  onStateChange("sending");
  try {
    // THE FILE IS NEVER DRAWN TO A CANVAS. ADR-007 Cost 1 makes "do not
    // recompress the original" binding, and a canvas round-trip is the
    // ScaneReport anti-pattern it names. We read the bytes and send exactly
    // those bytes, to storage and to the hash, with nothing in between.
    const bytes = await file.arrayBuffer();
    const expectedContentHash = await sha256Hex(bytes);

    const body = buildCreateIntentBody({
      file, occurrenceId, expectedContentHash, deviceCaptureId: photoId,
    });

    const createRes = await fetch(`/v1/assignments/${assignmentId}/upload-intents`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": attemptKey() },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) {
      const problem = await readProblem(createRes);
      const state = nonConfirmed(nextStateFor(problem?.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem?.detail || GENERIC_FAILURE };
    }
    const created = await createRes.json() as CreateUploadIntentResponse;

    // …PUT the bytes to created.upload.signedUrl → "sending" (already set,
    // above — the whole staging phase, hash through PUT, is one client state).
    //
    // STRAIGHT TO SUPABASE STORAGE, NOT THROUGH /v1. No Authorization or
    // apikey header: the signed token in `signedUrl` IS the authorization a
    // signed upload URL is for, and adding a second, session-scoped Supabase
    // client here just to attach headers Storage does not ask for would be a
    // second, unaudited path into Supabase from the browser — exactly what
    // `src/lib/supabase-browser.ts`'s own comment says this client keeps to
    // one call site of (the OTP exchange, which this is not).
    const putRes = await fetch(created.upload.signedUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
    });
    if (!putRes.ok) {
      // The original is still in hand (it never left this component's
      // memory) and the intent is still authorized — `not_sent` under
      // `nextStateFor`'s own naming would overclaim recovery machinery this
      // build does not have (no offline queue, ADR-007 decision 6), so a
      // failed PUT is reported as `failed`, honestly, per recover.ts's own
      // default.
      onStateChange("failed");
      return { state: "failed", message: GENERIC_FAILURE };
    }

    // …POST /v1/upload-intents/{id}/finalize → "awaiting_receipt"
    onStateChange("awaiting_receipt");
    const finalizeRes = await fetch(`/v1/upload-intents/${created.uploadIntentId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": attemptKey() },
      body: JSON.stringify({}),
    });
    if (!finalizeRes.ok) {
      const problem = await readProblem(finalizeRes);
      const state = nonConfirmed(nextStateFor(problem?.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem?.detail || GENERIC_FAILURE };
    }
    const finalized = await finalizeRes.json() as FinalizeUploadIntentResponse;

    // …only status === "available" → "server_confirmed". `upload_received`
    // is not `evidence_available` (INV-081); nothing above this line may
    // claim the photo is saved, and this is the one branch that may.
    if (finalized.status !== "available" || finalized.contentHash === null
        || finalized.evidenceObjectId === null || finalized.serverReceivedAt === null) {
      onStateChange("failed");
      return { state: "failed", message: GENERIC_FAILURE };
    }
    onStateChange("server_confirmed");
    return {
      state: "server_confirmed",
      evidenceObjectId: finalized.evidenceObjectId,
      contentHash: finalized.contentHash,
      serverReceivedAt: finalized.serverReceivedAt,
    };
  } catch {
    // Network failure, a body that was not JSON, anything unanticipated.
    // THE DEFAULT IS `failed`, NOT A RETRY (recover.ts's own rule, restated
    // here for the case that never reaches `nextStateFor` at all): retrying
    // blindly against an unknown condition is how a client hammers a server
    // that just dropped the connection.
    onStateChange("failed");
    return { state: "failed", message: GENERIC_FAILURE };
  }
}

function formatClaimed(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

export function CaptureIsland({ assignmentId, occurrenceId, accept = "image/*" }: CaptureIslandProps) {
  // ONE UUID PER PHOTO, NOT PER ATTEMPT (context item 5). Generated once for
  // the lifetime of this component instance — one capture island answers one
  // obligation with one photo — and reused on every retry, because a retry
  // of the same photo carrying a fresh id would make one capture read as
  // several to anyone reviewing the records later. Retry safety is
  // `attemptKey()` above, not this value.
  const [photoId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ClientState>("not_sent");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{
    contentHash: string; serverReceivedAt: string; claimedCaptureTime: string;
  } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setMessage(null);
    const claimedCaptureTime = new Date(file.lastModified).toISOString();
    const outcome = await upload(file, occurrenceId, assignmentId, photoId, setState);
    setBusy(false);
    if (outcome.state === "server_confirmed") {
      setReceipt({
        contentHash: outcome.contentHash,
        serverReceivedAt: outcome.serverReceivedAt,
        claimedCaptureTime,
      });
    } else {
      setMessage(outcome.message);
    }
  }

  const saved = isSaved(state);
  const inputId = `capture-${occurrenceId}`;

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
      <label htmlFor={inputId} className="text-data font-medium text-foreground">
        {saved ? "Фото збережено" : "Додати фото"}
      </label>

      {/*
       * `capture="environment"` is a HINT to mobile browsers to open the
       * camera by default — the user can still choose the gallery, and
       * nothing here or anywhere else claims the two are distinguishable
       * afterward (context item 3; no camera-vs-gallery claim anywhere).
       * Re-selecting the same path fires `onChange` again because the
       * value is cleared right after the file is read, which is also what
       * makes this input double as the retry control — one interaction,
       * not a second button.
       */}
      <input
        id={inputId}
        type="file"
        accept={accept}
        capture="environment"
        disabled={busy || saved}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
        className="text-data text-foreground file:mr-3 file:h-11 file:rounded-control file:border file:border-border file:bg-surface file:px-3 file:text-data file:font-medium disabled:opacity-50"
      />

      <p aria-live="polite" className="text-data text-foreground-secondary">
        {CLIENT_STATE_LABEL[state]}
      </p>

      {holdsUnsavedBytes(state) && (
        <p className="text-data text-destructive">
          Не закривайте сторінку — фото ще не збережено на сервері.
        </p>
      )}

      {message && (
        <p role="alert" className="text-data text-destructive">
          {message}
        </p>
      )}

      {saved && receipt && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-data text-foreground-secondary">
          {/*
           * TWO TIMES, NEVER SHOWN WITHOUT THEIR LABELS, NEVER MERGED INTO
           * ONE. `claimedCaptureTime` is the device's own mtime claim,
           * unverified (context item 6) — ADR-007 decision 5 permits
           * exactly this claim, a server receipt time, and a client-computed
           * hash, and nothing stronger.
           */}
          <dt className="text-foreground-muted">Час пристрою (не перевірено)</dt>
          <dd>{formatClaimed(receipt.claimedCaptureTime)}</dd>
          <dt className="text-foreground-muted">Підтверджено сервером</dt>
          <dd>{formatClaimed(receipt.serverReceivedAt)}</dd>
        </dl>
      )}
    </div>
  );
}
