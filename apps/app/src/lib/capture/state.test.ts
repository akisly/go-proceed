import { describe, it, expect } from "vitest";
import {
  CLIENT_STATE_LABEL, UNSAVED_PHOTO_WARNING, discard, guardBeforeUnload,
  holdsUnsavedBytes, isSaved, type ClientState,
} from "./state";

const ALL: ClientState[] = [
  "not_sent", "sending", "awaiting_receipt", "server_confirmed", "failed", "discarded",
];

describe("INV-081 — no success is reported before the receipt", () => {
  it("calls exactly ONE state saved, and it is the one the receipt produces", () => {
    expect(ALL.filter(isSaved)).toEqual(["server_confirmed"]);
  });

  it("treats every pre-receipt state as holding bytes the server does not have", () => {
    expect(ALL.filter(holdsUnsavedBytes))
      .toEqual(["not_sent", "sending", "awaiting_receipt"]);
  });

  it("does not treat a finished state as holding bytes", () => {
    expect(holdsUnsavedBytes("server_confirmed")).toBe(false);
    expect(holdsUnsavedBytes("failed")).toBe(false);
    expect(holdsUnsavedBytes("discarded")).toBe(false);
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
  it("turns every unsaved state into discarded", () => {
    for (const s of ALL.filter(holdsUnsavedBytes)) {
      expect(discard(s), s).toBe("discarded");
    }
  });

  it("refuses to overwrite a state that no longer holds unsaved bytes", () => {
    // A stale discard click (or a race with an in-flight upload's own final
    // callback landing after the user already discarded) must never turn a
    // receipt, a failure notice, or an already-discarded state into anything
    // else — there is nothing left in the browser's hands to drop.
    for (const s of ALL.filter((x) => !holdsUnsavedBytes(x))) {
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

  it("blocks unload for exactly the states holdsUnsavedBytes names, and no others", () => {
    // THIS is "holdsUnsavedBytes gates the guard" as an assertion, not a
    // comment: the guard's own decision is walked against every reachable
    // state and compared to holdsUnsavedBytes's verdict on the same state,
    // so a future edit that lets the two conditions drift apart — e.g. someone
    // "simplifying" the guard to `state === "sending"` — fails here first,
    // in Node, long before it ships a tab a foreman can close unwarned.
    for (const s of ALL) {
      let prevented = false;
      const event = { preventDefault: () => { prevented = true; }, returnValue: "" };
      guardBeforeUnload(s, event);
      expect(prevented, s).toBe(holdsUnsavedBytes(s));
    }
  });

  it("sets returnValue too, for engines that ignore preventDefault on this event", () => {
    for (const s of ALL.filter(holdsUnsavedBytes)) {
      const event = { preventDefault: () => {}, returnValue: "" };
      guardBeforeUnload(s, event);
      // Any non-empty string is enough to trigger the browser's own (fixed,
      // un-customizable) confirmation dialog — the exact text is discarded by
      // every modern engine, but a legacy one still reads this property.
      expect(event.returnValue, s).not.toBe("");
    }
  });

  it("touches nothing on the event when there is nothing at risk to warn about", () => {
    for (const s of ALL.filter((x) => !holdsUnsavedBytes(x))) {
      let prevented = false;
      const event = { preventDefault: () => { prevented = true; }, returnValue: "" };
      guardBeforeUnload(s, event);
      expect(prevented, s).toBe(false);
      expect(event.returnValue, s).toBe("");
    }
  });
});
