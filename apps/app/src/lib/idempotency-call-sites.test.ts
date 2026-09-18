import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * DEV-020 / BL-103, INV-048: every `withIdempotency` call authorizes its caller.
 *
 * The type makes `authorize` required but cannot tell a real check from
 * `async () => {}`, and the helper's runtime guard only refuses the
 * no-workspace sentinel on a workspace call. A route that authorized nothing
 * would put BL-103's role and capability half back, with `0089` covering only
 * membership. So this reads every call site in the app and requires that:
 *
 *  - a call that names a workspace has an `authorize` that reaches
 *    `requireActiveMembership` directly or through a named `authorize*` helper;
 *  - `actorScopedOnly` and `organizationId: null` appear only on the three
 *    operations that run before any workspace exists for the caller.
 */
const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NO_WORKSPACE_OPERATIONS = new Set(["workspaces.create", "organizations.create", "invitations.accept"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

interface CallSite { where: string; args: string }

/** The argument object of each call: from `withIdempotency(` to the callback. */
function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of [...sources(join(APP_ROOT, "app")), ...sources(join(APP_ROOT, "src"))]) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/withIdempotency(?:<[^(]*?>)?\(/g)) {
      const rest = text.slice(m.index! + m[0].length);
      const callback = rest.search(/\},\s*(?:async\s*)?\(/);
      const line = text.slice(0, m.index).split("\n").length;
      sites.push({ where: `${relative(APP_ROOT, file)}:${line}`, args: callback < 0 ? rest : rest.slice(0, callback) });
    }
  }
  return sites;
}

export function violations(sites: CallSite[]): string[] {
  const out: string[] = [];
  for (const { where, args } of sites) {
    const operation = /operationId:\s*"([^"]+)"/.exec(args)?.[1] ?? "?";
    const authorize = /authorize:\s*([\s\S]*)$/.exec(args)?.[1];
    const noWorkspace = /organizationId:\s*null\b/.test(args);
    if (authorize === undefined) { out.push(`${where} (${operation}): no authorize`); continue; }
    if (/^actorScopedOnly\b/.test(authorize.trim()) || noWorkspace) {
      if (!NO_WORKSPACE_OPERATIONS.has(operation)) out.push(`${where} (${operation}): no-workspace authorize outside the bootstrap commands`);
      continue;
    }
    if (!/\brequireActiveMembership\(|\bauthorize\w+\(/.test(authorize)) {
      out.push(`${where} (${operation}): authorize reaches neither requireActiveMembership nor an authorize* helper`);
    }
  }
  return out;
}

describe("withIdempotency call sites (DEV-020)", () => {
  it("every call site authorizes its caller before any replay", () => {
    const sites = callSites();
    expect(sites.length).toBeGreaterThanOrEqual(51);
    expect(violations(sites)).toEqual([]);
  });

  it("the audit refuses an authorize that checks nothing, and the sentinel on a workspace command", () => {
    expect(violations([
      { where: "x.ts:1", args: `{ organizationId: ws, operationId: "projects.create", authorize: async () => {} ` },
      { where: "x.ts:2", args: `{ organizationId: ws, operationId: "projects.create", authorize: actorScopedOnly ` },
      { where: "x.ts:3", args: `{ organizationId: ws, operationId: "projects.create" ` },
      { where: "x.ts:4", args: `{ organizationId: null, operationId: "workspaces.create", authorize: actorScopedOnly ` },
      { where: "x.ts:5", args: `{ organizationId: ws, operationId: "p.x", authorize: () => authorizeProject(tx) ` },
    ])).toEqual([
      "x.ts:1 (projects.create): authorize reaches neither requireActiveMembership nor an authorize* helper",
      "x.ts:2 (projects.create): no-workspace authorize outside the bootstrap commands",
      "x.ts:3 (projects.create): no authorize",
    ]);
  });
});
