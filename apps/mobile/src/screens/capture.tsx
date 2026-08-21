// THE CAPTURE ISLAND — ADR-007 decision 4, obligation 2 of 2, and the
// interaction the whole client is named after.
//
// PORT of apps/app/app/(app)/a/[assignmentId]/capture.tsx, adapted for the
// one interaction the platform genuinely changes: there is no `<input
// type="file">` here for a foreman to tap, so this screen owns a `Pressable`
// that calls `ImagePicker.launchCameraAsync` itself. Everything downstream
// of "bytes are in hand" — the hash, the three-request pipeline, the state
// narration, the receipt, the discard control, the AttemptGuard — is the
// SAME PIPELINE the source runs, via the same `uploadCapture`
// (`../lib/capture/upload.ts`) the source's own equivalent calls.
//
// A THIN SHELL, DELIBERATELY, same as the source. Everything that could run
// with no DOM/RN — the fetch sequencing, the state-transition narration, the
// request body assembly — lives in `../lib/capture/upload.ts`, tested in
// plain Node (`upload.test.ts`). What remains here is JSX and the pieces of
// state React actually owns.
//
// WEB-FIRST, LIKE THE REST OF THIS CLIENT (AGENTS.md). `ImagePicker.
// launchCameraAsync` is called SYNCHRONOUSLY from the `Pressable`'s
// `onPress` — not after an intervening `await` of anything else — because on
// web this call ultimately opens a browser file/camera chooser, and browsers
// only honour that from inside a user gesture (verified against
// https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker, read 2026-08-20).
// The native path (iOS/Android camera) is an unimplemented TODO — see
// `handlePress` below — matching this task's brief: v0.1/v0.2 of this client
// is web-first, and `apps/mobile` stays in the tree for v0.3's native build
// (ADR-007 decision 2).
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { color, type ThemeName } from "@goproceed/tokens";

import {
  UNSAVED_PHOTO_WARNING, discard, guardBeforeUnload, holdsUnsavedBytes, isSaved,
  serverDoesNotHaveThePhoto, type CaptureHold, type ClientState,
} from "../lib/capture/state";
import { GENERIC_FAILURE, uploadCapture, type PickedPhoto } from "../lib/capture/upload";
import { sha256Hex } from "../lib/capture/hash";
import { AttemptGuard } from "../lib/capture/attempt";
import { clientStateLabel } from "../lib/status-labels";

// Pinned, same convention and same caveat as the other screens: this screen
// does not yet follow the device's own theme.
const THEME: ThemeName = "light";

/**
 * No source string to port: the PWA has no code path where the platform
 * itself cannot capture a photo — a browser always has SOME file/camera
 * chooser. This build's own copy, for the one state that is genuinely new
 * here: the native camera path is a TODO (v0.3), not a failed upload.
 * Reported through the same `message`/`failed` vocabulary the upload
 * pipeline already uses, because `ClientState` has no state that means
 * "unsupported platform" and inventing one would be exactly the kind of
 * second, divergent state catalog `state.ts`'s own header warns against.
 */
const NATIVE_CAPTURE_UNAVAILABLE =
  "Знімання фото на цьому пристрої поки не підтримується. Скористайтеся веб-версією GoProceed.";

type CaptureIslandProps = {
  assignmentId: string;
  occurrenceId: string;
};

function formatClaimed(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

export function CaptureIsland({ assignmentId, occurrenceId }: CaptureIslandProps) {
  // ONE UUID PER PHOTO, NOT PER ATTEMPT — same reasoning as the source's
  // identical comment: generated once for the lifetime of this component
  // instance and reused on every retry, because a retry of the same photo
  // carrying a fresh id would make one capture read as several to anyone
  // reviewing the records later. Retry safety is `AttemptGuard`, not this
  // value.
  const [photoId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ClientState>("not_sent");
  // THE FACT `ClientState` CANNOT CARRY — same invariant `state.ts` and the
  // source both document: `not_sent` is BOTH the initial state and a
  // post-refusal recovery target, so a screen that reasons from the state
  // alone cannot tell "nothing has happened here" from "a photo was taken
  // and the server does not have it". False until a photo is actually handed
  // to the pipeline; false again once the photo is discarded.
  const [hasPickedFile, setHasPickedFile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{
    contentHash: string; serverReceivedAt: string; claimedCaptureTime: string;
  } | null>(null);

  // ATTEMPT-SCOPED, NOT COMPONENT-SCOPED — `AttemptGuard`'s own header names
  // the exact defect a component-scoped boolean produced in the source
  // (fix round 2, task 9): a discarded photo's late callback overwriting the
  // receipt of the photo the foreman kept. Lazily assigned (`??=`), not
  // `useRef(new AttemptGuard())` — the latter's argument is evaluated on
  // every render even though only the first is kept.
  const guardRef = useRef<AttemptGuard | null>(null);
  guardRef.current ??= new AttemptGuard();
  const guard = guardRef.current;

  // THE ABORT THE CONFIRMATION DIALOG PROMISES — same reasoning as the
  // source's identical comment: `guard.supersede()` alone stops a superseded
  // attempt from WRITING to this screen; it does not stop it RUNNING.
  // Without this controller, a discard would let the in-flight
  // `uploadCapture` finish and the server record an evidence object for the
  // very photo the dialog had just said would not be saved.
  const abortRef = useRef<AbortController | null>(null);

  const hold: CaptureHold = { state, hasPickedFile };

  // THE `beforeunload` GUARD — INV-081's tab-close half, made real for this
  // client. Ported from the source's identical effect
  // (`apps/app/app/(app)/a/[assignmentId]/capture.tsx:153-162`): the
  // decision (`guardBeforeUnload`, which is `holdsUnsavedBytes` under the
  // hood) is not made here, this effect only wires that decision to the one
  // browser API that can act on it.
  //
  // REGISTERED ONLY WHILE BYTES ARE AT RISK, and REMOVED ON EVERY STATE
  // CHANGE AND ON UNMOUNT — same two constraints the source's comment names:
  // a foreman who has already saved, failed, or discarded a photo gets NO
  // prompt on navigating away, and there is never a moment with a listener
  // still bound to bytes that are no longer at risk.
  //
  // WEB-ONLY, EXPLICITLY GUARDED — the one delta from source, which never
  // needs this check because `apps/app` only ever runs in a browser. This
  // client also targets native (a TODO — see `handlePress` below), where
  // there is no `window`/`beforeunload` at all; `typeof window !==
  // "undefined" && typeof window.addEventListener === "function"` keeps
  // this effect an inert no-op there rather than a crash.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    if (!holdsUnsavedBytes(hold)) return;
    const listener = (event: BeforeUnloadEvent) => guardBeforeUnload(hold, event);
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `hold` is
    // rebuilt every render from exactly these two values; depending on the
    // object itself would re-register the listener on every render instead
    // of on every change — same reasoning as the source's identical effect.
  }, [state, hasPickedFile]);

  async function runCapture(photo: PickedPhoto, lastModifiedMs: number) {
    const token = guard.begin();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setHasPickedFile(true);
    setMessage(null);
    setReceipt(null);
    const claimedCaptureTime = new Date(lastModifiedMs).toISOString();

    const outcome = await uploadCapture(
      photo, occurrenceId, assignmentId, photoId,
      (s) => { if (guard.isCurrent(token)) setState(s); },
      sha256Hex, controller.signal,
    );

    // A superseded attempt writes NOTHING past this point — not `busy`, not
    // a message, not a receipt. Same rule as the source's identical guard.
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

  const handlePress = useCallback(() => {
    async function pick() {
      // NATIVE PATH: TODO (v0.3). This build is web-first only (AGENTS.md);
      // no native camera wiring exists yet. Reported as an honest `failed`
      // (see `NATIVE_CAPTURE_UNAVAILABLE`'s own comment) rather than a
      // silent no-op, so a foreman on a native build is told why nothing
      // happened instead of tapping a button that does nothing.
      if (Platform.OS !== "web") {
        setMessage(NATIVE_CAPTURE_UNAVAILABLE);
        setState("failed");
        return;
      }

      try {
        // CALLED SYNCHRONOUSLY (no `await` above this line, and none inside
        // this `try` before it) — see this file's header for why: the
        // browser's user-gesture requirement for opening a camera/file
        // chooser is spent the instant this `Pressable` is tapped, not
        // whenever this `async` function happens to reach this line.
        // Verified against expo-image-picker's own web implementation
        // (`node_modules/expo-image-picker/src/ExponentImagePicker.web.ts`,
        // read 2026-08-20): it builds a hidden `<input type="file"
        // capture="environment">` — the exact element the source PWA's own
        // `<input capture="environment">` is — and dispatches a synthetic
        // click on it synchronously, which is what actually needs the live
        // gesture.
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          cameraType: ImagePicker.CameraType.back,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        // WEB ONLY: `asset.file` is the DOM `File` the browser's own chooser
        // returned (expo-image-picker's `ImagePickerAsset.file`, web-only —
        // see https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker, read
        // 2026-08-20). Every field `buildCreateIntentBody` (upload.ts) needs
        // comes off this `File` directly, the same fields the source PWA
        // reads off its own `<input type="file">`'s `File` — never off
        // `asset`'s own (RN-oriented) `fileName`/`mimeType` fields, which do
        // not exist on web's result at all.
        const file = asset?.file;
        if (!file) {
          // Defensive, not the native-unsupported branch above: this is the
          // web path, and the picker returned a result, but the one field
          // this module depends on (`.file`) was missing from it — an
          // expo-image-picker/browser-compatibility surprise this build has
          // never observed, not "camera unavailable".
          setMessage(GENERIC_FAILURE);
          setState("failed");
          return;
        }

        // THE FILE IS NEVER DRAWN TO A CANVAS — ADR-007 Cost 1, same rule
        // the source's `uploadCapture` states: we read the bytes once and
        // send exactly those bytes, to the hash and to storage, with
        // nothing in between.
        const bytes = await file.arrayBuffer();
        const photo: PickedPhoto = {
          bytes,
          mediaType: file.type,
          fileName: file.name,
          lastModifiedMs: file.lastModified,
          byteSize: file.size,
        };
        await runCapture(photo, file.lastModified);
      } catch {
        // Defensive: `launchCameraAsync` itself can reject (a picked file
        // the browser refuses to read metadata for, an unsupported type —
        // see the web implementation's `readFile`), and this happens BEFORE
        // `runCapture` ever starts an attempt, so nothing here can clobber
        // an in-flight upload's own state. `GENERIC_FAILURE` is the same
        // honest "not saved, try again" the pipeline itself reports for
        // every other unanticipated failure — reused rather than a second
        // ad hoc string.
        setMessage(GENERIC_FAILURE);
        setState("failed");
      }
    }

    void pick();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `runCapture`
    // closes over this render's `guard`/`photoId`/props, same as the
    // source's `handleFile`; recreating the callback identity every render
    // is fine here since `Pressable` does not memo on it.
  }, [assignmentId, occurrenceId, photoId]);

  function handleDiscard() {
    if (!holdsUnsavedBytes(hold)) return;
    // NO `window.confirm` ON NATIVE — TODO (v0.3): a native confirmation
    // (e.g. `Alert.alert`) belongs alongside native capture itself, when
    // that lands; today this control is unreachable there anyway (the
    // native branch of `handlePress` never sets `hasPickedFile`, so
    // `holdsUnsavedBytes` above is already false). Guarded regardless, so
    // that stays true by construction rather than by coincidence: treating
    // an absent `confirm` as "not confirmed" is the safe default — do
    // nothing, drop no photo — not a bypass of the warning.
    if (typeof window === "undefined" || typeof window.confirm !== "function") return;
    // "Explicit warned user deletion" — the warning is this confirmation,
    // asked before the transition, not after. Same three guarantees as the
    // source's identical comment: the request is ABORTED (so «не буде
    // збережено на сервері» is a fact, not a hope), the attempt is
    // superseded (so nothing it already started can write here), and there
    // is no undo control anywhere on this screen.
    const confirmed = window.confirm(
      "Скасувати це фото? Його не буде збережено на сервері, і дію не можна відмінити.",
    );
    if (!confirmed) return;
    abortRef.current?.abort();
    guard.supersede();
    setState((current) => discard(current));
    setHasPickedFile(false);
    setMessage(null);
    setBusy(false);
  }

  const saved = isSaved(state);
  const canDiscard = holdsUnsavedBytes(hold);

  return (
    <View style={styles.card}>
      {/*
       * ONE CONTROL, ONE LABEL THAT DOUBLES AS THE STATE INDICATOR — the
       * direct translation of the source's `<label htmlFor={inputId}>{saved
       * ? "Фото збережено" : "Додати фото"}</label>` next to its `<input>`.
       * The source's label and input are two DOM nodes only because HTML's
       * `<label for>` is how a browser associates descriptive text with a
       * native file control; there is no such control to describe here, so
       * this `Pressable`'s own visible text IS that same string, on the one
       * element a foreman actually taps. Disabled exactly when the source
       * disables its input: `busy || saved`.
       */}
      <Pressable
        testID={`capture-${occurrenceId}`}
        role="button"
        disabled={busy || saved}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          pressed && !(busy || saved) && styles.buttonPressed,
          (busy || saved) && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>{saved ? "Фото збережено" : "Додати фото"}</Text>
      </Pressable>

      <Text aria-live="polite" style={styles.stateLine}>{clientStateLabel(state)}</Text>

      {/*
       * THE PERSISTENT BANNER — `UNSAVED_PHOTO_WARNING` (`../lib/capture/
       * state.ts`), imported rather than hand-written here a second time.
       * No dismiss control exists on this banner at all: it disappears
       * exactly when `serverDoesNotHaveThePhoto` turns false and never
       * before. Same gate as the source, and the source's own header on
       * `serverDoesNotHaveThePhoto` explains why this is NOT
       * `holdsUnsavedBytes` — the two disagree on `failed`, deliberately.
       */}
      {serverDoesNotHaveThePhoto(hold) && (
        <Text style={styles.banner}>{UNSAVED_PHOTO_WARNING}</Text>
      )}

      {message && (
        <Text role="alert" style={styles.message}>{message}</Text>
      )}

      {/*
       * Offered exactly while `holdsUnsavedBytes(hold)` — a photo already
       * confirmed, already failed, already discarded, or never picked at
       * all has nothing left in this screen's hands to drop.
       */}
      {canDiscard && (
        <Pressable
          role="button"
          onPress={handleDiscard}
          style={({ pressed }) => [styles.discardButton, pressed && styles.discardButtonPressed]}
        >
          <Text style={styles.discardButtonText}>Скасувати фото</Text>
        </Pressable>
      )}

      {saved && receipt && (
        <View style={styles.receipt}>
          {/*
           * ALL THREE CLAIMS ADR-007 DECISION 5 PERMITS, EACH LABELLED,
           * NONE MERGED — same three as the source's identical `<dl>`: the
           * device's own unverified capture-time claim, the server's
           * receipt time, and the SERVER's content hash (never the local
           * one — this is the value a foreman, or a reviewer beside him,
           * can independently check a downloaded file against, and it must
           * be what the server recorded, not merely what this device
           * computed before the network had a say).
           */}
          <ReceiptRow label="Час пристрою (не перевірено)" value={formatClaimed(receipt.claimedCaptureTime)} />
          <ReceiptRow label="Підтверджено сервером" value={formatClaimed(receipt.serverReceivedAt)} />
          <ReceiptRow label="Контрольна сума файлу (SHA-256)" value={receipt.contentHash} monospace />
        </View>
      )}
    </View>
  );
}

function ReceiptRow({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={[styles.receiptValue, monospace && styles.receiptValueMono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color[THEME]["border-default"],
    backgroundColor: color[THEME]["bg-surface"],
    padding: 16,
  },
  button: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color[THEME]["border-default"],
    backgroundColor: color[THEME]["bg-surface"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  buttonPressed: {
    backgroundColor: color[THEME]["action-ghost-hover"],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "500",
    color: color[THEME]["text-primary"],
  },
  stateLine: {
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  banner: {
    fontSize: 13,
    color: color[THEME]["status-blocked-fg"],
  },
  message: {
    fontSize: 13,
    color: color[THEME]["status-blocked-fg"],
  },
  discardButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color[THEME]["status-blocked-border"],
    backgroundColor: color[THEME]["status-blocked-surface"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  discardButtonPressed: {
    opacity: 0.85,
  },
  discardButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: color[THEME]["status-blocked-fg"],
  },
  receipt: {
    gap: 4,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  receiptLabel: {
    fontSize: 13,
    color: color[THEME]["text-muted"],
  },
  receiptValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  receiptValueMono: {
    // `globals.css` (web) clears the `--font-*` namespace and defines only
    // `--font-display`/`--font-sans` — same reason the source's identical
    // comment gives for not applying a monospace font here either. No RN
    // equivalent font family is wired up in this app yet, so this stays a
    // plain-weight break-anywhere value, matching what the source actually
    // ships rather than styling that would not be applied.
    flexShrink: 1,
  },
});
