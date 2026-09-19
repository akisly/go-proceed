import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isSecretKeyName } from "@goproceed/database";

/**
 * DEV-024 / BL-109 / INV-104: no route in this app takes a bearer secret from
 * its URL path or its query string.
 *
 * A token in the path or the query reaches hosting and proxy access logs,
 * `Referer` headers, analytics and CDN caches, and a link prefetch (an email
 * scanner, a chat preview) would consume it. The approved route table once
 * prescribed `invite/{token}`; the invitation link is now `invite#<token>`, and
 * the external review link was always `external/review#<token>` (INV-010): the
 * fragment is never sent, and the page exchanges it by POST.
 *
 * This reads the tree: every dynamic segment (`[name]`, `[...name]`) and every
 * literal `searchParams.get("name")` must not be secret-shaped by the rule that
 * guards stored responses (BL-108: `csrf…`, or ending in token, url, link,
 * secret, password, singular or plural).
 */
const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string): { dirs: string[]; files: string[] } {
  const dirs: string[] = [];
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules") continue;
      dirs.push(path);
      const inner = walk(path);
      dirs.push(...inner.dirs);
      files.push(...inner.files);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      files.push(path);
    }
  }
  return { dirs, files };
}

export function secretSegments(dirs: readonly string[]): string[] {
  return dirs.flatMap((dir) => {
    const segment = /\[(?:\.\.\.)?\[?(?:\.\.\.)?([^\]]+)\]?\]$/.exec(dir.split(/[\\/]/).pop() ?? "");
    return segment && isSecretKeyName(segment[1]!) ? [dir] : [];
  });
}

export function secretQueryReads(files: readonly { path: string; text: string }[]): string[] {
  return files.flatMap(({ path, text }) =>
    [...text.matchAll(/searchParams\s*\.\s*get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)]
      .filter((m) => isSecretKeyName(m[1]!))
      .map((m) => `${path}: searchParams.get("${m[1]}")`));
}

describe("no route takes a secret from its URL (BL-109)", () => {
  const app = walk(join(APP_ROOT, "app"));
  const src = walk(join(APP_ROOT, "src"));
  const rel = (p: string) => relative(APP_ROOT, p);

  it("no dynamic route segment is secret-shaped", () => {
    expect(app.dirs.length).toBeGreaterThan(20);
    expect(secretSegments(app.dirs).map(rel)).toEqual([]);
  });

  it("no literal query-string read is secret-shaped", () => {
    const files = [...app.files, ...src.files].map((path) => ({ path: rel(path), text: readFileSync(path, "utf8") }));
    expect(files.length).toBeGreaterThan(50);
    expect(secretQueryReads(files)).toEqual([]);
  });

  it("the checks refuse what BL-109 describes and pass what the app uses", () => {
    expect(secretSegments(["app/invite/[token]", "app/x/[...inviteLinks]", "app/x/[[...csrf]]", "app/v1/invitations/[invitationId]"]))
      .toEqual(["app/invite/[token]", "app/x/[...inviteLinks]", "app/x/[[...csrf]]"]);
    expect(secretQueryReads([{ path: "a.ts", text: `url.searchParams.get("token"); u.searchParams.get('cursor'); s.searchParams.get("signedUrl")` }]))
      .toEqual(['a.ts: searchParams.get("token")', 'a.ts: searchParams.get("signedUrl")']);
  });
});
