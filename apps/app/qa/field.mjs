import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import { launch } from "./browser.mjs";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BROWSER PASS FOR apps/app — modelled on apps/demo/qa/verify.mjs, but a
 * genuinely different animal underneath it. apps/demo serves a prebuilt
 * static SPA; apps/app is a Next server whose pages are gated by
 * `proxy.ts` (the auth gate, `middleware.ts` until 2026-08-19) and render real
 * data through `/v1`. Most of what this file
 * exists to prove — the довідковий disclaimer, the 44px touch floor on the
 * obligation screen, the unsaved-photo banner — lives BEHIND that gate.
 *
 * ITS NAME IS `field.mjs` AND IT IS NO LONGER ONLY THE FIELD PASS (2026-08-22,
 * Plan D slice D0 task 3). It now also drives the OFFICE DASHBOARD at `/`
 * — the profile control's reachability in the icon-rail band, the mobile
 * drawer's geometry, and the sign-out flow end to end, including the session
 * cookies before and after and the Back press afterwards. The file keeps its
 * name because renaming it would break `apps/app/package.json`'s `qa` script,
 * `.github/workflows/ci.yml`'s `app-qa` job and every reference in the runbook
 * for no gain; this paragraph is here so the name does not quietly become a
 * lie about the coverage, which is the failure mode this repository's docs
 * gate exists to prevent.
 *
 * AND SINCE 2026-08-22 (Plan D slice D1 task 7) IT ALSO DRIVES THE EXTERNAL
 * PLANE — the surface no browser had ever opened. Before this change, every
 * claim `app/external/review/route.ts` made about itself was unverified by its
 * own admission («this page has never been served, never been opened in a
 * browser, and the exchange it performs has never run»). The seventh audit
 * closes the whole loop in one pass: it seeds ONE REAL, AVAILABLE evidence
 * object through the product's own three capture routes, opens
 * `/assignments/{id}` and asserts the photo DECODED (`naturalWidth > 0`,
 * never a screenshot), presses «Відправити на перевірку» and reads the
 * one-time link off the screen, then opens that link in a SECOND BROWSER
 * CONTEXT WITH ITS OWN EMPTY COOKIE JAR, taps the gate, and asserts the same
 * photo decoded there — with the absence of every `sb-` cookie asserted in
 * that context, so the pass is about the no-account path and not about the
 * signed-in one wearing a different URL.
 *
 * WHAT THAT ADDS TO THE SERVER SIDE, so the header does not overclaim: the
 * exchange, the fragment strip, the external session cookie over a loopback
 * origin, `GET /external/occurrence` and `GET /external/evidence` have all now
 * RUN IN A BROWSER. The DECIDE path has not — the audit issues a view-only
 * grant, because the screen that issues it cannot name an occurrence's
 * approver role (`grants.service.ts` carries the whole reason) — so accept and
 * return are still Node-only, in `m5-external.int.test.ts`.
 *
 * AND SINCE PLAN D SLICE D2 IT ALSO DRIVES THE MONEY SCREEN —
 * `/projects/{projectId}`, the blocked-value read the subcontractor
 * owner actually asks for (`docs/design/04-role-pain-map.md`'s own account
 * of the demand scan). Opens the route with the real seeded world's
 * `readiness.view` grant, asserts the headline sum, the blocked-reasons
 * list, the one-line cause split and the «Доручення» link's `href` against
 * real seeded data, then repeats the overflow/touch-target pass this file
 * already runs against the register one step further down the chain. What
 * it does NOT drive — the unvalued register, the 403/404 refusal branches,
 * the good-news empty state — is named in `NOT_COVERED`, not left implicit.
 *
 * THE BOUNDARY, STATED PLAINLY (task-11-brief.md context item 3 asks for
 * this twice — once here, once in the report). This harness goes all the way:
 * it mints a real Supabase Auth user through the local Admin HTTP API (the
 * same mechanism task 5's report verified by hand), drives that user through
 * the REAL email-OTP login screen — typing an address, reading the six-digit
 * code back out of the local Mailpit inbox, typing the code — and then
 * exercises the real, data-backed obligation screen the way a foreman
 * actually reaches it: by creating a workspace, a project, both parties, a
 * contract, a published baseline with one bound rule and one work item, and
 * one assignment, over the SAME `/v1` routes the product exposes — never a
 * raw SQL insert standing in for what a route would have done. That chain is
 * not invented for this file: it mirrors, call for call,
 * `apps/app/tests/helpers/fixtures.ts`'s `baselineFixture` and
 * `apps/app/tests/helpers/manual-baseline.ts`, and
 * `apps/app/tests/field-capture.int.test.ts`'s own `boundOccurrence()` — the
 * three places this exact sequence is already proven to produce one
 * materialised, photo-evidenceKind requirement occurrence.
 *
 * What this harness does NOT cover, and why, is in `NOT_COVERED` at the
 * bottom of this file — read it before trusting a green run to mean more
 * than it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * EVERY PATH BELOW IS DERIVED FROM THIS FILE, NOT FROM THE CWD.
 *
 * `OUTPUT` was `path.resolve("qa-output")` and `startNextServer` spawned with
 * `cwd: process.cwd()`, so this harness only ran when the shell already stood
 * in `apps/app`. Run the exact command the task brief and the gate name —
 * `node apps/app/qa/field.mjs` from the repository root — and `pnpm exec next`
 * resolved against the root workspace instead, dying with «Command "next" not
 * found»: a message that names the wrong cause entirely and sends the reader
 * looking for a missing dependency. CI never hit it because it runs
 * `pnpm --filter @goproceed/app qa`, which sets the cwd for you.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(APP_DIR, "qa-output");
const SHOTS = path.join(OUTPUT, "screenshots");

// ---------------------------------------------------------------------------
// Local-stack configuration. Every default below is the FIXED local dev value
// `supabase start` produces from this repo's supabase/config.toml (the JWT
// signing secret there is the CLI's own unconfigured default,
// "super-secret-jwt-token-with-at-least-32-characters-long" — not overridden
// by an env(...) substitution anywhere in config.toml), so the keys below are
// stable across every fresh local stack and every CI run of this repo, the
// same way scripts/set-local-app-password.mjs defaults its own dev-only
// passwords. Every one of them is overridable by env var for a stack that ever
// does override the secret.
//
// `sb_publishable_…` / `sb_secret_…` SINCE 2026-08-19, not the legacy
// anon/service_role JWTs this block used to carry. The local CLI (even 2.75.0)
// issues both forms — `supabase status` shows PUBLISHABLE_KEY and SECRET_KEY
// beside ANON_KEY and SERVICE_ROLE_KEY — and these are the two it issues,
// verbatim. The legacy JWTs stop working at the end of 2026; the app's SDK is
// now 2.112, which handles the new family explicitly. This harness drives a
// REAL OTP sign-in through the real login screen, so it is the proof that the
// new-format key works end to end on the installed SDK.
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY
  ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
// The superuser connection `tests/helpers/fixtures.ts`'s `ADMIN_URL` also
// uses, for the same reason: the "assignment creation" audit's proof is a
// ROW COUNT, not a route response, and a route response is exactly what a
// route that agreed with itself while writing nothing (or writing twice)
// would still return correctly.
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Refuses to run the moment any of the four points at something that is not
// this machine — the same guard scripts/set-local-app-password.mjs makes,
// for the same reason: the values above are dev-only secrets, safe ONLY
// because nothing reachable from outside this machine trusts them.
for (const [label, url] of [
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL], ["MAILPIT_URL", MAILPIT_URL],
  ["SUPABASE_DB_URL", SUPABASE_DB_URL],
]) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    console.error(`qa/field.mjs: refusing non-local ${label} (${host}) — this harness's Admin API calls carry a dev-only key.`);
    process.exit(1);
  }
}

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });

// ---------------------------------------------------------------------------
// Next server lifecycle. `next start` has no `--port 0` (unlike the plain
// node http server apps/demo's verify.mjs binds with `listen(0, ...)`), so an
// ephemeral port is reserved by binding a throwaway net server to port 0,
// reading the OS-assigned port back, and closing it immediately before
// handing that number to `next start -p`. There is a small window between
// that close and Next's own bind where another process on the runner could
// take the same port; accepted here the same way `getFreePort`-style helpers
// are accepted elsewhere, because the alternative — a fixed port — is worse
// (two concurrent local runs, or a leftover process from a prior crashed
// run, collide deterministically instead of by chance).
async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Every detached server group this process has started and not yet stopped.
 * See the `detached` note inside `startNextServer` for why this exists at all.
 */
const serverGroups = new Set();

function killAllServerGroups(signal) {
  for (const proc of serverGroups) {
    try {
      process.kill(-proc.pid, signal);
    } catch {
      /* already gone */
    }
  }
}

// `exit` can only run synchronous work, and `process.kill` is synchronous, so
// this is the last-resort net for an uncaught throw. The signal handlers
// re-raise with the conventional 128+n code rather than swallowing the signal.
//
// SIGHUP IS IN THE LIST AND IT IS THE ONE THAT MATTERS MOST HERE. A signal
// whose default disposition is to terminate does not run `exit` listeners
// unless a handler is installed for it — so before this line, closing the
// terminal or dropping an SSH session during a run left the whole
// `pnpm → pnpm → next` group alive, which `detached: true` is precisely what
// made possible. It leaked silently, one stray server per abandoned run,
// because `getFreePort` takes a fresh port every time and nothing ever
// collided to reveal it. Abandoning a long QA run mid-flight is the ordinary
// case, not the exotic one.
process.on("exit", () => killAllServerGroups("SIGKILL"));
for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129], ["SIGQUIT", 131]]) {
  process.once(signal, () => {
    killAllServerGroups("SIGKILL");
    process.exit(code);
  });
}

async function startNextServer() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  // ── THE EXTERNAL PLANE'S OWN ORIGIN, AND WHY IT IS SPELLED `localhost` ────
  //
  // `buildReviewLink` (src/lib/external-link.ts) REFUSES an origin that is
  // neither `https://` nor `http://localhost`, so `http://127.0.0.1:PORT` —
  // the origin every other audit in this file uses — cannot build a link at
  // all: `occurrence_grants.issue` would throw before returning one. The two
  // spellings name the same interface (`next start -H 127.0.0.1` answers both,
  // because `localhost` resolves to it), and to a BROWSER they are two
  // different origins, which is a property this audit uses rather than works
  // around: the external context's cookie jar cannot be confused with the
  // office session's even by accident.
  const externalOrigin = `http://localhost:${port}`;
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
        // THIS HARNESS NAMES ITS OWN ORIGIN, and doing so is part of what the
        // pass proves rather than a setup detail.
        //
        // `next start` is a production build, and `resolveBaseOrigin`
        // (src/lib/api.ts) has no header-derived fallback in one: the loopback
        // branch took its PORT from the request, so `Host: 127.0.0.1:9200`
        // aimed a server component's self-fetch — carrying the foreman's whole
        // Supabase cookie jar — at an attacker-chosen port on the app's own
        // loopback interface. Without this line every authenticated audit below
        // would render the error screen.
        //
        // The gain is not just that it still works. Every deployment that is
        // not a developer's own machine must set this variable, so setting it
        // here means the browser pass now exercises the SAME branch a real
        // origin will — instead of a developer fallback that no deployment is
        // allowed to use, and that therefore proved nothing about the deployed
        // path. The loopback branch keeps its own coverage in
        // src/lib/api.test.ts, with no browser.
        //
        // IT WORKS BECAUSE THE BUILD LEFT IT UNSET, which is worth knowing
        // before changing either side. `NEXT_PUBLIC_*` is inlined at build
        // time; measured against `.next/server` output, a value ABSENT at
        // build survives as a literal `process.env.NEXT_PUBLIC_APP_ORIGIN`
        // read that the server performs at runtime, which is what this
        // assignment reaches. Build apps/app with the variable set to
        // something else and that build wins — the string is already baked in
        // and this line is ignored. CI's `app-qa` job sets it nowhere, so the
        // build there is the unset one.
        NEXT_PUBLIC_APP_ORIGIN: baseUrl,

        // ── THE EXTERNAL PLANE'S FIVE VARIABLES ───────────────────────────
        //
        // Set here, not left to `.env.local`, for two reasons that are both
        // about this being a GATE command. CI has no `.env.local` at all — it
        // is untracked — so without these lines the seventh audit's grant
        // issue would 500 on `EXTERNAL_LINK_HMAC_KEYS is not set` in CI while
        // passing on a developer's machine, which is the worst possible
        // failure shape. And `.env.local`'s own `EXTERNAL_LINK_ORIGIN` names
        // port 3000, which is not this run's port: an env var passed to
        // `spawn` wins over a `.env` file (Next's loader never overwrites an
        // existing `process.env` entry), so this line is also what stops a
        // developer's file from building links to a server that is not this
        // one.
        //
        // THE KEYS ARE DEV-ONLY AND LOCAL-ONLY, exactly like the Supabase
        // keys above and for the same reason: they are safe only because
        // nothing reachable from outside this machine trusts them. They are
        // the values `apps/app/.env.example` publishes, verbatim, rather than
        // freshly random ones — a fixed key makes a failing run reproducible,
        // and a key committed to `.env.example` is already public.
        EXTERNAL_LINK_ORIGIN: externalOrigin,
        EXTERNAL_LINK_HMAC_KEYS: process.env.EXTERNAL_LINK_HMAC_KEYS
          ?? "dev1:ZGV2LW9ubHktbGluay1rZXktMzItYnl0ZXMtbG9uZy0xMjM0",
        EXTERNAL_LINK_ACTIVE_KEY_ID: process.env.EXTERNAL_LINK_ACTIVE_KEY_ID ?? "dev1",
        EXTERNAL_SESSION_HMAC_KEYS: process.env.EXTERNAL_SESSION_HMAC_KEYS
          ?? "dev1:ZGV2LW9ubHktc2Vzc2lvbi1rZXktMzItYnl0ZXMtbG9uZy0xMg",
        EXTERNAL_SESSION_ACTIVE_KEY_ID: process.env.EXTERNAL_SESSION_ACTIVE_KEY_ID ?? "dev1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      // THE HARNESS USED TO NEVER EXIT, AND THIS IS WHY (found 2026-08-22,
      // while adding the dash audit below; NOT caused by it).
      //
      // `close()` sent SIGTERM to THIS pid and then awaited its `exit`. But
      // this pid is `pnpm`, and pnpm re-execs a second pnpm from its own store
      // (`pnpm/9.12.0/…/bin/pnpm.cjs`) which then spawns `next`. SIGTERM to
      // the outermost one propagates to neither, so the `next` server stays
      // up, the outer process stays alive waiting on it, and the `await
      // proc.once("exit")` never resolves — after the report had already been
      // written and every finding printed. Reproduced in isolation with a
      // ten-line script carrying nothing of this task in it: "STILL RUNNING
      // after 10s — SIGTERM did not propagate".
      //
      // The symptom is nasty out of proportion to the bug: `node
      // apps/app/qa/field.mjs` is a GATE command, and a gate command that
      // never returns reads as a hung test run, not as a finished one — and
      // in a shell that pipes it (`| tail`) even the findings stay invisible,
      // because the pipe never closes.
      //
      // `detached: true` puts the child in its own PROCESS GROUP, so
      // `process.kill(-pid, …)` in `close()` below signals pnpm, pnpm's
      // re-exec and `next` together.
      detached: true,
    },
  );

  // …AND `detached` HAS A COST THAT HAS TO BE PAID BACK HERE. Severing the
  // child from this process's group is what makes `stopServer` able to signal
  // the whole `pnpm → pnpm → next` chain — and it also means the chain no
  // longer dies with the harness. Before this change a Ctrl-C killed the
  // server as collateral; after it, any exit that does not reach `stopServer`
  // (SIGINT, SIGTERM, an uncaught throw) would leave a `next start` holding a
  // port for the rest of the session. These handlers are that guarantee, and
  // `stopServer` removes them so a normal shutdown does not fire twice.
  proc.once("exit", () => { serverGroups.delete(proc); });
  serverGroups.add(proc);
  proc.stdout.on("data", (d) => stdout.push(d.toString()));
  proc.stderr.on("data", (d) => stderr.push(d.toString()));

  const deadline = Date.now() + 60_000;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      // Readiness probe: `/login` answers 200 with no session. It was
      // `/manifest.webmanifest` until DEV-035 removed the manifest.
      const res = await fetch(`${baseUrl}/login`);
      if (res.ok) {
        return {
          baseUrl,
          // The origin `occurrence_grants.issue` will actually build links on
          // — returned so the seventh audit can assert the link it was handed
          // is the one this server was configured to build, rather than
          // trusting whatever string came back.
          externalOrigin,
          async close() {
            await stopServer(proc);
          },
        };
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  await stopServer(proc);
  throw new Error(
    `next start never became ready on ${baseUrl}: ${lastErr}\n--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
  );
}

/**
 * Stops the whole `pnpm → pnpm → next` process GROUP — see the `detached`
 * comment in `startNextServer` for why signalling `proc.pid` alone left the
 * server running and this harness hanging forever afterwards.
 *
 * `process.kill(-pid, …)` addresses the group (the negative pid is POSIX's own
 * spelling for that), which `detached: true` is what creates. Wrapped in
 * try/catch because the group may already be gone — a race with a crashed
 * `next` throws ESRCH, and a shutdown path that throws on "already dead" would
 * turn a clean run into a failed one.
 *
 * SIGKILL AFTER A DEADLINE, not an unbounded wait. The previous code awaited
 * `exit` with no timeout, which is exactly what turned a signal that did not
 * land into a hang with no message. Five seconds is far more than `next stop`
 * needs and short enough that a stuck server is reported rather than waited on.
 */
async function stopServer(proc) {
  const signalGroup = (signal) => {
    try {
      process.kill(-proc.pid, signal);
    } catch {
      /* already gone, or never had a group — nothing left to stop */
    }
  };

  // Out of the registry first: from here the shutdown is deliberate, and the
  // `exit`/signal nets in `killAllServerGroups` have nothing left to do for
  // this one.
  serverGroups.delete(proc);

  signalGroup("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => proc.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited) {
    console.error("qa/field.mjs: next start did not stop on SIGTERM within 5s — sending SIGKILL");
    signalGroup("SIGKILL");
    await Promise.race([
      new Promise((resolve) => proc.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Seeding the world the obligation screen needs, entirely over HTTP against
// the SAME running server the browser will drive — no direct-import of route
// modules (that trick only works inside vitest, which transpiles TS; this is
// plain Node) and no raw SQL standing in for a command. `httpStep` mirrors
// `tests/helpers/fixtures.ts`'s own `step()`: refuse loudly, with the status
// and body, rather than let a later line fail on `undefined.somethingId` and
// blame the wrong call.
// ---------------------------------------------------------------------------
async function httpStep(what, res) {
  const text = await res.text();
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`seedWorld: ${what} returned ${res.status} ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

function authedFetch(baseUrl, bearer) {
  // Parameter named `urlPath`, not `path` — this file imports node:path as
  // `path` at module scope, and shadowing it here (even harmlessly, since
  // this closure never calls into node:path) is the kind of thing that stops
  // being harmless the next time someone edits this function.
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

/**
 * The digest `contract_versions.publish` asks the caller to confirm.
 * Reimplemented from `apps/app/src/lib/manual-baseline.ts`'s
 * `lineManifestHash`/`pinsFrom` rather than imported — this file is plain
 * Node ESM with no TypeScript loader (the same reason apps/demo/qa/verify.mjs
 * reimplements WCAG contrast instead of importing it from src). Kept to the
 * exact field list and JSON shape of the source function; if that function's
 * `LINE_MANIFEST_SCHEME` ever moves past `/2`, this must move with it or
 * every `seedWorld` run starts failing `contract_versions.publish` with
 * VERSION_CONFLICT.
 */
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

/**
 * One workspace → one project → self-granted capabilities → both parties →
 * one contract → one published baseline (one work item, one bound photo
 * rule) → one assignment, which MATERIALISES the occurrence
 * `assignments.create` writes in the same transaction (see that route's own
 * header comment). Every request body and every capability name below is
 * copied from a passing suite, not guessed: workspace/project/grant/parties/
 * contract from `baselineFixture`, the draft/line/bind/publish sequence from
 * `manual-baseline.ts`, the assignment-manage capability set from
 * `field-capture.int.test.ts`'s `boundOccurrence()`.
 */
const PROJECT_NAME = "Приклад-Обʼєкт QA";
const WORK_ITEM_DESCRIPTION = "Приклад-улаштування прокладки кабелю QA";

/**
 * TWO MORE PROJECTS, EACH SEEDED FOR ONE STATE THE MAIN WORLD CANNOT REACH —
 * added by the final fix wave, and named here so they are not mistaken for
 * padding.
 *
 * `EMPTY_PROJECT_NAME` — a project with NO assignment, because the main
 * project has one from the moment it is seeded and its register therefore
 * never renders the empty state. F1 (the create link existing only once an
 * assignment already exists) is invisible on any register that has a row.
 *
 * `NO_MONEY_PROJECT_NAME` — a project the seeded member can SEE
 * (`project.view`) and create доручення on (`assignments.manage`) but whose
 * MONEY they cannot read: `readiness.view` is deliberately withheld from its
 * grant, which is the exact shape four responsibility presets ship
 * (`requirement_owner`, `internal_verifier`, `package_submitter`, `foreman`).
 * That is the only way to reach F2's refusal without minting a second user.
 *
 * NEITHER CHANGES ANY EXISTING ASSERTION, and that was checked rather than
 * hoped: `showProjectName` is `distinctProjectsWithWork > 1`
 * (src/lib/field/assignments.ts [deleted 2026-09-23, DEV-035]) and neither project carries an assignment, so
 * «Мої доручення» still renders one row and still hides the project name; no
 * audit counts the rows in `/`'s project list.
 */
const EMPTY_PROJECT_NAME = "Приклад-Порожній проєкт QA";
const NO_MONEY_PROJECT_NAME = "Приклад-Проєкт без доступу до грошей QA";

// [2026-09-23, DEV-035] «Мої доручення» in the comments below names the field
// client's assignment list — once `app/(app)/page.tsx` here, now only
// apps/mobile's. The seed shape those comments justify is kept: `/v1`'s
// `?assignee=me` still serves that list, and the dashboard audits read the
// same world.
async function seedWorld(baseUrl, bearer) {
  const f = authedFetch(baseUrl, bearer);

  const ws = await httpStep("workspaces.create",
    await f("/v1/workspaces", { displayName: "Приклад-Об'єкт-простір QA" }));

  const members = await httpStep("members.list", await f(`/v1/workspaces/${ws.workspaceId}/members`));
  const memberId = members.members[0].memberId;

  const proj = await httpStep("projects.create",
    await f(`/v1/workspaces/${ws.workspaceId}/projects`, { name: PROJECT_NAME }));

  // Two grants, exactly as the two suites this mirrors make them: the manual-
  // baseline capabilities first (baselineFixture), the field/assignment
  // capabilities second (field-capture.int.test.ts's own `grant()`). A single
  // combined call would work too (access-grants is idempotent per-capability
  // — see that route's own comment), but keeping the two calls separate keeps
  // this function readably parallel to the two fixtures it is standing in for.
  await httpStep("access-grants (baseline)", await f(`/v1/projects/${proj.projectId}/access-grants`, {
    memberId, capabilities: ["contracts.edit", "imports.manage", "imports.publish"],
  }));
  await httpStep("access-grants (field)", await f(`/v1/projects/${proj.projectId}/access-grants`, {
    memberId, capabilities: [
      "assignments.manage", "evidence.record", "rule_bindings.manage",
      "requirements.assign", "project.view",
      // `packages.submit` GOVERNS `occurrence_grants.issue`
      // (technical/permissions/capabilities.csv:34), which the seventh audit
      // presses a button to perform. Without it the POST is a 403 the office
      // screen renders as «Посилання не створено» — correct behaviour, and a
      // seeding gap rather than a defect, which is exactly why it is granted
      // here rather than worked around in the audit.
      "packages.submit",
      // ADDED FOR THE PROJECT-OVERVIEW AUDIT (Plan D slice D2). `GET /v1/
      // projects/{projectId}/blocked-value` calls `requireProjectCapability`
      // for `readiness.view` SEPARATELY from its own second call for
      // `project.view` (`app/v1/projects/[projectId]/blocked-value/route.ts`),
      // and `project.view` alone does NOT imply it
      // (`authz.ts`'s `IMPLIED_BY_PROJECT_ADMIN` covers `project.admin`
      // only). Without this grant `/projects/{projectId}` would render
      // its 403 branch for the very member this world seeds as a foreman —
      // a seeding gap, not the thing the new audit exists to exercise (that
      // refusal is proven separately, in `apps/app/src/services/
      // blocked-value.service.ts`'s own header and its would-be caller, not
      // by starving the happy-path audit of the grant it needs to see real
      // data).
      "readiness.view",
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

  // The Додаток Н library — seeded automatically by workspaces.create (task
  // 3; see that route's own comment). Н.15/1 is the same photo-evidence,
  // before_concealment position every other fixture in this codebase binds.
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

  // `assigneeMemberId` IS LOAD-BEARING AND WAS MISSING. It is optional on
  // `createAssignmentRequest`, and without it the assignment is created with a
  // null assignee — which is perfectly valid, and means
  // `GET /v1/projects/{id}/assignments?assignee=me` correctly returns nothing.
  // The obligation screen is reached by id and never noticed; «Мої доручення»
  // is the screen that asks the question, so it rendered its "no assignments"
  // empty state on a world this file believed it had seeded. Caught the day the
  // authenticated `/` audit was added, which is the whole argument for adding
  // it. The seeded foreman is the member who is signing in, so this is also
  // what makes the world a foreman's world rather than an administrator's.
  const assignment = await httpStep("assignments.create",
    await f(`/v1/contracts/${contract.contractId}/assignments`, {
      workItemId: line.workItem.workItemId,
      assigneeMemberId: memberId,
    }));

  // Asserted through the READ the list screen actually performs, not off the
  // create response — `CreateAssignmentResponse` carries only the id, the
  // version and the materialisation, never the assignee. This is the exact
  // question «Мої доручення» asks, so a seed that satisfies it is a seed that
  // screen can render.
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

  // The project name and the work-item description are returned rather than
  // re-typed in the audits: «Мої доручення» renders the description as each
  // row's title and — because this world has exactly ONE project — must NOT
  // render the project name at all (`showProjectName` in
  // src/lib/field/assignments.ts [deleted 2026-09-23, DEV-035]). Asserting against the values this function
  // actually sent keeps that check honest if either literal above changes.
  // A SECOND WORKSPACE, SEEDED FOR ONE ASSERTION AND NAMED HERE SO IT IS NOT
  // MISTAKEN FOR PADDING. `WorkspaceSwitch` renders plain text with one
  // membership and a disabled control with a trailing `+N` pill and chevron
  // with more than one — and it is that WIDER row, at the top of the mobile
  // drawer, that the drawer's own `pt-16` clearance exists to keep out from
  // under `DialogContent`'s close button. 64px was hand-derived from `top-4`
  // plus `--gp-control-height-touch`; the dash audit below turns that into a
  // measured, repeatable non-overlap assertion, and it can only make it
  // against a caller who actually has two memberships.
  //
  // It contributes NO project, so nothing above changes: `/v1/projects` still
  // returns one, «Мої доручення» still renders one row, and `showProjectName`
  // is still correctly false.
  await httpStep("workspaces.create (second, for the multi-membership rail)",
    await f("/v1/workspaces", { displayName: "Приклад-Другий-простір QA" }));

  // ── THE TWO EXTRA PROJECTS ───────────────────────────────────────────────
  // See the constants above for what each exists to make reachable. Both are
  // created in THIS workspace, so `listProjects()` returns them to the same
  // signed-in session every audit already uses, and both are left without a
  // contract: neither ever grows an assignment, so `showProjectName` stays
  // false and «Мої доручення» still renders exactly one row.
  const emptyProject = await httpStep("projects.create (empty register)",
    await f(`/v1/workspaces/${ws.workspaceId}/projects`, { name: EMPTY_PROJECT_NAME }));
  await httpStep("access-grants (empty register)",
    await f(`/v1/projects/${emptyProject.projectId}/access-grants`, {
      memberId, capabilities: ["project.view", "assignments.manage", "readiness.view"],
    }));

  // `readiness.view` IS WITHHELD HERE, AND THAT IS THE WHOLE POINT. With it,
  // this project would render the no-baseline empty state like the one above
  // and prove nothing. Without it, `blocked_value.get` answers 403 and the
  // create screen has to say so legibly instead of rendering ShellFatalError.
  //
  // OMITTING IT FROM THIS LIST IS ONLY HALF THE WITHHOLDING — the creator's
  // own `project.admin` row implies it, and is taken back immediately below.
  const noMoneyProject = await httpStep("projects.create (no readiness.view)",
    await f(`/v1/workspaces/${ws.workspaceId}/projects`, { name: NO_MONEY_PROJECT_NAME }));
  await httpStep("access-grants (no readiness.view)",
    await f(`/v1/projects/${noMoneyProject.projectId}/access-grants`, {
      memberId, capabilities: ["project.view", "assignments.manage"],
    }));

  // ── AND `project.admin` IS TAKEN BACK, WHICH IS WHAT MAKES THE WITHHOLDING
  //    REAL ──────────────────────────────────────────────────────────────────
  //
  // WITHHOLDING A CAPABILITY FROM A GRANT DOES NOT WITHHOLD IT. Every project
  // is created by this same member, and `projects.create` grants its creator
  // `project.admin` and `project.view` unconditionally
  // (app/v1/workspaces/[workspaceId]/projects/route.ts) — access is never
  // inferred later, so it is handed out at creation instead. And
  // `requireProjectCapability` treats `project.admin` as covering
  // `IMPLIED_BY_PROJECT_ADMIN = ["project.view", "readiness.view"]`
  // (src/lib/authz.ts). So the grant above, which carefully omits
  // `readiness.view`, omits nothing at all: the member still holds it through
  // the admin row, `blocked_value.get` still answers 200, and the create
  // screen renders its ordinary empty state.
  //
  // THAT IS NOT A SILENT PASS — IT IS EXACTLY TWO FINDINGS. Block 0b looks for
  // a `[role="status"]` banner naming the missing access; with the refusal
  // never reached, that assertion fires, and so does the one below it that
  // reads the same absent banner for its «Попросіть адміністратора проєкту»
  // body. Both describe the seed, not the screen. Revoking the admin row is
  // what makes them describe the screen.
  //
  // SQL, WHERE EVERY OTHER SEEDING STEP HERE IS HTTP, AND ON PURPOSE. Until
  // DEV-043 v0.1 had no operation that revokes a project access grant. It has
  // one now (`project_access.revoke`, ADR-014), and it refuses exactly this
  // write: the row revoked here is the creator's only `project.admin` grant,
  // and the route keeps a project's last administrator (INV-110). The column is the
  // one authz.ts itself reads (`revoked_at is null`), so this writes the state
  // the production check already tests for rather than a second mechanism.
  //
  // AND IT IS ASSERTED, NOT ASSUMED. A revoke that matched no row would leave
  // the member an admin and put block 0b back exactly where it started, so the
  // row count is checked here — where the message can say what went wrong —
  // rather than surfacing later as two findings about a banner.
  const revoked = await dbQuery(
    `update public.project_access_grants set revoked_at = now()
      where workspace_id = $1 and project_id = $2 and member_id = $3
        and capability = 'project.admin' and revoked_at is null
      returning 1 as ok`,
    [ws.workspaceId, noMoneyProject.projectId, memberId]);
  if (revoked.length !== 1) {
    throw new Error(
      `seedWorld: expected to revoke exactly one project.admin grant on ${NO_MONEY_PROJECT_NAME}, `
      + `revoked ${revoked.length} — the money-refusal audit needs readiness.view genuinely absent, and `
      + "projects.create grants project.admin to its creator, which implies it (src/lib/authz.ts).");
  }

  const me = await httpStep("me.context", await f("/v1/me/context"));
  if (me.memberships.length !== 2) {
    throw new Error(
      `seedWorld: expected exactly two memberships after seeding two workspaces, got ${me.memberships.length} — `
      + "the dash audit's drawer-overlap check needs the multi-membership WorkspaceSwitch row.",
    );
  }

  // ── ONE REAL, AVAILABLE EVIDENCE OBJECT ──────────────────────────────────
  //
  // ADDED FOR THE SEVENTH AUDIT (Plan D slice D1 task 7), and it is the one
  // thing this world was missing. Every audit before it either shows an
  // obligation with no photo or drives the capture path deliberately INTO
  // failure (the in-flight banner audit stubs `fetch` so the upload never
  // succeeds), so nothing here had ever produced an `evidence_objects` row
  // that reached `available` — and both screens this task is about, the office
  // evidence screen and the external review page, render nothing without one.
  //
  // THE CHAIN IS THE PRODUCT'S OWN, over the same three routes
  // `src/lib/capture/upload.ts` [deleted 2026-09-23, DEV-035] drives and `tests/field-capture.int.test.ts`
  // proves: create an upload intent, PUT the bytes STRAIGHT to the signed
  // storage URL with no Authorization header (the signed token in the URL is
  // the authorization), then finalize. No raw SQL, no direct storage write,
  // and no shortcut that would let a broken route pass this seeding step.
  const occurrences = await httpStep("requirement-occurrences.list",
    await f(`/v1/assignments/${assignment.assignmentId}/requirement-occurrences`));
  const occurrenceId = occurrences.occurrences?.[0]?.occurrenceId;
  if (typeof occurrenceId !== "string" || occurrenceId.length === 0) {
    throw new Error(
      `seedWorld: the assignment materialised ${assignment.requirementOccurrences.occurrenceCount} occurrence(s) `
      + "but GET /v1/assignments/{id}/requirement-occurrences returned none this file could read — "
      + `got ${JSON.stringify(occurrences).slice(0, 400)}`,
    );
  }

  const photoHash = createHash("sha256").update(PHOTO_JPEG_BYTES).digest("hex");
  const intent = await httpStep("upload-intents.create",
    await f(`/v1/assignments/${assignment.assignmentId}/upload-intents`, {
      requirementOccurrenceId: occurrenceId,
      expectedContentHash: photoHash,
      expectedByteSize: PHOTO_JPEG_BYTES.length,
      claimedMediaType: "image/jpeg",
      originalFilename: PHOTO_FILENAME,
      deviceCaptureId: crypto.randomUUID(),
      // The only value a PWA build is permitted to send (ADR-007 decision 5,
      // INV-086) — `buildCreateIntentBody` has no parameter that reaches it.
      originMethod: "origin_not_distinguished",
      // Device-claimed and labelled as such wherever it is shown. An hour ago
      // rather than `now` so it is visibly DIFFERENT from the server receipt
      // the same row records.
      claimedCaptureTime: new Date(Date.now() - 3_600_000).toISOString(),
    }));

  // No Authorization, no apikey: exactly what `uploadCapture` sends (apps/mobile's; the apps/app copy was deleted 2026-09-23, DEV-035).
  const put = await fetch(intent.upload.signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: PHOTO_JPEG_BYTES,
  });
  if (!put.ok) {
    throw new Error(`seedWorld: PUT to the signed upload URL returned ${put.status} ${await put.text()}`);
  }

  const finalized = await httpStep("upload-intents.finalize",
    await f(`/v1/upload-intents/${intent.uploadIntentId}/finalize`, {}));
  if (finalized.status !== "available" || !finalized.evidenceObjectId) {
    throw new Error(
      `seedWorld: finalize returned status "${finalized.status}" / evidenceObjectId `
      + `${JSON.stringify(finalized.evidenceObjectId)} — INV-081 makes "available" the only state that counts as saved, `
      + "and both screens the seventh audit drives render nothing without one.",
    );
  }

  return {
    assignmentId: assignment.assignmentId,
    workspaceId: ws.workspaceId,
    // The register `/projects/{projectId}/assignments` is addressed by
    // this and nothing else. It was not returned until the D1 final fix wave,
    // which is a large part of why no audit had ever opened that route.
    projectId: proj.projectId,
    // The two states the main project cannot be in at the same time as itself.
    emptyProjectId: emptyProject.projectId,
    noMoneyProjectId: noMoneyProject.projectId,
    occurrenceId,
    evidenceObjectId: finalized.evidenceObjectId,
    projectName: PROJECT_NAME,
    workItemDescription: WORK_ITEM_DESCRIPTION,
  };
}

// ---------------------------------------------------------------------------
// Supabase Auth Admin API — the same mechanism task 5's report verified by
// hand ("Created one throwaway, email-confirmed user via the local Auth
// Admin HTTP API"). `email_confirm: true` is what lets `signInWithOtp({
// shouldCreateUser: false })` find this user later through the REAL login
// screen; `password` is set only so this script can obtain a bearer token to
// SEED the world without going through the browser at all — the browser
// session that actually views the screens is established separately, below,
// through the real OTP form.
// ---------------------------------------------------------------------------
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
  // Best-effort: this is post-run hygiene, not a correctness requirement —
  // the CI runner (and its Postgres/GoTrue containers) is thrown away right
  // after this job ends either way. A failure here must never flip the
  // report's `ok`.
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
  } catch {
    // ignored — see above
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

/**
 * Extracts a six-digit OTP code from an email body (Text, HTML, or the list
 * endpoint's Snippet — see `readOtpCode`).
 *
 * FIX ROUND 2, ON THIS SAME FUNCTION: round 1 (below, in `readOtpCode`'s own
 * header) replaced the literal `code:\s*(\d{6})` match with a bare
 * `(?<!\d)(\d{6})(?!\d)` scan across the WHOLE body, reasoning that a
 * reworded template shouldn't require the literal prefix. That reasoning
 * was correct on its own but incomplete: this local stack's actual OTP
 * email is Supabase's default "Magic Link" template, which carries BOTH the
 * real code AND a magic-link URL in the SAME body —
 *
 *   Log In ( http://127.0.0.1:54321/auth/v1/verify?token=pkce_1899d2f93
 *   11e485871de6a1d6eb29fc0eccc17bb8fe21889e7cb929a&type=magiclink&... )
 *
 *   Alternatively, enter the code: 834368
 *
 * — and a PKCE token is a long, effectively-random hex string. Hex digits
 * are ~62.5% numeric (10 of 16 characters), so a token of that length has a
 * non-trivial chance of containing an UNRELATED run of six consecutive
 * digits bounded by letters — which reads, to a bare `(?<!\d)(\d{6})(?!\d)`
 * scan, as an equally valid "standalone six-digit run" as the real code.
 * `.exec()` returns the FIRST match, and the token appears BEFORE "enter
 * the code" in the body, so round 1's fallback would silently hand back a
 * syntactically valid but WRONG code whenever that token happened to
 * contain one — which GoTrue then correctly 403's on verify. This is not
 * hypothetical: it reproduced locally at roughly the rate a random hex
 * string that length would be expected to contain a spurious six-digit
 * run, and every failure it produced looked identical to a broken sign-in
 * screen (`page.waitForNavigation` timing out after the code was
 * submitted) unless the actual email body was inspected — exactly the
 * "harness fails for the wrong stated reason" defect class this file
 * exists to eliminate, reintroduced by round 1's own fix.
 *
 * ROUND 2's FIX: try the LABELLED match first — `code:\s*(\d{6})`,
 * case-insensitive. This is not a return to requiring the literal prefix
 * everywhere; it is trying the unambiguous, currently-true-for-this-
 * template match FIRST, before falling back to anything looser. Only if no
 * labelled match exists (a genuinely reworded template with no "code:"
 * label at all) does this fall back to a bare standalone-digit scan — and
 * that fallback now strips anything that looks like a URL
 * (`https?://\S+`) out of the text FIRST, so a PKCE token (or any other
 * URL-embedded digit run) can never reach the bare scan in the first
 * place. This closes the exact failure mode above regardless of which
 * template ships, rather than trading one template's correctness for
 * another's.
 */
function extractOtpCode(text) {
  if (!text) return null;
  const labelled = /code:\s*(\d{6})(?!\d)/i.exec(text);
  if (labelled) return labelled[1];
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, " ");
  const bare = /(?<!\d)(\d{6})(?!\d)/.exec(withoutUrls);
  return bare ? bare[1] : null;
}

/**
 * Reads the six-digit OTP code Mailpit received for `email`.
 *
 * PRIOR VERSION'S DEFECT, FOR THE RECORD: this function used to trust the
 * LIST endpoint's (`/api/v1/messages`) `Snippet` field exclusively, matched
 * with a `code:\s*(\d{6})` regex the old comment said was "confirmed by
 * hand against the local stack before this was written" — i.e. verified
 * against ONE Mailpit build, on one CLI version, and never re-verified
 * against CI's. CI resolves `supabase/setup-cli@... version: latest`, which
 * is demonstrably a newer CLI than the 2.75.0 this was hand-checked
 * against locally (CI's `supabase start` even logs `WARN: config section
 * [inbucket] is deprecated. Please use [local_smtp] instead`, a warning the
 * local CLI does not emit) — so CI is quite possibly running a different
 * Mailpit build too, with different Snippet truncation or template
 * wording. When that assumption broke, the old code's own error message —
 * "no OTP email reached Mailpit" — asserted a cause (nothing arrived) it
 * had never actually distinguished from "Mailpit is unreachable" or "a
 * message arrived but no code could be parsed out of it". A harness whose
 * failure message names a cause it did not establish is exactly the defect
 * class this repository does not tolerate, so every failure path below is
 * now traceable to the one cause it actually observed, with the evidence
 * that grounds it:
 *
 *   1. Mailpit never answered `/api/v1/messages` with 2xx (or the fetch
 *      itself threw, e.g. connection refused) — reports the last HTTP
 *      status or error seen.
 *   2. Mailpit answered fine, but no message ever arrived addressed to
 *      `email` — reports how many messages WERE seen on the last poll and
 *      which addresses they were sent to, so a caller can tell "Mailpit is
 *      empty" apart from "Mailpit has mail, just not for this address".
 *   3. A message addressed to `email` DID arrive, but no six-digit code
 *      could be parsed out of it — reports the message id plus a truncated
 *      Snippet/Text/HTML so the actual template text is visible in the CI
 *      log without a local reproduction.
 *
 * Once a matching message is found, this fetches the FULL message
 * (`GET /api/v1/message/{ID}`) instead of trusting the list endpoint's
 * `Snippet` — Mailpit truncates that field, which is exactly the kind of
 * thing a version bump reshapes without changing the actual delivered
 * code. The code is extracted from Text, then HTML, then (only as a last
 * resort, in case both bodies are empty for some reason) the list
 * endpoint's own Snippet — see `extractOtpCode`'s header for the two-step
 * match it actually runs (a labelled `code:` match first, a URL-stripped
 * bare-digit scan only as its own fallback) and for the false-positive
 * this two-step shape exists to avoid.
 *
 * Polls because the email is genuinely asynchronous — GoTrue enqueues it,
 * Mailpit receives it a moment later — never a fixed sleep, which would
 * either flake under load or waste time under none.
 */
async function readOtpCode(email, { timeoutMs = 60_000 } = {}) {
  // 60s, not the previous 15s. The workflow's own comment on the
  // `supabase start` step already documents that a cold CI runner pays for
  // a full Postgres/GoTrue/Kong/Mailpit image pull before anything is up
  // ("Cold runners pull the full local Postgres/GoTrue/Kong image set on
  // first boot, which is slow"); 15s never had headroom for that on a
  // shared, loaded runner, only on a warm local machine. 60s is generous
  // without hiding a genuinely broken pipeline for a full test run.
  const deadline = Date.now() + timeoutMs;
  let lastListStatus = null; // number (HTTP status) | string (network error) | null (never reached)
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
          `six-digit code could be parsed out of its Text, HTML, or Snippet. This is the template-` +
          `changed / Mailpit-build-changed case readOtpCode's header describes — evidence:\n` +
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
// Page diagnostics — same shape as apps/demo/qa/verify.mjs's `withPage`, so a
// console error or an uncaught page error anywhere during an audit is a
// finding rather than a silent pass. Also tracks 404 responses, for the same
// reason apps/demo/qa/verify.mjs's RULING 3 does: Chrome's own automatic
// `/favicon.ico` probe 404s on this app (no favicon.ico ships in public/,
// only the two PNG icon sizes the manifest names) and logs that 404 to the
// console as an "error"-typed message. That is real, already-known, harmless
// browser behaviour — not a defect this harness exists to catch — so it is
// named and counted separately rather than either silently dropped (which
// would hide a genuinely missing asset) or left to fail the zero-console-
// error gate (which would block every run on a favicon nobody asked for).
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

/**
 * WCAG 2.5.5's 44×44 CSS px floor, at the width the field client's own
 * audience actually holds a phone at. Selector and filter copied from
 * apps/demo/qa/verify.mjs's `auditTouchTargets` — the same real defect class
 * (a search input measured 22px, a footer link 20px) is exactly as possible
 * here, and `apps/demo` already has a proven-correct way to catch it.
 */
/**
 * NOTHING MAY SCROLL SIDEWAYS ON A PHONE. Added by the final fix wave after the
 * obligation screen's own screenshot showed the ДБН retrieval record — a URL
 * and a 64-character sha256, neither of which contains a break opportunity —
 * running off the right edge at 375px and taking the whole document's
 * horizontal scroll with it. A regulatory citation that cannot be read on the
 * device this client is FOR is not really rendered, which is the same failure
 * the disclaimer-visibility check exists to catch, and no assertion here would
 * have noticed: the text was present, visible, and unclipped.
 *
 * `documentElement`, not `body`: the scroll that matters is the viewport's.
 * A 1px tolerance because sub-pixel layout rounding produces a harmless
 * `scrollWidth` one greater than `clientWidth` on some elements.
 */
async function measureHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    if (overflow <= 1) return null;
    // Name the widest offender, so the finding says WHAT is too wide rather
    // than only that something is.
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

/**
 * NO ANCHOR UNDER /app/** MAY RENDER WITH USER-AGENT LINK STYLING, and this
 * gate is the whole reason the fix is safe to keep.
 *
 * There was no Tailwind preflight and no `a` reset, so every anchor in the
 * field client came out blue, underlined and visited-purple. «Мої доручення»
 * renders each obligation row AS an anchor, so a foreman's list turned purple
 * row by row as he worked through it — read as a rendering fault, not as
 * progress. `text-decoration` propagates to in-flow descendants and cannot be
 * overridden by them, so the row's own `text-foreground` spans could not undo
 * the underline; only a reset could.
 *
 * MEASURED ON THE UNVISITED COLOUR, NOT THE PURPLE. `:visited` styling is
 * deliberately unreadable from script — every engine returns the unvisited
 * computed style for privacy reasons — so an assertion about purple is not
 * available to any harness. Both come from the same UA rule, so pinning
 * `rgb(0, 0, 238)` pins the cause of both. Same for the underline, which is
 * directly readable.
 *
 * `[data-slot="button"]` anchors are exempt: `<Button asChild>` renders a real
 * link with button styling, and `@goproceed/ui`'s Button `link` variant underlines
 * ON PURPOSE. Exempting them by the attribute the component itself sets — not
 * by a class-name guess — means a hand-rolled anchor that merely looks like a
 * button is still caught.
 */
async function measureUaStyledLinks(page) {
  return page.evaluate(() => {
    // Chrome's UA sheet: `a:-webkit-any-link { color: -webkit-link }`, which
    // computes to this exact value. Comparing the computed rgb rather than the
    // keyword because getComputedStyle always resolves it.
    const UA_LINK_BLUE = "rgb(0, 0, 238)";
    return [...document.querySelectorAll("a")]
      .filter((el) => !el.closest('[data-slot="button"]'))
      .map((el) => {
        const s = getComputedStyle(el);
        return {
          label: (el.textContent ?? "").trim().slice(0, 40) || el.getAttribute("href") || "(no text)",
          href: el.getAttribute("href"),
          color: s.color,
          decoration: s.textDecorationLine,
        };
      })
      .filter((l) => l.color === UA_LINK_BLUE || l.decoration.includes("underline"));
  });
}

/**
 * The product renders in the brand sheet's pair, headings and body alike:
 * Hanken Grotesk in front for Latin, Commissioner behind it for Cyrillic. A
 * face that reverts — to a UA serif, to a system sans — is silent in every
 * other gate; only a rendered page can see it. Asserting the STACK, not one
 * name, is what catches the order being reversed: Hanken carries no Cyrillic,
 * so Commissioner in front would leave the sheet's face unused on a page that
 * still looks plausible. [Autumn, 2026-09-22; was `assertOnest`.]
 */
async function assertBrandFaces(ctx, page, label) {
  const faces = await page.evaluate(() => {
    const h = document.querySelector("h1, h2");
    return {
      heading: h ? getComputedStyle(h).fontFamily : null,
      body: getComputedStyle(document.body).fontFamily,
    };
  });
  const ok = (f) => /Hanken Grotesk[^,]*,\s*["']?Commissioner/i.test(f);
  if (faces.heading === null) {
    ctx.findings.push(`${label}: no <h1>/<h2> to check the heading face against`);
  } else if (!ok(faces.heading)) {
    ctx.findings.push(`${label}: the heading renders in "${faces.heading}" — must be Hanken Grotesk ahead of Commissioner`);
  }
  if (!ok(faces.body)) {
    ctx.findings.push(`${label}: the body renders in "${faces.body}" — must be Hanken Grotesk ahead of Commissioner`);
  }
}

/**
 * The first handle matching `selector` that is ACTUALLY RENDERED.
 *
 * The dash shell deliberately keeps two copies of the profile control in the
 * DOM at once — the desktop rail (`hidden md:flex`) and, when it is open, the
 * mobile drawer — so `page.$(selector)` returns whichever comes first in the
 * document, which below `md` is the one that is `display: none`. Clicking that
 * one times out with a message about an element not being clickable, which
 * names the symptom and not the cause.
 *
 * `checkVisibility()` rather than a computed-style walk — it is the engine's
 * own answer — but IT MUST BE PASSED OPTIONS. `visibilityProperty` and
 * `contentVisibilityAuto` both default to false, and a `visibility: hidden`
 * element still generates a box, so a bare `checkVisibility()` returns TRUE
 * for one.
 *
 * THE CASE THAT NEEDS THEM IS NOT THE ONE THIS HEADER FIRST NAMED. It claimed
 * the options were what tells the shell's two duplicated profile controls
 * apart; they are not — the hidden one is `display: none` (`hidden md:flex`),
 * which a bare `checkVisibility()` already excludes. The real case is the
 * PORTALLED content these helpers are also pointed at:
 * `@radix-ui/react-popper@1.3.7` sets `{ visibility: "hidden", pointerEvents:
 * "none" }` on the popper wrapper when `middlewareData.hide.referenceHidden`
 * (dist/index.mjs:214-217), so a menu whose trigger has been scrolled out of
 * a clipping ancestor is styled — in that library's own words — «as if the
 * PopperContent isn't there at all», while still generating boxes. Without
 * the options `visibleHandleWithText` would hand back a `[role="menuitem"]`
 * that cannot be clicked.
 *
 * `opacityProperty` is deliberately NOT set: it would treat `opacity: 0` as
 * hidden, and `animate-chip-in` passes through exactly that on its first
 * frame, which would make every menu and dialog lookup racy. The width test
 * below covers the remaining case — a box that is technically visible with no
 * width.
 */
const VISIBILITY_OPTIONS = { visibilityProperty: true, contentVisibilityAuto: true };

async function visibleHandle(page, selector) {
  for (const handle of await page.$$(selector)) {
    const rendered = await handle.evaluate((el, opts) =>
      (typeof el.checkVisibility === "function" ? el.checkVisibility(opts) : true)
      && el.getBoundingClientRect().width > 0, VISIBILITY_OPTIONS);
    if (rendered) return handle;
    await handle.dispose();
  }
  return null;
}

/** The same, narrowed to an element whose trimmed text is exactly `text` —
 * for menu items and dialog buttons, which carry no id and no test hook. */
async function visibleHandleWithText(page, selector, text) {
  for (const handle of await page.$$(selector)) {
    const match = await handle.evaluate((el, want, opts) =>
      (typeof el.checkVisibility === "function" ? el.checkVisibility(opts) : true)
      && (el.textContent ?? "").trim() === want, text, VISIBILITY_OPTIONS);
    if (match) return handle;
    await handle.dispose();
  }
  return null;
}

/**
 * One query, one throwaway connection — the same shape as
 * `tests/helpers/fixtures.ts`'s `q()`, for the same reason: a query that
 * throws must not leave its connection open.
 */
async function dbQuery(sql, params = []) {
  const c = new Client({ connectionString: SUPABASE_DB_URL });
  await c.connect();
  try {
    const r = await c.query(sql, params);
    return r.rows;
  } finally {
    await c.end().catch(() => undefined);
  }
}

/**
 * ROWS, not a route's own opinion of what it wrote. The "assignment creation"
 * audit's whole point is a count taken from the same table
 * `assignments.create` writes to, before and after a real double press — a
 * 201 that counted something it did not persist, or a route that persisted
 * twice while answering once, would both still look fine from a response
 * body.
 */
async function countAssignments(workspaceId, projectId) {
  const rows = await dbQuery(
    `select count(*)::int as n from public.work_assignments
      where workspace_id = $1 and project_id = $2`,
    [workspaceId, projectId]);
  return rows[0].n;
}

/**
 * Waits until nothing on the page is still animating.
 *
 * GEOMETRY MEASURED MID-ANIMATION IS THE WRONG GEOMETRY, and this harness
 * proved it against itself: `animate-chip-in` scales the drawer up from 95%,
 * and `getBoundingClientRect()` returns the TRANSFORMED box, so the four nav
 * buttons and the close button reported 42px against a 44px floor — 44 ×
 * 0.955 — and the touch-target audit failed on a drawer that is 44px the
 * moment it settles. The earlier runs that passed did so only because
 * unrelated work happened to sit between opening the drawer and measuring it.
 *
 * `getAnimations()` is the engine's own answer, so this covers CSS animations
 * and transitions without naming any of them. Bounded, and a timeout is not a
 * finding: an animation that never finishes is the marquee's business, not
 * this helper's, and every caller below asserts something real straight after.
 */
async function waitForAnimations(page, timeoutMs = 3_000) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState === "finished" || a.playState === "idle"),
    { timeout: timeoutMs },
  ).catch(() => {});
}

/**
 * Opens `loginUrl`, types `email`, presses «Надіслати код» and waits for the
 * code step (`#otp-code`), up to `retries` more times after a failure.
 * Resolves `{ ok, attempts }`, where `attempts` holds one single-line
 * diagnostic per failed attempt. It never throws on a missing code step, so
 * the caller decides whether that is a finding, a crash or a warning.
 *
 * WHY IT EXISTS (DEV-063, BL-158). On 2026-09-24 app-qa went red twice
 * (runs 36000385535 and 36006179453) on the daylight audit's THIRD code
 * request of the run, the 390px one, with only
 * «Waiting for selector `#otp-code` failed» to go on. The same code passed on
 * nearby runs. What the page showed, and what GoTrue answered, was never
 * recorded. GoTrue v2.195.0's limits under CLI 2.115.0 do not obviously
 * explain it: the CLI sets `GOTRUE_RATE_LIMIT_EMAIL_SENT=360000` unless a
 * custom SMTP server is configured, and the per-IP `/otp` bucket has a burst
 * of 30. The per-user interval is config.toml's `max_frequency = "1s"`; the
 * requests are expected to be further apart than that, but nobody measured
 * it. The same browser sequence with GoTrue mocked passed 30 of 30 attempts,
 * also under 6x CPU throttling.
 *
 * So each failed attempt records the following, which between them separate
 * a 429 (alert «Забагато спроб…» and `→ 429`), a mailer 5xx (`→ 5xx`), a
 * request that never left the page (`sent no`), a network or CORS failure
 * (`failed: …`) and a slow answer (`sent yes`, no answer, the button reading
 * «Надсилаємо…»):
 *   - whether `POST /auth/v1/otp` was sent, and its status and body or its
 *     network failure;
 *   - the `role="alert"` text;
 *   - the URL, the typed address, and the submit button's state and label;
 *   - the page's console warnings and errors during the attempt;
 *   - a screenshot.
 *
 * The attempt is then repeated after 2s, which is longer than
 * `max_frequency`. The daylight caller passes `retries: 1` and prints a
 * `::warning::` line when a pass needed the repeat. Actions shows that line
 * as an annotation, so the cause shows up without turning the run red.
 * Remove the repeat once BL-158 names the cause.
 */
async function requestOtpCode(page, loginUrl, email, { retries = 0, timeoutMs = 15_000, failureShot } = {}) {
  const oneLine = (text) => String(text).replace(/\s+/g, " ").trim();
  const isOtpPost = (req) => req.url().includes("/auth/v1/otp") && req.method() === "POST";
  const attempts = [];
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 2_000));
    await page.goto(loginUrl, { waitUntil: "networkidle0" });
    await page.type("#otp-email", email);

    const consoleLines = [];
    const onConsole = (m) => { if (m.type() === "warn" || m.type() === "error") consoleLines.push(`${m.type()}: ${m.text()}`); };
    let networkFailure = null;
    const onFailed = (req) => { if (isOtpPost(req)) networkFailure = req.failure()?.errorText ?? "unknown"; };
    page.on("console", onConsole);
    page.on("requestfailed", onFailed);
    const otpRequest = page.waitForRequest(isOtpPost, { timeout: timeoutMs }).catch(() => null);
    const otpResponse = page.waitForResponse((r) => isOtpPost(r.request()), { timeout: timeoutMs }).catch(() => null);

    await page.click('button[type="submit"]');
    const outcome = await page.waitForFunction(
      () => (document.querySelector("#otp-code") ? "code" : (document.querySelector('[role="alert"]')?.textContent ?? "").trim() || null),
      { timeout: timeoutMs },
    ).then((h) => h.jsonValue(), (err) => ({ err }));
    if (outcome === "code") {
      page.off("console", onConsole);
      page.off("requestfailed", onFailed);
      return { ok: true, attempts };
    }

    const [req, res] = await Promise.all([otpRequest, otpResponse]);
    page.off("console", onConsole);
    page.off("requestfailed", onFailed);
    let otp = `POST /auth/v1/otp sent ${req ? "yes" : "no"}`;
    if (res) {
      const body = await res.text().catch((err) => `(body unreadable: ${err.message})`);
      otp += `, answered ${res.status()} ${body.slice(0, 300)}`;
    } else if (networkFailure) {
      otp += `, failed: ${networkFailure}`;
    } else if (req) {
      otp += `, no answer within ${timeoutMs}ms`;
    }
    const state = await page.evaluate(() => ({
      url: location.href,
      typed: document.querySelector("#otp-email")?.value ?? null,
      submitDisabled: document.querySelector('button[type="submit"]')?.disabled ?? null,
      submitLabel: document.querySelector('button[type="submit"]')?.textContent?.trim() ?? null,
    })).catch((err) => ({ unreadable: err.message }));
    let shot = failureShot ? failureShot.replace(/\.png$/, `-attempt${attempt}.png`) : null;
    if (shot) {
      await page.screenshot({ path: shot, fullPage: true }).catch((err) => {
        shot = `none (screenshot failed: ${err.message})`;
      });
    }
    const waited = typeof outcome === "string"
      ? `alert «${outcome}»`
      : outcome.err?.name === "TimeoutError"
        ? `no #otp-code and no alert within ${timeoutMs}ms`
        : `the wait failed: ${outcome.err?.name}: ${outcome.err?.message}`;
    attempts.push(oneLine(`attempt ${attempt}: ${waited}; ${otp}; page ${JSON.stringify(state)}`
      + `; console ${consoleLines.length ? JSON.stringify(consoleLines.slice(0, 5)) : "none"}`
      + (shot ? `; screenshot ${shot.startsWith("none") ? shot : path.basename(shot)}` : "")));
  }
  return { ok: false, attempts };
}

/** `null` when the two boxes do not overlap; a description when they do. */
function overlapOf(a, b, aLabel, bLabel) {
  const horizontal = a.left < b.right && b.left < a.right;
  const vertical = a.top < b.bottom && b.top < a.bottom;
  if (!horizontal || !vertical) return null;
  return `${aLabel} [${Math.round(a.left)},${Math.round(a.top)} → ${Math.round(a.right)},${Math.round(a.bottom)}] `
    + `overlaps ${bLabel} [${Math.round(b.left)},${Math.round(b.top)} → ${Math.round(b.right)},${Math.round(b.bottom)}]`;
}

async function rectOf(handle) {
  return handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  });
}

/**
 * Every `sb-…` cookie a cookie jar currently holds. `@supabase/ssr` chunks a
 * large session across several of them, so this counts rather than looking for
 * one known name.
 *
 * IT TAKES EITHER A `Browser` OR A `BrowserContext`, which are separate
 * `cookies()` methods in puppeteer, and the distinction is the seventh audit's
 * whole point: the external reviewer's context must hold no `sb-` cookie even
 * while the default context — the signed-in foreman's — holds several.
 */
async function supabaseCookieNamesIn(contextOrBrowser) {
  return (await contextOrBrowser.cookies())
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => c.name)
    .sort();
}

/**
 * DID THE BROWSER ACTUALLY DECODE PIXELS — the only honest way to ask «is the
 * photo there», and the reason no screenshot appears in that assertion.
 *
 * `naturalWidth` is 0 for every way an image can fail while still looking
 * plausible in a capture: a 404 or 403 on a signed URL, an expired token, a
 * CSP refusal, a byte stream that carries a header and no scan data. It is
 * non-zero only when the decoder produced a raster. `complete` and `src` are
 * returned beside it so a failure names WHICH of those happened instead of
 * leaving the reader to re-run the harness by hand.
 *
 * It waits, because `loading="lazy"` and a network fetch mean the element can
 * exist for some milliseconds before it has decoded anything — and it
 * distinguishes «no such element» (count 0) from «element that never
 * decoded», which are different defects with different fixes.
 */
async function measureDecodedImage(page, alt, timeoutMs = 15_000) {
  const selector = `img[alt="${alt}"]`;
  await page.waitForFunction(
    (sel) => {
      const img = document.querySelector(sel);
      return img !== null && img.complete;
    },
    { timeout: timeoutMs },
    selector,
  ).catch(() => { /* fall through to the measurement, which reports what it found */ });

  return page.evaluate((sel) => {
    const all = [...document.querySelectorAll(sel)];
    const img = all[0];
    return {
      count: all.length,
      ok: img ? img.naturalWidth > 0 : false,
      naturalWidth: img ? img.naturalWidth : 0,
      complete: img ? img.complete : false,
      src: img ? img.getAttribute("src") : null,
    };
  }, selector);
}

async function measureSmallTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("a, button, input, select, textarea")]
      // `aria-hidden="true"` excludes Radix `Select`'s own `SelectBubbleInput`
      // — a real `<select>`, `tabIndex={-1}` and visually-hidden 1x1, that it
      // renders beside every trigger purely so the VALUE bubbles into native
      // `<form>` submission and autofill. It is not reachable by pointer, by
      // keyboard or by assistive tech (that is what `aria-hidden` means), so
      // it was never a touch target to begin with — the trigger button beside
      // it is, and that one is measured on its own. Added by task 9, first
      // caught on «Нове доручення» because it is the first screen in this
      // app to render a `Select` with real options; the exclusion is general
      // (nothing legitimately interactive is ever `aria-hidden`) so it holds
      // for every audit that calls this helper, not only that screen's.
      .filter((el) => el.getAttribute("aria-hidden") !== "true")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.textContent || el.getAttribute("type") || el.tagName).trim().slice(0, 32),
          w: Math.round(r.width), h: Math.round(r.height),
        };
      })
      .filter((r) => r.h > 0 && (r.h < 44 || r.w < 44)));
}

/**
 * INV-044's sentence, retyped here rather than imported — this file is plain
 * Node ESM with no TypeScript loader, the same reason `lineManifestHash` above
 * is reimplemented instead of imported from `src/lib/manual-baseline.ts`. It
 * is pinned BYTE FOR BYTE against `issue-review-link.tsx`'s own exported
 * constant by that component's unit test, so the two cannot drift silently:
 * a softening edit there fails `issue-review-link.test.tsx`, and an edit that
 * changed both would still have to be a deliberate act in two files.
 */
const ONE_TIME_LINK_NOTICE =
  "Посилання показано один раз. Скопіюйте його зараз — відновити його неможливо, "
  + "лише відкликати й видати нове.";

/** A minimal but genuine JPEG (SOI, a 1×1 frame header, EOI), identical to field-capture.int.test.ts's fixture; since DEV-033 finalization reads the frame's size. */
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);

/**
 * A JPEG A BROWSER CAN ACTUALLY DECODE — and it has to be a second constant,
 * because `JPEG_BYTES` above cannot be one.
 *
 * `JPEG_BYTES` is eighteen bytes: a start-of-image marker, a 1×1 frame header
 * and an end-of-image marker. `evidence-inspection.ts` recognises it as
 * `image/jpeg` and reads its size from the frame header (since DEV-033), and
 * every Node-side test that uses it is right to. But it carries no scan data,
 * so `<img>.naturalWidth` on it is 0 in every browser — which is exactly the
 * assertion the seventh audit makes, and would make the seeded photo
 * indistinguishable from a photo that failed to load. The two fixtures are for
 * two different questions and neither substitutes for the other.
 *
 * 8×8 pixels, 796 bytes, produced by Chrome itself (`canvas.toDataURL(
 * "image/jpeg")`) and decoded back by Chrome to 8×8 before being pasted here.
 * Most of the bulk is the sRGB ICC profile Chrome embeds; it is left in
 * because stripping segments by hand would make this a JPEG this repository
 * invented rather than one a browser produced.
 */
const PHOTO_JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH"
  + "4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAA"
  + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAAB"
  + "FAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAA"
  + "AChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJY"
  + "WVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVog"
  + "AAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAA"
  + "AAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAA0JCgsK"
  + "CA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBD"
  + "AQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09P"
  + "T0//wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAfEAABBAAHAAAAAAAAAAAA"
  + "AAAABhESEwEUFSRDUWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAA//EABgRAAMBAQAAAAAAAAAAAAAAAAECAxER"
  + "/9oADAMBAAIRAxEAPwCbUag13LbWiiXJKTt5h0ACcpJJAiDgGb//2Q==",
  "base64",
);

/** Named once: the seed sends it, the office card renders it as `alt`, the audit selects on it. */
const PHOTO_FILENAME = "приклад-фото-qa.jpg";

/**
 * FIX ROUND 1, FINDING 1 & 2. Every name below is an audit that MUST have
 * been attempted by the time `main()` writes its report — checked at the
 * bottom of `main()` against `ctx.auditsRun`, which `runAudit` populates the
 * instant it is CALLED, before `fn` runs and regardless of whether `fn`
 * throws. This is what makes "the authenticated block never ran" a finding
 * rather than an invisible skip: previously `if (assignmentId) { … }` was
 * the ONLY thing standing between a seeding regression (a well-formed
 * response whose `assignmentId` happens to be missing or empty — `seedWorld`
 * validated `coverage`/`occurrenceCount` but never `assignmentId` itself)
 * and a report that closes with `ok: true` having audited nothing. A harness
 * must be unable to pass by not running; this list plus `runAudit` is what
 * enforces that structurally, not just the explicit `assignmentId` check
 * added at the seeding step below (belt AND braces — either one catching a
 * regression the other missed is the point of having both).
 */
const EXPECTED_AUDITS = [
  "unauthenticated surface",
  "sign-in",
  // BEFORE THE SIGN-OUT AUDIT AND AFTER SIGN-IN — its own header says why:
  // its first half is an authenticated office screen, so it cannot follow the
  // audit that signs the user out.
  "evidence, the review link, and the external plane",
  // ALSO BEFORE SIGN-OUT, FOR THE SAME REASON — it creates through a real
  // authenticated session and needs one. Placed after the register it sits
  // beside (that audit is the read half of this route's neighbourhood; this
  // is the write half) rather than beside "my assignments list", which reads
  // a different screen entirely.
  "assignment creation",
  // BEFORE SIGN-OUT, LIKE EVERYTHING AUTHENTICATED. Seven routes (nine until
  // the field PWA was retired, DEV-035), six widths,
  // two reduced-motion passes; screenshots for the controller, assertions
  // for the machine. Added 2026-09-05 with the field client's migration onto
  // @goproceed/ui — the first pass that can cover the field screens at all.
  "daylight visual audit",
  // LAST, AND ITS POSITION IN THIS LIST IS LOAD-BEARING — see the audit's own
  // header. Its final act destroys the session every audit above needs.
  "dashboard profile and sign-out",
];

/**
 * FIX ROUND 1, FINDING 2. `apps/demo/qa/verify.mjs`'s `main()` wraps every
 * individual audit in its own try/catch for exactly this reason — a crashing
 * selector in ONE audit must not discard every finding the OTHERS already
 * collected, nor prevent `qa-report.json` from being written at all (which
 * is what an uncaught rejection propagating out of `main()` would do: CI
 * still fails, but the artifact-upload step has nothing to upload, and every
 * genuine finding gathered before the crash is lost). `field.mjs`'s first
 * draft only guarded the seeding step; this closes the gap for the other
 * audits — five of them, four also authenticated, so also covered by the
 * `EXPECTED_AUDITS` check above — a crash and a silent skip are two
 * different failure modes and both are now caught).
 */
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
  const ctx = { findings: [], missingAssets: [], auditsRun: new Set() };
  const server = await startNextServer();
  const browser = await launch();
  let userId;

  try {
    // ── Unauthenticated surface ──────────────────────────────────────────
    // Everything here is reachable with no session at all — the manifest,
    // the viewport meta, `lang="uk"`, the redirect itself, and the login
    // screen's own touch targets and copy. Kept first and separate from the
    // authenticated pass below so a failure minting/seeding a user (which
    // needs the local Supabase stack) never hides a regression in the part
    // of the app that needs nothing but a browser.
    await runAudit(ctx, "unauthenticated surface", async () => {
      await withPage(browser, async (page) => {
        const res = await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });
        const finalUrl = page.url();
        if (!finalUrl.includes("/login")) {
          ctx.findings.push(`unauthenticated /: expected a redirect to /login, landed on ${finalUrl}`);
        }
        if (!res || res.status() !== 200) {
          ctx.findings.push(`unauthenticated /: final response was ${res ? res.status() : "no response"}, not 200`);
        }

        const htmlLang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
        if (htmlLang !== "uk") {
          ctx.findings.push(`<html lang="${htmlLang}"> — expected "uk"`);
        }

        const viewport = await page.evaluate(() =>
          document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null);
        if (viewport === null) {
          ctx.findings.push("no <meta name=\"viewport\"> found");
        } else {
          if (!/width=device-width/.test(viewport)) {
            ctx.findings.push(`viewport meta "${viewport}" does not declare width=device-width`);
          }
          // layout.tsx's own comment: capping zoom on a page read outdoors, in
          // daylight, by someone who may be gloved, is an accessibility
          // failure — `maximumScale`/`user-scalable=no` must never reappear.
          if (/maximum-scale|user-scalable\s*=\s*no/.test(viewport)) {
            ctx.findings.push(`viewport meta "${viewport}" caps zoom — this must never ship`);
          }
        }

        // Ukrainian copy, structurally: the two strings a foreman actually
        // reads on this screen, not a full-page snapshot (which would flag on
        // any unrelated copy edit and teach people to ignore this check).
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (!bodyText.includes("Вхід за одноразовим кодом")) {
          ctx.findings.push("login screen: expected copy \"Вхід за одноразовим кодом\" not found");
        }
        if (!bodyText.includes("Надіслати код")) {
          ctx.findings.push("login screen: expected the \"Надіслати код\" button label, not found");
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

    // The manifest's ABSENCE (it was asserted present, parsed and Ukrainian
    // until DEV-035 removed it with the field PWA).
    try {
      // DEV-035 (owner: «Убрать манифест»): the office dashboard is not
      // installable. The file must be gone, and no page may still point at it.
      const manifestRes = await fetch(`${server.baseUrl}/manifest.webmanifest`);
      if (manifestRes.status !== 404) {
        ctx.findings.push(`/manifest.webmanifest: expected 404 now that the manifest is removed, got ${manifestRes.status}`);
      }
      const loginHtml = await fetch(`${server.baseUrl}/login`).then((r) => r.text());
      if (/rel=["']?manifest/.test(loginHtml)) {
        ctx.findings.push("/login still links a web app manifest");
      }
    } catch (err) {
      ctx.findings.push(`/manifest.webmanifest: failed to fetch/parse: ${err}`);
    }

    // proxy.ts's whole reason for excluding /v1 and /external: an
    // unauthenticated API call must come back as the problem+json document
    // the client contract promises, never a 307 to an HTML login page. Task
    // 5's report verified this by hand once; this keeps it verified on every
    // run rather than trusting it stays true.
    // DEV-035: the dashboard moved from `/dash/**` to the root; the old
    // addresses answer a temporary redirect to the same path without the
    // prefix (`next.config.ts`), so a bookmark keeps working.
    try {
      const old = await fetch(`${server.baseUrl}/dash/projects/qa-probe/assignments?x=1`, { redirect: "manual" });
      const to = old.headers.get("location") ?? "";
      const toUrl = new URL(to, server.baseUrl);
      if (old.status !== 307 || toUrl.pathname !== "/projects/qa-probe/assignments" || toUrl.search !== "?x=1") {
        ctx.findings.push(`/dash/projects/qa-probe/assignments?x=1: expected a 307 to /projects/qa-probe/assignments?x=1, got ${old.status} → ${JSON.stringify(to)}`);
      }
      // The redirect must never manufacture a protocol-relative or off-origin
      // Location from a crafted path (DEV-035 review R4-06).
      for (const probe of ["/dash//evil.example", "/dash/%2F%2Fevil.example", "/dash/%5C%5Cevil.example"]) {
        const r = await fetch(`${server.baseUrl}${probe}`, { redirect: "manual" });
        const loc = r.headers.get("location") ?? "";
        if (loc.startsWith("//") || loc.startsWith("\\") || (loc && new URL(loc, server.baseUrl).origin !== new URL(server.baseUrl).origin)) {
          ctx.findings.push(`${probe}: the /dash redirect produced an off-origin Location ${JSON.stringify(loc)}`);
        }
      }
    } catch (err) {
      ctx.findings.push(`/dash redirect probe failed: ${err}`);
    }
    try {
      const v1Res = await fetch(`${server.baseUrl}/v1/me/context`, { redirect: "manual" });
      if (v1Res.status !== 401) {
        ctx.findings.push(`/v1/me/context unauthenticated: expected 401, got ${v1Res.status} (middleware may be intercepting /v1)`);
      }
      const contentType = v1Res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/problem+json")) {
        ctx.findings.push(`/v1/me/context unauthenticated: expected application/problem+json, got "${contentType}"`);
      }
    } catch (err) {
      ctx.findings.push(`/v1/me/context unauthenticated: request failed: ${err}`);
    }

    // ── Seed a user, a session, and the world the obligation screen needs ──
    const stamp = Date.now();
    const email = `pryklad-qa-field-${stamp}@example.test`;
    const password = `Приклад-QA-Пароль-${stamp}!`;
    let assignmentId;
    let workspaceId;
    let projectId;
    let projectName;
    let workItemDescription;
    // The final fix wave's two extra worlds — an empty register, and a project
    // whose money the seeded member may not read. See `seedWorld`'s own
    // constants for why neither can be a state of the main project.
    let emptyProjectId;
    let noMoneyProjectId;
    // The seventh audit's two inputs: the obligation a grant can be scoped to,
    // and the photo that must decode on both planes.
    let occurrenceId;
    let evidenceObjectId;
    try {
      userId = await mintConfirmedUser(email, password);
      const seedBearer = await seedBearerToken(email, password);
      ({
        assignmentId, workspaceId, projectId, projectName, workItemDescription, occurrenceId,
        evidenceObjectId, emptyProjectId, noMoneyProjectId,
      } = await seedWorld(server.baseUrl, seedBearer));

      // FIX ROUND 1, FINDING 1 (CRITICAL). `seedWorld` throwing is not the
      // only way seeding can go wrong — it already validates
      // `requirementOccurrences.coverage`/`occurrenceCount` before
      // returning, but never validated `assignmentId` itself. A route
      // regression that returns a well-formed occurrence set beside a
      // missing or empty `assignmentId` would reach here having thrown
      // nothing, and the four authenticated audits below would then be
      // driven off a value that can never resolve to a real page. Assert
      // the shape explicitly, as a named finding, rather than trusting a
      // later `if`/truthy check to notice — that IS the bug this fixes.
      if (typeof assignmentId !== "string" || assignmentId.length === 0) {
        ctx.findings.push(
          `seedWorld returned successfully but assignmentId is invalid (${JSON.stringify(assignmentId)}) — ` +
          "assignments.create may have regressed; the authenticated audits below will still run and report their own failures against this value",
        );
      }
    } catch (err) {
      // A seeding failure means the authenticated assertions below cannot
      // succeed — but they still RUN (no `if` gates them out any more; see
      // EXPECTED_AUDITS/runAudit above) and report their own specific
      // failures against an undefined assignmentId, rather than being
      // silently skipped. This finding names the root cause so a reader
      // isn't left reconstructing it from three downstream 404s.
      ctx.findings.push(`seeding a user + world failed, authenticated screens will attempt to run anyway and report their own failures: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }

    // FIX ROUND 1, FINDING 1: no `if (assignmentId)` gate here any more —
    // every audit below is ALWAYS attempted via `runAudit` (see its header
    // comment), so `ctx.auditsRun` always ends up containing all of
    // EXPECTED_AUDITS regardless of whether seeding succeeded.
    //
    // WHAT EACH AUDIT ACTUALLY CHECKS, stated precisely (an earlier version of
    // this comment claimed each one validates `assignmentId` "at its own first
    // line", which is not what any of them does). None of them inspects the
    // value directly. Each one navigates to a URL built from it and asserts on
    // the RESULT — a non-200, a missing selector, a wrong landing path — so an
    // undefined or empty `assignmentId` surfaces as that audit's own named
    // finding rather than as a silent skip. The explicit shape check on
    // `assignmentId` lives immediately above, at the seeding step, and is the
    // one place that looks at the value itself.
    await runAudit(ctx, "sign-in", async () => {
      // ── The real login screen, driven for real ──────────────────────────
      // Puppeteer's default browser context shares one cookie jar across
      // every `browser.newPage()` call, so signing in once here leaves every
      // later page in this run already authenticated — exactly like a
      // foreman who signed in once and kept using the same phone.
      const loginDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        // DEV-035: the deep link that proves `?next=` is a dashboard page now
        // (the field PWA's `/a/{id}` it used to be is retired).
        await page.goto(`${server.baseUrl}/login?next=${encodeURIComponent(`/projects/${projectId}`)}`,
          { waitUntil: "networkidle0" });

        await page.type("#otp-email", email);
        await Promise.all([
          page.waitForSelector("#otp-code"),
          page.click('button[type="submit"]'),
        ]);

        const code = await readOtpCode(email);
        await page.type("#otp-code", code);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle0" }),
          page.click('button[type="submit"]'),
        ]);

        const landedOn = new URL(page.url()).pathname;
        if (landedOn !== `/projects/${projectId}`) {
          ctx.findings.push(`sign-in: expected to land on /projects/${projectId} (via ?next=), landed on ${landedOn}`);
        }
      });
      reportDiagnostics("sign-in", loginDiagnostics, ctx.findings, ctx.missingAssets);
    });

    // [2026-09-23, DEV-035] Three audits of the field PWA — «my assignments
    // list», «obligation screen» and «capture in-flight banner» — stood here.
    // The owner retired that client («удали все что в (app)»); the field
    // client is `apps/mobile` (ADR-009 as amended), whose own harness is
    // `pnpm --filter @goproceed/mobile qa`. Their history is in git.
    // [2026-09-23, DEV-042] That harness (apps/mobile/qa/field-web.mjs) and
    // its script are deleted with the Expo web field client (ADR-013). The
    // native field client has no browser or device harness yet.

    await runAudit(ctx, "evidence, the review link, and the external plane", async () => {
      // ═══════════════════════════════════════════════════════════════════
      // THE WHOLE LOOP, BOTH PLANES — Plan D slice D1 task 7.
      //
      // ITS POSITION IS LOAD-BEARING IN BOTH DIRECTIONS. It must run AFTER
      // sign-in (its first half is an authenticated office screen) and
      // BEFORE the dash audit, whose final act signs the seeded user out
      // for real. The task brief says «after the dashboard audit»; that is
      // impossible as written and this is the nearest position that is not
      // — stated here rather than silently reordered, because a reader
      // comparing this file to the brief should find the discrepancy
      // explained instead of assuming one of the two is wrong.
      //
      // WHAT IT PROVES, in the order it proves it:
      //   1. ПТВ opens /assignments/{id} and the photo is THERE —
      //      asserted on the <img>'s own `naturalWidth`, which is zero for
      //      a broken image, a 403 signed URL and an eighteen-byte fixture
      //      alike, and non-zero only if the browser decoded real pixels.
      //      A screenshot would have looked correct in every one of those
      //      cases;
      //   2. «Відправити на перевірку» issues a real grant and shows the
      //      link ONCE, beside the sentence INV-044 requires — and a
      //      reload does not show it again, which is what «once» means;
      //   3. A SECOND BROWSER CONTEXT, with its own empty cookie jar,
      //      opens that link, taps the gate, and sees the same photo —
      //      again on `naturalWidth`. The context is asserted to hold no
      //      `sb-*` cookie at all, so this is the no-account path and not
      //      the signed-in one wearing a different URL.
      //
      // WHY A SECOND CONTEXT AND NOT A SECOND PAGE: puppeteer's default
      // context shares ONE cookie jar across every `browser.newPage()`, so
      // a page opened there would carry the foreman's Supabase session and
      // the audit would prove nothing about a reviewer who has no account.
      // ═══════════════════════════════════════════════════════════════════
      const issued = { url: null };

      // ── -1. THE MONEY SCREEN, ONE STEP BEFORE THE REGISTER NOW ─────────
      //
      // ADDED FOR PLAN D SLICE D2. `/projects/{projectId}` is the new
      // head of the chain this whole slice is about — "project → money →
      // доручення → докази" — and until this audit, exactly like the
      // register before it, NO HARNESS HAD EVER OPENED IT. The lesson that
      // shipped the register's own overflow defect applies unchanged: a
      // route no audit opens is where defects hide, and this screen is
      // DENSER and MORE NUMERIC than the register was, which is precisely
      // where overflow hides best.
      //
      // `readiness.view` WAS ADDED TO THIS FUNCTION'S OWN GRANT CALL ABOVE
      // (`access-grants (field)`) SO THIS AUDIT CAN SEE REAL CONTENT rather
      // than the 403 branch — that refusal is a real, reachable outcome of
      // this route (`blocked-value.service.ts`'s own header proves it
      // reachable, unlike the register's identical-looking one, and names
      // the real condition: FOUR presets — `requirement_owner`,
      // `internal_verifier`, `package_submitter`, `foreman` — grant
      // `project.view` without `readiness.view`), but it is proven by
      // reading the route, `authz.ts` and `technical/permissions/
      // responsibility-presets.csv` together, not by starving THIS audit of
      // the grant a real `pto_engineer`/`commercial_manager` persona already
      // holds per that same CSV (lines 13 and 15, both since 2026-08-17).
      //
      // THE SEEDED WORLD MATERIALISES EXACTLY ONE LIVE BLOCK: one occurrence
      // (`hold`, `blocks_stage_closure`), no evidence DECISION yet (only an
      // uploaded, available photo — evidence present, decision pending), on
      // an assignment with NO `plannedQuantity`. That is `whole_line`
      // attribution by construction (`packages/contracts/src/readiness.ts`'s
      // own account of the two attribution cases), so `totalsByCurrency`
      // carries a real non-zero UAH figure and `wholeLineAttributionCount`
      // is exactly 1 — this audit is not driving an empty-state render by
      // accident.
      //
      // WHAT THIS AUDIT DOES NOT EXERCISE, NAMED RATHER THAN LEFT IMPLICIT:
      // the seeded work item is PRICED (`unitPriceState: "known"`), so
      // `unvaluedRegister` is empty and `UnvaluedRegister` renders nothing —
      // its own `<table>`'s overflow safety rests on reusing `assignments-
      // list.tsx`'s already-measured `min-w-160` (that component's own
      // comment says so), not on a fresh measurement here. Seeding a SECOND,
      // unpriced work item purely to exercise that one table was judged out
      // of proportion to what this audit is for; it is recorded in
      // `NOT_COVERED` below rather than silently left unstated.
      const moneyDiagnostics = await withPage(browser, async (page) => {
        const url = `${server.baseUrl}/projects/${projectId}`;
        const res = await page.goto(url, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/projects/${projectId}: expected 200, got ${res ? res.status() : "no response"}`);
          return;
        }

        // ── STRUCTURAL CHECKS, ONCE, AT DESKTOP WIDTH ───────────────────
        // Attributes, not just visible text — the same correction this
        // repository's own review history applies to every UI check: a
        // link's destination is asserted on its `href`, not inferred from
        // where a click happened to land.
        const structural = await page.evaluate(() => {
          const assignmentsLink = [...document.querySelectorAll("a")]
            .find((a) => (a.textContent ?? "").trim() === "Доручення");
          return {
            assignmentsHref: assignmentsLink ? assignmentsLink.getAttribute("href") : null,
            bodyText: document.body.innerText,
          };
        });

        const expectedAssignmentsHref = `/projects/${projectId}/assignments`;
        if (structural.assignmentsHref !== expectedAssignmentsHref) {
          ctx.findings.push(
            `/projects/${projectId}: the «Доручення» link's href is `
            + `${JSON.stringify(structural.assignmentsHref)}, expected ${JSON.stringify(expectedAssignmentsHref)} — `
            + "the project → money → доручення chain is broken at its second hop",
          );
        }

        // The headline sum: real money, in the seeded currency, never a
        // cross-currency figure (there is only one currency to begin with
        // here, but the ₴ glyph is the cheapest structural proof that
        // `formatMoney` actually ran rather than a blank or a raw number).
        if (!structural.bodyText.includes("₴")) {
          ctx.findings.push(
            `/projects/${projectId}: no ₴ figure on the page — the headline sum did not render, `
            + "or formatMoney produced something that does not look like money",
          );
        }
        // The seeded occurrence's own `approver_role`
        // (`technical_supervisor`, `seedWorld`'s own rule-version call
        // above), asserted as its UKRAINIAN LABEL — CORRECTED IN FIX ROUND
        // 1. This used to assert the raw English identifier itself, which
        // is a test PINNING a defect rather than catching one: the third
        // instance of that shape on this branch, per the coordinator's own
        // finding IMPORTANT 3, and the previous instance
        // (`origin_not_distinguished`, `evidence-labels.ts`'s own account)
        // shipped a raw identifier to a Ukrainian-speaking ПТВ for weeks
        // behind a green suite. `approverRoleLabel` (`src/lib/
        // approver-role-labels.ts`) now maps `technical_supervisor` to
        // «технічний нагляд», so asserting THAT string is what proves the
        // label ran, not merely that some approver-role text reached the
        // page — a regression back to the raw fallback would make this
        // assertion fail rather than silently keep passing.
        if (!structural.bodyText.includes("технічний нагляд")) {
          ctx.findings.push(
            `/projects/${projectId}: expected the approver role's Ukrainian label "технічний `
            + `нагляд" (technical_supervisor via approverRoleLabel) on the page — either the row did `
            + "not render, or the label regressed to a raw identifier",
          );
        }
        if (!structural.bodyText.includes("Заблоковані вимоги")) {
          ctx.findings.push(`/projects/${projectId}: the blocked-reasons list panel did not render`);
        }

        // DEV-035 (2026-09-23): the project frame after the owner's Autumn CRM
        // reference. Asserted on roles and `data-*` hooks, never on classes
        // (02-building-ui.md §8): the trail, the current tab, the KPI row, the
        // readiness block and the work sheet the shell puts the page on.
        const frame = await page.evaluate(() => {
          const tabs = document.querySelector('nav[aria-label="Розділи проєкту"]');
          const current = tabs?.querySelector('[aria-current="page"]');
          return {
            trail: document.querySelector('nav[aria-label="Шлях"]')?.textContent ?? null,
            currentTab: current ? (current.textContent ?? "").trim() : null,
            stats: document.querySelectorAll('[data-slot="stat"]').length,
            readiness: document.body.innerText.includes("Готовність етапів"),
            waffleCells: document.querySelectorAll('[data-slot="waffle"] span').length,
            sheet: !!document.querySelector('main[data-slot="work-sheet"]'),
            railCurrent: document.querySelector('nav[aria-label="Основна навігація"] a[aria-current="page"]')
              ?.getAttribute("href") ?? null,
          };
        });
        if (!frame.trail || !frame.trail.startsWith("Проєкти")) {
          ctx.findings.push(`/projects/${projectId}: no «Проєкти / …» trail (nav «Шлях») above the heading`);
        }
        if (frame.currentTab !== "Огляд") {
          ctx.findings.push(`/projects/${projectId}: the current tab reads ${JSON.stringify(frame.currentTab)}, expected «Огляд» with aria-current=page`);
        }
        if (frame.stats < 3) {
          ctx.findings.push(`/projects/${projectId}: ${frame.stats} KPI card(s) — expected the money card and the two honesty counts at least`);
        }
        if (!frame.readiness || frame.waffleCells === 0) {
          ctx.findings.push(
            `/projects/${projectId}: the readiness block did not render with its requirement cells `
            + `(heading: ${frame.readiness}, cells: ${frame.waffleCells}) — seedWorld's assignment carries one occurrence`,
          );
        }
        if (!frame.sheet) {
          ctx.findings.push(`/projects/${projectId}: the page is not on the shell's work sheet (main[data-slot=work-sheet])`);
        }
        if (frame.railCurrent !== `/projects/${projectId}`) {
          ctx.findings.push(
            `/projects/${projectId}: the rail marks ${JSON.stringify(frame.railCurrent)} as current, `
            + "expected this project's own link",
          );
        }
        // Task item 4: the one-line cause split. The seeded block is
        // SUPERVISION_SIGNATURE_MISSING (evidence present, decision
        // pending), never a customer refusal, so the count is 0 — asserted
        // as the exact rendered sentence rather than just "the label is
        // present", since a sentence with the wrong number is the specific
        // failure this line exists to prevent.
        if (!structural.bodyText.includes("з них повернуто замовником: 0")) {
          ctx.findings.push(
            `/projects/${projectId}: expected the cause-split sentence "з них повернуто замовником: 0" `
            + "verbatim — either it did not render, or byCause's CUSTOMER_MOTIVATED_REFUSAL count is wrong",
          );
        }
        // The good-news empty state must NOT be what rendered — this world
        // has a real live block, so seeing "Нічого не заблоковано" here
        // would mean the route answered zero blocks for a project that has
        // one, which is a worse failure than an overflow.
        if (structural.bodyText.includes("Нічого не заблоковано")) {
          ctx.findings.push(
            `/projects/${projectId}: rendered the good-news empty state over a project with a real `
            + "live block — blockedReasons came back empty when it should not have",
          );
        }

        // ── THE SIX-VIEWPORT-ADJACENT PASS: 1280 desk, 390, 360 ─────────
        for (const width of [1280, 390, 360]) {
          const touch = width < 768;
          await page.setViewport({ width, height: 1400, isMobile: touch, hasTouch: touch });
          const overflow = await measureHorizontalOverflow(page);
          if (overflow) {
            ctx.findings.push(
              `/projects/${projectId} @${width}: the page scrolls sideways by ${overflow.overflow}px `
              + `(viewport ${overflow.viewport}px) — ${overflow.offender}`,
            );
          }
          if (touch) {
            for (const t of await measureSmallTargets(page)) {
              ctx.findings.push(`/projects/${projectId} @${width}: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
            }
          }
        }
        await page.setViewport({ width: 1280, height: 1400 });
        await page.screenshot({ path: path.join(SHOTS, "dash-project-money.png"), fullPage: true });
      });
      reportDiagnostics("project money overview", moneyDiagnostics, ctx.findings, ctx.missingAssets);

      // ── 0. THE REGISTER, THE SCREEN BEFORE THIS ONE ────────────────────
      //
      // ADDED IN THE D1 FINAL FIX WAVE, for a defect that shipped because
      // nothing here had ever opened this route. `/projects/{id}/
      // assignments` is the MIDDLE of the chain the slice exists for
      // (project → assignments → evidence) and no audit addressed it, so the
      // §6 width pass — run against the evidence screen only — could not
      // have seen that the table's four Ukrainian column headings overflowed
      // their own cells at 360 and 390. `Table` is `w-full table-fixed`, so
      // a `w-1/5` column on a phone is about 60px, 24px of which is the
      // `Th`'s `px-3`; «ЗАПЛАНОВАНО» is one unbreakable eleven-character
      // uppercase word and simply ran over its neighbour.
      //
      // ASSERTED PER CELL, NOT BY SCREENSHOT AND NOT BY PAGE OVERFLOW.
      // `scrollWidth > clientWidth` on the `th` itself is precisely the
      // "content is wider than its box" condition; the page-level check
      // below cannot see it, because the panel wrapping the table is
      // `overflow-x-auto` and absorbs the overflow into a scroll container
      // rather than into the document. Both are measured, because they are
      // different failures: a scrolling PANEL is the intended behaviour, a
      // scrolling PAGE is not.
      //
      // AND THE PAGE IS PINNED FIRST, so this cannot pass on the wrong
      // document. A 500, a redirect to /login or an empty register all
      // render zero `th` elements, and "no header overflowed" is trivially
      // true of a page with no headers — the same shape as the INV-044
      // reload assertion this audit had to have corrected in fix round 1.
      const registerDiagnostics = await withPage(browser, async (page) => {
        const url = `${server.baseUrl}/projects/${projectId}/assignments`;
        const res = await page.goto(url, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/projects/${projectId}/assignments: expected 200, got ${res ? res.status() : "no response"}`);
          return;
        }
        for (const width of [1280, 390, 360]) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          const state = await page.evaluate((description) => {
            const ths = [...document.querySelectorAll("table th")];
            return {
              path: location.pathname,
              headings: ths.map((th) => ({
                label: (th.textContent ?? "").trim(),
                scrollWidth: th.scrollWidth,
                clientWidth: th.clientWidth,
              })),
              rowNamed: document.body.innerText.includes(description),
            };
          }, workItemDescription);

          if (state.path !== `/projects/${projectId}/assignments`) {
            ctx.findings.push(`register @${width}: no longer on the register — path is ${state.path}`);
            break;
          }
          if (state.headings.length !== 4) {
            ctx.findings.push(
              `register @${width}: expected the four column headings, found ${state.headings.length} `
              + `(${JSON.stringify(state.headings.map((h) => h.label))}) — an error page, an empty state or a `
              + "changed table would make the overflow check below vacuously true",
            );
            break;
          }
          if (!state.rowNamed) {
            ctx.findings.push(
              `register @${width}: the seeded work item «${workItemDescription}» is not on the page — `
              + "the table is rendering no rows, so nothing below is measuring the real register",
            );
          }
          for (const h of state.headings) {
            if (h.scrollWidth > h.clientWidth) {
              ctx.findings.push(
                `register @${width}: the column heading «${h.label}» overflows its own cell — content `
                + `${h.scrollWidth}px in a ${h.clientWidth}px box. A single Ukrainian word has no break `
                + "opportunity, so it runs into the heading beside it.",
              );
            }
          }
          const overflow = await measureHorizontalOverflow(page);
          if (overflow) {
            ctx.findings.push(
              `register @${width}: the page scrolls sideways by ${overflow.overflow}px `
              + `(viewport ${overflow.viewport}px) — ${overflow.offender}`,
            );
          }
          if (touch) {
            for (const t of await measureSmallTargets(page)) {
              ctx.findings.push(`register @${width}: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
            }
          }
          await page.screenshot({
            path: path.join(SHOTS, `dash-assignments-${width}.png`), fullPage: true,
          });
        }
      });
      reportDiagnostics("assignments register", registerDiagnostics, ctx.findings, ctx.missingAssets);

      const officeDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 1280, height: 900 });
        const res = await page.goto(`${server.baseUrl}/assignments/${assignmentId}`,
          { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/assignments/${assignmentId}: expected 200, got ${res ? res.status() : "no response"}`);
          return;
        }

        // ── 1. The photo, measured and not looked at ───────────────────────
        const decoded = await measureDecodedImage(page, PHOTO_FILENAME);
        if (decoded.count === 0) {
          ctx.findings.push(
            `evidence screen: no <img alt="${PHOTO_FILENAME}"> on /assignments/${assignmentId} — `
            + "the seeded evidence object did not reach the card, or `readUrl` was absent and the "
            + "«Зображення тимчасово недоступне» fallback rendered instead",
          );
        } else if (!decoded.ok) {
          ctx.findings.push(
            `evidence screen: the photo is in the DOM but the browser decoded nothing — naturalWidth `
            + `${decoded.naturalWidth}, complete ${decoded.complete}, src ${decoded.src}. A signed URL that `
            + "404s, expires, or is refused by storage produces exactly this, and a screenshot of it looks "
            + "like a grey box nobody would call a failure.",
          );
        }
        // The photo is filed under the OBLIGATION it was captured against —
        // the group heading carries the occurrence's own id, which is the one
        // thing on this screen that says «this photo answers this
        // requirement» rather than «this assignment has a photo somewhere».
        const groupedUnderOccurrence = await page.evaluate(
          (id) => document.body.innerText.includes(id), occurrenceId);
        if (!groupedUnderOccurrence) {
          ctx.findings.push(
            `evidence screen: the seeded occurrence ${occurrenceId} is not named anywhere on the page — `
            + "the photo may be rendering in the «Без прив'язки до вимоги» group instead of under its obligation",
          );
        }
        await page.screenshot({ path: path.join(SHOTS, "dash-evidence.png"), fullPage: true });

        // ── THE SIX PINNED WIDTHS — docs/design/02-building-ui.md §6 ────────
        //
        // «1920 · 1440 · 1240 · 768 · 390 · 360», the shell's three states.
        // The gate proves the rules and does not prove the thing looks right;
        // this is the half that can be automated — a screenshot per width for
        // a person to look at, plus the two questions that ARE decidable by
        // measurement at every one of them: does anything scroll sideways, and
        // does the touch floor survive. The screen carries a form and a
        // 43-character token now, both of which are exactly the kind of
        // unbreakable string that takes a document's horizontal scroll with
        // it, so this is not ceremony.
        for (const width of [1920, 1440, 1240, 768, 390, 360]) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          await page.screenshot({
            path: path.join(SHOTS, `dash-evidence-${width}.png`), fullPage: true,
          });
          const overflow = await measureHorizontalOverflow(page);
          if (overflow) {
            ctx.findings.push(
              `evidence screen @${width}: the page scrolls sideways by ${overflow.overflow}px `
              + `(viewport ${overflow.viewport}px) — ${overflow.offender}`,
            );
          }
          if (touch) {
            for (const t of await measureSmallTargets(page)) {
              ctx.findings.push(`evidence screen @${width}: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
            }
          }
        }
        // Back to the desk width the rest of this half is written against.
        await page.setViewport({ width: 1280, height: 900 });

        // ── 2. «Відправити на перевірку» ───────────────────────────────────
        const emailInput = await visibleHandle(page, 'input[type="email"]');
        const roleInput = await visibleHandle(page, 'input[placeholder="технічний нагляд"]');
        if (!emailInput || !roleInput) {
          ctx.findings.push(
            "evidence screen: the review-link form is not on the page (email input "
            + `${emailInput ? "found" : "missing"}, role input ${roleInput ? "found" : "missing"}) — `
            + "`IssueReviewLink` renders per occurrence group and this world has exactly one",
          );
          return;
        }
        await emailInput.type("pryklad-tehnahliad-qa@example.test");
        await roleInput.type("технічний нагляд");

        const submit = await visibleHandleWithText(page, "button", "Відправити на перевірку");
        if (!submit) {
          ctx.findings.push('evidence screen: no visible «Відправити на перевірку» button to press');
          return;
        }
        await submit.click();

        // ── WHERE THE TOKEN IS, COUNTED EVERYWHERE IT COULD BE ─────────────
        //
        // FIX ROUND 1. This used to collect `<p>` elements whose ENTIRE
        // trimmed text is the URL, and the comment beside it read as a general
        // «the link appears once» guarantee it did not give. Add the
        // conventional copy affordance later — `<input readOnly value={url}>`
        // beside «Копіювати посилання» — and the token is on screen twice and
        // in a DOM attribute besides, while a `<p>`-shaped count stays at 1.
        //
        // So the search is by TOKEN SHAPE rather than by element shape, across
        // three places a URL can live: the rendered text, every attribute of
        // every element, and the `value` PROPERTY of form controls (React sets
        // that property on a controlled input; the attribute does not always
        // follow it). `distinct` answers «which link», `total` answers «how
        // many times is it on this page» — two different questions, and the
        // second is the one INV-044's «shown once» is about.
        //
        // The 43-character base64url fragment is INV-010's own shape, so the
        // pattern asserts what the link IS as well as that it is there.
        const readLinkOccurrences = () => page.evaluate(() => {
          const RE = /https?:\/\/[^\s"'<>]+\/external\/review#[A-Za-z0-9_-]{43}/g;
          const inText = document.body.innerText.match(RE) ?? [];
          const inAttrs = [];
          for (const el of document.querySelectorAll("*")) {
            for (const a of el.attributes) {
              const m = a.value.match(RE);
              if (m) inAttrs.push(...m);
            }
            if (typeof el.value === "string") {
              const m = el.value.match(RE);
              if (m) inAttrs.push(...m);
            }
          }
          return { inText, inAttrs };
        });
        const readLink = async () => {
          const { inText, inAttrs } = await readLinkOccurrences();
          return { total: inText.length + inAttrs.length, distinct: [...new Set([...inText, ...inAttrs])] };
        };

        // Waits on the same TOKEN SHAPE the count below uses, not on an
        // element shape — so a future affordance change (a readonly input
        // instead of a paragraph) is measured by the count assertion rather
        // than timing out here and reporting the wrong cause.
        const appeared = await page.waitForFunction(
          () => /https?:\/\/[^\s"'<>]+\/external\/review#[A-Za-z0-9_-]{43}/.test(document.body.innerText),
          { timeout: 20_000 },
        ).then(() => true).catch(() => false);
        if (!appeared) {
          const shown = await page.evaluate(() => document.body.innerText);
          ctx.findings.push(
            "evidence screen: pressing «Відправити на перевірку» produced no link within 20s. "
            + `What the screen says instead: ${JSON.stringify(shown.slice(0, 600))}`,
          );
          await page.screenshot({ path: path.join(SHOTS, "dash-review-link-failed.png"), fullPage: true });
          return;
        }

        const links = await readLink();
        if (links.distinct.length !== 1) {
          ctx.findings.push(
            `evidence screen: expected exactly one distinct review link on screen, found ${links.distinct.length}`,
          );
        }
        // ONE LINK, ONCE. A second copy of the same URL — in a readonly input,
        // a `title`, a `data-` attribute — is the same token disclosed twice,
        // and «Посилання показано один раз» is a claim about the token and not
        // about how many <p> elements hold it.
        if (links.total !== 1) {
          ctx.findings.push(
            `evidence screen: the review token appears ${links.total} time(s) on the page (text + attributes + input values); `
            + "INV-044's «shown once» is about the token, not about one element that happens to hold it",
          );
        }
        issued.url = links.distinct[0] ?? null;

        // The origin is the one the SERVER was configured to build on, not
        // whatever the page happened to render — `buildReviewLink` refuses to
        // derive it from a Host header for exactly this reason.
        if (issued.url && !issued.url.startsWith(`${server.externalOrigin}/external/review#`)) {
          ctx.findings.push(
            `evidence screen: the link's origin is not this server's EXTERNAL_LINK_ORIGIN `
            + `(${server.externalOrigin}) — got ${issued.url}`,
          );
        }

        // INV-044, ON THE FACE OF THE RESULT. Not a tooltip, not a title
        // attribute: the sentence must be in the rendered text beside the link.
        const afterIssue = await page.evaluate(() => document.body.innerText);
        if (!afterIssue.includes(ONE_TIME_LINK_NOTICE)) {
          ctx.findings.push(
            `evidence screen: the one-time-link sentence is not on screen beside the link. Expected "${ONE_TIME_LINK_NOTICE}"`,
          );
        }
        // The form is GONE, so the same press cannot be repeated without a
        // reload — this world has exactly one occurrence group, so any
        // remaining submit button would be the issued block failing to replace
        // the form.
        const remainingForms = await page.evaluate(() => document.querySelectorAll('button[type="submit"]').length);
        if (remainingForms !== 0) {
          ctx.findings.push(`evidence screen: the issue form is still on screen after a link was issued (${remainingForms} submit button(s))`);
        }
        await page.screenshot({ path: path.join(SHOTS, "dash-review-link.png"), fullPage: true });

        // ── «ONCE» MEANS ONCE. A reload re-renders this screen from the
        // server, which has an HMAC of the token and not the token. If the
        // link came back here, the product would be storing it somewhere and
        // INV-044 would be false — so this is the assertion that makes the
        // sentence above true rather than merely printed.
        //
        // AND THE RELOAD'S OWN RESPONSE IS CHECKED FIRST — FIX ROUND 1, AND
        // THIS WAS THE DEFECT THIS AUDIT WAS SUPPOSED TO BE INCAPABLE OF.
        //
        // The response used to be discarded and nothing after it re-established
        // that this was still the evidence screen. Make `/assignments/{id}`
        // 500 on a second request — a server-component read that only fails
        // warm, a session read that trips on the freshly written grant row — or
        // redirect it to `/login`, and the search below finds no token on the
        // error page, `total === 0`, no finding fires, and the harness reports
        // zero findings having asserted INV-044 against a stack trace. That is
        // exactly how slice D0's harness went six consecutive green runs
        // through a real bug: a check that returned by a route which wiped the
        // state the bug lived in. The discipline already exists sixty lines
        // above — the first `goto` asserts `status() !== 200` — and the reload
        // simply did not copy it.
        //
        // Three things are established before absence is allowed to mean
        // anything: the response is 200, the path is still this screen, and the
        // screen is rendering its own content (the form is back — which is also
        // the positive proof that the issued block was client state and nothing
        // else — and the photo still decodes).
        const reloadRes = await page.reload({ waitUntil: "networkidle0" });
        const reloadStatus = reloadRes ? reloadRes.status() : null;
        const reloadPath = new URL(page.url()).pathname;
        const formIsBack = await page.evaluate(() => document.querySelectorAll('button[type="submit"]').length);
        const stillDecodes = await measureDecodedImage(page, PHOTO_FILENAME);

        if (reloadStatus !== 200 || reloadPath !== `/assignments/${assignmentId}`
            || formIsBack === 0 || !stillDecodes.ok) {
          ctx.findings.push(
            `evidence screen: the reload did not land back on a working evidence screen — status ${reloadStatus}, `
            + `path ${reloadPath}, submit buttons ${formIsBack}, photo decoded ${stillDecodes.ok} `
            + `(naturalWidth ${stillDecodes.naturalWidth}). The «shown once» assertion below is only meaningful `
            + "against the screen itself; on an error page or a login redirect it would pass by finding nothing.",
          );
        } else {
          const afterReload = await readLink();
          if (afterReload.total !== 0) {
            ctx.findings.push(
              `evidence screen: the review link is STILL on screen after a reload (${afterReload.total} occurrence(s)) — `
              + "the token is being re-derived or stored somewhere, and INV-044 says it cannot be",
            );
          }
        }
      });
      reportDiagnostics("evidence screen", officeDiagnostics, ctx.findings, ctx.missingAssets);

      // ── 3. The external plane, in a browser that has never signed in ─────
      if (!issued.url) {
        ctx.findings.push("external review: no link was issued above, so the no-account path was not driven");
        return;
      }
      const externalContext = await browser.createBrowserContext();
      try {
        const externalDiagnostics = await withPage(externalContext, async (page) => {
          await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
          const res = await page.goto(issued.url, { waitUntil: "networkidle0" });
          if (!res || res.status() !== 200) {
            ctx.findings.push(`external review: expected 200 for the issued link, got ${res ? res.status() : "no response"}`);
            return;
          }

          // THE FRAGMENT IS OUT OF THE ADDRESS BAR BEFORE ANYTHING ELSE
          // (INV-010's client half). Asserted here because this is the first
          // time that line has run in a browser at all.
          const afterStrip = await page.evaluate(() => ({ hash: location.hash, href: location.href }));
          if (afterStrip.hash !== "") {
            ctx.findings.push(`external review: the token is still in the address bar after load (${afterStrip.hash.slice(0, 12)}…)`);
          }

          // The gate: nothing is spent until a person taps.
          const gate = await visibleHandleWithText(page, "button", "Відкрити вимогу");
          if (!gate) {
            const shown = await page.evaluate(() => document.body.innerText);
            ctx.findings.push(`external review: no «Відкрити вимогу» gate button. Page says: ${JSON.stringify(shown.slice(0, 400))}`);
            return;
          }
          // THE ONE CONTROL A ТЕХНАГЛЯД MUST HIT ON A PHONE, measured at the
          // moment it is the only thing on screen. Added in fix round 1: the
          // external plane had the 375px overflow check and no touch-target
          // measurement at all, and this page is a hand-written shell with its
          // own stylesheet — nothing in `packages/ui`'s component contract
          // reaches it, so the 44px floor here is held by one `min-height` in a
          // template literal and by nothing else. Measured at the GATE rather
          // than after it, deliberately: an observer grant renders no decision
          // buttons, so a check on the scope screen would pass by finding
          // nothing to measure.
          for (const t of await measureSmallTargets(page)) {
            ctx.findings.push(`external review gate @375: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
          }
          await gate.click();

          const opened = await page.waitForFunction(
            () => !document.getElementById("scope").hidden,
            { timeout: 20_000 },
          ).then(() => true).catch(() => false);
          if (!opened) {
            const shown = await page.evaluate(() => document.body.innerText);
            ctx.findings.push(`external review: the exchange never revealed the scope. Page says: ${JSON.stringify(shown.slice(0, 400))}`);
            await page.screenshot({ path: path.join(SHOTS, "external-review-failed.png"), fullPage: true });
            return;
          }

          // THE PHOTO, ON THE OTHER PLANE. Same measurement, different
          // mechanism entirely: this one is a same-origin stream through
          // `GET /external/evidence`, authorised by a session cookie the
          // exchange just minted, under a page CSP of `img-src 'self'`.
          const decoded = await measureDecodedImage(page, PHOTO_FILENAME);
          if (decoded.count === 0) {
            const note = await page.evaluate(() => document.getElementById("evidence-note")?.textContent ?? "");
            ctx.findings.push(
              `external review: no <img> for the evidence object — the shell rendered identities only. Note reads: ${JSON.stringify(note)}`,
            );
          } else if (!decoded.ok) {
            ctx.findings.push(
              "external review: the photo is in the DOM but decoded nothing — naturalWidth "
              + `${decoded.naturalWidth}, complete ${decoded.complete}, src ${decoded.src}. `
              + "A CSP refusal, a revoked session or a storage miss all look exactly like this.",
            );
          }

          // SAME-ORIGIN, AND NAMING THE OBJECT THE SEED CREATED. A signed
          // Supabase URL here would be blocked by this page's own
          // `img-src 'self'` before a byte moved — the reason this plane
          // streams — so the shape of the src is not cosmetic.
          if (decoded.src !== null) {
            const expected = `/external/evidence?evidenceObjectId=${evidenceObjectId}`;
            if (decoded.src !== expected) {
              ctx.findings.push(
                `external review: the image src is ${JSON.stringify(decoded.src)}, expected ${JSON.stringify(expected)} — `
                + "an absolute URL, or another object's id, means the shell is not reading the scope it was served",
              );
            }
          }

          // The corrected sentence, and the absence of the one it replaced.
          const bodyText = await page.evaluate(() => document.body.innerText);
          if (bodyText.includes("Перегляд самих файлів у цій версії недоступний")) {
            ctx.findings.push("external review: the page still says the files cannot be viewed, while showing them");
          }

          // NOTHING MAY SCROLL SIDEWAYS ON A PHONE — the same rule the
          // obligation screen is held to, and for the same reason: this
          // page's normative reference ends in a URL and a 64-character
          // sha256, neither of which contains a break opportunity, and a ДБН
          // citation that runs off the right edge is a citation the технагляд
          // cannot read. Caught by the first screenshot this page ever
          // produced; the fix is one `overflow-wrap` declaration in the
          // shell's own style block, and this is what keeps it.
          const overflow = await measureHorizontalOverflow(page);
          if (overflow) {
            ctx.findings.push(
              `external review @375: the page scrolls sideways by ${overflow.overflow}px `
              + `(viewport ${overflow.viewport}px) — ${overflow.offender}`,
            );
          }
          await page.screenshot({ path: path.join(SHOTS, "external-review.png"), fullPage: true });
        });
        reportDiagnostics("external review", externalDiagnostics, ctx.findings, ctx.missingAssets);

        // ── THE PROOF THAT THIS WAS THE NO-ACCOUNT PATH ───────────────────
        // Read AFTER the page did its work, so a cookie set at any point in
        // the exchange would be caught. The external session's own cookie
        // (`__Host-goproceed_external`) is expected and is not an `sb-` one;
        // what must be absent is every Supabase auth cookie, because their
        // presence would mean this context reused the foreman's session and
        // the whole audit proved nothing.
        const leaked = await supabaseCookieNamesIn(externalContext);
        if (leaked.length !== 0) {
          ctx.findings.push(
            `external review: the no-account browser context holds Supabase auth cookies (${leaked.join(", ")}) — `
            + "this run exercised a signed-in browser, not the external plane",
          );
        }
        const externalCookies = (await externalContext.cookies()).map((c) => c.name);
        if (!externalCookies.includes("__Host-goproceed_external")) {
          ctx.findings.push(
            `external review: no __Host-goproceed_external cookie in the external context after the exchange `
            + `(cookies: ${externalCookies.join(", ") || "none"}) — the session that served the bytes is unaccounted for`,
          );
        }
      } finally {
        await externalContext.close();
      }
    });

    // ── "assignment creation" — Plan D3, task 9 ──────────────────────────
    //
    // FOUR BLOCKS SINCE THE FINAL FIX WAVE, and the first two are the reason
    // that wave needed a harness at all — they are the only checks in this file
    // that exercise how a person REACHES this screen rather than what it does
    // once they are on it:
    //   0.  the empty register offers «Нове доручення», and following it lands
    //       on the create screen (F1 — until the fix, the only link to that
    //       route lived in the component the empty register never renders, so
    //       the first доручення in a project was uncreatable through the UI);
    //   0b. a member who may create доручення but may not read the project's
    //       money gets a named refusal instead of ShellFatalError (F2);
    //   1–3. the form itself, unchanged: it renders, it refuses legibly, and a
    //       double press creates exactly one assignment.
    //
    // Blocks 0 and 0b drive projects `seedWorld` creates for them, because
    // neither state is one the main project can be in — see that function's own
    // constants.
    //
    // THE PROOF NO UNIT TEST CAN GIVE. `new-assignment-form.test.tsx` injects
    // a fake `createImpl`; `assignment-creation.int.test.ts` drives the real
    // route directly. Neither opens a browser, so neither can see whether a
    // REAL click on a REAL button — rendered, laid out, hit-tested — actually
    // reaches the form at all, or whether a SECOND real click, thrown as fast
    // as this driver can throw one, is something the disabled attribute
    // stops before a second request leaves.
    //
    // BESIDE THE REGISTER ON PURPOSE (both in EXPECTED_AUDITS and here): the
    // register audit above is the READ half of this same neighbourhood — it
    // opens `/projects/{projectId}/assignments` and asserts on what is
    // already there. This is the WRITE half, on the screen one hop further
    // in, and it reuses that audit's `projectId` and `workItemDescription`
    // rather than seeding a second world.
    //
    // THE ROW COUNT IS TAKEN FROM THE TABLE, NOT FROM A ROUTE'S OWN OPINION
    // OF WHAT IT WROTE — a 201 that counted something it did not persist, or
    // a route that persisted twice while answering once, would both still
    // look fine from a response body. `countAssignments` queries
    // `public.work_assignments` directly, before the two presses and after.
    //
    // AND THE REQUEST COUNT IS TAKEN FROM THE NETWORK, NOT ONLY THE TABLE.
    // `after === before + 1` alone would still pass even with the disabled
    // guard ripped out of `new-assignment-form.tsx`, because both presses
    // send the SAME `idempotencyKey.current` and the server's own
    // `withIdempotency` (packages/database/src/idempotency.ts) replays the
    // first response for the second — a real concurrent double press would
    // still leave exactly one row. That would be a true and useful fact, but
    // it is a fact about the SERVER's safety net, not about whether the
    // button actually disabled. Counting the POSTs that left the browser is
    // the assertion that is specifically about the client guard: with it
    // removed, two requests leave even though idempotency still collapses
    // them to one row, and this line — not the row count — is what catches
    // that.
    await runAudit(ctx, "assignment creation", async () => {
      // ── 0. THE WAY IN, FROM THE STATE THAT NEEDS IT MOST ────────────────
      //
      // F1, and it is the reason this block exists at all. Until the final fix
      // wave the ONLY navigational entry point to `/assignments/new` lived in
      // `assignments-list.tsx`, which `assignments/page.tsx` renders only when
      // the register already has a row — so the first доручення in a project
      // could not be created through the UI. Every other check in this file
      // drives `/assignments/new` by URL, which is exactly the move an owner
      // holding a browser cannot make, so none of them could see it.
      //
      // IT NEEDS ITS OWN PROJECT. The seeded world's register has had a row
      // since `seedWorld` returned; an empty register is not a state the main
      // project can be in, which is why `EMPTY_PROJECT_NAME` is seeded.
      //
      // AND IT IS FOLLOWED, NOT JUST FOUND. A control that carries the right
      // label and the right href and lands on a broken screen is the defect
      // wearing the fix's clothes, so the click is real and the destination is
      // asserted — the no-baseline empty state, which is the honest answer for
      // a project with no published contract version.
      const entryDiag = await withPage(browser, async (page) => {
        await page.setViewport({ width: 1280, height: 900 });
        const registerUrl = `${server.baseUrl}/projects/${emptyProjectId}/assignments`;
        const res = await page.goto(registerUrl, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(
            `empty register: expected 200 for ${registerUrl}, got ${res ? res.status() : "no response"}`);
          return;
        }

        const empty = await page.evaluate(() => ({
          text: document.body.innerText,
          tables: document.querySelectorAll("table").length,
          createHrefs: [...document.querySelectorAll("a")]
            .filter((a) => (a.textContent ?? "").trim() === "Нове доручення")
            .map((a) => a.getAttribute("href")),
        }));
        // The page IS the empty state — pinned first, so the assertions below
        // cannot pass on a register that quietly grew a row.
        if (!empty.text.includes("Немає доручень") || empty.tables !== 0) {
          ctx.findings.push(
            `empty register: expected the «Немає доручень» empty state and no table on ${registerUrl} `
            + `(tables found: ${empty.tables}) — this project is supposed to have no assignment, so `
            + "everything below would be measuring the wrong screen");
          return;
        }
        const wantHref = `/projects/${emptyProjectId}/assignments/new`;
        if (!empty.createHrefs.includes(wantHref)) {
          ctx.findings.push(
            `empty register: no «Нове доручення» link to ${wantHref} on a project with no доручення — `
            + "the first assignment in a project cannot be created through the UI "
            + `(anchors with that label found: ${JSON.stringify(empty.createHrefs)})`);
          return;
        }

        // The 44px floor applies to it exactly as it does to the register's own
        // copy of this control — a new control on a touch width is a new place
        // for that floor to be missed.
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        for (const t of await measureSmallTargets(page)) {
          ctx.findings.push(`empty register @390: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
        }
        await page.screenshot({
          path: path.join(SHOTS, "dash-assignments-empty-390.png"), fullPage: true,
        });
        await page.setViewport({ width: 1280, height: 900 });

        // FOLLOWED FOR REAL, through the anchor, the way a person would.
        const link = await visibleHandleWithText(page, "a", "Нове доручення");
        if (!link) {
          ctx.findings.push("empty register: the «Нове доручення» link is in the DOM but not visible");
          return;
        }
        await link.click();
        await link.dispose();
        await page.waitForFunction(
          (want) => location.pathname === want, { timeout: 10_000 }, wantHref,
        ).catch(() => {});

        const landed = await page.evaluate(() => ({
          path: location.pathname,
          heading: document.querySelector("h1")?.textContent?.trim() ?? "",
          text: document.body.innerText,
        }));
        if (landed.path !== wantHref) {
          ctx.findings.push(
            `empty register: following «Нове доручення» left the browser on ${landed.path}, not ${wantHref}`);
          return;
        }
        if (landed.heading !== "Нове доручення") {
          ctx.findings.push(
            `empty register: the create screen reached from the empty state has the heading `
            + `"${landed.heading}", not «Нове доручення»`);
        }
        // This project has no contract at all, so the honest answer is the
        // no-baseline empty state — never the shell's fatal error.
        if (!landed.text.includes("У проєкті ще немає опублікованої версії договору")) {
          ctx.findings.push(
            "empty register: the create screen reached from the empty state did not render the "
            + "no-baseline empty state for a project with no published contract version — page text: "
            + `"${landed.text.replace(/\s+/g, " ").slice(0, 240)}"`);
        }
        await page.screenshot({
          path: path.join(SHOTS, "dash-assignment-creation-no-baseline.png"), fullPage: true,
        });
      });
      reportDiagnostics("empty register", entryDiag, ctx.findings, ctx.missingAssets);

      // ── 0b. THE MONEY REFUSAL, LEGIBLE ──────────────────────────────────
      //
      // F2. `listPublishedBaselines` reads a project's published baselines
      // through `blocked_value.get`, gated by `readiness.view` — a capability
      // four responsibility presets do NOT grant alongside `project.view`. That
      // refusal used to fold into the service's `error` arm, which the route
      // renders as `ShellFatalError`: «Не вдалося завантажити робочий простір»,
      // the copy for a system that broke, shown to a member who is simply not
      // granted a read and who can create the same assignment by curl.
      //
      // `NO_MONEY_PROJECT_NAME` is seeded with `project.view` and
      // `assignments.manage` and WITHOUT `readiness.view`, which is the only
      // way to stand in that person's shoes without minting a second user.
      const forbiddenDiag = await withPage(browser, async (page) => {
        await page.setViewport({ width: 1280, height: 900 });
        const url = `${server.baseUrl}/projects/${noMoneyProjectId}/assignments/new`;
        const res = await page.goto(url, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(
            `money refusal: expected 200 for ${url}, got ${res ? res.status() : "no response"}`);
          return;
        }
        const state = await page.evaluate(() => ({
          heading: document.querySelector("h1")?.textContent?.trim() ?? "",
          statuses: [...document.querySelectorAll('[role="status"]')]
            .map((n) => (n.textContent ?? "").trim()),
          text: document.body.innerText,
        }));
        // The generic fatal error is what this fix removed; naming it is what
        // makes this assertion a regression test rather than a spot check.
        if (state.text.includes("Не вдалося завантажити робочий простір")) {
          ctx.findings.push(
            "money refusal: a member with project.view + assignments.manage but no readiness.view still "
            + "gets ShellFatalError on the create screen — a permission boundary rendered as a system failure");
        }
        if (!state.statuses.some((t) => t.includes("Немає доступу до кошторисів цього проєкту"))) {
          ctx.findings.push(
            'money refusal: no [role="status"] banner naming the missing access on the create screen — '
            + `statuses found: ${JSON.stringify(state.statuses)}`);
        }
        // The refusal is about the money, not about the project, so the screen
        // still asserts which screen it is — the route's own stated rule.
        if (state.heading !== "Нове доручення") {
          ctx.findings.push(
            `money refusal: expected the heading «Нове доручення» to survive the refusal, found "${state.heading}"`);
        }
        // The banner carries a title AND a sentence, so the state is never
        // signalled by colour alone.
        const banner = state.statuses.find((t) => t.includes("Немає доступу до кошторисів цього проєкту")) ?? "";
        if (!banner.includes("Попросіть адміністратора проєкту")) {
          ctx.findings.push(
            "money refusal: the banner names the refusal but not what to do about it — its body did not render");
        }
        await page.screenshot({
          path: path.join(SHOTS, "dash-assignment-creation-forbidden.png"), fullPage: true,
        });
      });
      reportDiagnostics("money refusal", forbiddenDiag, ctx.findings, ctx.missingAssets);

      const diag = await withPage(browser, async (page) => {
        const posts = [];
        page.on("request", (req) => {
          if (req.method() !== "POST") return;
          if (/^\/v1\/contracts\/[^/]+\/assignments$/.test(new URL(req.url()).pathname)) {
            posts.push(req.url());
          }
        });

        const url = `${server.baseUrl}/projects/${projectId}/assignments/new`;
        const res = await page.goto(url, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`assignment creation: expected 200 for ${url}, got ${res ? res.status() : "no response"}`);
          return;
        }

        // ── 1. THE FORM RENDERS ─────────────────────────────────────────
        const heading = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? "");
        if (heading !== "Нове доручення") {
          ctx.findings.push(`assignment creation: expected the heading "Нове доручення", found "${heading}"`);
        }
        const trigger = await visibleHandleWithText(page, 'button[role="combobox"]', "Оберіть рядок");
        const submitLabel = await visibleHandleWithText(page, 'button[type="submit"]', "Створити доручення");
        if (!trigger || !submitLabel) {
          ctx.findings.push(
            `assignment creation: the form did not render (work-item picker found: ${!!trigger}, `
            + `submit control found: ${!!submitLabel}) — the checks below could not run`,
          );
          await trigger?.dispose();
          await submitLabel?.dispose();
          return;
        }
        await trigger.dispose();
        await submitLabel.dispose();

        // ── §6, THE SIX WIDTHS — docs/design/02-building-ui.md §6 ────────
        //
        // The gate proves the rules and does not prove the thing looks
        // right; this is the half that can be automated. Run on the form's
        // OWN resting state, which is also its most genuinely Ukrainian one
        // — «Рядок кошторису», «Виконавець», two «Необов'язково.» hints —
        // never lorem, and never re-typed: it is whatever
        // `new-assignment-form.tsx` actually renders.
        for (const width of [1920, 1440, 1240, 768, 390, 360]) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          const overflow = await measureHorizontalOverflow(page);
          if (overflow) {
            ctx.findings.push(
              `assignment creation @${width}: the page scrolls sideways by ${overflow.overflow}px `
              + `(viewport ${overflow.viewport}px) — ${overflow.offender}`,
            );
          }
          if (touch) {
            for (const t of await measureSmallTargets(page)) {
              ctx.findings.push(`assignment creation @${width}: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
            }
          }
          await page.screenshot({
            path: path.join(SHOTS, `dash-assignment-creation-${width}.png`), fullPage: true,
          });
        }
        await page.setViewport({ width: 1280, height: 900 });

        // ── §6, THE ERROR STATE, LEGIBLE WITH COLOUR REMOVED ──────────────
        //
        // Submitted with NOTHING chosen, so zod's own client-side refusal —
        // never the network — is what produces it (confirmed below: this
        // must add nothing to `posts`). `FieldError` (packages/ui/src/
        // components/Field.tsx) pairs the red text with an `aria-hidden`
        // «✕» glyph precisely so the message does not depend on colour to
        // be read; the glyph's presence is the structural half of that
        // claim, and the screenshot is the visual half.
        const postsBeforeErrorCheck = posts.length;
        // THE VIEWPORT IS SET BEFORE THE CLICK, NOT AFTER — measured, not
        // assumed. An earlier draft clicked submit at the desk width and
        // resized to 390 afterward; the screenshot then showed the PRISTINE
        // form, byte-for-byte identical to the no-error one (diffed pixel
        // for pixel), even though the structural check just above (same
        // run, same `page`) found `[role="alert"]` with the right text
        // immediately before the resize. `page.setViewport({ isMobile:
        // true, … })` toggling `isMobile` mid-session is what erased it.
        // Fixed by never touching `isMobile` between the click and the shot.
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        const emptySubmit = await visibleHandle(page, 'button[type="submit"]');
        if (!emptySubmit) {
          ctx.findings.push("assignment creation: the submit control was not found for the error-state check");
        } else {
          await emptySubmit.click();
          await emptySubmit.dispose();
          const errorShown = await page.waitForSelector('[role="alert"]', { timeout: 5_000 })
            .then(() => true).catch(() => false);
          if (!errorShown) {
            ctx.findings.push(
              'assignment creation: submitting with no line chosen produced no [role="alert"] — the '
              + "client-side validation error did not render",
            );
          } else {
            const errorState = await page.evaluate(() => {
              const alert = document.querySelector('[role="alert"]');
              return {
                text: (alert?.textContent ?? "").trim(),
                hasGlyph: !!alert?.querySelector('[aria-hidden="true"]'),
              };
            });
            if (!errorState.text.includes("Оберіть рядок кошторису")) {
              ctx.findings.push(
                `assignment creation: expected the Ukrainian «Оберіть рядок кошторису.» validation `
                + `message, found "${errorState.text}"`,
              );
            }
            if (!errorState.hasGlyph) {
              ctx.findings.push(
                "assignment creation: the field error carries no non-colour glyph — it would be "
                + "unreadable with colour removed",
              );
            }
          }
          await page.screenshot({
            path: path.join(SHOTS, "dash-assignment-creation-error-390.png"), fullPage: true,
          });
        }
        await page.setViewport({ width: 1280, height: 900 });
        if (posts.length !== postsBeforeErrorCheck) {
          ctx.findings.push(
            "assignment creation: submitting with no line chosen reached the network — client-side "
            + "validation should have refused it before any request left the browser",
          );
        }

        // ── §6, REDUCED MOTION IS A DIFFERENT ANIMATION, NEVER A FASTER
        // ONE (rule 8) ─────────────────────────────────────────────────
        //
        // The work-item picker's popup is `animate-chip-in
        // motion-reduce:animate-none` (packages/ui/src/components/
        // Select.tsx) — the same treatment `top-bar.tsx`'s drawer uses,
        // checked the same way this file already checks the drawer: under
        // `prefers-reduced-motion: reduce` the computed animation-name must
        // be `none`, not merely shorter.
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.reload({ waitUntil: "networkidle0" });
        const reducedTrigger = await visibleHandleWithText(page, 'button[role="combobox"]', "Оберіть рядок");
        if (!reducedTrigger) {
          ctx.findings.push("assignment creation: the work-item picker was not found after reload under reduced motion");
        } else {
          await reducedTrigger.click();
          await reducedTrigger.dispose();
          await page.waitForSelector('[role="listbox"]', { timeout: 5_000 }).catch(() => {});
          // SCREENSHOT BEFORE `evaluate`, AND `fullPage: false` — measured,
          // not assumed. Radix `Select` (unlike the drawer's `Dialog`) uses
          // `position="item-aligned"`: it aligns the popup to the trigger
          // AT OPEN TIME and repositions on resize/scroll. `fullPage: true`
          // makes Puppeteer resize the page to its full scrollable height to
          // capture it, and that resize was enough to make the popup close
          // itself before the shot — an earlier draft's screenshot here was
          // the pristine closed trigger, not the open popup, even though the
          // `[role="listbox"]` had just been found. A full-page shot of a
          // Dialog survives this (fixed positioning, not trigger-relative);
          // an item-aligned Select popup does not.
          await page.screenshot({
            path: path.join(SHOTS, "dash-assignment-creation-reduced-motion.png"), fullPage: false,
          });
          const reducedMotion = await page.evaluate(() => {
            const content = document.querySelector('[data-slot="select-content"]');
            if (!content) return null;
            const s = getComputedStyle(content);
            return { name: s.animationName, duration: s.animationDuration };
          });
          if (!reducedMotion) {
            ctx.findings.push(
              "assignment creation: the work-item picker did not open under reduced motion, so its "
              + "animation could not be checked",
            );
          } else if (reducedMotion.name !== "none") {
            ctx.findings.push(
              `assignment creation: the work-item picker still animates under reduced motion `
              + `(animation-name: ${reducedMotion.name}, ${reducedMotion.duration}) — reduced motion `
              + "must remove the animation, not shorten it",
            );
          }
          await page.keyboard.press("Escape");
        }
        await page.emulateMediaFeatures([]);

        // A FRESH, NORMAL-MOTION LOAD for the two creation checks below —
        // the `reload()` above dropped whatever the earlier steps had
        // selected, which is the point: the double-press proof must start
        // from the same empty form a foreman actually opens.
        await page.reload({ waitUntil: "networkidle0" });

        // ── Choose the one seeded line ───────────────────────────────────
        const finalTrigger = await visibleHandleWithText(page, 'button[role="combobox"]', "Оберіть рядок");
        if (!finalTrigger) {
          ctx.findings.push("assignment creation: the work-item picker was not found after the final reload");
          return;
        }
        await finalTrigger.click();
        await finalTrigger.dispose();
        await page.waitForSelector('[role="listbox"]', { timeout: 5_000 }).catch(() => {});
        const option = await visibleHandleWithText(page, '[role="option"]', workItemDescription);
        if (!option) {
          ctx.findings.push(
            `assignment creation: no option "${workItemDescription}" in the work-item picker — the seeded `
            + "line is not offered, and the creation checks below could not run",
          );
          return;
        }
        await option.click();
        await option.dispose();

        // ── 2 & 3. ONE SUBMIT CREATES ONE, AND A DOUBLE PRESS CREATES ONE ─
        //
        // TWO PRESSES, DELIBERATELY, and as close together as this driver
        // can put them — see this audit's own header for why both the row
        // count and the request count are asserted below.
        const before = await countAssignments(workspaceId, projectId);
        const submit = await visibleHandle(page, 'button[type="submit"]');
        if (!submit) {
          ctx.findings.push("assignment creation: the submit control vanished after choosing the line");
          return;
        }
        await submit.click();
        await submit.click().catch(() => {});
        await submit.dispose();

        await page.waitForFunction(
          (want) => location.pathname === want,
          { timeout: 10_000 }, `/projects/${projectId}/assignments`,
        ).catch(() => {});

        const after = await countAssignments(workspaceId, projectId);
        if (after !== before + 1) {
          const banner = await page.evaluate(
            () => document.querySelector('[role="alert"]')?.textContent?.trim() ?? null);
          ctx.findings.push(
            `assignment creation: expected exactly one new row in public.work_assignments (workspace `
            + `${workspaceId}, project ${projectId}) after a submit and an immediate second press, went from `
            + `${before} to ${after}` + (banner ? ` — banner on screen: "${banner}"` : ""),
          );
        }
        if (posts.length !== 1) {
          ctx.findings.push(
            `assignment creation: expected exactly one POST to assignments.create to leave the browser for two `
            + `rapid presses on the submit control, saw ${posts.length} — the button's disabled state did not `
            + "stop the second click from firing a second request",
          );
        }

        await page.screenshot({ path: path.join(SHOTS, "dash-assignment-creation.png"), fullPage: true });
      });
      reportDiagnostics("assignment creation", diag, ctx.findings, ctx.missingAssets);
    });

    await runAudit(ctx, "daylight visual audit", async () => {
      // ═══════════════════════════════════════════════════════════════════
      // THE SIX-VIEWPORT PASS UNDER THE DAYLIGHT PALETTE — spec
      // 2026-09-05-app-daylight-migration-design.md §5.2.
      //
      // The tokens moved system-wide on 2026-09-05 and every surface
      // re-coloured through its roles with nobody looking. This audit is the
      // looking: nine routes × six widths, plus reduced motion at 1440 and
      // 390, a full-page capture of each for the controller's review, and
      // the assertions a machine can make — overflow, the touch floor, UA
      // link styling, the signal budget, status-never-colour-alone, the face.
      //
      // Runs BEFORE the sign-out audit because eight of the nine routes need
      // the session that audit destroys. The unauthenticated /login is
      // captured through a second browser context with an empty cookie jar,
      // so the signed-in page's session cannot leak into it.
      // ═══════════════════════════════════════════════════════════════════
      // DEV-035: an old field-PWA link, signed in, lands on the Ukrainian 404
      // (`app/not-found.tsx`) — not on Next's built-in English page.
      await withPage(browser, async (page) => {
        const res = await page.goto(`${server.baseUrl}/a/qa-retired-probe`, { waitUntil: "networkidle0" });
        const text = await page.evaluate(() => document.body.innerText);
        const lang = await page.evaluate(() => document.documentElement.lang);
        if (!res || res.status() !== 404) ctx.findings.push(`/a/qa-retired-probe: expected 404, got ${res ? res.status() : "no response"}`);
        if (!text.includes("Сторінку не знайдено") || lang !== "uk") {
          ctx.findings.push(`/a/qa-retired-probe: the Ukrainian not-found page did not render (lang ${JSON.stringify(lang)})`);
        }
        const home = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent?.trim() === "До кабінету")?.getAttribute("href") ?? null);
        if (home !== "/") ctx.findings.push(`/a/qa-retired-probe: «До кабінету» points at ${JSON.stringify(home)}, expected "/"`);
        await page.screenshot({ path: path.join(SHOTS, "not-found.png"), fullPage: true });
      });

      const DAYLIGHT_WIDTHS = [1920, 1440, 1240, 768, 390, 360];
      const DAYLIGHT_REDUCED = [1440, 390];
      const daylightShots = path.join(SHOTS, "daylight");
      await mkdir(daylightShots, { recursive: true });

      const routes = [
        { slug: "login", path: "/login", anonymous: true },
        { slug: "dash-home", path: "/" },
        { slug: "dash-project", path: `/projects/${projectId}` },
        { slug: "dash-register", path: `/projects/${projectId}/assignments` },
        { slug: "dash-new-assignment", path: `/projects/${emptyProjectId}/assignments/new` },
        { slug: "dash-evidence", path: `/assignments/${assignmentId}` },
        { slug: "dash-profile", path: "/settings/profile" },
      ];

      const inspect = async (page, label, width) => {
        const overflow = await measureHorizontalOverflow(page);
        if (overflow) {
          ctx.findings.push(`${label} @${width}: scrolls sideways by ${overflow.overflow}px (viewport ${overflow.viewport}px) — ${overflow.offender}`);
        }
        if (width < 768) {
          for (const t of await measureSmallTargets(page)) {
            ctx.findings.push(`${label} @${width}: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
          }
        }
        for (const link of await measureUaStyledLinks(page)) {
          ctx.findings.push(`${label} @${width}: anchor "${link.label}" renders with user-agent link styling (${link.color}, ${link.decoration})`);
        }
        const budget = await page.evaluate(() => {
          const signal = getComputedStyle(document.documentElement).getPropertyValue("--gp-action-signal-bg").trim();
          const probe = document.createElement("i");
          probe.style.backgroundColor = signal;
          document.body.append(probe);
          const resolved = getComputedStyle(probe).backgroundColor;
          probe.remove();
          if (!resolved || resolved === "rgba(0, 0, 0, 0)") {
            return { unresolved: true };
          }
          const hits = [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).backgroundColor === resolved);
          return { resolved, count: hits.length, samples: hits.slice(0, 3).map((el) => {
            const cls = el.getAttribute("class") ?? "";
            return `${el.tagName.toLowerCase()}${cls ? "." + cls.split(" ")[0] : ""}`;
          }) };
        });
        if (budget.unresolved) {
          ctx.findings.push(`${label} @${width}: signal probe: --gp-action-signal-bg did not resolve`);
        } else if (budget.count > 1) {
          ctx.findings.push(`${label} @${width}: ${budget.count} elements carry the signal background (${budget.samples.join(", ")}) — at most one per screen`);
        }
        // DEV-035 (2026-09-23): `Meter` reached a dashboard page for the first
        // time (the readiness block). Its colour is never alone, but it is not
        // INSIDE the text either: a legend dot sits beside its label in the
        // same `li`, and the bar is `aria-hidden` with every state named in the
        // legend under it. So a status colour passes when it is a dot in a
        // Meter legend `li` that carries text, or when it is inside an
        // `aria-hidden` drawing of a Meter whose legend carries text. Both are
        // scoped to `[data-slot="meter"]`, so no other swatch is excused by
        // text that happens to sit nearby (review R1-04). A swatch with no
        // label anywhere near it still fails.
        const silentStatus = await page.evaluate(() =>
          [...document.querySelectorAll('[class*="bg-status-"]')]
            .filter((el) => (el.textContent ?? "").trim().length === 0 && !el.querySelector("img, svg[aria-label]"))
            .filter((el) => !(el.closest('[data-slot="meter"] li')
              && (el.closest("li")?.textContent ?? "").trim().length > 0))
            .filter((el) => !(el.closest('[aria-hidden="true"]')
              && (el.closest('[data-slot="meter"]')?.querySelector("ul")?.textContent ?? "").trim().length > 0))
            .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ").find((c) => c.startsWith("bg-status-"))}`));
        for (const s of silentStatus) {
          ctx.findings.push(`${label} @${width}: ${s} carries a status colour and no text — status is never colour alone`);
        }
        await assertBrandFaces(ctx, page, `${label} @${width}`);
      };

      const walkRoute = async (page, route) => {
        for (const width of DAYLIGHT_WIDTHS) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          const res = await page.goto(`${server.baseUrl}${route.path}`, { waitUntil: "networkidle0" });
          if (!res || res.status() !== 200) {
            ctx.findings.push(`${route.path} @${width}: expected 200, got ${res ? res.status() : "no response"}`);
            continue;
          }
          await waitForAnimations(page);
          await inspect(page, route.path, width);
          await page.screenshot({ path: path.join(daylightShots, `${route.slug}-${width}.png`), fullPage: true });
        }
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        for (const width of DAYLIGHT_REDUCED) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          const res = await page.goto(`${server.baseUrl}${route.path}`, { waitUntil: "networkidle0" });
          if (!res || res.status() !== 200) {
            ctx.findings.push(`${route.path} (reduced motion) @${width}: expected 200, got ${res ? res.status() : "no response"}`);
            continue;
          }
          await waitForAnimations(page);
          await inspect(page, `${route.path} (reduced motion)`, width);
          await page.screenshot({ path: path.join(daylightShots, `${route.slug}-${width}-reduced.png`), fullPage: true });
        }
        await page.emulateMediaFeatures([]);
      };

      // The signed-in routes, in the default context.
      const diagnostics = await withPage(browser, async (page) => {
        for (const route of routes.filter((r) => !r.anonymous)) await walkRoute(page, route);

        // The sign-out confirm, open, at 1440 and 390 — the first screen the
        // TODOS entry named. Opened the way the sign-out audit opens it,
        // cancelled the way it cancels it, so the session survives.
        for (const width of [1440, 390]) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          await page.goto(`${server.baseUrl}/settings/profile`, { waitUntil: "networkidle0" });
          // Below 768 the profile control sits inside the mobile drawer — open
          // it first, the same way the sign-out audit's own drawer opens it.
          if (touch) {
            await page.click('button[aria-label="Відкрити меню"]');
            await page.waitForSelector('[role="dialog"]');
            await waitForAnimations(page);
          }
          const trigger = await visibleHandle(
            page,
            touch ? '[role="dialog"] button[aria-label="Профіль і вихід"]' : 'button[aria-label="Профіль і вихід"]',
          );
          if (!trigger) { ctx.findings.push(`sign-out confirm @${width}: no visible profile control`); continue; }
          await trigger.click();
          await trigger.dispose();
          const item = await visibleHandleWithText(page, '[role="menuitem"]', "Вийти");
          if (!item) { ctx.findings.push(`sign-out confirm @${width}: no «Вийти» item`); continue; }
          await item.click();
          await page.waitForFunction(
            () => [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.innerText ?? "").includes("Вийти з системи?")),
            { timeout: 5_000 });
          await waitForAnimations(page);
          await inspect(page, "sign-out confirm", width);
          await page.screenshot({ path: path.join(daylightShots, `dash-sign-out-${width}.png`), fullPage: true });
          const cancel = await visibleHandleWithText(page, '[role="dialog"] button', "Скасувати");
          if (cancel) { await cancel.click(); await cancel.dispose(); }
          await page.keyboard.press("Escape");
        }
      });
      reportDiagnostics("daylight visual audit", diagnostics, ctx.findings, ctx.missingAssets);

      // /login and the OTP second step, in a context that has never signed in.
      const anonymous = await browser.createBrowserContext();
      try {
        const page = await anonymous.newPage();
        await walkRoute(page, routes[0]);
        // The second step: type an address, request a code, capture the form
        // that asks for it. The code itself is never entered here. One repeat
        // and a diagnostic per failed attempt: see `requestOtpCode` (BL-158).
        for (const width of [1440, 390]) {
          const touch = width < 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          const step = await requestOtpCode(page, `${server.baseUrl}/login`, email, {
            retries: 1,
            failureShot: path.join(daylightShots, `login-code-${width}-failed.png`),
          });
          if (!step.ok) {
            ctx.findings.push(`/login (code step) @${width}: the code step never appeared — ${step.attempts.join(" | ")}`);
            continue;
          }
          if (step.attempts.length > 0) {
            // `%` is the only character left to escape: every attempt line is
            // already a single line, and a workflow command ends at a newline.
            console.log(`::warning::app-qa /login (code step) @${width} passed on a repeat (BL-158) — ${step.attempts.join(" | ").replace(/%/g, "%25")}`);
          }
          await waitForAnimations(page);
          await inspect(page, "/login (code step)", width);
          await page.screenshot({ path: path.join(daylightShots, `login-code-${width}.png`), fullPage: true });
        }
        await page.close();
      } finally {
        await anonymous.close();
      }
    });

    await runAudit(ctx, "dashboard profile and sign-out", async () => {
      // ═══════════════════════════════════════════════════════════════════
      // THE OFFICE DASHBOARD — Plan D slice D0. This file is no longer only
      // the field pass; see the header at the top.
      //
      // IT RUNS LAST, AND THAT IS NOT ARBITRARY: its final act signs the
      // seeded user out for real, which destroys the session every audit
      // above depends on. Moving it earlier would break them all in a way
      // that looks like an auth regression.
      //
      // WHAT IT PROVES, in the order it proves it:
      //   1. at 1000px — the icon-rail band — the profile control is
      //      REACHABLE while its label is collapsed;
      //   2. in the mobile drawer, the close button and the multi-membership
      //      workspace row do not overlap, and the menu opens above the
      //      drawer with Escape closing the menu alone;
      //   3. opening the sign-out confirm signs NOTHING out — asserted on
      //      the session cookies and the URL, not on the dialog looking
      //      right — and «Скасувати» leaves them intact;
      //   4. confirming clears the `sb-*` cookies, lands on /login, and a
      //      Back press does not repaint the signed-in shell out of Next's
      //      client Router Cache.
      // ═══════════════════════════════════════════════════════════════════
      const dashDiagnostics = await withPage(browser, async (page) => {
        const PROFILE_TRIGGER = 'button[aria-label="Профіль і вихід"]';

        // ── 1. The icon rail, 768–1240px ───────────────────────────────────
        // THE DEFECT THIS CATCHES SHIPPED AND WAS INVISIBLE. The profile slot
        // used to carry `rail-icons:hidden`, the same class the nav LABELS
        // carry, so at any width in this band the whole block was
        // `display: none` — and once sign-out lived in it there would have
        // been no way to sign out on an ordinary office laptop window. 1000px
        // is inside `768 ≤ w < 1240`, which is the only width that shows it:
        // every other pinned viewport passes either way.
        await page.setViewport({ width: 1000, height: 800 });
        let res = await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/: expected 200 for a signed-in office user, got ${res ? res.status() : "no response"}`);
          return;
        }
        if (new URL(page.url()).pathname !== "/") {
          ctx.findings.push(`/: a signed-in user was redirected to ${new URL(page.url()).pathname}`);
          return;
        }

        const railTrigger = await visibleHandle(page, PROFILE_TRIGGER);
        if (!railTrigger) {
          ctx.findings.push(
            "/ @1000: no VISIBLE profile control — the only way to sign out of this product is display:none "
            + "between 768px and 1240px (the `rail-icons` band). The label may collapse; the control may not.",
          );
        } else {
          const railRect = await rectOf(railTrigger);
          // HEIGHT AGAINST THE 44px FLOOR; WIDTH AGAINST ITS OWN SIBLINGS.
          //
          // The floor in this system is a fact about the POINTING DEVICE, not
          // the viewport (`packages/ui/src/base.css`'s `touch` variant), and
          // this viewport has a fine pointer — but the control's own height
          // is 44px here regardless, so asserting it costs nothing and pins
          // the avatar's `size-(--gp-control-height-desk)` + `p-1`.
          //
          // Width is deliberately NOT asserted against 44. The collapsed rail
          // is 68px wide with a 1px right border and `p-3`, so its content box
          // is 68 − 1 − 24 = 43px, and EVERY control in it — the four nav
          // buttons included — is 43px wide. [DEV-035: the rail has no right
          // border any more (the work sheet draws its own edge) and the nav
          // items are links, so the box is 68 − 24 = 44px; the width is still
          // measured against the nav links, not against 44.] That one missing pixel predates
          // this task and belongs to `--gp-rail-width-collapsed`, not to the
          // profile menu; hard-coding 44 here would fail this gate on a rail
          // nobody in this task designed. What IS this task's business is that
          // the profile control fills the rail exactly as the nav items do,
          // rather than shrinking to its avatar and leaving a dead strip — so
          // that is what it is measured against.
          if (railRect.height < 44) {
            ctx.findings.push(`/ @1000: the profile control is ${Math.round(railRect.height)}px tall — below the 44px floor`);
          }
          const navItemWidth = await page.evaluate((VIS) => {
            // DEV-035: the nav items are LINKS now (they were disabled
            // buttons until the rail got real routes), so the sibling the
            // profile control is measured against is an `li a`.
            const btn = [...document.querySelectorAll('nav[aria-label="Основна навігація"] li a')]
              .find((b) => b.checkVisibility(VIS));
            return btn ? btn.getBoundingClientRect().width : null;
          }, VISIBILITY_OPTIONS);
          if (navItemWidth === null) {
            ctx.findings.push("/ @1000: no visible nav button to compare the profile control's width against");
          } else if (Math.abs(railRect.width - navItemWidth) > 1) {
            ctx.findings.push(`/ @1000: the profile control is ${Math.round(railRect.width)}px wide but the nav items beside it are ${Math.round(navItemWidth)}px — it no longer fills the rail`);
          }
          // …and the LABEL beside it IS collapsed at this width, which is the
          // other half of the rule. Asserting only that the button is visible
          // would also pass a rail that never collapsed anything and simply
          // overflowed its 68px.
          const emailShownInRail = await page.evaluate(
            (sel, addr, VIS) => {
              const btn = [...document.querySelectorAll(sel)].find((b) => b.checkVisibility(VIS));
              return btn ? (btn.innerText ?? "").includes(addr) : false;
            }, PROFILE_TRIGGER, email, VISIBILITY_OPTIONS);
          if (emailShownInRail) {
            ctx.findings.push(`/ @1000: the address is still rendered in the collapsed icon rail — \`rail-icons:hidden\` has been lost from ProfileMenu's label`);
          }
          await railTrigger.dispose();
        }
        await page.screenshot({ path: path.join(SHOTS, "dash-rail-icons.png"), fullPage: true });

        // ── 1b. The six pinned viewports, and reduced motion ───────────────
        // `docs/design/02-building-ui.md` §6 pins these widths and requires
        // the pass at every one of them. Task 2 did it BY HAND, in a browser
        // session, and its report had to record reduced motion as unverified
        // because the tool available then could not emulate it. A hand pass
        // is also a pass nobody can repeat — so the shell's three states are
        // asserted here instead, on every run.
        //
        // WHAT IS ASSERTED IS THE STATE, not a screenshot looking right: at
        // and above `md` the persistent rail carries the profile control and
        // the mobile bar is gone; below `md` the rail is gone and the bar's
        // menu button is the way in. Getting that backwards is invisible in a
        // screenshot of the correct width and obvious here.
        for (const [width, height] of [[1920, 1080], [1440, 900], [1240, 900], [768, 1024], [390, 844], [360, 780]]) {
          const phone = width < 768;
          await page.setViewport(phone
            ? { width, height, isMobile: true, hasTouch: true }
            : { width, height });
          await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });

          const state = await page.evaluate((VIS) => ({
            railProfile: !!(() => {
              const el = document.querySelector('nav[aria-label="Основна навігація"] button[aria-label="Профіль і вихід"]');
              return el && el.checkVisibility(VIS);
            })(),
            menuButton: !!(() => {
              const el = document.querySelector('button[aria-label="Відкрити меню"]');
              return el && el.checkVisibility(VIS);
            })(),
          }), VISIBILITY_OPTIONS);
          if (phone && (state.railProfile || !state.menuButton)) {
            ctx.findings.push(`/ @${width}: below md the persistent rail must be gone and the drawer's menu button present — rail profile visible: ${state.railProfile}, menu button visible: ${state.menuButton}`);
          }
          if (!phone && (!state.railProfile || state.menuButton)) {
            ctx.findings.push(`/ @${width}: at md and up the rail must carry the profile control and the mobile bar must be gone — rail profile visible: ${state.railProfile}, menu button visible: ${state.menuButton}`);
          }

          const sweepOverflow = await measureHorizontalOverflow(page);
          if (sweepOverflow) {
            ctx.findings.push(`/ @${width}: the page scrolls sideways by ${sweepOverflow.overflow}px — ${sweepOverflow.offender}`);
          }
          await page.screenshot({ path: path.join(SHOTS, `dash-${width}.png`), fullPage: true });
        }

        // REDUCED MOTION IS A DIFFERENT ANIMATION, NEVER A FASTER ONE (§4.3
        // rule 8). The drawer and the confirm dialog both enter with
        // `animate-chip-in motion-reduce:animate-none` — Task 1's treatment,
        // reused rather than re-invented — so under `prefers-reduced-motion:
        // reduce` the computed `animation-name` must be `none`, not a shorter
        // duration. Emulated through CDP rather than an OS toggle, which is
        // why this is now assertable at all.
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });
        await page.click('button[aria-label="Відкрити меню"]');
        await page.waitForSelector('[role="dialog"]');
        await waitForAnimations(page);
        const reducedMotion = await page.evaluate(() => {
          const content = document.querySelector('[role="dialog"]');
          if (!content) return null;
          const s = getComputedStyle(content);
          return { name: s.animationName, duration: s.animationDuration };
        });
        if (!reducedMotion) {
          ctx.findings.push("reduced motion @390: the drawer did not open, so its animation could not be checked");
        } else if (reducedMotion.name !== "none") {
          ctx.findings.push(`reduced motion @390: the drawer still animates (animation-name: ${reducedMotion.name}, ${reducedMotion.duration}) — reduced motion must remove the animation, not shorten it`);
        }
        await page.screenshot({ path: path.join(SHOTS, "dash-reduced-motion.png"), fullPage: true });
        await page.emulateMediaFeatures([]);

        // ── 2. The mobile drawer ───────────────────────────────────────────
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });
        await page.click('button[aria-label="Відкрити меню"]');
        await page.waitForSelector('[role="dialog"]');
        await waitForAnimations(page);

        // THE `pt-16` CLEARANCE, MEASURED INSTEAD OF DERIVED. 64px was
        // computed by hand from `top-4` + `--gp-control-height-touch` (44px)
        // with 4px of slack; move either token and the workspace row slides
        // back under the close button with nothing to notice it. The
        // workspace row is found by `aria-disabled` — `WorkspaceSwitch` sets
        // it when the caller has more than one membership (which is why
        // `seedWorld` creates a second workspace), and the nav items beside
        // it are links with no `aria-disabled` [disabled buttons until
        // DEV-035], so this selector cannot pick one of them up by accident.
        const closeButton = await visibleHandleWithText(page, '[role="dialog"] button', "Закрити");
        const workspaceRow = await visibleHandle(page, '[role="dialog"] [aria-disabled="true"]');
        if (!closeButton) {
          ctx.findings.push("drawer @375: DialogContent's own close button was not found — the pt-16 clearance assertion below could not run");
        } else if (!workspaceRow) {
          ctx.findings.push("drawer @375: no multi-membership WorkspaceSwitch row (aria-disabled) — seedWorld's second workspace did not reach /v1/me/context, so the clearance assertion below could not run");
        } else {
          const overlap = overlapOf(
            await rectOf(closeButton), await rectOf(workspaceRow),
            "DialogContent close button", "WorkspaceSwitch row");
          if (overlap) {
            ctx.findings.push(`drawer @375: ${overlap} — the drawer's \`pt-16\` no longer clears the close button (top-bar.tsx)`);
          }
        }
        if (closeButton) await closeButton.dispose();
        if (workspaceRow) await workspaceRow.dispose();

        // The profile control is reachable from the drawer too — this is the
        // ONLY way a phone reaches sign-out, since there is no desktop rail
        // below `md`.
        const drawerTrigger = await visibleHandle(page, `[role="dialog"] ${PROFILE_TRIGGER}`);
        if (!drawerTrigger) {
          ctx.findings.push("drawer @375: no profile control inside the mobile drawer — there is no way to sign out on a phone");
        } else {
          await drawerTrigger.click();
          await page.waitForSelector('[role="menu"]');

          // A RADIX MENU INSIDE A RADIX DIALOG. Both portal to the document
          // root with `z-50`, so "the menu paints above the drawer" rests on
          // portal mount order, not on a z-index either one names — worth an
          // assertion rather than a claim. `elementFromPoint` at the menu's
          // own centre answers the question the way a finger would.
          const menuOnTop = await page.evaluate(() => {
            const menu = document.querySelector('[role="menu"]');
            if (!menu) return { ok: false, why: "no [role=menu] in the document" };
            const r = menu.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { ok: !!hit && menu.contains(hit), why: hit ? hit.tagName + "." + hit.className : "nothing" };
          });
          if (!menuOnTop.ok) {
            ctx.findings.push(`drawer @375: the profile menu does not paint above the drawer — the point at its centre hits ${menuOnTop.why}`);
          }

          // ESCAPE CLOSES THE MENU, AND THE DRAWER SURVIVES IT. Two
          // dismissable layers stacked; if both closed on one press, a
          // foreman who opened the menu by accident would lose his whole
          // navigation with it.
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 2_000 })
            .catch(() => ctx.findings.push("drawer @375: Escape did not close the profile menu"));
          const drawerSurvived = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
          if (!drawerSurvived) {
            ctx.findings.push("drawer @375: Escape closed the navigation drawer as well as the profile menu — one press dismissed two layers");
          }
          await drawerTrigger.dispose();
        }

        // ── 2b. «Профіль» FROM THE DRAWER — THE ROUTE CHANGE MUST CLOSE IT ──
        // THIS WAS A SHIPPED BUG AND NO ASSERTION HERE WOULD HAVE CAUGHT IT.
        // `top-bar.tsx` held a bare uncontrolled `<Dialog>`, and
        // `/settings/profile` is nested under `app/(dash)/layout.tsx`, so
        // the soft navigation re-renders only `children` — `TopBar` is not
        // remounted and the drawer's open state survives. Radix's modal
        // content keeps `hideOthers()` applied, so the page the user just
        // asked for is covered, focus-trapped and `aria-hidden`, with no way
        // forward but closing the drawer by hand. The desktop path could
        // never show it: there is no drawer at all above `md`.
        // The Escape test above closed the menu (that was its point), so it has
        // to be reopened before there is a «Профіль» item to press.
        const reopenTrigger = await visibleHandle(page, `[role="dialog"] ${PROFILE_TRIGGER}`);
        if (reopenTrigger) {
          await reopenTrigger.click();
          await page.waitForSelector('[role="menu"]', { timeout: 5_000 }).catch(() => {});
          await reopenTrigger.dispose();
        }
        const drawerProfileItem = await visibleHandleWithText(page, '[role="menuitem"]', "Профіль");
        if (!drawerProfileItem) {
          ctx.findings.push("drawer @375: the profile menu has no visible «Профіль» item — the drawer navigation check could not run");
        } else {
          await Promise.all([
            page.waitForFunction(() => location.pathname === "/settings/profile", { timeout: 10_000 }),
            drawerProfileItem.click(),
          ]).catch(() => ctx.findings.push("drawer @375: «Профіль» did not navigate to /settings/profile"));
          await drawerProfileItem.dispose();

          // Given up to 3s rather than sampled instantly: Radix unmounts the
          // content on `open=false` with no exit animation, but a one-frame
          // commit delay would otherwise read as the bug. A drawer that is
          // still there after three seconds is not mid-frame.
          const drawerClosed = await page
            .waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0, { timeout: 3_000 })
            .then(() => true).catch(() => false);

          const afterDrawerNav = await page.evaluate((VIS) => {
            const heading = document.querySelector("h1");
            return {
              openDialogs: document.querySelectorAll('[role="dialog"]').length,
              // `aria-hidden` on an ancestor is the other half of the damage:
              // `hideOthers()` marks every sibling of the modal content, so the
              // page can be on screen and still be invisible to a screen reader.
              headingRendered: !!heading && heading.checkVisibility(VIS),
              headingHiddenFromAT: !!heading?.closest('[aria-hidden="true"]'),
              headingText: (heading?.textContent ?? "").trim(),
            };
          }, VISIBILITY_OPTIONS);

          if (!drawerClosed || afterDrawerNav.openDialogs > 0) {
            ctx.findings.push(
              `drawer @375: the navigation drawer is STILL OPEN after «Профіль» navigated (${afterDrawerNav.openDialogs} dialog(s)) — `
              + "it covers the page it just sent the user to; top-bar.tsx's Dialog must close on a route change",
            );
          }
          if (!afterDrawerNav.headingRendered || afterDrawerNav.headingHiddenFromAT) {
            ctx.findings.push(
              `drawer @375: the profile screen's heading is not genuinely reachable after navigating from the drawer `
              + `(rendered: ${afterDrawerNav.headingRendered}, inside aria-hidden: ${afterDrawerNav.headingHiddenFromAT})`,
            );
          }
          if (afterDrawerNav.headingText !== "Профіль") {
            ctx.findings.push(`drawer @375: expected the «Профіль» heading after navigating, found "${afterDrawerNav.headingText}"`);
          }
          await page.screenshot({ path: path.join(SHOTS, "dash-drawer-navigated.png"), fullPage: true });

          // ── 2c. BACK — THE CASE THE FIRST FIX FOR 2b REINTRODUCED ────────
          // A controlled Radix Dialog does not call `onOpenChange` when the
          // prop closes it (see `top-bar.tsx`'s own note and the two call
          // sites it cites), so a fix that only DERIVES `open` from the
          // pathname leaves the path it was opened on sitting in state. Press
          // Back, `pathname` returns to that value, and the drawer reopens
          // over the dashboard — covered and focus-trapped, on the only
          // navigation a phone has, since this app contains exactly one link.
          //
          // THIS MUST BE A REAL `goBack()`, NOT A `page.goto`. The previous
          // version of this block returned to `/` with a hard navigation,
          // which remounts `TopBar` and wipes the very state the bug lives in
          // — which is why six consecutive green runs said nothing about it.
          await page.evaluate(() => {
            window.__qaDrawerPopstates = 0;
            window.addEventListener("popstate", () => { window.__qaDrawerPopstates += 1; });
          });
          await page.goBack({ waitUntil: "networkidle0" }).catch(() => {});
          const backHappened = await page.evaluate(() => window.__qaDrawerPopstates ?? 0);
          const afterBackToDash = await page.evaluate(() => ({
            pathname: location.pathname,
            openDialogs: document.querySelectorAll('[role="dialog"]').length,
          }));
          if (backHappened === 0) {
            ctx.findings.push("drawer @375: the Back press never navigated — the reopen check below cannot have tested anything");
          }
          if (afterBackToDash.pathname !== "/") {
            ctx.findings.push(`drawer @375: Back from the profile screen landed on ${afterBackToDash.pathname}, expected /`);
          }
          if (afterBackToDash.openDialogs > 0) {
            ctx.findings.push(
              "drawer @375: pressing Back REOPENED the navigation drawer over the dashboard — the drawer's open state "
              + "was not cleared on the outbound route change, only re-derived, so returning to the same path restores it",
            );
          }

          // ── 2d. A LINK TO THE ROUTE YOU ARE ALREADY ON ──────────────────
          // `goForward` rather than another drawer trip: it puts us back on
          // the profile screen without spending an interaction. Then open the
          // drawer there and press «Профіль» again — the pathname does not
          // change, so nothing keyed on a route change can close it, and only
          // the link handler can.
          await page.goForward({ waitUntil: "networkidle0" }).catch(() => {});
          if (new URL(page.url()).pathname !== "/settings/profile") {
            ctx.findings.push(`drawer @375: goForward did not return to the profile screen (on ${new URL(page.url()).pathname}) — the same-route check could not run`);
          } else {
            await page.click('button[aria-label="Відкрити меню"]');
            await page.waitForSelector('[role="dialog"]');
            await waitForAnimations(page);
            const sameRouteTrigger = await visibleHandle(page, `[role="dialog"] ${PROFILE_TRIGGER}`);
            if (sameRouteTrigger) {
              await sameRouteTrigger.click();
              await page.waitForSelector('[role="menu"]', { timeout: 5_000 }).catch(() => {});
              await sameRouteTrigger.dispose();
            }
            const sameRouteItem = await visibleHandleWithText(page, '[role="menuitem"]', "Профіль");
            if (!sameRouteItem) {
              ctx.findings.push("drawer @375: no «Профіль» item for the same-route check");
            } else {
              await sameRouteItem.click();
              await sameRouteItem.dispose();
              const closedOnSameRoute = await page
                .waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0, { timeout: 3_000 })
                .then(() => true).catch(() => false);
              if (!closedOnSameRoute) {
                ctx.findings.push(
                  "drawer @375: pressing «Профіль» while already on /settings/profile left the drawer open over the "
                  + "page — no route change happens, so the drawer has to close on the link activation itself",
                );
              }
            }
          }

          // Back to `/` for the touch-target and overflow checks below,
          // which are about the dashboard index, not this screen. A hard
          // navigation is correct HERE — the state-sensitive checks are done.
          await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });
          await page.click('button[aria-label="Відкрити меню"]');
          await page.waitForSelector('[role="dialog"]');
          await waitForAnimations(page);
        }

        for (const t of await measureSmallTargets(page)) {
          ctx.findings.push(`/ drawer @375: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
        }
        const drawerOverflow = await measureHorizontalOverflow(page);
        if (drawerOverflow) {
          ctx.findings.push(`/ @375: the page scrolls sideways by ${drawerOverflow.overflow}px (viewport ${drawerOverflow.viewport}px) — ${drawerOverflow.offender}`);
        }
        await page.screenshot({ path: path.join(SHOTS, "dash-drawer.png"), fullPage: true });

        // ── 3. The profile screen, reached the way a user reaches it ───────
        // A SOFT NAVIGATION ON PURPOSE, not a `page.goto`. It leaves `/`
        // in the history stack AND its rendered RSC payload in Next's client
        // Router Cache, which is precisely what step 4's Back press has to
        // find stale. A hard navigation would prove sign-out works and prove
        // nothing about the cache.
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });

        // A MENU THAT WILL NOT OPEN HAS SEVERAL POSSIBLE CAUSES AND THIS NAMES
        // THE ONE IT OBSERVED, rather than letting a bare `waitForSelector`
        // timeout assert "the selector was not found" — which is a symptom, and
        // this file's own standard (see `readOtpCode`'s header) is that a
        // failure message may only name a cause it actually established. The
        // interesting one is `document.body.style.pointerEvents === "none"`:
        // that is a modal layer's own lock left behind, and it means the whole
        // page is dead to the pointer, not that this one control moved.
        // WAIT FOR THE SHELL TO SETTLE BEFORE PRESSING AGAIN.
        //
        // Radix restores focus to the element that opened a dialog AFTER that
        // dialog has already left the DOM, in its own deferred task — so
        // between "the confirm is gone" (which is what the cancel step waits
        // for) and "the shell is idle" there is a window of a few
        // milliseconds. Pressing the profile control inside that window was
        // observed ONCE, on an otherwise identical run, to open the menu and
        // immediately lose it: the failure diagnostic recorded focus already
        // back on the trigger, no dialog, no popper, and no pointer-events
        // lock anywhere. The next run of the same build passed.
        //
        // THE MECHANISM IS THE LEADING HYPOTHESIS, NOT AN ESTABLISHED FACT,
        // and this comment says so rather than asserting one: focus landing
        // on the trigger just after the menu opened would move focus OUT of
        // the menu, which Radix reads as a dismissal. What IS established is
        // that the failure is intermittent and that nothing was blocking the
        // pointer when it happened.
        //
        // A human never presses inside that window; this harness does, so it
        // waits for a STATE rather than sleeping — the trigger holding focus
        // is the observable end of the restore. `.catch` swallows the timeout
        // deliberately: on the FIRST open no dialog has closed and nothing
        // restores focus, so the condition legitimately never becomes true,
        // and the click below is the real assertion either way.
        const settleAfterDialog = async () => {
          // THREE CONDITIONS, BECAUSE FOCUS ALONE IS NOT "TORN DOWN". The
          // dialog has to be out of the DOM, every animation finished, and
          // focus landed back on the trigger — Radix's own restore runs in a
          // `setTimeout(…, 0)` inside FocusScope's effect cleanup
          // (@radix-ui/react-focus-scope@1.1.16, dist/index.mjs:92-104), and
          // `RemoveScroll`/`hideOthers` unwind around the same moment.
          await page.waitForFunction(
            (sel, VIS) => {
              if (document.querySelector('[role="dialog"]')) return false;
              if (!document.getAnimations().every((a) => a.playState === "finished" || a.playState === "idle")) return false;
              const btn = [...document.querySelectorAll(sel)].find((b) => b.checkVisibility(VIS));
              return !!btn && document.activeElement === btn;
            },
            { timeout: 3_000 }, PROFILE_TRIGGER, VISIBILITY_OPTIONS,
          ).catch(() => {});
          // …and then two frames, which is the one thing a state query cannot
          // express: React commits the unmount, and the effect cleanups that
          // follow it are what actually release the focus scope.
          await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }));
        };

        const openMenu = async (where) => {
          const trigger = await visibleHandle(page, PROFILE_TRIGGER);
          if (!trigger) {
            ctx.findings.push(`${where}: the profile control is not reachable`);
            return false;
          }
          await trigger.click();
          const opened = await page.waitForSelector('[role="menu"]', { timeout: 5_000 })
            .then(() => true).catch(() => false);
          await trigger.dispose();
          if (!opened) {
            const why = await page.evaluate((sel, VIS) => {
              const describe = (el) => el
                ? `<${el.tagName.toLowerCase()}${el.getAttribute("role") ? ` role=${el.getAttribute("role")}` : ""} class="${String(el.className).slice(0, 90)}">`
                : "(none)";
              const btn = [...document.querySelectorAll(sel)].find((b) => b.checkVisibility(VIS));
              const r = btn ? btn.getBoundingClientRect() : null;
              // WHAT THE POINTER ACTUALLY HITS at the control's own centre. A
              // leftover full-screen overlay swallows every press while
              // leaving `[role=dialog]` at zero, because the Overlay carries
              // no role of its own.
              const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
              // …and whether any ancestor has been left inert / aria-hidden by
              // a modal layer's `hideOthers`.
              const blockers = [];
              for (let n = btn; n && n !== document.documentElement; n = n.parentElement) {
                if (n.hasAttribute("inert")) blockers.push(`${describe(n)} inert`);
                if (n.getAttribute("aria-hidden") === "true") blockers.push(`${describe(n)} aria-hidden`);
                if (getComputedStyle(n).pointerEvents === "none") blockers.push(`${describe(n)} pointer-events:none`);
              }
              return {
                bodyPointerEvents: document.body.style.pointerEvents || "(unset)",
                bodyAttrs: [...document.body.attributes].map((a) => a.name).join(" ") || "(none)",
                triggerState: btn ? btn.getAttribute("data-state") : "(no visible trigger)",
                openDialogs: document.querySelectorAll('[role="dialog"]').length,
                menus: document.querySelectorAll('[role="menu"]').length,
                poppers: document.querySelectorAll("[data-radix-popper-content-wrapper]").length,
                fixedFullScreen: [...document.querySelectorAll("body *")]
                  .filter((el) => {
                    const s = getComputedStyle(el);
                    const b = el.getBoundingClientRect();
                    return s.position === "fixed" && b.width >= innerWidth - 1 && b.height >= innerHeight - 1;
                  })
                  .map(describe).join(" | ") || "(none)",
                hitAtTriggerCentre: describe(hit),
                blockedAncestors: blockers.join(" | ") || "(none)",
                activeElement: describe(document.activeElement),
              };
            }, PROFILE_TRIGGER, VISIBILITY_OPTIONS);
            ctx.findings.push(
              `${where}: clicking the profile control did not open its menu. `
              + `trigger data-state=${why.triggerState}; the point at its centre hits ${why.hitAtTriggerCentre}; `
              + `full-screen fixed elements: ${why.fixedFullScreen}; blocked ancestors: ${why.blockedAncestors}; `
              + `body.style.pointer-events=${why.bodyPointerEvents}; body attrs=${why.bodyAttrs}; `
              + `dialogs=${why.openDialogs} menus=${why.menus} poppers=${why.poppers}; focus on ${why.activeElement}`,
            );
          }
          return opened;
        };

        if (await openMenu("/ @1280")) {
          // The address IS shown at this width, both on the control and as
          // the menu's own label — the other side of the collapse assertion
          // at 1000px above.
          const addressShown = await page.evaluate(() => document.body.innerText);
          if (!addressShown.includes(email)) {
            ctx.findings.push(`/ @1280: the signed-in address (${email}) appears nowhere in the profile control or its menu — /v1/me/context carries no email, so this is the Supabase session read in session.service.ts`);
          }

          const profileItem = await visibleHandleWithText(page, '[role="menuitem"]', "Профіль");
          if (!profileItem) {
            ctx.findings.push('/ @1280: no «Профіль» item in the profile menu');
          } else {
            await Promise.all([
              page.waitForFunction(() => location.pathname === "/settings/profile", { timeout: 10_000 }),
              profileItem.click(),
            ]);
            await profileItem.dispose();
          }
        }

        const profileText = await page.evaluate(() => document.body.innerText);
        for (const expected of ["Профіль", "Обліковий запис", "Електронна пошта", "Робочі простори", email]) {
          if (!profileText.includes(expected)) {
            ctx.findings.push(`/settings/profile: expected "${expected}" on the screen, not found`);
          }
        }
        // THE ROLE IS RENDERED IN UKRAINIAN, NEVER AS ITS DATABASE IDENTIFIER.
        // The seeded user created both workspaces, so both memberships are
        // `owner` — «Власник» in `src/lib/membership-labels.ts`.
        if (!profileText.includes("Власник")) {
          ctx.findings.push('/settings/profile: the membership role is not rendered in Ukrainian — expected «Власник» for the workspace creator');
        }
        if (/\bowner\b|pto_manager/.test(profileText)) {
          ctx.findings.push("/settings/profile: a raw membership role identifier is on screen — membership-labels.ts is not being applied");
        }

        // ONE FACE, EVERY SCREEN. [Corrected 2026-09-05: the cascade race this
        // probe used to guard — two stylesheets, two `--font-display` values on
        // one `:root` — no longer exists. apps/app has one entry point
        // (app/globals.css on @goproceed/ui/base.css) since the field client
        // migrated. The probe stays because the face has been lost twice
        // already; it now runs on every route in the daylight visual audit,
        // and here once more on the screen where it was first lost.]
        await assertBrandFaces(ctx, page, "/settings/profile");
        await page.screenshot({ path: path.join(SHOTS, "dash-profile.png"), fullPage: true });

        // ── 4. Sign-out: not until confirmed, and then for real ────────────
        const cookiesBefore = await supabaseCookieNamesIn(browser);
        if (cookiesBefore.length === 0) {
          ctx.findings.push("sign-out: no `sb-*` session cookies were present BEFORE signing out — the assertions below would pass vacuously");
        }

        const openSignOutDialog = async (attempt) => {
          await settleAfterDialog();
          if (!await openMenu(`/settings/profile (${attempt})`)) return false;
          const item = await visibleHandleWithText(page, '[role="menuitem"]', "Вийти");
          if (!item) {
            ctx.findings.push(`profile menu (${attempt}): no «Вийти» item`);
            return false;
          }
          await item.click();
          await item.dispose();
          await page.waitForFunction(
            () => [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.innerText ?? "").includes("Вийти з системи?")),
            { timeout: 5_000 });
          return true;
        };

        if (await openSignOutDialog("first")) {
          // THE «NOT UNTIL CONFIRMED» PROOF, and it is deliberately made
          // against the cookies and the URL rather than against the dialog
          // looking right. A dialog that signs you out as it opens looks
          // identical in a screenshot.
          const cookiesWithDialogOpen = await supabaseCookieNamesIn(browser);
          if (cookiesWithDialogOpen.join() !== cookiesBefore.join()) {
            ctx.findings.push(`sign-out: opening the confirm changed the session cookies (${cookiesBefore.join()} → ${cookiesWithDialogOpen.join()}) — it must sign nothing out until confirmed`);
          }
          if (new URL(page.url()).pathname !== "/settings/profile") {
            ctx.findings.push(`sign-out: opening the confirm navigated to ${new URL(page.url()).pathname} — it must not navigate at all`);
          }
          const dialogText = await page.evaluate(() =>
            [...document.querySelectorAll('[role="dialog"]')].map((d) => d.innerText ?? "").join("\n"));
          for (const expected of ["Вийти з системи?", "Ви зможете увійти знову за одноразовим кодом.", "Вийти", "Скасувати"]) {
            if (!dialogText.includes(expected)) {
              ctx.findings.push(`sign-out dialog: expected copy "${expected}", not found`);
            }
          }
          await page.screenshot({ path: path.join(SHOTS, "dash-sign-out-confirm.png"), fullPage: true });

          // «Скасувати» — the dialog goes, the session stays.
          const cancel = await visibleHandleWithText(page, '[role="dialog"] button', "Скасувати");
          if (!cancel) {
            ctx.findings.push("sign-out dialog: no «Скасувати» button");
          } else {
            await cancel.click();
            await cancel.dispose();
            await page.waitForFunction(
              () => ![...document.querySelectorAll('[role="dialog"]')].some((d) => (d.innerText ?? "").includes("Вийти з системи?")),
              { timeout: 5_000 })
              .catch(() => ctx.findings.push("sign-out: «Скасувати» did not close the confirm dialog"));
            const cookiesAfterCancel = await supabaseCookieNamesIn(browser);
            if (cookiesAfterCancel.join() !== cookiesBefore.join()) {
              ctx.findings.push(`sign-out: «Скасувати» changed the session cookies (${cookiesBefore.join()} → ${cookiesAfterCancel.join()}) — cancelling must sign nothing out`);
            }

            // THE PAGE IS STILL USABLE AFTER CANCELLING.
            //
            // THE MECHANISM THIS COMMENT FIRST GAVE IS NOT POSSIBLE IN THE
            // INSTALLED VERSION, and saying so is the point: it claimed the
            // dialog captures the body's "original" pointer-events while the
            // menu still holds the lock, and then restores that captured
            // `none`. In `@radix-ui/react-dismissable-layer@1.1.19` the
            // capture is guarded — `if (layersWithOutsidePointerEventsDisabled
            // .size === 0) { originalBodyPointerEvents = … }`
            // (dist/index.mjs:110-114) — so a second layer mounting on top of
            // a first cannot capture `none`, and the restore is refcounted by
            // the same Set. (Corrected 2026-08-22, fix round 1.)
            //
            // The assertion stays, and stays cheap, because what it measures
            // is the SYMPTOM and not any one library's route to it: a
            // dashboard whose every control is silently dead until a reload
            // looks completely normal in a screenshot. `body.style` is where
            // that state would land whatever produced it — a future Radix
            // version, a scroll-lock library, or our own code.
            // FOCUS LANDS SOMEWHERE DELIBERATE, NOT ON `<body>`.
            // Radix's modal DialogContent ships
            // `onCloseAutoFocus: composeEventHandlers(props…, (e) => {
            // e.preventDefault(); context.triggerRef.current?.focus(); })`
            // (@radix-ui/react-dialog@1.1.23, dist/index.mjs:154-156). This
            // dialog is controlled and has NO `DialogTrigger`, so that ref is
            // null, the optional call no-ops, FocusScope's own restore has
            // already been cancelled by the `preventDefault` above it, and a
            // keyboard user is dropped to the top of the document mid-flow.
            // `sign-out-dialog.tsx` now restores to the profile trigger; this
            // is what proves the restore actually happened, since nothing
            // about it is visible in a screenshot.
            // MEASURED AFTER THE RESTORE HAS HAD ITS CHANCE, NOT THE INSTANT
            // THE DIALOG LEAVES THE DOM. `@radix-ui/react-focus-scope@1.1.16`
            // dispatches its unmount-autofocus event inside a
            // `setTimeout(…, 0)` in the effect cleanup (dist/index.mjs:92-104),
            // so both Radix's restore and ours run a macrotask AFTER the node
            // is gone. Sampling `activeElement` immediately reports `<body>`
            // even when the restore is about to land correctly — this exact
            // assertion did, on its first run. Bounded, so a restore that
            // never happens is still a finding: two seconds is far longer than
            // one macrotask and far shorter than a user would tolerate.
            await page
              .waitForFunction(() => document.activeElement !== null && document.activeElement !== document.body,
                { timeout: 2_000 })
              .catch(() => { /* still on <body> — the assertion below is what reports it */ });
            const focusAfterCancel = await page.evaluate(() => {
              const el = document.activeElement;
              return {
                isBody: el === document.body || el === null,
                label: el ? `${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? ""}]` : "(none)",
              };
            });
            if (focusAfterCancel.isBody) {
              ctx.findings.push(
                "sign-out: closing the confirm left focus on <body> — a keyboard user is thrown to the top of the "
                + "document mid-flow. Radix focuses its DialogTrigger on close and this dialog has none, so the "
                + "restore has to be explicit (onCloseAutoFocus).",
              );
            } else if (!focusAfterCancel.label.includes("Профіль і вихід")) {
              ctx.findings.push(`sign-out: after «Скасувати» focus is on ${focusAfterCancel.label}, expected the profile control that opened the dialog`);
            }

            const bodyPointerEvents = await page.evaluate(() => document.body.style.pointerEvents || "");
            if (bodyPointerEvents === "none") {
              ctx.findings.push(
                "sign-out: `document.body.style.pointer-events` is still `none` after «Скасувати» — the whole dashboard "
                + "is unclickable until a reload. A modal layer's lock was left behind when the confirm dialog closed.",
              );
            }
          }
        }

        if (await openSignOutDialog("second")) {
          const confirm = await visibleHandleWithText(page, '[role="dialog"] button', "Вийти");
          if (!confirm) {
            ctx.findings.push("sign-out dialog: no «Вийти» confirm button");
          } else {
            await confirm.click();
            await confirm.dispose();
            const landed = await page.waitForFunction(
              () => location.pathname === "/login", { timeout: 15_000 })
              .then(() => true).catch(() => false);
            if (!landed) {
              ctx.findings.push(`sign-out: confirming did not land on /login (still ${new URL(page.url()).pathname}) — router.replace never ran, or signOut reported an error`);
            }

            const cookiesAfter = await supabaseCookieNamesIn(browser);
            if (cookiesAfter.length > 0) {
              ctx.findings.push(`sign-out: the session cookies survived (${cookiesAfter.join()}) — the browser is still signed in on a shared machine`);
            }

            // THE BACK PRESS, AND THIS IS WHAT `router.refresh()` IS FOR.
            // Next's client Router Cache holds `/`'s rendered RSC payload
            // — the chrome, the workspace name, the user's own address — and
            // the cookies being gone does not evict it. Without the refresh a
            // Back press repaints the signed-in shell from cache, with no
            // server round trip to notice the session died.
            // THE BACK PRESS HAS TO BE PROVEN TO HAVE HAPPENED, or the
            // assertion below passes for the wrong reason. `goBack()` used to
            // be `.catch(() => {})` with nothing checking it, so a throw, or a
            // history stack with nowhere to go back to, left the page sitting
            // on `/login` — where there is no shell and no address, so every
            // check underneath went green having tested nothing.
            //
            // `goBack()`'s RETURN VALUE cannot carry that proof: `router.replace`
            // put `/login` there through the History API, so going back is a
            // same-document navigation and resolves to `null` exactly as a
            // no-op would. A `popstate` counter installed first distinguishes
            // them, and the pathname afterwards is NOT the signal either — the
            // proxy legitimately sends a session-less `/` straight back to
            // `/login`, so landing there again is a pass, not a failure.
            await page.evaluate(() => {
              window.__qaPopstates = 0;
              window.addEventListener("popstate", () => { window.__qaPopstates += 1; });
            });
            let backError = null;
            await page.goBack({ waitUntil: "networkidle0" }).catch((err) => { backError = err; });
            const popstates = await page.evaluate(() => window.__qaPopstates ?? 0);
            if (popstates === 0) {
              ctx.findings.push(
                `sign-out: the Back press never navigated (${backError ? `goBack threw: ${backError.message}` : "no popstate fired"}) — `
                + "the Router-Cache assertion below cannot have tested anything",
              );
            }
            const afterBack = await page.evaluate(() => ({
              pathname: location.pathname,
              hasShellNav: !!document.querySelector('nav[aria-label="Основна навігація"]'),
              text: document.body.innerText,
            }));
            if (afterBack.hasShellNav || afterBack.text.includes(email)) {
              ctx.findings.push(
                `sign-out: a Back press repainted the signed-in dashboard (path ${afterBack.pathname}, shell nav present: ${afterBack.hasShellNav}) — `
                + "the Router Cache still holds the authenticated RSC payload; router.refresh() after router.replace() is what invalidates it",
              );
            }
            await page.screenshot({ path: path.join(SHOTS, "dash-after-sign-out.png"), fullPage: true });
          }
        }
      });
      reportDiagnostics("dashboard profile and sign-out", dashDiagnostics, ctx.findings, ctx.missingAssets);
    });

    // FIX ROUND 1, FINDING 1 — THE STRUCTURAL ENFORCEMENT. Every name in
    // EXPECTED_AUDITS must be in `ctx.auditsRun` by now, because `runAudit`
    // adds a name the instant it is called — before its `fn` runs, whether
    // `fn` throws, and regardless of what `assignmentId` turned out to be.
    // If one is missing, no `if` gate silently skipped it (there are none
    // left); the only way to reach this point with a name absent is a
    // FUTURE refactor that stops calling `runAudit` for it entirely — and
    // that is exactly the class of regression this check exists to catch,
    // structurally, rather than trusting every future edit to remember why
    // the truthy check this replaces was wrong.
    for (const name of EXPECTED_AUDITS) {
      if (!ctx.auditsRun.has(name)) {
        ctx.findings.push(`expected audit "${name}" never ran — see EXPECTED_AUDITS/runAudit in qa/field.mjs`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    const NOT_COVERED = [
      "The field client's screens are not covered here at all since DEV-035 " +
      "(2026-09-23): the owner retired the field PWA (app/(app)/**) and this " +
      "file's three field audits went with it. The field client is apps/mobile's " +
      "native iOS/Android build (ADR-013), which has no harness yet (DEV-042, " +
      "2026-09-23): the Expo web export's browser pass (apps/mobile/qa/field-web.mjs, " +
      "`pnpm --filter @goproceed/mobile qa`) was deleted with that client.",
      "No colour-contrast (WCAG AA) scan is run, and no screen-reader pass " +
      "(NVDA/VoiceOver/JAWS) was performed — same limitation apps/demo/qa/verify.mjs " +
      "states about itself.",
      "No real device/OS was used — headless Chrome via puppeteer only, no " +
      "Safari/iOS, no physical gloved-hand touch input.",
      "The dash pass exercises ONE identity shape: a signed-in user who OWNS both " +
      "of their workspaces, so every membership rendered on /settings/profile " +
      "is role=owner status=active. The other twelve roles and the other three " +
      "statuses reach no browser here — `api.me_context` filters status='active' " +
      "outright, and nothing in D0 can mint a second role. Their labels are covered " +
      "against technical/schema.sql's own CHECK lists, with no browser, in " +
      "src/lib/membership-labels.test.ts; Plan D slice D4 (members) is where they " +
      "are actually rendered.",
      "Sign-out's FAILURE path is not driven in the browser: making auth.signOut() " +
      "fail for real would mean stubbing window.fetch against GoTrue's /logout " +
      "(the capture audit's own trick) and would prove the dialog's error branch " +
      "at the cost of a stub that must track the SDK's request shape. The rules " +
      "that matter there — that a failure calls NEITHER router.replace nor " +
      "router.refresh, and surfaces the error instead — are pinned in Node, with " +
      "injected fakes, in src/services/sign-out.service.test.ts.",
      "`scope: \"local\"` is asserted as an ARGUMENT (sign-out.service.test.ts), not " +
      "as an OUTCOME. Proving that a second device's session survives would need a " +
      "second, independently signed-in browser context in this harness; what is " +
      "verified here is only that this browser's own cookies are gone.",
      "Keyboard-only navigation of the dash shell is not driven end to end. Escape " +
      "is pressed (the menu-inside-drawer case) but Tab order, focus return to the " +
      "trigger after the menu closes, and the confirm dialog's focus trap are not " +
      "asserted. The rail's items are links since DEV-035 (the four disabled " +
      "placeholders are gone), so they are in the tab order, but that order is " +
      "not asserted either.",
      "The seeded Auth user is deleted after the run (best-effort); the workspace/" +
      "project/contract rows it created under \"Приклад-*\" names are NOT deleted — " +
      "harmless synthetic data, left the same way the Node integration suites " +
      "leave their own truncateAll()-scoped rows between runs, not between a run " +
      "and the next `supabase db reset`. SINCE 2026-08-22 that also includes an " +
      "800-byte JPEG in local Supabase Storage and the evidence_objects/" +
      "upload_intents rows naming it, plus one external_access_grant per run whose " +
      "token nobody holds (it expires in seven days, or dies with the next db reset).",

      "THE EXTERNAL DECIDE PATH IS NOT DRIVEN IN A BROWSER. The seventh audit " +
      "issues a VIEW-ONLY grant, because the screen that issues it cannot name an " +
      "occurrence's approver_role (see `grants.service.ts`), so `/external/review`'s " +
      "accept/return buttons, its synchronizer-token echo, the receipt, and the " +
      "session rotation a decision performs are all still exercised only in Node, in " +
      "tests/m5-external.int.test.ts. What the browser now proves on that page is the " +
      "gate, the fragment strip, the exchange, the scope render and the bytes.",

      "`external_grants.revoke_reissue` reaches no browser at all — nothing in the " +
      "product calls it yet. That matters more than an ordinary gap because it is the " +
      "ONLY recovery INV-044 leaves for a link that was lost, and the screen says so " +
      "in words it cannot yet act on. D-slice work that adds the control owns closing " +
      "this line.",

      "Only ONE evidence object, one occurrence group, and one media type reach the " +
      "browser: a single `image/jpeg`. The null (unbound) group renders in no browser " +
      "here — its treatment is pinned without a DOM in " +
      "src/components/evidence/evidence-by-occurrence.test.tsx — and `application/pdf`, " +
      "the other type `evidence-inspection.ts` recognises, is unreachable because no " +
      "capture route in this repository produces one. The consequence is named rather " +
      "than hidden: `GET /external/evidence`'s `content-security-policy: default-src " +
      "'none'; sandbox` is never exercised on a non-image response by any automated " +
      "check. It was measured by hand for task 7's report and is not asserted here. " +
      "AND IT CANNOT BE AUTOMATED HERE, which is the half that matters to whoever reads this " +
      "list next: HEADLESS CHROME HAS NO PDF VIEWER AT ALL. A PDF served with that header and " +
      "the same PDF served without it both render an EMPTY document in this harness's browser, " +
      "so an audit added later to «cover» this case would compare two blank pages, go green, and " +
      "then be cited as proof of a property nothing checked. The hand measurement needed a " +
      "HEADFUL Chrome with the PDF component extension enabled (puppeteer's default launch args " +
      "disable it even headful); its result — the viewer renders, identically, with and without " +
      "the header, so the header stays and no ADR moves — is in task-7-report.md §2 and in the " +
      "byte route's own comment.",

      "The «Копіювати посилання» button is rendered and never pressed. " +
      "`navigator.clipboard.writeText` needs a permission headless Chrome grants " +
      "inconsistently across builds, and a flaky assertion about a convenience control " +
      "would cost more than it proves — the link is on screen as selectable text either " +
      "way, which is what the audit asserts. Its failure branch (the message shown when " +
      "the clipboard refuses) is therefore unexercised anywhere.",

      "Grant lifetime is not exercised: neither the seven-day expiry, the 30-minute " +
      "idle window nor the 12-hour absolute session ceiling advances during a run that " +
      "takes under two minutes. Expiry and revocation are covered in Node, in " +
      "tests/m5-external.int.test.ts and tests/external-evidence.int.test.ts.",

      "The external link is opened by the SAME Chrome build, in a second context, on " +
      "the same machine. No email client, no mail-security gateway (the rendering " +
      "scanner the gate exists for), no second device and no real phone is involved — " +
      "so the gate is proven to work for a person, and proven against nothing.",

      "THE MONEY SCREEN (Plan D slice D2, `/projects/{projectId}`) IS DRIVEN " +
      "THROUGH EXACTLY ONE SHAPE: one live block, SUPERVISION_SIGNATURE_MISSING " +
      "(evidence present, decision pending — never CUSTOMER_MOTIVATED_REFUSAL), " +
      "whole-line attribution, one currency (UAH), a priced work item. Not exercised " +
      "by any browser pass: the `unvaluedRegister` panel and its own `<table>` (the " +
      "seeded work item is priced, so that panel renders nothing here — its overflow " +
      "safety rests on reusing `assignments-list.tsx`'s already-measured `min-w-160`, " +
      "not a fresh measurement); the 403 `forbidden` branch and the 404 `not_found` " +
      "branch (`ProjectMoneyForbidden`/`ProjectMoneyNotFound` are exercised only in " +
      "reasoning against `blocked-value.service.ts`'s own header, never against a " +
      "real refused response in a browser); the `zeroPricedAssignmentCount` and " +
      "`unvaluedAssignmentCount` honesty counts both stay 0 throughout this run, so " +
      "their non-zero rendering is unverified by any browser pass; and the good-news " +
      "empty state (`NoBlockedValueEmptyState`) is asserted only as ABSENT here, never " +
      "driven to actually render — that would need a second seeded world with zero " +
      "live blocks, which this harness does not build.",
    ];

    const report = {
      ok: ctx.findings.length === 0,
      generatedAt: new Date().toISOString(),
      baseUrl: server.baseUrl,
      assignmentAudited: assignmentId ?? null,
      // FIX ROUND 1, FINDING 1: which audits actually ran, in the report
      // itself — not just enforced internally above. Compared against
      // EXPECTED_AUDITS, a reader can see directly whether this run
      // genuinely exercised the authenticated screens or not, rather than
      // inferring it from `assignmentAudited` being non-null (which is
      // exactly the inference that was wrong before this fix round).
      auditsRun: [...ctx.auditsRun],
      expectedAudits: EXPECTED_AUDITS,
      findings: ctx.findings,
      // Known, already-explained 404s (Chrome's own favicon.ico probe — see
      // withPage's header comment) — counted and named, never a cause for
      // `ok: false`. Same non-failing treatment as apps/demo/qa/verify.mjs's
      // own `missingAssets`.
      missingAssets: [...new Set(ctx.missingAssets)],
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
    await server.close();
  }
}

await main();
