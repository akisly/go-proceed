import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer as createNetServer } from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { launch } from "./browser.mjs";
import { DOVIDKOVYI_DISCLAIMER_TEXT } from "../src/lib/field/disclaimer.ts";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BROWSER PASS FOR apps/mobile — PORT of apps/app/qa/field.mjs. Every
 * helper below that has no reason to differ (the localhost-only safety guard,
 * seedWorld and everything it calls, the Mailpit OTP reader with its
 * labelled-then-stripped extraction, withPage/reportDiagnostics/runAudit,
 * measureSmallTargets, measureHorizontalOverflow) is copied from that file
 * near-verbatim, with only the names/comments touched where this file's own
 * context differs. Read THAT file's header and per-function comments for the
 * full reasoning behind each of those; this header covers only what is
 * actually different here.
 *
 * TWO SERVERS, NOT ONE. apps/app's own harness drives ONE Next server, same
 * origin for pages and API. This client is a static SPA export
 * (`expo export --platform web`) that calls a DIFFERENT origin's `/v1` API
 * over CORS (ADR-009 Plan B/C) — so this file starts TWO servers: apps/app's
 * `next start` (the `/v1` backend, exactly as apps/app's own harness starts
 * it, plus `FIELD_CLIENT_ORIGINS` so the CORS path in `src/lib/cors.ts` is
 * exercised on the real wire, not mocked) and a tiny static file server for
 * `apps/mobile/dist` (the exported SPA). The browser opens the FIELD origin,
 * never the app origin — the app origin exists in this file purely as an API
 * backend.
 *
 * CLIENT-SIDE REDIRECTS, NOT SERVER-SIDE ONES. apps/app's pages are gated by
 * `proxy.ts`, a real HTTP 307 before any HTML is even sent. A static export
 * has no server to run a gate at all: `src/screens/my-assignments.tsx` and
 * `src/screens/assignment.tsx` each own a `useEffect` that calls
 * `requireSession()` after mount and `router.replace()`s to `/login` when it
 * comes back empty — a History API transition, not a navigation. Puppeteer's
 * `waitForNavigation()` does not fire for that (it waits for a real frame
 * navigation), so every redirect assertion below polls
 * `location.pathname`/`document.body.innerText` with `page.waitForFunction`
 * instead.
 *
 * THE CAPTURE PICKER HAS NO PRE-EXISTING `<input type="file">`. apps/app's
 * page renders a real, static `<input>` this whole session long; this
 * client's `ImagePicker.launchCameraAsync` (web) builds one on demand inside
 * the `Pressable`'s own `onPress`, appends it to `document.body`, and
 * dispatches a synthetic click on it — see
 * `node_modules/expo-image-picker/src/ExponentImagePicker.web.ts`
 * (`openFileBrowserAsync`), read for this task. Because the outer click is a
 * real Puppeteer click (a trusted, CDP-level `Input.dispatchMouseEvent`, not
 * a JS-level `.click()`), the browser's transient-activation window survives
 * the synchronous call chain into that inner synthetic click, which is what
 * lets a real file chooser open at all — verified against the same source,
 * not assumed. The capture audit below therefore arms
 * `page.waitForFileChooser()` BEFORE clicking «Додати фото» and, only if that
 * times out, falls back to locating the dynamically-created
 * `input[data-testid="file-input"]` (the exact attribute
 * `openFileBrowserAsync` sets) and calling `ElementHandle.uploadFile()`
 * directly — CDP's `DOM.setFileInputFiles`, which needs no chooser
 * interception at all. Which path actually fired is recorded in the report's
 * `observations.fileInputStrategy`, not silently discarded either way.
 *
 * THE ДОВІДКОВИЙ DISCLAIMER IS IMPORTED, NOT RETYPED A THIRD TIME. It already
 * exists twice — `apps/app/src/lib/statutory-act-form.ts` (source) and
 * `apps/app/qa/field.mjs`'s own hardcoded copy (that file has no TypeScript
 * loader available to it) — and a fourth hand-copied instance is exactly the
 * drift risk `apps/mobile/src/lib/field/disclaimer.ts`'s own header warns
 * about. This file imports the `.ts` module directly instead: Node 24 strips
 * types from a `.ts` file with no enums/namespaces/decorators by default (no
 * flag needed — verified directly against this repo's pinned Node before
 * relying on it), and `disclaimer.ts` is exactly that — one exported string
 * constant, no runtime-only TS syntax. Every OTHER string this file needs
 * (`UNSAVED_PHOTO_WARNING`, the state labels, the button/heading copy) is
 * still hardcoded below, matching `qa/field.mjs`'s own precedent for those —
 * only the disclaimer gets the import, because only the disclaimer's own
 * source file happens to be import-safe AND was the one the task brief named.
 *
 * NEXT_PUBLIC_APP_ORIGIN IS DELIBERATELY NEVER SET FOR `next start` HERE,
 * AND THIS IS NOT THE SAME CLAIM `qa/field.mjs` MAKES ABOUT ITSELF. That
 * file leaves the variable unset at BUILD so `resolveBaseOrigin`
 * (`apps/app/src/lib/api.ts`) reads a live `process.env` value at runtime,
 * because its OWN browser pass navigates to `app/(app)/page.tsx` and
 * `app/(app)/a/[assignmentId]/page.tsx` — Server Components that self-fetch
 * their own `/v1` API and need to resolve their own origin to do it. THIS
 * harness never navigates the browser to either of those routes at all — the
 * field origin's static export owns every page the browser visits, and
 * apps/app here is purely a headless `/v1` API backend. Confirmed by reading,
 * not assumed: `grep -rln 'lib/api"' apps/app/app` finds exactly those two
 * page files importing `apiGet`/`resolveBaseOrigin`; no `/v1/*` route handler
 * does. So `NEXT_PUBLIC_APP_ORIGIN`'s value — whatever a given local build
 * happens to bake in — is inert for every request this file makes, and is
 * left alone rather than engineered around.
 *
 * (This was checked empirically before being trusted: this worktree's
 * `apps/app/.env.local` — written the same day as this task, for `next dev`
 * convenience — sets `NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000`, and
 * Next's own env-file precedence does NOT let an absent OS variable override
 * a `.env.local` entry, so a fresh `next build` bakes that literal in
 * regardless of what this file's own env omits — confirmed by grepping
 * `.next/server` before and after: `process.env.NEXT_PUBLIC_APP_ORIGIN`
 * appears zero times in the built output; `"http://localhost:3000"` does.
 * That would matter for `qa/field.mjs`'s own pass; it does not matter here,
 * for the reason above.)
 *
 * What this harness does NOT cover is in `NOT_COVERED` at the bottom of this
 * file, adapted from `qa/field.mjs`'s own list for this platform.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = path.resolve(__dirname, "..");
const APP_DIR = path.resolve(__dirname, "../../app");
const DIST_DIR = path.join(MOBILE_DIR, "dist");
const OUTPUT = path.join(MOBILE_DIR, "qa-output");
const SHOTS = path.join(OUTPUT, "screenshots");

// ---------------------------------------------------------------------------
// Local-stack configuration — identical defaults to apps/app/qa/field.mjs;
// see that file's own header for why these are stable across every fresh
// local stack and every CI run, and for the 2026-08-19 `sb_publishable_…`/
// `sb_secret_…` migration this repeats verbatim.
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY
  ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

// Refuses to run the moment any of the three points at something that is not
// this machine — same guard, same reasoning as apps/app/qa/field.mjs.
for (const [label, url] of [["EXPO_PUBLIC_SUPABASE_URL", SUPABASE_URL], ["MAILPIT_URL", MAILPIT_URL]]) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    console.error(`qa/field-web.mjs: refusing non-local ${label} (${host}) — this harness's Admin API calls carry a dev-only key.`);
    process.exit(1);
  }
}

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });

// ---------------------------------------------------------------------------
// Two free ports, chosen up front — same "bind to 0, read, release" trick
// apps/app/qa/field.mjs uses for its one port, run twice here: one for
// apps/app's `next start`, one for the static field server. Both are needed
// before EITHER server starts, because the field port must be baked into
// `FIELD_CLIENT_ORIGINS` for the app server, and the app port must be baked
// into `EXPO_PUBLIC_API_ORIGIN` for the exported bundle.
// ---------------------------------------------------------------------------
async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * `expo export --platform web` — produces `apps/mobile/dist`, the exact
 * bundle `vercel.json`'s own `buildCommand` runs for a real deploy (task-6
 * brief context), pointed at THIS run's ephemeral app-server origin via
 * `EXPO_PUBLIC_API_ORIGIN`. Metro inlines all three `EXPO_PUBLIC_*` vars at
 * bundle time (`src/lib/env.ts`'s own header), so this must run BEFORE the
 * field server starts serving `dist/`, and must be re-run on every
 * invocation of this script (an ephemeral port chosen fresh each run cannot
 * be baked into a bundle built on a PRIOR run).
 *
 * `--clear` IS LOAD-BEARING, NOT A SAFETY MARGIN. Found by direct evidence,
 * not assumed: this worktree's `apps/mobile/.env` (gitignored, written for
 * local `expo start --web` convenience) pins
 * `EXPO_PUBLIC_API_ORIGIN=http://localhost:3000`, and `@expo/env`'s own
 * loader (`node_modules/@expo/env/build/index.js`) does NOT let that file
 * override an already-set `process.env` value — confirmed by reading its
 * source. The first several runs of this harness still shipped a bundle
 * hard-wired to `:3000` regardless, and every authenticated `/v1` call from
 * the browser failed with `net::ERR_CONNECTION_REFUSED` against whatever
 * ephemeral port this run had actually chosen. The cause was Metro's own
 * persistent disk cache (`$TMPDIR/metro-cache`), which had memoized an
 * EARLIER export's inlined value and kept serving it across separate
 * process invocations even though the `EXPO_PUBLIC_API_ORIGIN` VALUE passed
 * to each one differed — confirmed by clearing that directory by hand and
 * observing the correct port appear in the bundle immediately afterward.
 * `--clear` is `expo export`'s own documented flag for exactly this
 * ("Clear the bundler cache"); every run of this harness must pass it,
 * because every run bakes in a FRESH ephemeral port that a stale cache
 * cannot know about.
 */
async function exportFieldWeb(apiOrigin) {
  await rm(DIST_DIR, { recursive: true, force: true });
  const stdout = [];
  const stderr = [];
  await new Promise((resolve, reject) => {
    const proc = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "expo", "export", "--platform", "web", "--clear"],
      {
        cwd: MOBILE_DIR,
        env: {
          ...process.env,
          EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
          EXPO_PUBLIC_API_ORIGIN: apiOrigin,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    proc.stdout.on("data", (d) => stdout.push(d.toString()));
    proc.stderr.on("data", (d) => stderr.push(d.toString()));
    proc.once("error", reject);
    proc.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(
        `expo export --platform web exited ${code}\n--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
      ));
    });
  });
}

/**
 * apps/app's `/v1` backend for this run — same shape as
 * apps/app/qa/field.mjs's own `startNextServer`, plus `FIELD_CLIENT_ORIGINS`
 * (this is the whole reason Plan B's CORS path runs for real here rather
 * than being asserted only against a unit test) and an explicit `cwd`
 * (this script's own cwd is `apps/mobile`, not `apps/app` — unlike
 * `qa/field.mjs`, which is invoked FROM `apps/app` and can rely on
 * `process.cwd()`). `NEXT_PUBLIC_APP_ORIGIN` is deliberately absent — see
 * this file's header.
 */
async function startNextServer(port, fieldOrigin) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdout = [];
  const stderr = [];
  const proc = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "next", "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: APP_DIR,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
        FIELD_CLIENT_ORIGINS: fieldOrigin,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  proc.stdout.on("data", (d) => stdout.push(d.toString()));
  proc.stderr.on("data", (d) => stderr.push(d.toString()));

  const deadline = Date.now() + 60_000;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/manifest.webmanifest`);
      if (res.ok) {
        return {
          baseUrl,
          async close() {
            proc.kill("SIGTERM");
            await new Promise((resolve) => proc.once("exit", resolve));
          },
        };
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  proc.kill("SIGTERM");
  throw new Error(
    `next start never became ready on ${baseUrl}: ${lastErr}\n--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
  );
}

// ---------------------------------------------------------------------------
// The static field server — a plain node:http server for `apps/mobile/dist`,
// no external deps. SPA fallback (unknown path → `index.html`) mirrors the
// rewrite `apps/mobile/vercel.json`'s own `buildCommand`/`rewrites` declare
// for the real deploy (task-6 brief context item): expo-router's web export
// resolves every client-side route (`/login`, `/a/{id}`) through History-API
// routing inside the one bundle, so there is no per-route HTML file for a
// dynamic segment like `/a/{id}` to match on disk.
// ---------------------------------------------------------------------------
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".map": "application/json; charset=utf-8",
};

async function startFieldServer(port) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://internal");
      let filePath = path.normalize(path.join(DIST_DIR, decodeURIComponent(url.pathname)));
      // Path-traversal guard: this server has no untrusted client in
      // practice (only this script's own puppeteer instance ever requests
      // anything from it), but staying inside DIST_DIR costs one check.
      if (!filePath.startsWith(DIST_DIR)) filePath = path.join(DIST_DIR, "index.html");

      let st = await stat(filePath).catch(() => null);
      if (!st || !st.isFile()) {
        filePath = path.join(DIST_DIR, "index.html");
        st = await stat(filePath).catch(() => null);
      }
      if (!st) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found — dist/ missing index.html; did expo export run?");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "content-type": MIME_TYPES[ext] ?? "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(err));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// ---------------------------------------------------------------------------
// Seeding — PORTED VERBATIM from apps/app/qa/field.mjs (httpStep,
// authedFetch, lineManifestHash, seedWorld, mintConfirmedUser, deleteUser,
// seedBearerToken, extractOtpCode, readOtpCode). Every request body,
// capability name, and the whole «Приклад-…» naming convention is copied
// unchanged — this drives the SAME `/v1` routes against the SAME local
// Supabase stack apps/app's own harness does, seeding one workspace, one
// project, both parties, a contract, a published baseline with one bound
// photo rule and one work item, and one assignment, so that the resulting
// world is provably identical to what apps/app's own pass verifies. See that
// file's own comments for the full reasoning behind each step; nothing below
// this point differs from it except the error-message prefix
// ("seedWorld: …" stays, since this IS still seedWorld) used to identify
// this file in a stack trace.
// ---------------------------------------------------------------------------
async function httpStep(what, res) {
  const text = await res.text();
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`seedWorld: ${what} returned ${res.status} ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

function authedFetch(baseUrl, bearer) {
  return (urlPath, body, method = body === undefined ? "GET" : "POST") =>
    fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bearer}`,
        ...(method !== "GET" ? { "idempotency-key": crypto.randomUUID() } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}

function lineManifestHash(view) {
  const midpoint = view.pins.roundingPolicy?.midpoint === "half_even" ? "half_even" : "half_up";
  const canonical = JSON.stringify({
    scheme: "goproceed-manual-baseline/2",
    pins: {
      currency: view.pins.currency, taxMode: view.pins.taxMode,
      taxRateBps: view.pins.taxRateBps, midpoint,
    },
    lines: view.workItems.map((w) => [
      w.sourceKey, w.workCode, w.description, w.workTypeKey, w.section,
      w.unitCode, w.unitPrecision, w.contractQuantity,
      w.unitPriceState, w.unitPriceDecimal, w.valuationBasis,
      w.netMinor, w.taxMinor, w.grossMinor,
      w.sourceAmountMinor, w.predecessorWorkItemId,
    ]),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

const PROJECT_NAME = "Приклад-Обʼєкт QA";
const WORK_ITEM_DESCRIPTION = "Приклад-улаштування прокладки кабелю QA";

async function seedWorld(baseUrl, bearer) {
  const f = authedFetch(baseUrl, bearer);

  const ws = await httpStep("workspaces.create",
    await f("/v1/workspaces", { displayName: "Приклад-Об'єкт-простір QA" }));

  const members = await httpStep("members.list", await f(`/v1/workspaces/${ws.workspaceId}/members`));
  const memberId = members.members[0].memberId;

  const proj = await httpStep("projects.create",
    await f(`/v1/workspaces/${ws.workspaceId}/projects`, { name: PROJECT_NAME }));

  await httpStep("access-grants (baseline)", await f(`/v1/projects/${proj.projectId}/access-grants`, {
    memberId, capabilities: ["contracts.edit", "imports.manage", "imports.publish"],
  }));
  await httpStep("access-grants (field)", await f(`/v1/projects/${proj.projectId}/access-grants`, {
    memberId, capabilities: [
      "assignments.manage", "evidence.record", "rule_bindings.manage",
      "requirements.assign", "project.view",
    ],
  }));

  const own = await httpStep("parties.create (own)",
    await f(`/v1/workspaces/${ws.workspaceId}/parties`, { displayName: "Приклад-Власна QA" }));
  await httpStep("legal-profile",
    await f(`/v1/parties/${own.partyId}/legal-profile`, { officialName: "ТОВ Приклад-Власна QA", edrpou: "12345678" }, "PUT"));
  await httpStep("own-profile", await f(`/v1/parties/${own.partyId}/own-profile`, {}));

  const customer = await httpStep("parties.create (customer)",
    await f(`/v1/workspaces/${ws.workspaceId}/parties`, { displayName: "Приклад-Замовник QA" }));

  const contract = await httpStep("contracts.create", await f(`/v1/projects/${proj.projectId}/contracts`, {
    ownPartyId: own.partyId, customerPartyId: customer.partyId, contractNo: "Приклад-Д-QA-1",
    currency: "UAH", taxMode: "exclusive", taxRateBps: 2000,
  }));

  const library = await httpStep("requirement-library.list",
    await f(`/v1/workspaces/${ws.workspaceId}/requirement-library`));
  const item = library.items.find((i) => i.positionCode === "Н.15" && i.itemNo === 1);
  if (!item) throw new Error("seedWorld: workspace library carries no Н.15/1 — did workspaces.create seed it?");

  const ruleVersion = await httpStep("requirement-rule-versions.publish",
    await f(`/v1/workspaces/${ws.workspaceId}/requirement-rule-versions`, {
      workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
      stageKey: "prykhovani-roboty",
      interventionType: "hold",
      blockingScope: "blocks_stage_closure",
      timing: "before_concealment",
      evidenceKind: "photo",
      performerRole: "foreman",
      approverRole: "technical_supervisor",
      allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024 },
      requirementLibraryItemId: item.libraryItemId,
    }));

  const draft = await httpStep("contract-versions.create (draft)",
    await f(`/v1/contracts/${contract.contractId}/versions`, {}));

  const line = await httpStep("work-items.create",
    await f(`/v1/contract-versions/${draft.contractVersionId}/work-items`, {
      sourceKey: "1.1",
      workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
      description: WORK_ITEM_DESCRIPTION,
      unitCode: "м",
      contractQuantity: "10",
      unitPriceState: "known",
      unitPrice: "100.00",
    }));

  await httpStep("rule-bindings.create",
    await f(`/v1/contract-versions/${draft.contractVersionId}/rule-bindings`, {
      ruleVersionIds: [ruleVersion.ruleVersionId],
    }));

  const view = await httpStep("versions.get(1)", await f(`/v1/contracts/${contract.contractId}/versions/1`));
  await httpStep("contract-versions.publish", await f(`/v1/contract-versions/${draft.contractVersionId}/publish`, {
    confirmedManifestHash: lineManifestHash(view),
  }));

  const assignment = await httpStep("assignments.create",
    await f(`/v1/contracts/${contract.contractId}/assignments`, {
      workItemId: line.workItem.workItemId,
      assigneeMemberId: memberId,
    }));

  const mine = await httpStep("assignments.list(?assignee=me)",
    await f(`/v1/projects/${proj.projectId}/assignments?assignee=me`));
  if (!mine.assignments.some((x) => x.assignmentId === assignment.assignmentId)) {
    throw new Error(
      "seedWorld: the assignment just created is not returned by ?assignee=me — "
      + "«Мої доручення» would render its empty state on a world this file believes it seeded.",
    );
  }

  if (assignment.requirementOccurrences.coverage !== "covered" || assignment.requirementOccurrences.occurrenceCount !== 1) {
    throw new Error(`seedWorld: expected one covered occurrence, got ${JSON.stringify(assignment.requirementOccurrences)}`);
  }

  return {
    assignmentId: assignment.assignmentId,
    workspaceId: ws.workspaceId,
    projectName: PROJECT_NAME,
    workItemDescription: WORK_ITEM_DESCRIPTION,
  };
}

async function mintConfirmedUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await httpStep("admin.createUser", res);
  return body.id;
}

async function deleteUser(userId) {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
  } catch {
    // ignored — best-effort, see apps/app/qa/field.mjs's identical comment.
  }
}

async function seedBearerToken(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const body = await httpStep("token(password)", res);
  return body.access_token;
}

function extractOtpCode(text) {
  if (!text) return null;
  const labelled = /code:\s*(\d{6})(?!\d)/i.exec(text);
  if (labelled) return labelled[1];
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, " ");
  const bare = /(?<!\d)(\d{6})(?!\d)/.exec(withoutUrls);
  return bare ? bare[1] : null;
}

async function readOtpCode(email, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastListStatus = null;
  let lastMessageCount = null;
  let lastRecipients = null;

  while (Date.now() < deadline) {
    let res;
    try {
      res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    } catch (err) {
      lastListStatus = `fetch failed: ${err.message}`;
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    lastListStatus = res.status;
    if (res.ok) {
      const { messages } = await res.json();
      lastMessageCount = messages.length;
      lastRecipients = messages.flatMap((m) => m.To.map((t) => t.Address));
      const mine = messages.find((m) => m.To.some((t) => t.Address === email));
      if (mine) {
        const full = await fetch(`${MAILPIT_URL}/api/v1/message/${mine.ID}`);
        if (!full.ok) {
          throw new Error(
            `readOtpCode: found a Mailpit message for ${email} (id ${mine.ID}) but ` +
            `GET /api/v1/message/${mine.ID} returned ${full.status} — cannot read its body to find the code.`,
          );
        }
        const body = await full.json();
        const code = extractOtpCode(body.Text) ?? extractOtpCode(body.HTML) ?? extractOtpCode(mine.Snippet);
        if (code) return code;
        const truncate = (s) => JSON.stringify((s ?? "").slice(0, 200));
        throw new Error(
          `readOtpCode: found a Mailpit message for ${email} (id ${mine.ID}) but no standalone ` +
          `six-digit code could be parsed out of its Text, HTML, or Snippet.\n` +
          `  Text:    ${truncate(body.Text)}\n` +
          `  HTML:    ${truncate(body.HTML)}\n` +
          `  Snippet: ${truncate(mine.Snippet)}`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (typeof lastListStatus !== "number" || lastListStatus < 200 || lastListStatus >= 300) {
    throw new Error(
      `readOtpCode: Mailpit at ${MAILPIT_URL}/api/v1/messages never answered with a 2xx status within ` +
      `${timeoutMs}ms (last result: ${lastListStatus === null ? "never reached — timed out before the first fetch resolved" : lastListStatus}). ` +
      `This is an infrastructure failure, not a sign-in failure — check that Mailpit is actually up.`,
    );
  }
  throw new Error(
    `readOtpCode: Mailpit answered (status ${lastListStatus}) but no message addressed to ${email} arrived ` +
    `within ${timeoutMs}ms. Last poll saw ${lastMessageCount} message(s) in Mailpit, addressed to: ` +
    `${JSON.stringify(lastRecipients)}. This means GoTrue's mail either never reached Mailpit or was sent to a ` +
    `different address than expected — it does NOT mean Mailpit is unreachable or that a code failed to parse.`,
  );
}

// ---------------------------------------------------------------------------
// Page diagnostics — ported verbatim from apps/app/qa/field.mjs. Chrome's own
// favicon.ico probe is named and counted separately rather than failing the
// zero-console-error gate; see that file's identical comment.
// ---------------------------------------------------------------------------
async function withPage(browser, task) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const notFoundUrls = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleErrors.push({ text: msg.text(), url: msg.location()?.url ?? null });
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("response", (res) => {
    if (res.status() === 404) notFoundUrls.push(res.url());
  });
  try {
    await task(page);
  } finally {
    await page.close();
  }
  return { consoleErrors, pageErrors, notFoundUrls };
}

function reportDiagnostics(label, diagnostics, findings, missingAssets) {
  const knownMissing = new Set(diagnostics.notFoundUrls.filter((u) => u.endsWith("/favicon.ico")));
  for (const url of knownMissing) missingAssets.push(url);
  for (const url of diagnostics.notFoundUrls) {
    if (!knownMissing.has(url)) findings.push(`${label}: unexpected 404 for ${url}`);
  }
  for (const err of diagnostics.consoleErrors) {
    if (err.url && knownMissing.has(err.url)) continue;
    findings.push(`${label}: console error: ${err.text}`);
  }
  for (const err of diagnostics.pageErrors) findings.push(`${label}: uncaught page error: ${err}`);
}

/** WCAG 2.5.5's 44×44 CSS px floor — ported verbatim from apps/app/qa/field.mjs. */
async function measureSmallTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("a, button, input, select, textarea")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.textContent || el.getAttribute("type") || el.tagName).trim().slice(0, 32),
          w: Math.round(r.width), h: Math.round(r.height),
        };
      })
      .filter((r) => r.h > 0 && (r.h < 44 || r.w < 44)));
}

/** No sideways scroll on a phone — ported verbatim from apps/app/qa/field.mjs. */
async function measureHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    if (overflow <= 1) return null;
    const widest = [...document.querySelectorAll("body *")]
      .map((el) => ({ el, right: el.getBoundingClientRect().right }))
      .filter((x) => x.right > doc.clientWidth + 1)
      .sort((a, b) => b.right - a.right)[0];
    return {
      overflow,
      viewport: doc.clientWidth,
      offender: widest
        ? `<${widest.el.tagName.toLowerCase()} class="${widest.el.className}"> extends to ${Math.round(widest.right)}px`
        : "no single element identified",
    };
  });
}

// ---------------------------------------------------------------------------
// Strings this file asserts on but has no import-safe source for — hardcoded
// with a citation to the source of truth, same convention
// apps/app/qa/field.mjs uses for its own copies of these same catalog
// entries. `UNSAVED_PHOTO_WARNING`/state labels: byte-identical between
// apps/app/src/lib/capture/state.ts and apps/mobile/src/lib/capture/state.ts
// (both cite copy-catalog.csv as their source; ADR-009 duplication, same as
// the disclaimer). `apps/mobile/src/lib/status-labels.generated.json` is the
// mobile catalog's own generated output for `CLIENT_STATE_LABEL`.
// ---------------------------------------------------------------------------
const UNSAVED_PHOTO_WARNING =
  "GoProceed не зберіг це фото. Зробіть його ще раз або збережіть у себе.";
const STATE_LABEL_SENDING = "Надсилання"; // status.client_state.sending
const STATE_LABEL_FAILED = "Потрібна дія"; // status.client_state.failed

/** A minimal but genuine JPEG (SOI + APP0), identical to apps/app/qa/field.mjs's fixture. */
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

const EXPECTED_AUDITS = [
  "unauthenticated surface",
  "sign-in",
  "my assignments list",
  "obligation screen",
  "capture in-flight banner",
];

/** Same belt-and-braces shape as apps/app/qa/field.mjs's `runAudit` — see its own header comment. */
async function runAudit(ctx, name, fn) {
  ctx.auditsRun.add(name);
  try {
    await fn();
  } catch (err) {
    ctx.findings.push(`${name}: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const ctx = { findings: [], missingAssets: [], auditsRun: new Set(), observations: {} };

  const appPort = await getFreePort();
  const fieldPort = await getFreePort();
  // "127.0.0.1", NOT "localhost" — DELIBERATE DEVIATION FROM THE TASK
  // BRIEF'S OWN LITERAL WORDING (apps/mobile/.env.example and
  // apps/app/.env.local's FIELD_CLIENT_ORIGINS entry both write
  // "http://localhost:…", a human-dev convenience convention, and the first
  // draft of this file matched it). Verified, not assumed: this machine's
  // resolver returns "localhost" as BOTH `::1` (first) and `127.0.0.1`
  // (`dns.lookup('localhost', {all:true})`), while `next start -H
  // 127.0.0.1` (below) binds ONLY the IPv4 loopback — Chromium's Happy-
  // Eyeballs race against the two addresses produced a bare
  // `ERR_CONNECTION_REFUSED` on every cross-origin `/v1` fetch the FIRST
  // time this harness ran with "localhost", reproducibly. `127.0.0.1`
  // everywhere below removes the ambiguity outright, matching
  // apps/app/qa/field.mjs's own already-proven convention for its one
  // server. The two values must still be byte-identical to what the browser
  // sends as `Origin` — they are, since both the bundle's
  // `EXPO_PUBLIC_API_ORIGIN` and the field server's own `baseUrl` are built
  // from these same two constants.
  const appApiOrigin = `http://127.0.0.1:${appPort}`;
  const fieldOrigin = `http://127.0.0.1:${fieldPort}`;

  await exportFieldWeb(appApiOrigin);
  const appServer = await startNextServer(appPort, fieldOrigin);
  const fieldServer = await startFieldServer(fieldPort);
  const browser = await launch();
  let userId;

  try {
    // ── Unauthenticated surface ──────────────────────────────────────────
    await runAudit(ctx, "unauthenticated surface", async () => {
      await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        const res = await page.goto(`${fieldServer.baseUrl}/`, { waitUntil: "networkidle0" });
        // Loading over the static server at all is the manifest check's
        // replacement — a static SPA export carries no
        // manifest.webmanifest (task-6 brief: "manifest check N/A for SPA
        // export").
        if (!res || res.status() !== 200) {
          ctx.findings.push(`unauthenticated /: expected 200 from the static server, got ${res ? res.status() : "no response"}`);
        }

        // CLIENT-SIDE REDIRECT, NOT A SERVER ONE — this file's header
        // explains why waitForNavigation() would not fire here at all.
        const redirected = await page.waitForFunction(
          () => location.pathname === "/login", { timeout: 5_000 },
        ).then(() => true).catch(() => false);
        const finalUrl = page.url();
        if (!redirected) {
          ctx.findings.push(`unauthenticated /: expected a client-side redirect to /login, landed on ${finalUrl}`);
        }

        const bodyText = await page.evaluate(() => document.body.innerText);
        if (!bodyText.includes("Вхід за одноразовим кодом")) {
          ctx.findings.push('login screen: expected copy "Вхід за одноразовим кодом" not found');
        }

        // The viewport meta, measured and RECORDED regardless of verdict
        // (task-6 brief: "measure the viewport meta and REPORT what is
        // there") — a violation (a zoom cap) is additionally a finding, not
        // hidden either way.
        const viewport = await page.evaluate(() =>
          document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null);
        ctx.observations.viewportMeta = viewport;
        if (viewport === null) {
          ctx.findings.push('no <meta name="viewport"> found');
        } else {
          if (!/width=device-width/.test(viewport)) {
            ctx.findings.push(`viewport meta "${viewport}" does not declare width=device-width`);
          }
          if (/maximum-scale|user-scalable\s*=\s*no/.test(viewport)) {
            ctx.findings.push(`viewport meta "${viewport}" caps zoom — this must never ship`);
          }
        }

        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        const small = await measureSmallTargets(page);
        for (const t of small) {
          ctx.findings.push(`login @375: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
        }
        const overflow = await measureHorizontalOverflow(page);
        if (overflow) {
          ctx.findings.push(`login @375: the page scrolls sideways by ${overflow.overflow}px (viewport ${overflow.viewport}px) — ${overflow.offender}`);
        }

        await page.screenshot({ path: path.join(SHOTS, "login.png"), fullPage: true });
      }).then((d) => reportDiagnostics("unauthenticated /", d, ctx.findings, ctx.missingAssets));
    });

    // ── Seed a user, a session, and the world the obligation screen needs ──
    const stamp = Date.now();
    const email = `pryklad-qa-mobile-${stamp}@example.test`;
    const password = `Приклад-QA-Пароль-${stamp}!`;
    let assignmentId;
    let projectName;
    let workItemDescription;
    try {
      userId = await mintConfirmedUser(email, password);
      const seedBearer = await seedBearerToken(email, password);
      ({ assignmentId, projectName, workItemDescription } = await seedWorld(appServer.baseUrl, seedBearer));

      if (typeof assignmentId !== "string" || assignmentId.length === 0) {
        ctx.findings.push(
          `seedWorld returned successfully but assignmentId is invalid (${JSON.stringify(assignmentId)}) — ` +
          "assignments.create may have regressed; the authenticated audits below will still run and report their own failures against this value",
        );
      }
    } catch (err) {
      ctx.findings.push(`seeding a user + world failed, authenticated screens will attempt to run anyway and report their own failures: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }

    // ── Sign-in, via the real /login screen ─────────────────────────────
    await runAudit(ctx, "sign-in", async () => {
      const loginDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        await page.goto(`${fieldServer.baseUrl}/login?next=${encodeURIComponent(`/a/${assignmentId}`)}`,
          { waitUntil: "networkidle0" });

        await page.type("#otp-email", email);
        await Promise.all([
          page.waitForSelector("#otp-code"),
          page.click('[data-testid="otp-email-submit"]'),
        ]);

        const code = await readOtpCode(email);
        await page.type("#otp-code", code);
        await page.click('[data-testid="otp-code-submit"]');

        // CLIENT-SIDE NAVIGATION AGAIN — Login's `onSignedIn` calls
        // `router.replace(safeNext(...))`, a History transition, not a real
        // navigation. Poll rather than `waitForNavigation()`.
        await page.waitForFunction(
          (expected) => location.pathname === expected,
          { timeout: 10_000 },
          `/a/${assignmentId}`,
        ).catch(() => {});

        const landedOn = new URL(page.url()).pathname;
        if (landedOn !== `/a/${assignmentId}`) {
          ctx.findings.push(`sign-in: expected to land on /a/${assignmentId} (via ?next=), landed on ${landedOn}`);
        }
      });
      reportDiagnostics("sign-in", loginDiagnostics, ctx.findings, ctx.missingAssets);
    });

    // ── «Мої доручення» ───────────────────────────────────────────────────
    await runAudit(ctx, "my assignments list", async () => {
      const listDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        const res = await page.goto(`${fieldServer.baseUrl}/`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/: expected 200 for the signed-in list, got ${res ? res.status() : "no response"}`);
          return;
        }

        // requireSession()/loadMyAssignments() both run in a post-mount
        // effect — wait for either the heading or a bounce back to /login
        // rather than reading the DOM the instant networkidle0 fires.
        await page.waitForFunction(
          () => document.body.innerText.includes("Мої доручення") || location.pathname === "/login",
          { timeout: 10_000 },
        ).catch(() => {});

        const landedOn = new URL(page.url()).pathname;
        if (landedOn !== "/") {
          ctx.findings.push(`/: a signed-in foreman was redirected to ${landedOn} instead of seeing his list`);
          return;
        }

        const bodyText = await page.evaluate(() => document.body.innerText);

        if (!bodyText.includes("Мої доручення")) {
          ctx.findings.push('/: expected the heading "Мої доручення", not found');
        }

        if (!bodyText.includes(workItemDescription)) {
          ctx.findings.push(`/: the seeded assignment ("${workItemDescription}") is not on the list — the projects→assignments fan-out or ?assignee=me may have regressed`);
        }

        for (const wrong of [
          "У вас немає доступу до жодного проєкту",
          "Наразі за вами не закріплено жодного доручення",
          "Не вдалося завантажити ваші доручення",
        ]) {
          if (bodyText.includes(wrong)) {
            ctx.findings.push(`/: rendered "${wrong}" although one assignment was seeded for this member`);
          }
        }

        if (bodyText.includes(projectName)) {
          ctx.findings.push(`/: the project name ("${projectName}") is shown although only one project contributes rows — showProjectName should be false`);
        }

        // The row must be a link to the obligation screen — `a[href^="/a/"]`
        // (task-6 brief), asserted here as the exact match, which is a
        // strictly narrower, still-satisfying case of that prefix.
        const href = `/a/${assignmentId}`;
        const linked = await page.evaluate(
          (h) => [...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === h), href);
        if (!linked) {
          ctx.findings.push(`/: no <a href="${href}"> — the row does not link to its obligation screen`);
        }

        const small = await measureSmallTargets(page);
        for (const t of small) {
          ctx.findings.push(`/ @375: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
        }
        const overflow = await measureHorizontalOverflow(page);
        if (overflow) {
          ctx.findings.push(`/ @375: the page scrolls sideways by ${overflow.overflow}px (viewport ${overflow.viewport}px) — ${overflow.offender}`);
        }

        await page.screenshot({ path: path.join(SHOTS, "my-assignments.png"), fullPage: true });
      });
      reportDiagnostics("my assignments list", listDiagnostics, ctx.findings, ctx.missingAssets);
    });

    // ── The obligation screen ────────────────────────────────────────────
    await runAudit(ctx, "obligation screen", async () => {
      const obligationDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        const res = await page.goto(`${fieldServer.baseUrl}/a/${assignmentId}`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/a/${assignmentId}: expected 200, got ${res ? res.status() : "no response"} — was the session carried over?`);
          return;
        }

        // requireSession()/fetchOccurrences() both run post-mount.
        await page.waitForFunction(
          () => document.body.innerText.trim().length > 0, { timeout: 10_000 },
        ).catch(() => {});

        // THE ДОВІДКОВИЙ DISCLAIMER — three checks, not one. Ported verbatim
        // from apps/app/qa/field.mjs (see its own comment for the full
        // reasoning): a closed-<details> case passes a naive
        // computed-style walk but fails checkVisibility()/innerText; an
        // overflow:hidden case passes those two but is caught by the
        // ancestor-box walk. Either flagging is a finding. `p, div, span`
        // covers react-native-web's `Text` output (a `<div>` at the top
        // level, unless nested inside another `Text`).
        const disclaimerCheck = await page.evaluate((expectedText) => {
          const all = [...document.querySelectorAll("p, div, span")];
          const el = all.find((e) => (e.textContent ?? "").trim() === expectedText.trim());
          if (!el) return { found: false };

          const renderedByEngine =
            (typeof el.checkVisibility === "function" ? el.checkVisibility() : true)
            && document.body.innerText.includes(expectedText.trim());

          const rect = el.getBoundingClientRect();
          let node = el;
          let clippedBy = null;
          while (node && node !== document.body) {
            const s = getComputedStyle(node);
            const nodeRect = node.getBoundingClientRect();
            if (s.overflow === "hidden" || s.overflowY === "hidden") {
              if (nodeRect.height <= 0 || rect.bottom > nodeRect.bottom + 1 || rect.top < nodeRect.top - 1) {
                clippedBy = `${node.tagName}.${node.className} (overflow:hidden, ${Math.round(nodeRect.height)}px)`;
                break;
              }
            }
            node = node.parentElement;
          }
          return { found: true, renderedByEngine, clippedBy };
        }, DOVIDKOVYI_DISCLAIMER_TEXT);

        if (!disclaimerCheck.found) {
          ctx.findings.push("obligation screen: довідковий disclaimer text not found verbatim anywhere on the page");
        } else if (!disclaimerCheck.renderedByEngine) {
          ctx.findings.push("obligation screen: довідковий disclaimer is present in the DOM but not genuinely rendered (checkVisibility()/document.body.innerText both say it is not shown)");
        } else if (disclaimerCheck.clippedBy) {
          ctx.findings.push(`obligation screen: довідковий disclaimer is clipped by an ancestor — ${disclaimerCheck.clippedBy}`);
        }

        const small = await measureSmallTargets(page);
        for (const t of small) {
          ctx.findings.push(`/a/${assignmentId} @375: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
        }
        const overflow = await measureHorizontalOverflow(page);
        if (overflow) {
          ctx.findings.push(`/a/${assignmentId} @375: the page scrolls sideways by ${overflow.overflow}px (viewport ${overflow.viewport}px) — ${overflow.offender}`);
        }

        // Defensive net, same as apps/app/qa/field.mjs's identical check —
        // this client has no source string matching it at all (grepped),
        // so this should trivially pass; kept so a future accidental
        // reintroduction is still caught.
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.includes("Збережено на пристрої")) {
          ctx.findings.push('obligation screen: renders the forbidden claim "Збережено на пристрої"');
        }

        await page.screenshot({ path: path.join(SHOTS, "obligation.png"), fullPage: true });
      });
      reportDiagnostics("obligation screen", obligationDiagnostics, ctx.findings, ctx.missingAssets);
    });

    // ── The unsaved-photo banner: in-flight, then after a failure ────────
    await runAudit(ctx, "capture in-flight banner", async () => {
      const captureDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        await page.evaluateOnNewDocument(() => {
          const realFetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : input.url;
            if (url.includes("/upload-intents") && init?.method === "POST") {
              await new Promise((resolve) => setTimeout(resolve, 700));
              return new Response(JSON.stringify({
                code: "INTERNAL_ERROR", detail: "QA-stubbed failure (qa/field-web.mjs)",
                userAction: "retry_later", retryable: true, requestId: "qa-stub",
              }), { status: 500, headers: { "content-type": "application/problem+json" } });
            }
            return realFetch(input, init);
          };
        });

        const res = await page.goto(`${fieldServer.baseUrl}/a/${assignmentId}`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`capture pass: expected 200 on /a/${assignmentId}, got ${res ? res.status() : "no response"}`);
          return;
        }
        await page.waitForFunction(
          () => document.body.innerText.trim().length > 0, { timeout: 10_000 },
        ).catch(() => {});

        const captureButton = await page.$('button[data-testid^="capture-"]');
        if (!captureButton) {
          ctx.findings.push('capture pass: no button[data-testid^="capture-"] found on the obligation screen — is there a photo-evidenceKind occurrence?');
          return;
        }

        // AT REST, NOTHING IS AT RISK — same assertion, same reasoning as
        // apps/app/qa/field.mjs: a screen merely opened must show neither
        // the banner nor the discard control.
        const bodyTextAtRest = await page.evaluate(() => document.body.innerText);
        if (bodyTextAtRest.includes(UNSAVED_PHOTO_WARNING)) {
          ctx.findings.push(`capture pass: the unsaved-photo banner ("${UNSAVED_PHOTO_WARNING}") is on screen before any file has been picked — serverDoesNotHaveThePhoto has lost its hasPickedFile term`);
        }
        if (bodyTextAtRest.includes("Скасувати фото")) {
          ctx.findings.push('capture pass: the "Скасувати фото" control is offered before any file has been picked — there is nothing to discard');
        }

        // THE PICKER — see this file's header for why both paths exist.
        // `page.waitForFileChooser()` is armed BEFORE the click that
        // triggers `ImagePicker.launchCameraAsync`'s synchronous synthetic
        // click on its own hidden `<input>`; only if the chooser is never
        // intercepted does this fall back to the input element directly.
        const jpegPath = path.join(OUTPUT, "фото.jpg");
        await writeFile(jpegPath, JPEG_BYTES);

        let fileInputStrategy;
        const chooserPromise = page.waitForFileChooser({ timeout: 5_000 }).catch(() => null);
        await captureButton.click();
        const chooser = await chooserPromise;
        if (chooser) {
          fileInputStrategy = "fileChooser";
          await chooser.accept([jpegPath]);
        } else {
          fileInputStrategy = "inputFallback";
          // `data-testid="file-input"` is the exact attribute
          // `openFileBrowserAsync` (expo-image-picker's web implementation)
          // sets on the hidden input it appends to document.body — see this
          // file's header.
          const fileInput = await page.$('input[data-testid="file-input"]');
          if (!fileInput) {
            ctx.findings.push('capture pass: neither a file chooser nor input[data-testid="file-input"] appeared after clicking «Додати фото»');
            return;
          }
          await fileInput.uploadFile(jpegPath);
        }
        ctx.observations.fileInputStrategy = fileInputStrategy;

        // THE UNAMBIGUOUS IN-FLIGHT PROOF — «Надсилання» is the "sending"
        // state's own label (status-labels.generated.json), set as
        // `uploadCapture`'s very first line, independent of the network
        // stub's 700ms hold.
        const reachedSending = await page.waitForFunction(
          (label) => document.body.innerText.includes(label), { timeout: 2_000 }, STATE_LABEL_SENDING,
        ).then(() => true).catch(() => false);
        if (!reachedSending) {
          ctx.findings.push(`capture pass: expected the "sending" state label ("${STATE_LABEL_SENDING}") after picking a file — the upload never appears to have started`);
        }

        const bannerUpWhileInFlight = await page.evaluate(
          (expected) => document.body.innerText.includes(expected), UNSAVED_PHOTO_WARNING);
        if (!bannerUpWhileInFlight) {
          ctx.findings.push(`capture pass: unsaved-photo banner ("${UNSAVED_PHOTO_WARNING}") is not visible while the upload is in flight ("${STATE_LABEL_SENDING}")`);
        }

        // THE BANNER MUST PERSIST AFTER A FAILURE, NOT JUST DURING FLIGHT —
        // `serverDoesNotHaveThePhoto` (state.ts) is true at "failed" too;
        // asserted only after the failure label actually appears, so this
        // cannot pass on the in-flight render alone.
        const reachedFailed = await page.waitForFunction(
          (label) => document.body.innerText.includes(label), { timeout: 5_000 }, STATE_LABEL_FAILED,
        ).then(() => true).catch(() => false);
        if (!reachedFailed) {
          ctx.findings.push(`capture pass: expected the "failed" state label ("${STATE_LABEL_FAILED}") after the stubbed failure, not found`);
        }

        const bodyTextAfter = await page.evaluate(() => document.body.innerText);
        if (!bodyTextAfter.includes(UNSAVED_PHOTO_WARNING)) {
          ctx.findings.push(`capture pass: the unsaved-photo banner ("${UNSAVED_PHOTO_WARNING}") is gone after the upload FAILED — it must persist on every failed or abandoned in-flight upload`);
        }
        if (!bodyTextAfter.includes("QA-stubbed failure")) {
          ctx.findings.push("capture pass: the server-supplied problem `detail` is not rendered after a failed upload — the foreman is told the photo is unsaved but not why");
        }
        if (bodyTextAfter.includes("Збережено на пристрої")) {
          ctx.findings.push('capture pass: renders the forbidden claim "Збережено на пристрої" after a failed upload');
        }

        await page.screenshot({ path: path.join(SHOTS, "capture-failed.png"), fullPage: true });
      });
      reportDiagnostics("capture in-flight banner", captureDiagnostics, ctx.findings, ctx.missingAssets);
    });

    for (const name of EXPECTED_AUDITS) {
      if (!ctx.auditsRun.has(name)) {
        ctx.findings.push(`expected audit "${name}" never ran — see EXPECTED_AUDITS/runAudit in qa/field-web.mjs`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    const NOT_COVERED = [
      "beforeunload is not exercised in the browser, for the same reason apps/app/qa/field.mjs's " +
      "identical entry names: headless Chrome's handling of the dialog is version-dependent and " +
      "Puppeteer cannot reliably assert on it. The decision function itself (guardBeforeUnload/" +
      "holdsUnsavedBytes, apps/mobile/src/lib/capture/state.ts) is unit-tested with no DOM in " +
      "state.test.ts; the wiring (capture.tsx's useEffect) has no browser coverage here either.",
      "No colour-contrast (WCAG AA) scan and no screen-reader pass — same limitation " +
      "apps/app/qa/field.mjs and apps/demo/qa/verify.mjs both state about themselves.",
      "Only ONE occurrence shape is exercised end to end (evidenceKind=photo, coverage=covered, " +
      "exactly one occurrence). The refusal branches and a multi-occurrence assignment are covered " +
      "by apps/mobile/src/lib/field/obligations.test.ts with no browser, not by this file.",
      "The discard control (\"Скасувати фото\") is asserted ABSENT at rest but never clicked here, " +
      "and the successful-upload receipt path (server_confirmed) is not driven in the browser — " +
      "only the failure path this harness's assertions are about. Both are covered without a " +
      "browser in apps/mobile/src/lib/capture/upload.test.ts and attempt.test.ts.",
      "No real device/OS was used — headless Chrome via puppeteer only, no Safari/iOS, no physical " +
      "gloved-hand touch input, and the NATIVE camera path (Platform.OS !== \"web\") is entirely " +
      "unreached — this build is web-first only (AGENTS.md); native capture is v0.3 TODO work.",
      "The seeded Auth user is deleted after the run (best-effort); the workspace/project/contract " +
      "rows it created under \"Приклад-*\" names are NOT deleted — harmless synthetic data, same " +
      "convention as apps/app/qa/field.mjs's identical entry.",
      "expo export's own build correctness (bundler warnings, asset hashing, tree-shaking) is not " +
      "separately audited here — only that the exported dist/ serves and behaves correctly once " +
      "running; `pnpm --filter @goproceed/mobile typecheck`/`test` are the build-correctness gates.",
    ];

    const report = {
      ok: ctx.findings.length === 0,
      generatedAt: new Date().toISOString(),
      baseUrl: fieldServer.baseUrl,
      appServerBaseUrl: appServer.baseUrl,
      assignmentAudited: assignmentId ?? null,
      auditsRun: [...ctx.auditsRun],
      expectedAudits: EXPECTED_AUDITS,
      findings: ctx.findings,
      missingAssets: [...new Set(ctx.missingAssets)],
      observations: ctx.observations,
      notCovered: NOT_COVERED,
    };
    await writeFile(path.join(OUTPUT, "qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);

    if (!report.ok) {
      console.error(ctx.findings.join("\n"));
      process.exitCode = 1;
      return;
    }
    console.log(
      `QA passed: ${report.auditsRun.length} of ${EXPECTED_AUDITS.length} expected audits ran (${report.auditsRun.join(", ")}), zero findings. ` +
      "See qa-output/qa-report.json for the full report and qa-output/screenshots/ for evidence.",
    );
  } finally {
    if (userId) await deleteUser(userId);
    await browser.close();
    await appServer.close();
    await fieldServer.close();
  }
}

await main();
