import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * DEV-024 / BL-109 / INV-104: no route this app serves takes a bearer secret
 * from its URL path or its query string.
 *
 * A token in the path or the query reaches this origin's access logs,
 * `Referer` headers, analytics and caches. The approved route table once
 * prescribed `invite/{token}`; the invitation link is now `invite#<token>`, and
 * the external review link was always `external/review#<token>` (INV-010): the
 * fragment is never sent, and the page exchanges it by POST.
 *
 * An allowlist, not a list of forbidden names: a secret under an innocent name
 * (`[code]`, `?invite=`) would pass a block list. Every dynamic segment
 * (`[x]`, `[...x]`, `[[...x]]`) must be an id (`…Id`) or a number (`…No`), and
 * every query-string read must be one of the names below. Adding a name is a
 * deliberate edit here, with the reason in the review.
 */
const QUERY_NAMES = new Set(["assignee", "limit", "cursor", "evidenceObjectId", "next"]);
const SEGMENT = /^[a-z][A-Za-z]*(Id|No)$/;

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

export function badSegments(dirs: readonly string[]): string[] {
  return dirs.flatMap((dir) => {
    const segment = /^\[\[?(?:\.\.\.)?([^\]]+)\]\]?$/.exec(dir.split(/[\\/]/).pop() ?? "");
    return segment && !SEGMENT.test(segment[1]!) ? [dir] : [];
  });
}

/** Every literal query-string name a file reads, however it reads it. */
export function queryReads(text: string): string[] {
  const names: string[] = [];
  // searchParams.get("x"), searchParams?.get("x"), useSearchParams().get("x"),
  // new URLSearchParams(…).get("x"), and a variable holding either.
  const holders = ["searchParams", "SearchParams\\([^)]*\\)"];
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*(?:use|new\s+URL)SearchParams\(/g)) holders.push(m[1]!);
  const receiver = new RegExp(`(?:${holders.join("|")})\\s*\\??\\.\\s*(?:get|getAll|has)\\(\\s*["'\`]([^"'\`]+)["'\`]`, "g");
  for (const m of text.matchAll(receiver)) names.push(m[1]!);
  // Every name at once: Object.fromEntries(searchParams) reads whatever arrives.
  if (/Object\.fromEntries\(\s*(?:\w+\.)?searchParams\b/.test(text)) names.push("*");
  // The awaited or use()d page prop: `await searchParams`, `await props.searchParams`, `use(searchParams)`.
  const prop = String.raw`(?:await\s+(?:\w+\.)?searchParams\b|use\(\s*(?:\w+\.)?searchParams\s*\))`;
  // const { x, y } = <prop>
  for (const m of text.matchAll(new RegExp(String.raw`\{([^{}]*)\}\s*=\s*` + prop, "g"))) {
    names.push(...m[1]!.split(",").map((part) => part.split(":")[0]!.trim()).filter(Boolean));
  }
  // (<prop>).x
  for (const m of text.matchAll(new RegExp(String.raw`\(\s*` + prop + String.raw`\s*\)\s*\??\.\s*(\w+)`, "g"))) names.push(m[1]!);
  // const params = <prop>; … params.x / params["x"]
  for (const m of text.matchAll(new RegExp(String.raw`const\s+(\w+)\s*=\s*` + prop, "g"))) {
    const v = m[1]!;
    for (const r of text.matchAll(new RegExp(`\\b${v}(?:\\s*\\??\\.\\s*(\\w+)|\\[\\s*["'\`]([^"'\`]+)["'\`]\\s*\\])`, "g"))) {
      names.push(r[1] ?? r[2]!);
    }
  }
  return names;
}

export function badQueryReads(files: readonly { path: string; text: string }[]): string[] {
  return files.flatMap(({ path, text }) =>
    queryReads(text).filter((name) => !QUERY_NAMES.has(name)).map((name) => `${path}: ${name}`));
}

describe("no route takes a secret from its URL (BL-109)", () => {
  const app = walk(join(APP_ROOT, "app"));
  const src = walk(join(APP_ROOT, "src"));
  const rel = (p: string) => relative(APP_ROOT, p);

  it("every dynamic route segment is an id or a number", () => {
    expect(app.dirs.filter((d) => /\[/.test(d)).length).toBeGreaterThan(20);
    expect(badSegments(app.dirs).map(rel)).toEqual([]);
  });

  it("every query-string read is an allowlisted name", () => {
    const files = [...app.files, ...src.files].map((path) => ({ path: rel(path), text: readFileSync(path, "utf8") }));
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap(({ text }) => queryReads(text)).length).toBeGreaterThanOrEqual(QUERY_NAMES.size);
    expect(badQueryReads(files)).toEqual([]);
  });

  it("the checks refuse what BL-109 describes and pass what the app uses", () => {
    expect(badSegments(["app/invite/[token]", "app/invite/[code]", "app/x/[...inviteLinks]", "app/x/[[...slug]]",
      "app/v1/invitations/[invitationId]", "app/v1/contracts/[contractId]/versions/[versionNo]"]))
      .toEqual(["app/invite/[token]", "app/invite/[code]", "app/x/[...inviteLinks]", "app/x/[[...slug]]"]);
    const text = [
      `url.searchParams.get("token"); u.searchParams?.get('cursor');`,
      `const q = useSearchParams(); q.get("invite"); useSearchParams().get("code");`,
      `new URLSearchParams(location.search).get("k");`,
      `const { next, secret } = await props.searchParams;`,
      `const params = await searchParams; params.next; params.tok; params["x"];`,
      `const { t1 } = use(searchParams); const p2 = use(props.searchParams); p2.t2; (await searchParams).t3; (use(searchParams)).t4;`,
      `searchParams.getAll("t5"); searchParams.has("t6"); Object.fromEntries(searchParams);`,
    ].join("\n");
    expect(badQueryReads([{ path: "a.ts", text }]).sort()).toEqual(
      ["a.ts: *", "a.ts: code", "a.ts: invite", "a.ts: k", "a.ts: secret", "a.ts: t1", "a.ts: t2", "a.ts: t3", "a.ts: t4",
        "a.ts: t5", "a.ts: t6", "a.ts: tok", "a.ts: token", "a.ts: x"]);
  });
});
