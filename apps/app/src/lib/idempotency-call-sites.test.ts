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
 *
 * It proves that membership is reachable, not that the command's role or
 * capability check is there: a site that dropped only that check passes here
 * and is caught by review and by the integration cases in
 * tests/idempotency-authorization.int.test.ts (DEV-020 Q1-01).
 *
 * DEV-022 (BL-112) adds the target: every call's `requestHash` must be the one
 * `commandRoute` computed over the path parameters and the body — passed as
 * `a.requestHash`, or through a service function's own `requestHash` parameter
 * — unless the operation is listed below with how it binds its target; and no
 * command handler may read its target from the URL or a header, which that
 * hash does not cover.
 */
const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NO_WORKSPACE_OPERATIONS = new Set(["workspaces.create", "organizations.create", "invitations.accept"]);

/** Operations that build their own request hash, and why that still binds the target. */
const OWN_HASH_OPERATIONS: Record<string, string> = {
  "organizations.create": "no path parameters: nothing to bind (it does not use commandRoute)",
  "import_files.add": "multipart, not commandRoute: hashes the batch id with the file's content hash",
};
/**
 * Service functions that pass their `requestHash` parameter through: their route
 * fills it from `a.requestHash`; the Telegram paths fill it with their own hash
 * and a key that names the occurrence (src/lib/telegram/evidence.ts, decisions.ts).
 */
const PASS_THROUGH_FILES = new Set(["src/lib/evidence/authorize-upload-intent.ts", "src/lib/evidence/record-evidence-decision.ts"]);

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

export function hashViolations(sites: CallSite[]): string[] {
  const out: string[] = [];
  for (const { where, args } of sites) {
    const operation = /operationId:\s*"([^"]+)"/.exec(args)?.[1] ?? "?";
    if (operation in OWN_HASH_OPERATIONS) continue;
    const hash = /requestHash(?:\s*:\s*([^,}\n]+))?\s*[,}\n]/.exec(args);
    const expr = hash?.[1]?.trim() ?? (hash ? "requestHash" : undefined);
    if (expr === "a.requestHash" || expr === "args.requestHash") continue;
    if (expr === "requestHash" && PASS_THROUGH_FILES.has(where.replace(/:\d+$/, ""))) continue;
    out.push(`${where} (${operation}): requestHash is ${expr ?? "missing"}, not the commandRoute hash`);
  }
  return out;
}

/** Mutating command handlers that read the URL or a header, which the request hash does not cover. */
function unhashedTargetReads(): string[] {
  const out: string[] = [];
  for (const file of sources(join(APP_ROOT, "app"))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/export const (POST|PATCH|PUT|DELETE)\s*=\s*commandRoute\(/g)) {
      const next = text.slice(m.index! + m[0].length).search(/\nexport const /);
      const body = next < 0 ? text.slice(m.index!) : text.slice(m.index!, m.index! + m[0].length + next);
      if (/\ba\.req\.(url|headers)\b|searchParams/.test(body)) out.push(`${relative(APP_ROOT, file)} ${m[1]}`);
    }
  }
  return out;
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

  it("every call site hashes the command's target (DEV-022)", () => {
    expect(hashViolations(callSites())).toEqual([]);
    expect(unhashedTargetReads()).toEqual([]);
  });

  it("the hash audit refuses a local body-only hash and allows the listed own-hash operations", () => {
    expect(hashViolations([
      { where: "app/v1/x/route.ts:1", args: `{ operationId: "items.archive", key, requestHash: createHash("sha256").update(raw).digest("hex"), ` },
      { where: "app/v1/x/route.ts:2", args: `{ operationId: "items.archive", key, requestHash: a.requestHash, ` },
      { where: "src/lib/evidence/record-evidence-decision.ts:3", args: `{ operationId: "evidence_decisions.create", key, requestHash,\n ` },
      { where: "app/v1/y/route.ts:4", args: `{ operationId: "items.archive", key, requestHash,\n ` },
      { where: "app/v1/z/route.ts:5", args: `{ operationId: "import_files.add", requestHash: createHash("sha256").update(x).digest("hex"), ` },
    ])).toEqual([
      "app/v1/x/route.ts:1 (items.archive): requestHash is createHash(\"sha256\").update(raw).digest(\"hex\"), not the commandRoute hash",
      "app/v1/y/route.ts:4 (items.archive): requestHash is requestHash, not the commandRoute hash",
    ]);
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
