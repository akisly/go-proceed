import { describe, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * DEV-047 / BL-141: every route under `/v1/projects/{projectId}` answers a
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
 * THIS FILE WRITES NOTHING. Before the fix the routes reached the database
 * with the malformed id and failed there.
 */

vi.mock("../src/lib/auth", () => ({
  requireUser: async () => ({ userId: "de470000-0000-4000-8000-0000000000a1" }),
}));

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

describe("every /v1/projects/{projectId} route refuses a malformed path id with 404 (DEV-047)", () => {
  it("sweeps the whole tree", () => {
    // 17 route files on 2026-09-24; the sweep reads the tree, so this only guards the walk itself.
    expect(files.length).toBeGreaterThanOrEqual(17);
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
            expect(`${res.status} ${body.code}`, `${method} ${rel} with ${target}=${JSON.stringify(bad)}`)
              .toBe("404 RESOURCE_NOT_FOUND");
            expect(body.retryable).toBe(false);
          }
        }, 30_000);
      }
    }
  }
});
