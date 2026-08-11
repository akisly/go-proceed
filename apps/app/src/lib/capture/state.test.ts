import { describe, it, expect } from "vitest";
import {
  CLIENT_STATE_LABEL, UNSAVED_PHOTO_WARNING, discard, guardBeforeUnload,
  holdsUnsavedBytes, isSaved, serverHasNotRecordedIt, type ClientState,
} from "./state";

const ALL: ClientState[] = [
  "not_sent", "sending", "awaiting_receipt", "server_confirmed", "failed", "discarded",
];

/** Every reachable state, as it looks once a file HAS been handed over. */
const PICKED = ALL.map((state) => ({ state, hasPickedFile: true }));

describe("INV-081 — no success is reported before the receipt", () => {
  it("calls exactly ONE state saved, and it is the one the receipt produces", () => {
    expect(ALL.filter(isSaved)).toEqual(["server_confirmed"]);
  });

  it("treats every pre-receipt state as one the server has not recorded", () => {
    expect(ALL.filter(serverHasNotRecordedIt))
      .toEqual(["not_sent", "sending", "awaiting_receipt"]);
  });

  it("does not treat a finished state as unrecorded", () => {
    expect(serverHasNotRecordedIt("server_confirmed")).toBe(false);
    expect(serverHasNotRecordedIt("failed")).toBe(false);
    expect(serverHasNotRecordedIt("discarded")).toBe(false);
  });

  it("holds unsaved bytes for every pre-receipt state ONCE a file has been picked", () => {
    expect(PICKED.filter(holdsUnsavedBytes).map((h) => h.state))
      .toEqual(["not_sent", "sending", "awaiting_receipt"]);
  });
});

describe("AT REST — nothing has been picked, so nothing is at risk", () => {
  // THE FIRST-PAINT CASE, WHICH THE PREVIOUS VERSION OF THIS FILE PINNED AS
  // CORRECT. `holdsUnsavedBytes` used to be `serverHasNotRecordedIt` and
  // `not_sent` is also the INITIAL state, so on first paint — before the
  // foreman touched anything — the red «GoProceed не зберіг це фото…» banner
  // rendered, «Скасувати фото» rendered, and a `beforeunload` listener was
  // registered, all about a photo that did not exist. The test that stood here
  // asserted the conflation with `expect(ALL.filter(holdsUnsavedBytes))
  // .toEqual([...])` — a passing test defending the defect. These three
  // assertions are the replacement, and each one goes red if the flag is
  // dropped from any of the three gates.
  const AT_REST = { state: "not_sent" as ClientState, hasPickedFile: false };

  it("does not consider bytes at risk before any file is picked", () => {
    expect(holdsUnsavedBytes(AT_REST)).toBe(false);
  });

  it("is false for EVERY state while no file has been picked, not just the initial one", () => {
    for (const state of ALL) {
      expect(holdsUnsavedBytes({ state, hasPickedFile: false }), state).toBe(false);
    }
  });

  it("leaves an unload event untouched at rest — no browser dialog on an untouched screen", () => {
    let prevented = false;
    const event = { preventDefault: () => { prevented = true; }, returnValue: "" };
    guardBeforeUnload(AT_REST, event);
    expect(prevented).toBe(false);
    expect(event.returnValue).toBe("");
  });
});

describe("the six labels are the approved copy, and the seventh is unreachable", () => {
  it("carries copy-catalog.csv:87-93's Ukrainian verbatim", () => {
    expect(CLIENT_STATE_LABEL).toEqual({
      not_sent: "Не надіслано",
      sending: "Надсилання",
      awaiting_receipt: "Очікування підтвердження",
      server_confirmed: "Підтверджено сервером",
      failed: "Потрібна дія",
      discarded: "Видалено користувачем",
    });
  });

  it("has no key for a native-only state", () => {
    expect(Object.keys(CLIENT_STATE_LABEL)).not.toContain("quarantined");
    expect(Object.keys(CLIENT_STATE_LABEL)).not.toContain("expired_purged");
  });
});

describe("discard — the seventh state's only reachable transition", () => {
  it("turns every unrecorded state into discarded", () => {
    for (const s of ALL.filter(serverHasNotRecordedIt)) {
      expect(discard(s), s).toBe("discarded");
    }
  });

  it("refuses to overwrite a state the server has already spoken about", () => {
    // A stale discard click (or a race with an in-flight upload's own final
    // callback landing after the user already discarded) must never turn a
    // receipt, a failure notice, or an already-discarded state into anything
    // else — there is nothing left in the browser's hands to drop.
    for (const s of ALL.filter((x) => !serverHasNotRecordedIt(x))) {
      expect(discard(s), s).toBe(s);
    }
  });
});

describe("INV-081's second half made real — the beforeunload guard", () => {
  it("carries copy-catalog.csv:281's warning.capture.not_saved, verbatim", () => {
    // Byte-for-byte, not retranslated. If this fails after an edit to
    // capture.tsx or state.ts, the fix is to copy the catalog row again, not
    // to adjust this expectation.
    expect(UNSAVED_PHOTO_WARNING)
      .toBe("GoProceed не зберіг це фото. Зробіть його ще раз або збережіть у себе.");
  });

  it("blocks unload for exactly the holds holdsUnsavedBytes names, and no others", () => {
    // THIS is "holdsUnsavedBytes gates the guard" as an assertion, not a
    // comment: the guard's own decision is walked against every reachable
    // hold — both values of `hasPickedFile`, all six states — and compared to
    // holdsUnsavedBytes's verdict on the same hold, so a future edit that lets
    // the two conditions drift apart — e.g. someone "simplifying" the guard to
    // `state === "sending"`, or dropping the `hasPickedFile` term and
    // reintroducing the dialog on an untouched screen — fails here first, in
    // Node, long before it ships.
    for (const hold of [...PICKED, ...ALL.map((state) => ({ state, hasPickedFile: false }))]) {
      let prevented = false;
      const event = { preventDefault: () => { prevented = true; }, returnValue: "" };
      guardBeforeUnload(hold, event);
      expect(prevented, JSON.stringify(hold)).toBe(holdsUnsavedBytes(hold));
    }
  });

  it("sets returnValue too, for engines that ignore preventDefault on this event", () => {
    for (const hold of PICKED.filter(holdsUnsavedBytes)) {
      const event = { preventDefault: () => {}, returnValue: "" };
      guardBeforeUnload(hold, event);
      // Any non-empty string is enough to trigger the browser's own (fixed,
      // un-customizable) confirmation dialog — the exact text is discarded by
      // every modern engine, but a legacy one still reads this property.
      expect(event.returnValue, hold.state).not.toBe("");
    }
  });

  it("touches nothing on the event when there is nothing at risk to warn about", () => {
    for (const hold of PICKED.filter((h) => !holdsUnsavedBytes(h))) {
      let prevented = false;
      const event = { preventDefault: () => { prevented = true; }, returnValue: "" };
      guardBeforeUnload(hold, event);
      expect(prevented, hold.state).toBe(false);
      expect(event.returnValue, hold.state).toBe("");
    }
  });
});
