import { describe, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * DEV-048 / BL-141: every route under `/v1/projects/{projectId}` answers a
 * malformed project id — and the two nested routes a malformed message or
 * contract-version id — with 404 RESOURCE_NOT_FOUND, never 500.
 *
 * Before it, most of these routes handed the path's id to a `uuid` comparison
 * without checking its form, so PostgreSQL's cast error (22P02) became 500
 * INTERNAL_ERROR; `project_access.revoke` and `project_responsibilities.end`
 * checked it first (DEV-043, DEV-044) and the rest did not. The check now
 * lives in `commandRoute` and `queryRoute`, before the Idempotency-Key, the body
 * and any database call, so this file needs no database once it passes, and a
 * route added under the tree later is swept here without being listed.
 *
 * THIS FILE WRITES NOTHING AND REACHES NO DATABASE: the transaction helpers are
 * mocked to throw, so a case passes only on the wrapper's own 404 and its
 * param's detail (review R1-01). Before the fix the routes reached the
 * database with the malformed id and failed there.
 */

vi.mock("../src/lib/auth", () => ({
  requireUser: async () => ({ userId: "de470000-0000-4000-8000-0000000000a1" }),
}));

// DEV-048 review R1-01: a case must not pass because a handler reached the
// database and found nothing there. Every transaction helper throws, so only
// the wrapper's check can answer, and each param has its own detail.
vi.mock("@goproceed/database", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  const refuse = () => { throw new Error("a malformed path id reached the database"); };
  return { ...real, withTenantTx: refuse, withServiceTx: refuse, withExternalTx: refuse };
});

/** The detail each declared path id answers with; a new dynamic segment must be registered here. */
const DETAIL: Record<string, string> = {
  projectId: "Проєкт не знайдено.",
  versionId: "Версію договору не знайдено.",
  messageId: "Повідомлення не знайдено.",
};

const ROOT = join(__dirname, "..", "app", "v1", "projects", "[projectId]");
const VALID = "de470000-0000-4000-8000-000000000001";
const MALFORMED = ["not-a-uuid", "de470000-0000-4000-8000-00000000000", "1 or 1=1", "%27"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : []);
}

/** The dynamic segments of a route file's path, `[projectId]` included. */
function paramNames(file: string): string[] {
  return relative(join(ROOT, ".."), file).split(sep).flatMap((s) => /^\[(\w+)\]$/.exec(s)?.[1] ?? []);
}

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

async function call(file: string, method: string, params: Record<string, string>): Promise<Response> {
  const mod = await import(file);
  const init: RequestInit = { method, headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() } };
  if (method !== "GET") init.body = "{}";
  return mod[method](new Request("http://x/v1/projects/x", init), { params: Promise.resolve(params) });
}

const files = routeFiles(ROOT).sort();
const modules = new Map<string, Record<string, unknown>>(
  await Promise.all(files.map(async (f) => [f, await import(f)] as const)));

describe("every /v1/projects/{projectId} route refuses a malformed path id with 404 (DEV-048)", () => {
  it("sweeps the whole tree", () => {
    // 17 route files on 2026-09-24; the sweep reads the tree, so this only guards the walk itself.
    expect(files.length).toBeGreaterThanOrEqual(17);
  });

  it("every dynamic segment in the tree has an expected detail", () => {
    const unknown = [...new Set(files.flatMap(paramNames))].filter((n) => !(n in DETAIL));
    expect(unknown).toEqual([]);
  });

  for (const file of files) {
    const rel = relative(ROOT, file);
    const names = paramNames(file);
    const methods = METHODS.filter((m) => typeof modules.get(file)![m] === "function");
    for (const method of methods) {
      for (const target of names) {
        it(`${method} ${rel}: a malformed ${target} is 404 RESOURCE_NOT_FOUND`, async () => {
          for (const bad of MALFORMED) {
            const params = Object.fromEntries(names.map((n) => [n, n === target ? bad : VALID]));
            const res = await call(file, method, params);
            const body = await res.json();
            const where = `${method} ${rel} with ${target}=${JSON.stringify(bad)}`;
            expect(`${res.status} ${body.code}`, where).toBe("404 RESOURCE_NOT_FOUND");
            expect(body.detail, where).toBe(DETAIL[target]);
            expect(body.retryable).toBe(false);
          }
        }, 30_000);
      }
    }
  }
});
