# v0.1-M2-B0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile client something to stand on — design tokens both
platforms can import, Ukrainian labels for the states the server actually emits,
and an Expo app that installs — without writing a single product screen.

**Architecture:** A new `packages/tokens` holds one JSON source and two
generators: one emits CSS custom properties for the web, one emits a typed
TypeScript module React Native can import. `packages/ui` becomes a consumer of
generated output instead of a hand-maintained stylesheet. Two fidelity tests,
modelled on the repository's existing error-catalog guard, fail when generated
output drifts from its source or when a server-emittable status has no label.
`apps/mobile` is a `create-expo-app` scaffold whose single screen renders both
generated artifacts, so a broken generator is visible rather than silent.

**Tech Stack:** Node 24, pnpm 9 workspaces, turbo, Vitest, Expo SDK 57.0.9,
React Native, EAS.

## Global Constraints

- **Branch:** `claude/m2-b0-foundations`, from `main` @ `7728f47`. Do not rebase.
- **Colour and shadow only.** Typography, spacing, radius, border width and
  motion are NOT tokenised in this slice. A token with no consumer is an
  untested assertion.
- **Three tokens are contested and are not in the source until Task 5:**
  `blue-500`, `line`, and the whole shadow ladder. Do not invent values for
  them. Do not add a placeholder entry.
- **Pin exact versions.** `docs/07-technical-architecture.md:20` requires it.
  No `^` or `~` ranges in any new dependency.
- **Every test command needs no database.** Nothing in B0 touches PostgreSQL.
  Do not add `APP_DB_URL` to any new script.
- **Never run `eas build`.** It is a paid service and the accounts do not exist.
  Task 4 produces configuration only.
- **Ukrainian UI copy is normative.** `docs/05-design-system.md:120` says
  approved labels "may not be reworded per page". Where an approved label
  already exists for the same meaning, reuse it verbatim.

## File Structure

| File | Responsibility |
|---|---|
| `packages/tokens/src/tokens.json` | The single source. Colour only in this slice; every entry carries the ruling that produced its value. |
| `packages/tokens/scripts/generate-css.mjs` | Emits `packages/ui/src/tokens.generated.css`. |
| `packages/tokens/scripts/generate-native.mjs` | Emits `packages/tokens/src/tokens.generated.ts`. |
| `packages/tokens/src/index.ts` | Public entry: re-exports the generated module so consumers import `@aktflow/tokens`, not a generated path. |
| `packages/tokens/package.json` | `main`/`types` so a bundler can resolve it. This is the thing `packages/ui` lacks. |
| `packages/testing/src/token-fidelity.test.ts` | Fails when generated output differs from what the source would produce, and when a documented token is missing. |
| `technical/copy-catalog.csv` | Reissued `status.upload_intent.*`; new `status.client_state.*`; legacy `status.mobile_capture.*` removed. |
| `packages/testing/src/copy-catalog-fidelity.test.ts` | Fails when a status the database permits has no Ukrainian label. |
| `apps/mobile/` | `create-expo-app` scaffold; one route, one screen. |
| `apps/mobile/eas.json` | Build profiles. No build is ever run. |
| `docs/superpowers/plans/evidence/2026-08-01-b0-procurement.md` | The long-lead items, and the device-install step recorded as blocked. |

---

### Task 1: The token source and its two generators

Ten of the twelve documented colours are decided by the spec's ruling rule. Two
are contested and are deliberately absent until Task 5.

**Files:**
- Create: `packages/tokens/package.json`, `packages/tokens/src/tokens.json`,
  `packages/tokens/scripts/generate-css.mjs`,
  `packages/tokens/scripts/generate-native.mjs`, `packages/tokens/src/index.ts`,
  `packages/tokens/tsconfig.json`
- Create: `packages/testing/src/token-fidelity.test.ts`
- Generated (committed): `packages/ui/src/tokens.generated.css`,
  `packages/tokens/src/tokens.generated.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: package `@aktflow/tokens` exporting
  `export const color: Record<ColorName, string>` where `ColorName` is a union
  of the ten names below, and `export const colorRaw: Record<ColorName, {hex: string; alpha: number}>`.
  Later tasks import `import { color } from "@aktflow/tokens"`.

- [ ] **Step 1: Write the failing test**

Create `packages/testing/src/token-fidelity.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

/**
 * The repository's error-catalog guard is the model: it fails when a route
 * emits a problem code the catalog does not define. This is the same shape for
 * tokens — it fails when committed output no longer matches what the source
 * would produce.
 *
 * What it does NOT catch, stated so nobody assumes otherwise: a wrong value.
 * Once a wrong value is in the source, generation makes it consistent
 * everywhere. That is exactly how `muted` drifted (#686E6A documented,
 * #666979 shipped, name identical). Only the visual gate catches that class.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

/**
 * A fixed, never-cleaned output path (the original `/tmp/token-fidelity`) let
 * a broken generator pass this guard silently. If a generator stopped
 * honouring `TOKENS_OUT_DIR` — e.g. someone hardcoded the real output path
 * back in — it would overwrite the committed file at its real location as a
 * side effect, while this test kept reading a stale-but-matching copy left
 * in the fixed temp path by an earlier successful run, and passed. On a
 * clean checkout that failed correctly with ENOENT; on a warm CI runner or a
 * second local `vitest` invocation it did not. A reviewer built and
 * confirmed exactly this regression.
 *
 * The fix is two-layered: `runDir` is unique per test-file execution
 * (`mkdtempSync`) and removed afterwards (`rmSync`), so no earlier run's
 * output can be waiting there to be misread; and each `regenerate()` call
 * gets its own fresh subdirectory of `runDir`, checked empty immediately
 * before the generator runs and checked to contain exactly the expected file
 * immediately after. A generator that silently ignores `TOKENS_OUT_DIR`
 * leaves that subdirectory empty, so the post-run assertion fails and
 * `readFileSync` never gets the chance to read back something stale.
 * Isolation here is the mechanism the guard depends on, not tidiness.
 */
let runDir: string;

beforeAll(() => {
  runDir = mkdtempSync(join(tmpdir(), "token-fidelity-"));
});

afterAll(() => {
  rmSync(runDir, { recursive: true, force: true });
});

/** Regenerates into a fresh, empty subdirectory of this run's temp root and
 * returns what the generator wrote. See the comment above `runDir` for why
 * this checks the directory's contents before and after, rather than
 * trusting that `TOKENS_OUT_DIR` was honoured. */
function regenerate(script: string, out: string): string {
  const dir = mkdtempSync(join(runDir, `${script}-`));
  expect(readdirSync(dir)).toEqual([]);

  execFileSync("node", [join(repoRoot, "packages/tokens/scripts", script)],
    { cwd: repoRoot, env: { ...process.env, TOKENS_OUT_DIR: dir } });

  expect(readdirSync(dir)).toEqual([out]);
  return readFileSync(join(dir, out), "utf8");
}

describe("generated tokens match their source", () => {
  it("the committed CSS is what the generator produces", () => {
    const committed = readFileSync(join(repoRoot, "packages/ui/src/tokens.generated.css"), "utf8");
    expect(regenerate("generate-css.mjs", "tokens.generated.css")).toBe(committed);
  });

  it("the committed React Native module is what the generator produces", () => {
    const committed = readFileSync(join(repoRoot, "packages/tokens/src/tokens.generated.ts"), "utf8");
    expect(regenerate("generate-native.mjs", "tokens.generated.ts")).toBe(committed);
  });
});

describe("the source accounts for every documented colour", () => {
  it("names every token the design document's table defines, or records it contested", () => {
    // docs/05-design-system.md:19-30. Parsed from the document rather than
    // copied, so adding a row there without adding a token fails here.
    const doc = readFileSync(join(repoRoot, "docs/05-design-system.md"), "utf8");
    const documented = [...doc.matchAll(/^\| `([a-z0-9-]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm)]
      .map((m) => m[1]!);
    expect(documented.length).toBe(12);

    const src = JSON.parse(
      readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
    const accounted = new Set([...Object.keys(src.color), ...src.contested]);
    expect(documented.filter((t) => !accounted.has(t))).toEqual([]);
  });

  it("carries a ruling for every token, so no value is unexplained", () => {
    const src = JSON.parse(
      readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
    const unexplained = Object.entries(src.color as Record<string, { ruling?: string }>)
      .filter(([, v]) => !v.ruling || v.ruling.length < 10)
      .map(([k]) => k);
    expect(unexplained).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aktflow/testing test -- src/token-fidelity.test.ts`
Expected: FAIL — `packages/tokens/src/tokens.json` does not exist.

- [ ] **Step 3: Write the source**

Create `packages/tokens/src/tokens.json`:

```json
{
  "version": 1,
  "note": "Single source for design tokens. Colour only in v0.1-M2-B0; typography, spacing, radius, border width and motion are tokenised when a screen consumes them. Every entry carries the ruling that produced its value — see docs/superpowers/specs/2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md. Colours never carry baked-in alpha: React Native's shadowOpacity multiplies with a colour's alpha, so an rgba() string passed as shadowColor renders nothing.",
  "contested": ["blue-500", "line"],
  "contestedNote": "Not values yet. `line` differs in KIND between sources (opaque #D9DBD5 documented, rgba(72,76,94,.17) shipped) and a translucent border composites differently over paper, white and ink — React Native authors border colours opaque and has no custom properties to composite through. `blue-500` has four rendered candidates for one role. Both need a render, not an argument.",
  "color": {
    "ink-950": {
      "hex": "#171717", "alpha": 1, "use": "primary ink/sidebar",
      "ruling": "agree — docs/05-design-system.md:19 and packages/ui/src/tokens.css:15 (--ink) are identical"
    },
    "ink-800": {
      "hex": "#242424", "alpha": 1, "use": "secondary surfaces",
      "ruling": "R2 rendered beats written — shipped as --ink-2 at tokens.css:16; the document's #2A2D2F appears nowhere in the repository"
    },
    "paper": {
      "hex": "#FBFBFB", "alpha": 1, "use": "app background",
      "ruling": "agree — the one row where document and shipped match on both name and value"
    },
    "white": {
      "hex": "#FFFFFF", "alpha": 1, "use": "cards",
      "ruling": "agree — shipped as #fff at tokens.css:18; identical colour, expanded notation"
    },
    "signal-500": {
      "hex": "#C6FF34", "alpha": 1, "use": "brand/action/readiness",
      "ruling": "agree — shipped as --signal at tokens.css:20"
    },
    "slate-600": {
      "hex": "#484C5E", "alpha": 1, "use": "structural surfaces/dividers",
      "ruling": "agree — shipped as --slate at tokens.css:22"
    },
    "signal-700": {
      "hex": "#667F12", "alpha": 1, "use": "accessible text/accent",
      "ruling": "R1 measured beats asserted — 4.56:1 recorded at apps/demo/src/styles/theme.css:133; the document's #84A625 carries no measurement anywhere in the repository"
    },
    "amber-500": {
      "hex": "#F2B84B", "alpha": 1, "use": "warning/at risk",
      "ruling": "agree — shipped as --amber at tokens.css:25"
    },
    "red-500": {
      "hex": "#E45C55", "alpha": 1, "use": "blocked/destructive",
      "ruling": "agree — shipped as --red at tokens.css:26"
    },
    "muted": {
      "hex": "#666979", "alpha": 1, "use": "secondary text",
      "ruling": "R1 measured beats asserted — 5.86:1 recorded at apps/demo/src/styles/theme.css:120. The document's #686E6A shares this token's NAME exactly and differs in value, which is the drift class no test catches once generated"
    }
  }
}
```

- [ ] **Step 4: Write the CSS generator**

Create `packages/tokens/scripts/generate-css.mjs`:

```js
// Emits the web half of the token source. Output directory is overridable so
// the fidelity test can regenerate into a temp dir and compare.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(readFileSync(join(root, "packages/tokens/src/tokens.json"), "utf8"));
const outDir = process.env.TOKENS_OUT_DIR ?? join(root, "packages/ui/src");

const lines = [
  "/* GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "   Regenerate: node packages/tokens/scripts/generate-css.mjs",
  "   packages/testing/src/token-fidelity.test.ts fails if this drifts. */",
  ":root {",
];
for (const [name, t] of Object.entries(src.color)) {
  lines.push(`  --${name}: ${t.alpha === 1 ? t.hex : rgba(t)};`);
}
lines.push("}", "");

function rgba({ hex, alpha }) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.css"), lines.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.css")}`);
```

- [ ] **Step 5: Write the React Native generator**

Create `packages/tokens/scripts/generate-native.mjs`:

```js
// Emits the React Native half. RN has no cascade, no var(), and no CSS custom
// properties — tokens must arrive as a plain object of strings. Alpha is kept
// separately in colorRaw because RN's shadowOpacity multiplies with a colour's
// alpha, so a shadow consumer needs the two apart.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(readFileSync(join(root, "packages/tokens/src/tokens.json"), "utf8"));
const outDir = process.env.TOKENS_OUT_DIR ?? join(root, "packages/tokens/src");

const names = Object.keys(src.color);
const out = [
  "// GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "// Regenerate: node packages/tokens/scripts/generate-native.mjs",
  "// packages/testing/src/token-fidelity.test.ts fails if this drifts.",
  "",
  `export type ColorName = ${names.map((n) => JSON.stringify(n)).join(" | ")};`,
  "",
  "export const colorRaw: Record<ColorName, { hex: string; alpha: number }> = {",
  ...names.map((n) =>
    `  ${JSON.stringify(n)}: { hex: ${JSON.stringify(src.color[n].hex)}, alpha: ${src.color[n].alpha} },`),
  "};",
  "",
  "export const color: Record<ColorName, string> = {",
  ...names.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(src.color[n].hex)},`),
  "};",
  "",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.ts"), out.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.ts")}`);
```

- [ ] **Step 6: Wire the package**

Create `packages/tokens/package.json` — note `main`/`types`, which is precisely
what `packages/ui` lacks and why React Native cannot import it:

```json
{
  "name": "@aktflow/tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "node scripts/generate-css.mjs && node scripts/generate-native.mjs",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/tokens/src/index.ts`:

```ts
// Consumers import from "@aktflow/tokens", never from the generated path — so
// regenerating cannot break an import, and the generated file stays free to
// change shape.
export { color, colorRaw, type ColorName } from "./tokens.generated";
```

Create `packages/tokens/tsconfig.json`, copying the shape used by
`packages/domain/tsconfig.json` (read that file and mirror it).

- [ ] **Step 7: Generate, then run the test to verify it passes**

Run:
```bash
pnpm install
pnpm --filter @aktflow/tokens generate
pnpm --filter @aktflow/testing test -- src/token-fidelity.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 8: Mutation-check the guard**

Prove the fidelity test fails when output drifts from source. Change one hex in
`packages/ui/src/tokens.generated.css` by hand, re-run the test, confirm the
first assertion FAILS, then restore with
`pnpm --filter @aktflow/tokens generate`. Record the failure output — a guard
that has not been shown to fail is not evidence.

- [ ] **Step 9: Commit**

```bash
git add packages/tokens packages/ui/src/tokens.generated.css \
  packages/testing/src/token-fidelity.test.ts pnpm-lock.yaml
git commit -m "feat(tokens): one source, two platforms, and a ruling beside every value

packages/ui exports exactly one path, ./tokens.css, with no main, module, types
or react-native — React Native could not import anything from it. This adds the
package that can be imported, and moves the values into a source that generates
both halves.

Ten of the twelve documented colours are here. Each carries the ruling that
produced it, because eleven of twelve had drifted from the design document and
the reason a value won is worth more than the value. Where a token is
load-bearing for contrast, the measured side won: signal-700 and muted take the
shipped values, which carry recorded ratios, over the document's, which appear
nowhere in the repository.

blue-500 and line are absent, not guessed. line differs in KIND between sources
and blue-500 has four rendered candidates; both need a render."
```

---

### Task 2: A copy catalog that matches the vocabulary the server ships

**Files:**
- Modify: `technical/copy-catalog.csv`
- Create: `packages/testing/src/copy-catalog-fidelity.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: keys `status.upload_intent.<status>` for all eight database-permitted
  `upload_intents.status` values, and `status.client_state.<state>` for all six
  permitted `capture_events.client_state` values. Task 3 reads
  `status.client_state.*`.

- [ ] **Step 1: Write the failing test**

Create `packages/testing/src/copy-catalog-fidelity.test.ts`:

```ts
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
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

function permitted(column: string): string[] {
  const sql = readFileSync(
    join(repoRoot, "supabase/migrations/0015_execution_evidence_module.sql"), "utf8");
  const m = new RegExp(`${column}\\s+text not null check \\(${column} in\\s*\\(([^)]*)\\)`, "s")
    .exec(sql);
  if (!m) throw new Error(`no check constraint found for ${column}`);
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aktflow/testing test -- src/copy-catalog-fidelity.test.ts`
Expected: FAIL — the first test reports the missing statuses
(`intent_authorized`, `staged`, `integrity_verified`, `scan_pending`,
`available`, `scan_blocked`, `orphaned_for_purge`), and the third reports
`authorized`, `sealed`, `cancelled` as stray.

- [ ] **Step 3: Reissue the catalog rows**

In `technical/copy-catalog.csv`, delete these four lines:

```
status.upload_intent.authorized,Дозволено завантаження,global,status,"upload_intent state label — canonical, derived from state-catalog"
status.upload_intent.sealed,Файл зафіксовано,global,status,"upload_intent state label — canonical, derived from state-catalog"
status.upload_intent.expired,Строк дозволу минув,global,status,"upload_intent state label — canonical, derived from state-catalog"
status.upload_intent.cancelled,Завантаження скасовано,global,status,"upload_intent state label — canonical, derived from state-catalog"
```

and these five:

```
status.mobile_capture.local_draft,Чернетка на пристрої,global,status,"mobile_capture state label — canonical, derived from state-catalog"
status.mobile_capture.local_queued,Збережено на пристрої,global,status,"mobile_capture state label — canonical, derived from state-catalog"
status.mobile_capture.uploading,Синхронізація,global,status,"mobile_capture state label — canonical, derived from state-catalog"
status.mobile_capture.server_confirmed,Підтверджено сервером,global,status,"mobile_capture state label — canonical, derived from state-catalog"
status.mobile_capture.failed_terminal,Потрібна дія,global,status,"mobile_capture state label — canonical, derived from state-catalog"
```

(If a line differs in its trailing context text, match on the key and delete
that whole line — the key is what identifies it.)

Insert in their place:

```
status.upload_intent.intent_authorized,Дозволено завантаження,global,status,"upload_intent state label — vocabulary from supabase/migrations/0015 check constraint"
status.upload_intent.staged,Байти передано,global,status,"upload_intent state label — not written by v0.1-M2-A; reserved for the resumable protocol in v0.3"
status.upload_intent.integrity_verified,Цілісність перевірено,global,status,"upload_intent state label — not written by v0.1-M2-A; reserved for v0.3"
status.upload_intent.scan_pending,Перевірка вмісту,global,status,"upload_intent state label — not written by v0.1-M2-A; reserved for v0.3"
status.upload_intent.available,Підтверджено сервером,global,status,"upload_intent state label — the receipt state; reuses the approved mobile_capture.server_confirmed wording for the same meaning"
status.upload_intent.scan_blocked,Вміст відхилено,global,status,"upload_intent state label — content failed inspection; no evidence row is ever created (INV-046)"
status.upload_intent.orphaned_for_purge,Доступ відкликано,global,status,"upload_intent state label — authorization was revoked mid-upload; bytes are marked for purge (INV-047)"
status.upload_intent.expired,Строк дозволу минув,global,status,"upload_intent state label — the 24-hour upload grant lapsed"
status.client_state.not_sent,Не надіслано,global,status,"capture_events client_state label — replaces mobile_capture.local_draft"
status.client_state.sending,Надсилання,global,status,"capture_events client_state label — replaces mobile_capture.uploading"
status.client_state.awaiting_receipt,Очікування підтвердження,global,status,"capture_events client_state label — bytes sent, receipt not yet durable"
status.client_state.server_confirmed,Підтверджено сервером,global,status,"capture_events client_state label — approved wording carried over verbatim from mobile_capture.server_confirmed"
status.client_state.failed,Потрібна дія,global,status,"capture_events client_state label — approved wording carried over verbatim from mobile_capture.failed_terminal"
status.client_state.quarantined,Доступ відкликано,global,status,"capture_events client_state label — logout or revocation; the original is retained, not deleted (INV-013)"
```

Two of the new labels are carried over verbatim rather than reworded, because
`docs/05-design-system.md:120` forbids rewording approved copy and the meanings
are identical. Three `upload_intent` states are labelled although v0.1-M2-A
never writes them: the database permits them, so the guard requires them, and
the context column says why they will not appear yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aktflow/testing test -- src/copy-catalog-fidelity.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Mutation-check the guard**

Delete the `status.client_state.quarantined` line, re-run, confirm the second
test FAILS naming `quarantined`, then restore it. Then widen the check
constraint parse target by adding a fake `'probe_state'` to the migration's
`client_state` list **in a scratch copy only** — do not edit the migration —
and confirm you understand the test would fail. Record what you did.

- [ ] **Step 6: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
git add technical/copy-catalog.csv packages/testing/src/copy-catalog-fidelity.test.ts
git commit -m "fix(copy): label the states the server actually ships

The catalog carried Ukrainian labels for authorized, sealed, cancelled and
expired. The server ships intent_authorized, staged, integrity_verified,
scan_pending, available, scan_blocked, orphaned_for_purge and expired. One of
four matched. sealed and cancelled name states that have never existed, and
available, scan_blocked and orphaned_for_purge — the three a client actually
observes — had no label at all.

The five mobile_capture labels go with them: that machine is not the one the
database enforces. supabase/migrations/0015 constrains client_state to six
values, and those six now have labels — two carried over verbatim from the
approved mobile_capture wording, because the meanings are identical and
docs/05-design-system.md:120 forbids rewording approved copy.

The guard parses both vocabularies out of the migration rather than restating
them, so widening a constraint without adding a label fails the suite."
```

---

### Task 3: The Expo scaffold, and a screen that proves the generators ran

**Files:**
- Create: `apps/mobile/` (via `create-expo-app`), then trimmed
- Create: `apps/mobile/src/app/index.tsx`, `apps/mobile/src/screens/token-proof.tsx`
- Create: `apps/mobile/src/lib/status-labels.ts`
- Modify: `apps/mobile/package.json`, `apps/mobile/metro.config.js`, `turbo.json`

**Interfaces:**
- Consumes: `import { color, type ColorName } from "@aktflow/tokens"` (Task 1);
  `status.client_state.*` rows in `technical/copy-catalog.csv` (Task 2).
- Produces: nothing later tasks import. Task 4 adds `eas.json` beside it.

- [ ] **Step 1: Scaffold**

Run from the repository root:

```bash
pnpm dlx create-expo-app@latest apps/mobile --template blank-typescript --no-install
```

Then confirm the SDK actually resolved to 57.0.9:

```bash
node -e "console.log(require('./apps/mobile/package.json').dependencies.expo)"
```
If it is not `57.0.9` or a `57.0.x`, STOP and report the version you got. The
plan pins 57.0.9 because that is what npm resolved on 2026-08-01; a different
major is a decision, not a detail.

- [ ] **Step 2: Pin every dependency and name the package**

Edit `apps/mobile/package.json`: set `"name": "@aktflow/mobile"`, add
`"private": true`, and replace every `^`/`~` range in `dependencies` and
`devDependencies` with the exact version already resolved.
`docs/07-technical-architecture.md:20` requires exact pins. Add:

```json
  "dependencies": {
    "@aktflow/tokens": "workspace:*"
  }
```

(merged into the existing dependencies block, not replacing it).

- [ ] **Step 3: Teach Metro about the monorepo**

Create `apps/mobile/metro.config.js`:

```js
// Metro resolves from the app directory only by default, so it would not find
// workspace packages like `@aktflow/tokens` without watchFolders and
// nodeModulesPaths pointing at the monorepo root.
//
// Hierarchical lookup is deliberately LEFT ON: pnpm stores each package's own
// dependencies beside it (as symlinks inside that package's own node_modules)
// rather than hoisting them to the root, and hierarchical lookup is the
// mechanism Metro uses to walk up and find them. Disabling it breaks
// resolution of any package's transitive dependencies that aren't hoisted to
// the two roots below — it is Yarn/npm-hoisting advice that does not apply to
// pnpm's layout.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
```

- [ ] **Step 4: Write the label reader**

Create `apps/mobile/src/lib/status-labels.ts`:

```ts
// Reads the canonical Ukrainian labels at build time. The catalog is the single
// source (technical/copy-catalog.csv) and packages/testing's copy-catalog
// fidelity test guarantees every database-permitted state has one — so a
// missing key here means that test would already be red.
import labels from "./status-labels.generated.json";

export type ClientState =
  | "not_sent" | "sending" | "awaiting_receipt"
  | "server_confirmed" | "failed" | "quarantined";

export function clientStateLabel(state: ClientState): string {
  const label = (labels as Record<string, string>)[`status.client_state.${state}`];
  if (!label) throw new Error(`no Ukrainian label for client_state ${state}`);
  return label;
}
```

And a generator, `apps/mobile/scripts/generate-labels.mjs`:

```js
// The CSV is the source; React Native cannot read it at runtime, so the subset
// the app needs is emitted as JSON at build time.
//
// technical/copy-catalog.csv follows RFC 4180: a field containing a comma (or
// a literal double quote) is wrapped in double quotes, and a literal quote
// inside a quoted field is written doubled (""). field.permission.camera_denied
// is one such row today — its ui_uk value has a comma inside quotes. A plain
// `line.split(",")` truncates that value at the embedded comma and produces a
// plausible-looking WRONG answer instead of an error, and the row-count guard
// below can't see it: the row is still there, just cut short. The parser below
// is quote-aware so a truncated or malformed field throws instead of passing
// through silently.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const csv = readFileSync(join(root, "technical/copy-catalog.csv"), "utf8");

// Splits one CSV line into fields per RFC 4180: an unquoted field ends at the
// next comma; a quoted field ends at the next unescaped closing quote and may
// itself contain commas, with `""` inside it decoding to a literal `"`.
// Throws if a quoted field never closes — an unbalanced quote, which is
// exactly what a truncated field (the naive split's failure mode) looks like.
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = "";
      i += 1;
      let closed = false;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        value += line[i];
        i += 1;
      }
      if (!closed) {
        throw new Error(`unbalanced quote in CSV field: ${line}`);
      }
      fields.push(value);
      if (line[i] === ",") {
        i += 1;
      } else if (i >= line.length) {
        break;
      } else {
        throw new Error(`unexpected character after quoted CSV field: ${line}`);
      }
    } else {
      const commaIndex = line.indexOf(",", i);
      const end = commaIndex === -1 ? line.length : commaIndex;
      fields.push(line.slice(i, end));
      i = end + 1;
      if (commaIndex === -1) break;
    }
  }
  return fields;
}

const out = {};
for (const line of csv.split("\n")) {
  if (!line.startsWith("status.client_state.")) continue;
  const [key, uk] = parseCsvLine(line);
  if (!uk) {
    throw new Error(`empty or missing ui_uk field for ${key} in copy-catalog.csv`);
  }
  out[key] = uk;
}
if (Object.keys(out).length !== 6) {
  throw new Error(`expected 6 client_state labels, found ${Object.keys(out).length}`);
}
writeFileSync(join(import.meta.dirname, "..", "src/lib/status-labels.generated.json"),
  JSON.stringify(out, null, 2) + "\n");
console.log(`wrote 6 labels`);
```

Add to `apps/mobile/package.json` scripts:
`"generate": "node scripts/generate-labels.mjs"`.

- [ ] **Step 5: Write the screen**

Create `apps/mobile/src/screens/token-proof.tsx`:

```tsx
// Not decoration. This screen renders both generated artifacts, so it fails
// visibly if either generator did not run: a missing token throws at import,
// a missing label throws in clientStateLabel. That is the whole deliverable of
// this slice made observable on a device.
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { color } from "@aktflow/tokens";
import { clientStateLabel, type ClientState } from "../lib/status-labels";

const STATES: ClientState[] = [
  "not_sent", "sending", "awaiting_receipt",
  "server_confirmed", "failed", "quarantined",
];

const SURFACE: Record<ClientState, string> = {
  not_sent: color["muted"],
  sending: color["slate-600"],
  awaiting_receipt: color["slate-600"],
  server_confirmed: color["signal-700"],
  failed: color["red-500"],
  quarantined: color["amber-500"],
};

export function TokenProof() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Стани захоплення</Text>
      {STATES.map((s) => (
        <View key={s} style={[styles.row, { backgroundColor: SURFACE[s] }]}>
          <Text style={styles.label}>{clientStateLabel(s)}</Text>
          <Text style={styles.key}>{s}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color["paper"] },
  content: { padding: 24, gap: 12 },
  heading: { fontSize: 22, color: color["ink-950"], marginBottom: 8 },
  row: { padding: 16, borderRadius: 12 },
  label: { fontSize: 17, color: color["white"] },
  key: { fontSize: 13, color: color["white"], opacity: 0.8, marginTop: 4 },
});
```

Replace `apps/mobile/App.tsx` (or `src/app/index.tsx` if the template produced
Expo Router) so it renders `<TokenProof />` and nothing else. If the template
gave a router layout, keep `src/app/_layout.tsx` as the template wrote it and
make `src/app/index.tsx`:

```tsx
import { TokenProof } from "../screens/token-proof";

export default function Index() {
  return <TokenProof />;
}
```

- [ ] **Step 6: Wire turbo and install**

In `turbo.json`, the `test` task's `inputs` array already lists migration paths.
Add two entries to that same array, so a change to either invalidates the cache
— the same defect that let turbo replay stale passes for SQL-only changes:

```json
        "../../technical/copy-catalog.csv",
        "../../packages/tokens/src/tokens.json"
```

The `../../` prefix is not optional. The existing entries are relative to each
package directory, not to the repository root — `"../../supabase/migrations/**"`
is what is already there. A root-relative path silently matches nothing, which
is the same failure as having no input at all and is invisible until a stale
pass replays.

Run:
```bash
pnpm install
pnpm --filter @aktflow/mobile generate
pnpm typecheck
```
Expected: install succeeds, 6 labels written, typecheck 9/9 (the new package
brings the count from 8 to 9).

- [ ] **Step 7: Verify it renders**

Run `pnpm --filter @aktflow/mobile exec expo start --web` and confirm the six
Ukrainian labels render on coloured rows. Web is enough here — the point is that
the generators produced consumable output, and a device is Task 4's blocked
step. Record what you saw.

If `expo start --web` needs packages the scaffold did not install, install them
with exact pins and say which.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile turbo.json pnpm-lock.yaml
git commit -m "feat(mobile): scaffold apps/mobile, and make the generators observable

create-expo-app with every dependency pinned exactly, per
docs/07-technical-architecture.md:20. Metro is taught the workspace layout
explicitly — pnpm's symlinks are not followed by default, and the failure mode
is a white screen with no useful error rather than a resolution error.

The one screen renders the six client_state labels on token-coloured surfaces.
That is deliberate: a missing token throws at import and a missing label throws
in clientStateLabel, so a generator that did not run is visible instead of
silent. It is the slice's deliverable made observable, not a placeholder screen.

turbo's test inputs now include the copy catalog and the token source, so a
change to either invalidates the cache. Migrations were added to that list for
the same reason after turbo was found replaying stale passes."
```

---

### Task 4: EAS configuration and the procurement record

**Files:**
- Create: `apps/mobile/eas.json`
- Create: `docs/superpowers/plans/evidence/2026-08-01-b0-procurement.md`
- Modify: `TODOS.md`

**Interfaces:**
- Consumes: `apps/mobile` from Task 3.
- Produces: nothing code depends on.

- [ ] **Step 1: Write the build profiles**

Create `apps/mobile/eas.json`:

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true
    }
  },
  "submit": { "production": {} }
}
```

`preview` is the profile the milestone's exit gate needs: internal distribution
to a real iPhone and a real Android, an APK on Android so it installs without
Play, and `simulator: false` on iOS because an emulator-only install does not
satisfy `docs/27-qa-traceability.md:137`.

- [ ] **Step 2: Verify the config is well-formed without building**

Run:
```bash
pnpm --filter @aktflow/mobile exec eas config --platform android --profile preview
```
Expected: it prints the resolved config, or it fails asking you to log in. Both
are acceptable outcomes — record which you got. **Do not run `eas build`.** It
is a paid service and the accounts do not exist.

If `eas-cli` is not installed, add it as an exact-pinned devDependency of
`apps/mobile` rather than invoking it through `dlx`, so the version is pinned
like everything else.

- [ ] **Step 3: Write the procurement record**

Create `docs/superpowers/plans/evidence/2026-08-01-b0-procurement.md` containing:

- **Three accounts, not two.** Apple Developer Program, Google Play Console, and
  an Expo plan with build minutes — EAS build and submit jobs are a paid
  service. No document in the corpus mentions any of the three.
- **The long-lead item.** Organisational Apple enrolment for a Ukrainian legal
  entity requires a D-U-N-S number, which is obtained separately and is the
  longest lead time in the milestone. Nothing in the repository mentions it.
- **The unrecoverable item.** The Android upload keystore cannot be recovered if
  lost. `docs/26-sre-operations.md:145-154` covers solo-founder continuity and
  does not list it or the store credentials.
- **Two devices.** One supported iPhone and one lower-resource Android, both
  physical. `docs/27-qa-traceability.md:137` says camera and offline cannot be
  signed off on an emulator. Neither device is procured and the pilot-device
  inventory the roadmap requires as *entry* evidence does not exist.
- **What is blocked.** The device-install step of B0's exit gate is NOT DONE.
  State it in those words. It is blocked on the three accounts and the two
  devices, in that order, and no amount of code closes it.

- [ ] **Step 4: Record the follow-ups**

Append to `TODOS.md` one entry: the pilot-device inventory is required as entry
evidence by the roadmap before capture UX is frozen, does not exist, and is a
prerequisite for B3's acceptance matrix rather than for B1 or B2.

- [ ] **Step 5: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
git add apps/mobile/eas.json docs/superpowers/plans/evidence/2026-08-01-b0-procurement.md TODOS.md
git commit -m "chore(mobile): EAS profiles ready, and the blocked step written down

The preview profile is what the milestone's exit gate needs: internal
distribution, an APK on Android so it installs without Play, and simulator:false
on iOS because docs/27-qa-traceability.md:137 says camera and offline cannot be
signed off on an emulator.

No build is run. EAS is a paid service and the three accounts — Apple, Google,
and an Expo plan with build minutes — do not exist. The procurement record names
all three, the D-U-N-S dependency for a Ukrainian legal entity that gates Apple
enrolment, and the Android upload keystore, which is unrecoverable if lost and
which the solo-founder continuity section does not list.

B0's device-install step is recorded NOT DONE with what it is blocked on, in the
same words the M2-A gate record used for the undeployed purge worker."
```

---

### Task 5: Rule the three contested tokens, then close the slice

This task needs the repository owner at a render. It cannot be completed by an
implementer alone, and it is last because Task 3's screen is what makes the
rendering possible.

**Files:**
- Modify: `packages/tokens/src/tokens.json`
- Modify: `packages/ui/src/tokens.css` (deleted and replaced by the generated file)
- Create: `docs/superpowers/plans/evidence/2026-08-01-b0-gate.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the completed token source.

- [ ] **Step 1: Present the three side by side**

Build a comparison for the owner. For each contested item, render the candidates
in `apps/mobile`'s screen (add a temporary route; remove it before committing):

- **`line`** — a bordered card on `paper`, on `white`, and on `ink-950`, drawn
  once with `#D9DBD5` and once with `rgba(72,76,94,.17)`. The question to answer
  is not which grey but whether borders composite: React Native authors border
  colours opaque and has no custom properties to composite through, so a
  translucent choice means the native module carries a pre-composited value per
  surface.
- **`blue-500`** — four candidates for one informational role: `#5278D8`
  (documented, survives only as a focus outline at
  `apps/demo/src/styles.css:527`), `#65719a` (shipped as `--blue`, never used as
  a status), `#3756a1` on `#e8eefc` (`apps/demo/src/styles/theme.css:157`, which
  is what actually fills the role), `#18376a` (`--atlas-blue`).
- **The shadow ladder** — the shipped six at `packages/ui/src/tokens.css:33-36,42,43`
  against the document's single `0 8px 30px rgba(21,23,25,.07)`. The document
  asks for "shallow"; a 70px blur is not shallow, and a second implementer
  independently shipped the document's reading at
  `apps/demo/src/styles/theme.css:215`.

- [ ] **Step 2: Record each ruling with its reason**

Add the ruled values to `packages/tokens/src/tokens.json` — `blue-500` and
`line` into `color`, the ladder into a new `shadow` block — and empty the
`contested` array. Each entry carries a `ruling` string naming who decided and
on what evidence, in the same form as Task 1's entries.

For shadows the shape is fixed by React Native: an array of numeric layers using
RN's own field names — `offsetX`, `offsetY`, `blurRadius`, `spreadDistance` —
with each layer's colour split into `{hex, alpha}` like every other colour. The
native target is `boxShadow`, which `react-native@0.86.2` (the version
`apps/mobile` pins through Expo SDK 57.0.9) declares on `ViewStyle` as
`ReadonlyArray<BoxShadowValue> | string | undefined`
(`Libraries/StyleSheet/StyleSheetTypes.d.ts:516`, with `BoxShadowValue` at
`:343-350`), and which carries CSS box-shadow semantics on both platforms.

So no `androidElevation` and no blur divisor in the source. The first exists
only for the legacy API's single Android scalar, which encodes offset, blur and
opacity together and cannot be derived from them; the second only because the
legacy `shadowRadius` is roughly half the CSS blur radius. `boxShadow` needs
neither — it renders the shadow itself on Android, and its `blurRadius` *is* CSS
blur. An approximation removed beats an approximation reviewed.

Extend `generate-native.mjs` to emit `shadow` as
`Record<ShadowName, BoxShadowValue[]>`, composing each layer's colour into an
`rgba()` string with the same helper `generate-css.mjs` uses rather than a
second copy of the arithmetic, and `generate-css.mjs` to emit `--shadow*` custom
properties.

- [ ] **Step 3: Replace the hand-maintained stylesheet**

Delete `packages/ui/src/tokens.css` and update `packages/ui/package.json`'s
export map to point `"./tokens.css"` at `./src/tokens.generated.css`, so every
existing consumer keeps working unchanged.

Review the resulting diff against what the old file said. That diff is the
visible consequence of the rulings, and reading it is how anyone checks the
rulings were applied as decided rather than as remembered. Paste it into the
gate record.

- [ ] **Step 4: Run everything**

```bash
pnpm --filter @aktflow/tokens generate
pnpm --filter @aktflow/mobile generate
pnpm turbo run test --concurrency=1 --force
pnpm typecheck
pnpm build
```
Expected: 6/6 or 7/7 tasks depending on whether `@aktflow/mobile` declares a
test script, typecheck 9/9, build unchanged. Report the real test total; the
baseline before B0 was 619 and this slice adds 7.

- [ ] **Step 5: Write the gate record**

Create `docs/superpowers/plans/evidence/2026-08-01-b0-gate.md` with the evidence
table, the three rulings and their reasons, the `tokens.css` replacement diff,
and a section headed "What this slice does not close" containing, plainly:

> The device-install step is NOT DONE. It is blocked on three accounts and two
> devices, and no code closes it.

> The fidelity guard does not catch a wrong-but-consistent value. Once a value
> is in the source, generation makes it consistent everywhere — which is exactly
> how `muted` drifted with its name intact. Only the visual gate catches that
> class.

> Five of seven token categories remain untokenised, by decision. They are
> tokenised in B1 when a screen consumes them.

- [ ] **Step 6: Commit**

```bash
git add packages/tokens packages/ui docs/superpowers/plans/evidence/2026-08-01-b0-gate.md
git commit -m "feat(tokens): rule the three that needed a render, and retire the hand-written stylesheet

line, blue-500 and the shadow ladder could not be decided by a rule. line
differed in KIND between sources, blue-500 had four rendered candidates for one
role, and the shadow ladder had the shipped values pointing one way and the
document's stated intent the other. Each is now recorded with the reason and the
evidence, beside its value.

packages/ui/src/tokens.css is gone and its export now points at generated
output, so the file that drifted from the design document for months cannot
drift again without failing a test. The replacement diff is in the gate record,
because it is the visible consequence of the rulings and reading it is how
anyone checks they were applied as decided."
```

---

## Self-Review

**Spec coverage.** Token source and generators — Task 1. Colour-and-shadow-only
scope — Task 1 (colour) and Task 5 (shadow, after its ruling). The ruling rule
— encoded as the `ruling` field on every entry, Task 1 Step 3. The three pixel
rulings — Task 5, scheduled rather than discovered. RN shape rules (split alpha,
numeric shadow layers named as `BoxShadowValue` names them, no per-platform
approximation in the source) — Task 1 Step 5 and Task 5 Step 2.
The guard and its honest limits — Task 1 Step 1's docstring and Task 5 Step 5.
Copy catalog reconciliation and its guard — Task 2. Expo scaffold with pinned
SDK — Task 3. `eas.json` and procurement recorded-blocked — Task 4. Exit gate —
Task 5 Steps 4 and 5.

**One sequencing change from the spec.** The spec says the three rulings "block
generation". They block *complete* generation. Tasks 1–4 run on the ten decided
colours, so the slice makes progress without the owner present, and Task 5 both
adds the contested values and closes the slice. Doing it the other way would
idle the whole plan behind one meeting.

**Placeholder scan.** One deliberate gap: Task 5 Step 2 cannot state the ruled
values, because they are the owner's to decide at a render. Everything around
them — the shape, the generator changes, the record format — is specified.
Task 3 Step 1 and Step 7 tell the implementer to STOP and report rather than
guess if the SDK or the web start disagrees with the plan.

**Type consistency.** `color` and `colorRaw` and `ColorName` are named
identically in Task 1's interface block, both generators, `src/index.ts`, and
Task 3's screen. `ClientState` in Task 3's `status-labels.ts` lists exactly the
six values Task 2's guard parses from the migration constraint.
`clientStateLabel` is the only accessor and is used once.
