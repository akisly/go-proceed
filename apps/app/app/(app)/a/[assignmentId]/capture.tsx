"use client";

import { useEffect, useRef, useState } from "react";

import {
  CLIENT_STATE_LABEL, UNSAVED_PHOTO_WARNING, discard, guardBeforeUnload,
  holdsUnsavedBytes, isSaved, serverDoesNotHaveThePhoto, type ClientState,
} from "../../../../src/lib/capture/state";
import { uploadCapture } from "../../../../src/lib/capture/upload";
import { AttemptGuard } from "../../../../src/lib/capture/attempt";
import { Button } from "../../../../src/ui/button";

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
  // THE FACT `ClientState` CANNOT CARRY, and the final review's Critical 1.
  // `not_sent` is BOTH the initial state and a post-refusal recovery target,
  // so a screen that reasons from the state alone cannot tell "nothing has
  // happened here" from "a photo was taken and the server does not have it".
  // The bytes themselves live only inside `uploadCapture`'s closure — they are
  // never held in React state — so this flag is the only place that fact can
  // exist. False until a `File` is actually handed over; false again once the
  // photo is discarded (see `handleDiscard`).
  //
  // BOTH at-risk predicates carry this flag as a term, which is what makes it
  // impossible for any of the three affordances to appear before a photo does:
  // `holdsUnsavedBytes(hold)` (this AND `serverHasNotRecordedIt(state)`) gates
  // the `beforeunload` listener and the discard control, and
  // `serverDoesNotHaveThePhoto(hold)` (this AND not-saved AND not-discarded)
  // gates the banner. They differ on `failed` and nowhere else — see state.ts.
  const [hasPickedFile, setHasPickedFile] = useState(false);
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

  // THE ABORT THE CONFIRMATION DIALOG PROMISES (final review, Important 3).
  // `guard.supersede()` alone stops the superseded attempt WRITING to this
  // screen; it does not stop it RUNNING. Without this controller, a discard
  // let the in-flight `uploadCapture` finish, finalize succeed, and the server
  // record an evidence object for the very photo the dialog had just said
  // «його не буде збережено на сервері» about. In a product whose subject is
  // evidence integrity, a confirmation that states a falsehood is a worse
  // defect than a missing abort, so the abort is what closed it — the sentence
  // stays, and is now true. One controller per attempt, replaced (never
  // reused) at the start of each, because an already-aborted signal aborts the
  // next attempt's very first fetch.
  const abortRef = useRef<AbortController | null>(null);

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
  //
  // 3. NOT REGISTERED AT ALL UNTIL A FILE HAS BEEN PICKED. `hold` below, not
  //    a bare `state`: `holdsUnsavedBytes` used to be a function of the state
  //    alone, and `not_sent` is the INITIAL state, so this effect registered a
  //    listener on the first paint of every obligation screen — point 1's own
  //    warning, realised. Closing an untouched tab raised the browser's "leave
  //    site?" dialog about a photo that did not exist. `[hold.state,
  //    hold.hasPickedFile]` as the dependency list (not `[hold]`, a fresh
  //    object every render) keeps point 2's teardown behaviour exactly as it
  //    was.
  const hold = { state, hasPickedFile };
  useEffect(() => {
    if (!holdsUnsavedBytes(hold)) return;
    const listener = (event: BeforeUnloadEvent) => guardBeforeUnload(hold, event);
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `hold` is rebuilt
    // every render from exactly these two values; depending on the object
    // itself would re-register the listener on every render instead of on
    // every change.
  }, [state, hasPickedFile]);

  async function handleFile(file: File) {
    const token = guard.begin();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setHasPickedFile(true);
    setMessage(null);
    setReceipt(null);
    const claimedCaptureTime = new Date(file.lastModified).toISOString();

    const outcome = await uploadCapture(file, occurrenceId, assignmentId, photoId, (s) => {
      if (guard.isCurrent(token)) setState(s);
    }, controller.signal);

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
    if (!holdsUnsavedBytes(hold)) return;
    // "Explicit warned user deletion" (state-catalog.csv:44) — the warning is
    // this confirmation, asked before the transition, not after. Every clause
    // of it is now enforced by the three lines below it: the request is
    // ABORTED (so «не буде збережено на сервері» is a fact, not a hope), the
    // attempt is superseded (so nothing it already started can write here),
    // and there is no undo control anywhere on this screen.
    const confirmed = window.confirm(
      "Скасувати це фото? Його не буде збережено на сервері, і дію не можна відмінити.",
    );
    if (!confirmed) return;
    // ABORT FIRST, then supersede. Order matters only for readability here —
    // both are synchronous — but the sequence states the intent: stop the
    // request reaching the server at all, and only then stop caring what it
    // would have said. `?.abort()` because a discard is reachable with no
    // attempt ever having started (a picked file whose upload already
    // resolved, for instance), and aborting an already-settled controller is a
    // no-op by specification.
    abortRef.current?.abort();
    // Supersedes whatever attempt (if any) is still in flight, so ITS
    // eventual callbacks find themselves superseded too — whether or not the
    // foreman goes on to pick a replacement photo immediately after.
    guard.supersede();
    setState((current) => discard(current));
    // There is nothing left in this browser's hands to lose: the banner, this
    // control and the unload guard all go down together. Not because they share
    // one predicate — since 2026-08-17 they do not — but because `hasPickedFile`
    // is a term of BOTH `holdsUnsavedBytes` and `serverDoesNotHaveThePhoto`, so
    // clearing it here settles all three at once. (The `discarded` state would
    // be enough on its own for either; this line is what also stops a retake
    // from inheriting a stale "a photo exists" flag.)
    setHasPickedFile(false);
    setMessage(null);
    setBusy(false);
  }

  const saved = isSaved(state);
  const canDiscard = holdsUnsavedBytes(hold);
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
       * hand-written here a second time (context item 2). No dismiss control
       * exists on this banner at all: it disappears exactly when its gate turns
       * false and never before, so "not dismissible while the condition holds"
       * (task-10-brief.md step 2) needs no extra code to enforce — there is
       * nothing here that could dismiss it.
       *
       * IT ALSO DOES NOT APPEAR BEFORE THERE IS A PHOTO. It used to: the gate
       * was the state alone, and `not_sent` is the initial state, so the red
       * «GoProceed не зберіг це фото» warned every foreman about a photo he
       * had not taken — the fastest way to teach someone that this app's red
       * text means nothing.
       *
       * GATED ON `serverDoesNotHaveThePhoto`, NOT ON `holdsUnsavedBytes` — a
       * deliberate split, and the correction of a defect this comment used to
       * describe as a feature. It read: gated by «`holdsUnsavedBytes(hold)`,
       * the SAME call (not a lookalike condition) that gates the `beforeunload`
       * listener above — so the banner and the browser's own close-tab prompt
       * can never disagree». They are not the same question, and sharing one
       * call made the banner answer the wrong one: `holdsUnsavedBytes` excludes
       * `failed`, so a failed upload took this banner DOWN, leaving only
       * `uploadCapture`'s `problem?.detail` — which, when the server supplies
       * one, says why the request was refused and nothing about the photo being
       * lost. `invariant-catalog.csv:82` requires the warning on «every failed
       * or abandoned in-flight upload»; for as long as the two gates were one
       * call, the row claimed more than this screen did. See state.ts's own
       * header on `serverDoesNotHaveThePhoto` for why the unload prompt and the
       * discard control must NOT follow it into `failed`.
       */}
      {serverDoesNotHaveThePhoto(hold) && (
        <p className="text-data text-destructive">{UNSAVED_PHOTO_WARNING}</p>
      )}

      {message && (
        <p role="alert" className="text-data text-destructive">
          {message}
        </p>
      )}

      {/*
       * Offered exactly while `holdsUnsavedBytes(hold)` — a photo already
       * confirmed, already failed, already discarded, or never picked at all
       * has nothing left in the browser's hands to drop (state.ts's `discard`,
       * symmetrically).
       *
       * `<Button variant="destructive">`, NOT A HAND-ROLLED `<button>`. This
       * control shipped with its own inline destructive styling, which is
       * precisely the drift `src/ui/button.tsx` exists to prevent — and its
       * own comment had said no destructive variant was needed because
       * "nothing under /app/** deletes or discards anything", which stopped
       * being true the moment this screen landed. The variant went in; this is
       * its call site.
       */}
      {canDiscard && (
        <Button type="button" variant="destructive" size="sm" className="self-start" onClick={handleDiscard}>
          Скасувати фото
        </Button>
      )}

      {saved && receipt && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-data text-foreground-secondary">
          {/*
           * ALL THREE CLAIMS ADR-007 DECISION 5 PERMITS, EACH LABELLED, NONE
           * MERGED. The decision names exactly three — the device's own
           * unverified capture-time claim, the server's receipt time, and a
           * client-computed content hash — and nothing stronger.
           *
           * The hash was collected and then never rendered, which is the
           * worse of the two ways to get this wrong: a claim the product is
           * permitted to make, computed, carried to the screen, and dropped.
           * It is the one value here a foreman (or a reviewer standing beside
           * him) can independently check a downloaded file against, so it is
           * shown, labelled as what it is — SHA-256 over the bytes THIS
           * BROWSER sent. It is not evidence about the sensor: nothing here or
           * anywhere claims the hash binds the camera's output, only that the
           * bytes the server stored are the bytes this page uploaded.
           */}
          <dt className="text-foreground-muted">Час пристрою (не перевірено)</dt>
          <dd>{formatClaimed(receipt.claimedCaptureTime)}</dd>
          <dt className="text-foreground-muted">Підтверджено сервером</dt>
          <dd>{formatClaimed(receipt.serverReceivedAt)}</dd>
          <dt className="text-foreground-muted">Контрольна сума файлу (SHA-256)</dt>
          {/*
            * `break-all`, and no `font-mono`: `globals.css` clears the
            * `--font-*` namespace (`--font-*: initial`) and defines only
            * `--font-display`/`--font-sans`, so a `font-mono` class here would
            * generate nothing at all and read as styling that is being applied
            * when it is not.
            */}
          <dd className="break-all">{receipt.contentHash}</dd>
        </dl>
      )}
    </div>
  );
}
