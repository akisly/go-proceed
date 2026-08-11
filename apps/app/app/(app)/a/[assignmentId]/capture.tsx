"use client";

import { useRef, useState } from "react";

import {
  CLIENT_STATE_LABEL, discard, holdsUnsavedBytes, isSaved, type ClientState,
} from "../../../../src/lib/capture/state";
import { uploadCapture } from "../../../../src/lib/capture/upload";

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
 *
 * A THIN SHELL, DELIBERATELY. Everything that used to run here — the fetch
 * sequencing, the state-transition narration, the request body assembly —
 * now lives in `src/lib/capture/upload.ts`, which runs (and is tested) in
 * plain Node with no DOM. What remains in this file is JSX and the two
 * pieces of state React actually owns: `photoId` and the rendered
 * `ClientState`.
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

function formatClaimed(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

export function CaptureIsland({ assignmentId, occurrenceId, accept = "image/*" }: CaptureIslandProps) {
  // ONE UUID PER PHOTO, NOT PER ATTEMPT (context item 5). Generated once for
  // the lifetime of this component instance — one capture island answers one
  // obligation with one photo — and reused on every retry, because a retry
  // of the same photo carrying a fresh id would make one capture read as
  // several to anyone reviewing the records later. Retry safety is
  // `attemptKey()` (upload.ts), not this value.
  const [photoId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ClientState>("not_sent");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{
    contentHash: string; serverReceivedAt: string; claimedCaptureTime: string;
  } | null>(null);

  // Set the instant the user confirms a discard, so the in-flight upload's
  // own eventual callback (there is no AbortController; the request keeps
  // running) cannot resurrect a state the user already dropped. A ref, not
  // state, because it has to be visible to a closure captured before the
  // discard happened, synchronously, with no re-render in between.
  const discardedRef = useRef(false);

  async function handleFile(file: File) {
    discardedRef.current = false;
    setBusy(true);
    setMessage(null);
    setReceipt(null);
    const claimedCaptureTime = new Date(file.lastModified).toISOString();

    const outcome = await uploadCapture(file, occurrenceId, assignmentId, photoId, (s) => {
      if (!discardedRef.current) setState(s);
    });
    setBusy(false);
    if (discardedRef.current) return; // the user discarded while this was still in flight

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

  function handleDiscard() {
    if (!holdsUnsavedBytes(state)) return;
    // "Explicit warned user deletion" (state-catalog.csv:44) — the warning is
    // this confirmation, asked before the transition, not after.
    const confirmed = window.confirm(
      "Скасувати це фото? Його не буде збережено на сервері, і дію не можна відмінити.",
    );
    if (!confirmed) return;
    discardedRef.current = true;
    setState((current) => discard(current));
    setMessage(null);
    setBusy(false);
  }

  const saved = isSaved(state);
  const canDiscard = holdsUnsavedBytes(state);
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
       * afterward (no camera-vs-gallery claim anywhere). Re-selecting the
       * same path fires `onChange` again because the value is cleared right
       * after the file is read, which is also what makes this input double
       * as the retry control — one interaction, not a second button.
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

      {/*
       * Offered exactly while `holdsUnsavedBytes` — a photo already
       * confirmed, already failed, or already discarded has nothing left in
       * the browser's hands to drop (state.ts's `discard`, symmetrically).
       */}
      {canDiscard && (
        <button
          type="button"
          onClick={handleDiscard}
          className="h-11 self-start rounded-control px-3 text-data font-medium text-destructive underline underline-offset-4 hover:text-destructive"
        >
          Скасувати фото
        </button>
      )}

      {saved && receipt && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-data text-foreground-secondary">
          {/*
           * TWO TIMES, NEVER SHOWN WITHOUT THEIR LABELS, NEVER MERGED INTO
           * ONE. `claimedCaptureTime` is the device's own mtime claim,
           * unverified — ADR-007 decision 5 permits exactly this claim, a
           * server receipt time, and a client-computed hash, and nothing
           * stronger.
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
