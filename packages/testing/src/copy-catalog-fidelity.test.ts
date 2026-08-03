import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every status the database permits must have a Ukrainian label.
 *
 * Before this test the catalog carried labels for `authorized`, `sealed`,
 * `cancelled` and `expired` while the server shipped eight different values —
 * one of four matched, two named states that do not exist, and the three a
 * client actually observes had no label at all. A one-time cleanup drifts
 * again; this is what stops it.
 *
 * The permitted values are parsed from the migration, not copied here, so
 * widening the constraint without adding a label fails this test.
 *
 * `status` is a checked column on three tables in this migration
 * (requirement_template_versions, work_assignments, upload_intents), each
 * with its own `default '...'` clause sitting between `not null` and
 * `check` — the constraint spans two lines. The parser is scoped to the
 * owning table's `create table` block before it looks for the check, so it
 * reads upload_intents.status rather than the first "status" it finds.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

function tableFor(column: string): string {
  if (column === "status") return "upload_intents";
  if (column === "client_state") return "capture_events";
  throw new Error(`no known table for column ${column}`);
}

function permitted(column: string): string[] {
  const sql = readFileSync(
    join(repoRoot, "supabase/migrations/0015_execution_evidence_module.sql"), "utf8");
  const table = tableFor(column);
  const block = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!block) throw new Error(`no table block found for ${table}`);
  const m = new RegExp(`${column}[\\s\\S]*?check \\(${column} in\\s*\\(([^)]*)\\)`).exec(block[1]!);
  if (!m) throw new Error(`no check constraint found for ${column} in ${table}`);
  return [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!);
}

function labelled(prefix: string): Set<string> {
  const csv = readFileSync(join(repoRoot, "technical/copy-catalog.csv"), "utf8");
  return new Set(csv.split("\n")
    .filter((l) => l.startsWith(prefix))
    .map((l) => l.slice(prefix.length).split(",")[0]!));
}

describe("every status the server can emit has a Ukrainian label", () => {
  it("covers upload_intents.status", () => {
    const want = permitted("status");
    expect(want).toContain("available");
    const have = labelled("status.upload_intent.");
    expect(want.filter((s) => !have.has(s))).toEqual([]);
  });

  it("covers capture_events.client_state", () => {
    const want = permitted("client_state");
    expect(want.length).toBe(6);
    const have = labelled("status.client_state.");
    expect(want.filter((s) => !have.has(s))).toEqual([]);
  });

  it("has no label for a state the database forbids", () => {
    // The other direction. `sealed` and `cancelled` were labelled for years and
    // never existed.
    const want = new Set(permitted("status"));
    const stray = [...labelled("status.upload_intent.")].filter((s) => !want.has(s));
    expect(stray).toEqual([]);
  });

  it("has no label for a client_state the database forbids", () => {
    // The same direction for `client_state`, which had no equivalent check.
    // `client_state` is the newer of the two prefixes and the one this
    // milestone's mobile client generates from, so a label for a state the
    // constraint does not permit would ship into the app as a dead entry.
    const want = new Set(permitted("client_state"));
    const stray = [...labelled("status.client_state.")].filter((s) => !want.has(s));
    expect(stray).toEqual([]);
  });
});
