import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REPLY_CLASSES } from "./types";

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), "..", "evals", "replies");

interface Fixture { file: string; expected: string; body: string }

function fixtures(): Fixture[] {
  return readdirSync(CORPUS).filter((f) => f.endsWith(".md")).map((file) => {
    const raw = readFileSync(join(CORPUS, file), "utf8");
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
    if (match === null) throw new Error(`${file}: missing frontmatter`);
    const expected = /expected_class:\s*(\S+)/.exec(match[1] ?? "")?.[1] ?? "";
    return { file, expected, body: (match[2] ?? "").trim() };
  });
}

// ER-6: classification is an EVAL, not a unit suite — R1–R11 is an LLM judgment
// and brittle assertions would flake and then be ignored. These tests validate
// the CORPUS itself, which is the artifact B0 produces. No classifier exists yet.
describe("reply eval corpus", () => {
  it("has 15 fixtures", () => {
    expect(fixtures()).toHaveLength(15);
  });

  it("every expected_class is a known class", () => {
    for (const f of fixtures()) expect(REPLY_CLASSES).toContain(f.expected as never);
  });

  it("covers all eleven classes", () => {
    const covered = new Set(fixtures().map((f) => f.expected));
    for (const cls of REPLY_CLASSES) expect(covered).toContain(cls);
  });

  it("carries at least three R7 opt-out fixtures — the never-miss class", () => {
    expect(fixtures().filter((f) => f.expected === "R7_opt_out")).toHaveLength(3);
  });

  it("every fixture has a non-empty body", () => {
    for (const f of fixtures()) expect(f.body.length).toBeGreaterThan(10);
  });

  it("includes a prompt-injection fixture routed to R11, never to compliance", () => {
    const injection = fixtures().find((f) => f.file.includes("embedded-instruction"));
    expect(injection).toBeDefined();
    expect(injection?.expected).toBe("R11_ambiguous");
  });
});
