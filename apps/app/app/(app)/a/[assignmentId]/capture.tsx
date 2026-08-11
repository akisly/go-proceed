"use client";

import { useEffect, useRef, useState } from "react";

import {
  CLIENT_STATE_LABEL, UNSAVED_PHOTO_WARNING, discard, guardBeforeUnload,
  holdsUnsavedBytes, isSaved, type ClientState,
} from "../../../../src/lib/capture/state";
import { uploadCapture } from "../../../../src/lib/capture/upload";
import { AttemptGuard } from "../../../../src/lib/capture/attempt";

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

  // ATTEMPT-SCOPED, NOT COMPONENT-SCOPED (fix round 2). A round-1 shared
  // boolean answered "has ANY attempt been discarded" — the wrong question
  // once a second attempt exists, because starting one reset the boolean and
  // re-armed the FIRST attempt's still-running, never-aborted callback. A
  // discarded photo's late progress could then drive the visible state, and
  // — the actual defect — its eventual receipt could land on screen
  // attributed to the photo the foreman kept. `AttemptGuard` (tested in
  // isolation in `src/lib/capture/attempt.test.ts`) makes "may this callback
  // still write" a comparison against a token that changes identity on every
  // new attempt or bare discard, not against one flag either can reset.
  // `useRef`, not `useState`: the guard's own identity must survive
  // re-renders, and mutating it must not itself trigger one. Lazily
  // assigned (`??=`), not `useRef(new AttemptGuard())` — the latter would
  // construct a fresh, immediately-discarded instance on every render, since
  // `useRef`'s argument is only used on the first call but is still
  // evaluated on every one.
  const guardRef = useRef<AttemptGuard | null>(null);
  guardRef.current ??= new AttemptGuard();
  const guard = guardRef.current;

  // THE `beforeunload` GUARD (task 10, INV-081's second half made real). The
  // decision itself — `guardBeforeUnload`, which is `holdsUnsavedBytes` under
  // the hood — is not made here; this effect only wires that decision to the
  // one browser API that can act on it. Two things this effect is
  // responsible for getting right, per context items 3 and 4:
  //
  // 1. REGISTERED ONLY WHILE BYTES ARE AT RISK. The early `return` below (no
  //    listener added at all) rather than always registering and letting
  //    `guardBeforeUnload` no-op internally means a foreman who has already
  //    saved, failed, or discarded a photo gets NO prompt on navigating away
  //    — not even a silent, immediately-cancelled one. A listener that stays
  //    registered after the photo is safe would make every ordinary
  //    navigation in the app show the same browser dialog, training people to
  //    click through the one prompt that actually protects something.
  //
  // 2. REMOVED ON EVERY STATE CHANGE AND ON UNMOUNT, NOT JUST AT THE END.
  //    `[state]` as the effect's only dependency means React tears down the
  //    PREVIOUS listener (closed over the PREVIOUS `state`) before either
  //    registering a new one or leaving none registered, on every render
  //    where `state` changed — including the render where a save, a
  //    failure, or a discard makes `holdsUnsavedBytes` turn false, and
  //    including unmount, where the returned cleanup is the only one that
  //    runs. There is never a moment with two listeners registered, and never
  //    a moment with a listener still bound to bytes that are no longer at
  //    risk.
  useEffect(() => {
    if (!holdsUnsavedBytes(state)) return;
    const listener = (event: BeforeUnloadEvent) => guardBeforeUnload(state, event);
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [state]);

  async function handleFile(file: File) {
    const token = guard.begin();
    setBusy(true);
    setMessage(null);
    setReceipt(null);
    const claimedCaptureTime = new Date(file.lastModified).toISOString();

    const outcome = await uploadCapture(file, occurrenceId, assignmentId, photoId, (s) => {
      if (guard.isCurrent(token)) setState(s);
    });

    // A superseded attempt writes NOTHING past this point — not `busy`, not
    // a message, not a receipt. If a newer attempt (a retake, or a discard)
    // has since taken over, it already owns every one of those pieces of
    // state, and this stale resolution has no business touching any of them.
    if (!guard.isCurrent(token)) return;

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

  function handleDiscard() {
    if (!holdsUnsavedBytes(state)) return;
    // "Explicit warned user deletion" (state-catalog.csv:44) — the warning is
    // this confirmation, asked before the transition, not after.
    const confirmed = window.confirm(
      "Скасувати це фото? Його не буде збережено на сервері, і дію не можна відмінити.",
    );
    if (!confirmed) return;
    // Supersedes whatever attempt (if any) is still in flight, so ITS
    // eventual callbacks find themselves superseded too — whether or not the
    // foreman goes on to pick a replacement photo immediately after.
    guard.supersede();
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

      {/*
       * THE PERSISTENT BANNER — copy-catalog.csv:281, `warning.capture.
       * not_saved`, imported as `UNSAVED_PHOTO_WARNING` rather than
       * hand-written here a second time (context item 2). Gated by
       * `holdsUnsavedBytes`, the SAME function (not a lookalike condition)
       * that gates the `beforeunload` listener above — so the banner and the
       * browser's own close-tab prompt can never disagree about whether this
       * photo is still at risk. No dismiss control exists on this banner at
       * all: it disappears exactly when `holdsUnsavedBytes` turns false
       * (save, failure, or discard), and never before, so "not dismissible
       * while the condition holds" (task-10-brief.md step 2) needs no extra
       * code to enforce — there is nothing here that could dismiss it.
       */}
      {holdsUnsavedBytes(state) && (
        <p className="text-data text-destructive">{UNSAVED_PHOTO_WARNING}</p>
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
