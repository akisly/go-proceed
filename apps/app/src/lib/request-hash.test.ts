import { describe, expect, it } from "vitest";
import { commandRequestHash } from "./request-hash";

/**
 * DEV-022 / BL-112 / INV-048: the request hash binds the command's target.
 *
 * The pinned vectors were computed independently of the implementation (the
 * same envelope in Python). A change to them is a change to every stored
 * request hash, which answers a retry spanning the deploy with 409: treat it as
 * a transition, not a refactor.
 */
const A = "0f0e0d0c-0b0a-4000-8000-000000000001";
const B = "0f0e0d0c-0b0a-4000-8000-000000000002";

describe("commandRequestHash", () => {
  it("is 64 lowercase hex, and pinned", () => {
    expect(commandRequestHash({}, "{}")).toBe("c67c81997883cad2301fa968b72e7bfa17ed6b5ed82ed84264e3b77da7688c9f");
    expect(commandRequestHash({ itemId: A }, "{}")).toBe("72dc86e7a5c871f64c8e3d2ee9db6d1a72423018ed762ce629a8dba266458ae3");
    expect(commandRequestHash({ itemId: A }, "{}")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("binds the target: the same body on another target hashes differently", () => {
    expect(commandRequestHash({ itemId: A }, "{}")).toBe(commandRequestHash({ itemId: A }, "{}"));
    expect(commandRequestHash({ itemId: A }, "{}")).not.toBe(commandRequestHash({ itemId: B }, "{}"));
    expect(commandRequestHash({ itemId: A }, "{}")).not.toBe(commandRequestHash({}, "{}"));
  });

  it("names the parameter, and ignores their order", () => {
    expect(commandRequestHash({ a: "x" }, "{}")).not.toBe(commandRequestHash({ b: "x" }, "{}"));
    expect(commandRequestHash({ projectId: A, versionId: B }, "{}"))
      .toBe(commandRequestHash({ versionId: B, projectId: A }, "{}"));
  });

  it("compares UUIDs case-insensitively, and anything else as sent", () => {
    expect(commandRequestHash({ itemId: A.toUpperCase() }, "{}")).toBe(commandRequestHash({ itemId: A }, "{}"));
    expect(commandRequestHash({ key: "Abc" }, "{}")).not.toBe(commandRequestHash({ key: "abc" }, "{}"));
  });

  it("keeps the body byte-exact", () => {
    expect(commandRequestHash({}, "{}")).not.toBe(commandRequestHash({}, "{ }"));
    expect(commandRequestHash({ itemId: A }, '{"x":1}')).not.toBe(commandRequestHash({ itemId: A }, '{"x":2}'));
  });
});
