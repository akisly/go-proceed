import { describe, expect, it } from "vitest";
import { wipeMessage, wipeNote } from "./wipe-note";

const clean = { keysDeleted: true, ciphertextDeleted: true, directoryDeleted: true, signedOut: true, reopened: true };

describe("what a wipe tells the user", () => {
  it("says a clean wipe happened, not as an error", () => {
    expect(wipeMessage(clean)).toBeNull();
    expect(wipeNote(clean)).toEqual({ text: "Фото на пристрої стерто.", error: false });
    expect(wipeNote({ ...clean, signedOut: null }).error).toBe(false);
  });
  it("names each failure that happened, and only those", () => {
    expect(wipeNote({ ...clean, directoryDeleted: false }).text).toMatch(/частину файлів/);
    expect(wipeNote({ ...clean, signedOut: false }).text).toMatch(/вийти не вдалося/);
    expect(wipeNote({ ...clean, reopened: false }).text).toMatch(/не відкривається/);
    expect(wipeNote({ ...clean, directoryDeleted: false }).text).not.toMatch(/вийти не вдалося/);
    expect(wipeNote({ ...clean, reopened: false }).error).toBe(true);
  });
});
