#!/usr/bin/env node
// pnpm-lock.yaml guard (BL-083, DEV-068).
//
// pnpm 9 privately hoists the copy of a package brought by whichever importer
// it lists first, and that order varies between runs (DEV-008). A package the
// web and mobile importers both reach can therefore resolve to a different
// copy on each install when two versions exist. `pnpm.overrides` pins the
// type packages to one version; this check makes the whole rule a red build:
//
//   1. `@types/react`, `@types/react-dom` and `typescript` resolve to exactly
//      one version in the whole workspace.
//   2. Every `react-dom` snapshot is paired with the same `react` version:
//      react-dom's client throws «Incompatible React versions» otherwise.
//   3. The web importers resolve `react` and `react-dom` to one version each.
//      `apps/mobile` keeps its own pair, the one Expo's SDK pins (19.2.3 for
//      SDK 57), so React itself is deliberately not overridden.
//
// Reads the lockfile's own line format (lockfileVersion 9.0) — no YAML
// dependency. Self-tests run first, on inline fixtures, so a parser that
// stopped matching fails loudly instead of passing an empty lockfile.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SINGLE_VERSION = ["@types/react", "@types/react-dom", "typescript"];
// packages/ui is consumed as source by both web apps, so its React is theirs.
export const WEB_IMPORTERS = ["apps/app", "apps/landing", "packages/ui"];

function unquote(key) {
  return key.replace(/^'(.*)'$/, "$1");
}

// `name@version` or `name@version(peer@x)(peer@y)`; a scoped name keeps its leading `@`.
export function splitKey(key) {
  const bare = unquote(key);
  const at = bare.indexOf("@", 1);
  const rest = bare.slice(at + 1);
  const paren = rest.indexOf("(");
  return { name: bare.slice(0, at), version: paren < 0 ? rest : rest.slice(0, paren) };
}

// The top-level sections, each as its own lines.
function sections(text) {
  const out = {};
  let current = null;
  for (const line of text.split("\n")) {
    const m = /^([a-zA-Z]+):/.exec(line);
    if (m) { current = m[1]; out[current] = []; continue; }
    if (current) out[current].push(line);
  }
  return out;
}

export function lockfileErrors(text) {
  const errs = [];
  const s = sections(text);
  if (!s.packages || !s.snapshots || !s.importers) return ["pnpm-lock.yaml: no importers/packages/snapshots section"];

  // 1. one version each
  const versions = new Map();
  for (const line of s.packages) {
    const m = /^  ('[^']+'|[^\s:]+):/.exec(line);
    if (!m) continue;
    const { name, version } = splitKey(m[1]);
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(version);
  }
  for (const name of SINGLE_VERSION) {
    const found = [...(versions.get(name) ?? [])].sort();
    if (found.length === 0) errs.push(`pnpm-lock.yaml: ${name} is not in the lockfile`);
    if (found.length > 1) errs.push(`pnpm-lock.yaml: ${name} resolves to ${found.length} versions (${found.join(", ")}); pin one in pnpm.overrides`);
  }

  // 2. react-dom paired with the same react
  let reactDomSnapshots = 0;
  for (let i = 0; i < s.snapshots.length; i++) {
    const m = /^  (react-dom@[^:]+):/.exec(s.snapshots[i]);
    if (!m) continue;
    reactDomSnapshots++;
    const { version } = splitKey(m[1]);
    let react = null;
    for (let j = i + 1; j < s.snapshots.length && /^ {4}|^$/.test(s.snapshots[j]); j++) {
      const r = /^ {6}react: ([^\s(]+)/.exec(s.snapshots[j]);
      if (r) { react = r[1]; break; }
    }
    if (react !== version) errs.push(`pnpm-lock.yaml: ${m[1]} is paired with react ${react ?? "(none)"}; react-dom needs the same version as react`);
  }
  if (reactDomSnapshots === 0) errs.push("pnpm-lock.yaml: no react-dom snapshot found; the parser no longer matches the lockfile");

  // 3. the web importers agree
  const importers = new Map();
  let importer = null;
  let dep = null;
  for (const line of s.importers) {
    const imp = /^ {2}(\S[^:]*):$/.exec(line);
    if (imp) { importer = imp[1]; importers.set(importer, {}); continue; }
    const d = /^ {6}('[^']+'|[^\s:]+):$/.exec(line);
    if (d) { dep = unquote(d[1]); continue; }
    const v = /^ {8}version: ([^\s(]+)/.exec(line);
    if (v && importer && (dep === "react" || dep === "react-dom")) importers.get(importer)[dep] = v[1];
  }
  for (const dep of ["react", "react-dom"]) {
    const seen = new Map();
    for (const name of WEB_IMPORTERS) {
      const version = importers.get(name)?.[dep];
      if (!version) { errs.push(`pnpm-lock.yaml: importer ${name} does not resolve ${dep}`); continue; }
      seen.set(name, version);
    }
    if (new Set(seen.values()).size > 1) {
      errs.push(`pnpm-lock.yaml: the web importers resolve ${dep} to different versions (${[...seen].map(([n, v]) => `${n} ${v}`).join(", ")})`);
    }
  }
  return errs;
}

function fixture({ types = ["19.2.18"], typesDom = ["19.2.4"], ts = ["6.0.3"], reactDom = [["19.2.8", "19.2.8"]], web = ["19.2.8", "19.2.8", "19.2.8"], webDom = null } = {}) {
  const pkg = [
    ...types.map((v) => `  '@types/react@${v}':\n    resolution: {}\n`),
    ...typesDom.map((v) => `  '@types/react-dom@${v}':\n    resolution: {}\n`),
    ...ts.map((v) => `  typescript@${v}:\n    resolution: {}\n`),
  ].join("\n");
  const snaps = reactDom.map(([d, r]) => `  react-dom@${d}(react@${r}):\n    dependencies:\n      react: ${r}\n      scheduler: 0.27.0\n`).join("\n");
  const dom = webDom ?? web;
  const imp = WEB_IMPORTERS.map((n, i) => `  ${n}:\n    dependencies:\n      react:\n        specifier: ${web[i]}\n        version: ${web[i]}\n      react-dom:\n        specifier: ${dom[i]}\n        version: ${dom[i]}(react@${web[i]})\n`).join("\n");
  return `lockfileVersion: '9.0'\n\nimporters:\n\n${imp}\npackages:\n\n${pkg}\nsnapshots:\n\n${snaps}`;
}

export function selfTest() {
  const t = [];
  const has = (errs, part) => errs.some((e) => e.includes(part));
  if (lockfileErrors(fixture()).length !== 0) t.push(`clean fixture reported: ${lockfileErrors(fixture()).join("; ")}`);
  if (!has(lockfileErrors(fixture({ types: ["19.2.18", "19.2.14"] })), "@types/react resolves to 2 versions")) t.push("two @types/react versions not reported");
  if (!has(lockfileErrors(fixture({ ts: ["6.0.3", "5.9.2"] })), "typescript resolves to 2 versions")) t.push("two typescript versions not reported");
  if (!has(lockfileErrors(fixture({ reactDom: [["19.2.8", "19.2.3"]] })), "react-dom@19.2.8(react@19.2.3) is paired with react 19.2.3")) t.push("react-dom/react mismatch not reported");
  if (!has(lockfileErrors(fixture({ web: ["19.2.8", "19.2.9", "19.2.8"] })), "web importers resolve react to different versions")) t.push("web importer split not reported");
  if (!has(lockfileErrors(fixture({ web: ["19.2.9", "19.2.9", "19.2.8"] })), "packages/ui 19.2.8")) t.push("packages/ui split not reported");
  if (!has(lockfileErrors(fixture({ webDom: ["19.2.8", "19.2.9", "19.2.8"] })), "web importers resolve react-dom to different versions")) t.push("web react-dom split not reported");
  if (!has(lockfileErrors(fixture({ typesDom: ["19.2.4", "19.2.3"] })), "@types/react-dom resolves to 2 versions")) t.push("two @types/react-dom versions not reported");
  if (!has(lockfileErrors("lockfileVersion: '9.0'\n"), "no importers/packages/snapshots section")) t.push("empty lockfile not reported");
  if (splitKey("'@types/react-dom@19.2.4(@types/react@19.2.18)'").name !== "@types/react-dom") t.push("scoped key split wrong");
  return t;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failedSelfTests = selfTest();
  if (failedSelfTests.length) {
    console.error(`check-lockfile-versions self-test failed:\n  - ${failedSelfTests.join("\n  - ")}`);
    process.exit(1);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const errs = lockfileErrors(readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
  if (errs.length) {
    console.error(`lockfile versions: ${errs.length} problem(s)\n  - ${errs.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("lockfile versions: OK");
}
