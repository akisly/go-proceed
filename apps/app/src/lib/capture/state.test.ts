import { describe, it, expect } from "vitest";
import { CLIENT_STATE_LABEL, discard, holdsUnsavedBytes, isSaved, type ClientState } from "./state";

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
