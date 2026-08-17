import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { launch } from "./browser.mjs";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BROWSER PASS FOR apps/app — modelled on apps/demo/qa/verify.mjs, but a
 * genuinely different animal underneath it. apps/demo serves a prebuilt
 * static SPA; apps/app is a Next server whose pages are gated by
 * `middleware.ts` and render real data through `/v1`. Most of what this task
 * exists to prove — the довідковий disclaimer, the 44px touch floor on the
 * obligation screen, the unsaved-photo banner — lives BEHIND that gate.
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

const OUTPUT = path.resolve("qa-output");
const SHOTS = path.join(OUTPUT, "screenshots");

// ---------------------------------------------------------------------------
// Local-stack configuration. Every default below is the FIXED local dev value
// `supabase start` produces from this repo's supabase/config.toml (the JWT
// signing secret there is the CLI's own unconfigured default,
// "super-secret-jwt-token-with-at-least-32-characters-long" — not overridden
// by an env(...) substitution anywhere in config.toml), so the anon/
// service_role JWTs below are stable across every fresh local stack and every
// CI run of this repo, the same way scripts/set-local-app-password.mjs
// defaults its own dev-only passwords. Every one of them is overridable by
// env var for a stack that ever does override the secret.
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

// Refuses to run the moment any of the three points at something that is not
// this machine — the same guard scripts/set-local-app-password.mjs makes,
// for the same reason: the values above are dev-only secrets, safe ONLY
// because nothing reachable from outside this machine trusts them.
for (const [label, url] of [["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL], ["MAILPIT_URL", MAILPIT_URL]]) {
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

async function startNextServer() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdout = [];
  const stderr = [];
  const proc = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "next", "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
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
  // src/lib/field/assignments.ts). Asserting against the values this function
  // actually sent keeps that check honest if either literal above changes.
  return {
    assignmentId: assignment.assignmentId,
    workspaceId: ws.workspaceId,
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

const DOVIDKOVYI_DISCLAIMER_TEXT =
  "Наведений перелік — це довідковий Додаток Н ДБН А.3.1-5:2016 (позиція Н.15 "
  + "«Монтаж електротехнічних установок» / Н.14 «Внутрішні санітарно-технічні роботи»), "
  + "відтворений дослівно. Обов'язковий перелік прихованих робіт для вашого об'єкта "
  + "визначає робоча документація (п. 8.4.3.3 ДБН А.3.1-5:2016). Цей перелік її не "
  + "замінює. За потреби такими актами оформлюють й інші види робіт.";

const UNSAVED_PHOTO_WARNING =
  "GoProceed не зберіг це фото. Зробіть його ще раз або збережіть у себе.";

/** A minimal but genuine JPEG (SOI + APP0), identical to field-capture.int.test.ts's fixture. */
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

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
  "my assignments list",
  "obligation screen",
  "capture in-flight banner",
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
 * audits — five of them now, four also authenticated, so also covered by the
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

    // The manifest, fetched directly (not through the page) so a parse
    // failure is unambiguous and not entangled with the page's own fetch of
    // it via <link rel="manifest">.
    try {
      const manifestRes = await fetch(`${server.baseUrl}/manifest.webmanifest`);
      if (!manifestRes.ok) {
        ctx.findings.push(`/manifest.webmanifest: expected 200, got ${manifestRes.status}`);
      } else {
        const manifest = await manifestRes.json();
        if (manifest.lang !== "uk") ctx.findings.push(`manifest.lang is "${manifest.lang}", expected "uk"`);
        if (!manifest.name) ctx.findings.push("manifest carries no name");
        if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
          ctx.findings.push("manifest carries no icons");
        }
      }
    } catch (err) {
      ctx.findings.push(`/manifest.webmanifest: failed to fetch/parse: ${err}`);
    }

    // middleware.ts's whole reason for excluding /v1 and /external: an
    // unauthenticated API call must come back as the problem+json document
    // the client contract promises, never a 307 to an HTML login page. Task
    // 5's report verified this by hand once; this keeps it verified on every
    // run rather than trusting it stays true.
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
    let projectName;
    let workItemDescription;
    try {
      userId = await mintConfirmedUser(email, password);
      const seedBearer = await seedBearerToken(email, password);
      ({ assignmentId, projectName, workItemDescription } = await seedWorld(server.baseUrl, seedBearer));

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
        await page.goto(`${server.baseUrl}/login?next=${encodeURIComponent(`/a/${assignmentId}`)}`,
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
        if (landedOn !== `/a/${assignmentId}`) {
          ctx.findings.push(`sign-in: expected to land on /a/${assignmentId} (via ?next=), landed on ${landedOn}`);
        }
      });
      reportDiagnostics("sign-in", loginDiagnostics, ctx.findings, ctx.missingAssets);
    });

    await runAudit(ctx, "my assignments list", async () => {
      // ── «Мої доручення», the screen a foreman actually lands on ─────────
      // ADDED BY THE FINAL WHOLE-BRANCH REVIEW (Important 5). This file used
      // to visit `/` only UNAUTHENTICATED (to prove the redirect to /login),
      // then sign in with `?next=/a/{id}` and go straight to the obligation
      // screen — so the authenticated list, ~252 lines of real decisions, had
      // never been rendered by anything at all. Its decisions now live in
      // `src/lib/field/assignments.ts` and are unit-tested; this audit is the
      // other half, proving they reach a real browser against real seeded
      // data.
      const listDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        const res = await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/: expected 200 for the signed-in list, got ${res ? res.status() : "no response"}`);
          return;
        }
        const landedOn = new URL(page.url()).pathname;
        if (landedOn !== "/") {
          ctx.findings.push(`/: a signed-in foreman was redirected to ${landedOn} instead of seeing his list`);
          return;
        }

        const bodyText = await page.evaluate(() => document.body.innerText);

        if (!bodyText.includes("Мої доручення")) {
          ctx.findings.push('/: expected the heading "Мої доручення", not found');
        }

        // THE ROW ITSELF, from the seeded world — not just the chrome. This
        // is what separates "the page rendered" from "the two-hop fetch,
        // `?assignee=me`, and the row mapping all actually worked".
        if (!bodyText.includes(workItemDescription)) {
          ctx.findings.push(`/: the seeded assignment ("${workItemDescription}") is not on the list — the projects→assignments fan-out or ?assignee=me may have regressed`);
        }

        // NEITHER EMPTY STATE, AND NOT THE ERROR STATE. Each of these is a
        // real branch of `buildMyAssignmentsScreen`, and reaching one of them
        // here would mean the seeded assignment was invisible for a reason
        // the assertion above alone would not name.
        for (const wrong of [
          "У вас немає доступу до жодного проєкту",
          "Наразі за вами не закріплено жодного доручення",
          "Не вдалося завантажити ваші доручення",
        ]) {
          if (bodyText.includes(wrong)) {
            ctx.findings.push(`/: rendered "${wrong}" although one assignment was seeded for this member`);
          }
        }

        // The `showProjectName` rule, asserted rather than eyeballed: this
        // world has exactly ONE project, so repeating its name on the single
        // row buys nothing and must not appear.
        if (bodyText.includes(projectName)) {
          ctx.findings.push(`/: the project name ("${projectName}") is shown although only one project contributes rows — showProjectName should be false`);
        }

        // The row must be a link to the obligation screen; a list a foreman
        // cannot tap through is not a list.
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

    await runAudit(ctx, "obligation screen", async () => {
      // ── The obligation screen: the disclaimer and the touch floor ───────
      const obligationDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        const res = await page.goto(`${server.baseUrl}/a/${assignmentId}`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`/a/${assignmentId}: expected 200, got ${res ? res.status() : "no response"} — was the session cookie carried over?`);
          return;
        }

        // THE ДОВІДКОВИЙ DISCLAIMER — INV-081's regulatory half, and the
        // reason this task exists. The text must be present verbatim
        // (byte-identical to statutory-act-form.ts's own constant, duplicated
        // here for the same reason lineManifestHash is above — this script
        // cannot import the .ts source) AND genuinely rendered — not sitting
        // inside a collapsed <details>, a display:none/visibility:hidden
        // ancestor, or an overflow:hidden box too short to show it.
        //
        // THREE CHECKS, NOT ONE — AND THIS IS A CORRECTION OF THIS FILE'S OWN
        // FIRST DRAFT. That draft walked ancestors reading
        // `getComputedStyle().display`/`.visibility`, which PASSED even when
        // the disclaimer was deliberately wrapped in a CLOSED `<details>`
        // during this task's own negative-case testing (confirmed by hand: a
        // `<p>` inside `details:not([open])` in this puppeteer's bundled
        // Chrome reports `display: "block"`, `visibility: "visible"`, and a
        // non-zero `getBoundingClientRect()` — none of the signals that draft
        // checked actually change). `element.checkVisibility()` and
        // `document.body.innerText` both DO correctly exclude it (innerText
        // is defined in terms of what is actually rendered, and a closed
        // `<details>`'s non-summary children are not) — confirmed the same
        // way, by hand, before relying on it. But innerText/checkVisibility
        // have the OPPOSITE gap: text clipped by a zero-height
        // `overflow:hidden` ancestor still generates a box and so still
        // counts as "rendered" to both of them, even though a reader cannot
        // see it — confirmed by the same hand-check. Neither signal alone
        // catches every case the brief asks for ("not inside any collapsed
        // element"), so both run, and either one flagging a problem is a
        // finding.
        const disclaimerCheck = await page.evaluate((expectedText) => {
          const all = [...document.querySelectorAll("p, div, span")];
          const el = all.find((e) => (e.textContent ?? "").trim() === expectedText.trim());
          if (!el) return { found: false };

          const renderedByEngine =
            (typeof el.checkVisibility === "function" ? el.checkVisibility() : true)
            && document.body.innerText.includes(expectedText.trim());

          // The overflow:hidden case innerText/checkVisibility do not catch
          // (see the comment above): walk ancestors for a box too short to
          // contain the element it claims to show.
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
          ctx.findings.push("obligation screen: довідковий disclaimer is present in the DOM but not genuinely rendered (checkVisibility()/document.body.innerText both say it is not shown — collapsed <details>, display:none, or visibility:hidden)");
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

        // The negative half of INV-081: nothing on this screen may ever
        // claim device-only persistence — GoProceed cannot back that claim,
        // and a foreman reading it would reasonably stop worrying about a
        // photo the server has not actually received.
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.includes("Збережено на пристрої")) {
          ctx.findings.push('obligation screen: renders the forbidden claim "Збережено на пристрої"');
        }

        await page.screenshot({ path: path.join(SHOTS, "obligation.png"), fullPage: true });
      });
      reportDiagnostics("obligation screen", obligationDiagnostics, ctx.findings, ctx.missingAssets);
    });

    await runAudit(ctx, "capture in-flight banner", async () => {
      // ── The unsaved-photo banner: visible while a capture is in flight ──
      // `page.evaluateOnNewDocument` installs the stub before any of the
      // page's own scripts run, so `uploadCapture`'s first fetch — the
      // upload-intents POST — is the one this catches. It is held for 700ms
      // before resolving to a failure: that hold is what makes the IN-FLIGHT
      // state (not just the eventual failure) something this harness can
      // actually witness, which is the assertion context item 4 asks for
      // ("the unsaved-photo warning appears when a capture is in flight").
      const captureDiagnostics = await withPage(browser, async (page) => {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        await page.evaluateOnNewDocument(() => {
          const realFetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : input.url;
            if (url.includes("/upload-intents") && init?.method === "POST") {
              await new Promise((resolve) => setTimeout(resolve, 700));
              return new Response(JSON.stringify({
                code: "INTERNAL_ERROR", detail: "QA-stubbed failure (qa/field.mjs)",
                userAction: "retry_later", retryable: true, requestId: "qa-stub",
              }), { status: 500, headers: { "content-type": "application/problem+json" } });
            }
            return realFetch(input, init);
          };
        });

        const res = await page.goto(`${server.baseUrl}/a/${assignmentId}`, { waitUntil: "networkidle0" });
        if (!res || res.status() !== 200) {
          ctx.findings.push(`capture pass: expected 200 on /a/${assignmentId}, got ${res ? res.status() : "no response"}`);
          return;
        }

        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
          ctx.findings.push("capture pass: no <input type=\"file\"> found on the obligation screen — is there a photo-evidenceKind occurrence?");
          return;
        }

        // AT REST, NOTHING IS AT RISK — and this used to be the opposite.
        // Task 11's first draft recorded a surprise here: `holdsUnsavedBytes`
        // was a function of the client state alone, `not_sent` is also the
        // INITIAL state, and so the red banner and the «Скасувати фото»
        // control were already on screen before any file had been picked (and
        // a `beforeunload` listener was already registered). It was recorded
        // as out of that task's scope; the final whole-branch review made it
        // Critical 1, and `holdsUnsavedBytes` now takes `hasPickedFile` too.
        //
        // So this is now an ASSERTION, not a console warning. A screen a
        // foreman has merely opened must carry neither affordance: a red
        // warning about a photo that does not exist is how people learn that
        // this product's red text means nothing, and the browser's own
        // close-tab prompt is the mechanism INV-081's second half rests on.
        const bodyTextAtRest = await page.evaluate(() => document.body.innerText);
        if (bodyTextAtRest.includes(UNSAVED_PHOTO_WARNING)) {
          ctx.findings.push(`capture pass: the unsaved-photo banner ("${UNSAVED_PHOTO_WARNING}") is on screen before any file has been picked — holdsUnsavedBytes has lost its hasPickedFile term`);
        }
        if (bodyTextAtRest.includes("Скасувати фото")) {
          ctx.findings.push("capture pass: the \"Скасувати фото\" control is offered before any file has been picked — there is nothing to discard");
        }
        //
        // Because the banner is now genuinely absent at rest, its appearance
        // IS evidence on its own — but the unambiguous in-flight proof below
        // stays the STATE LABEL «Надсилання» (`CLIENT_STATE_LABEL.sending`),
        // which is unique to the "sending" state and reachable no other way.

        const jpegPath = path.join(OUTPUT, "фото.jpg");
        await writeFile(jpegPath, JPEG_BYTES);
        await fileInput.uploadFile(jpegPath);

        // THE UNAMBIGUOUS IN-FLIGHT PROOF. "Надсилання" is `CLIENT_STATE_LABEL.sending`
        // (state.ts) — it renders for the "sending" state alone, so seeing it
        // proves `uploadCapture` actually started (its very first line is
        // `onStateChange("sending")`), independent of the banner's own
        // already-true-at-rest condition above.
        const reachedSending = await page.waitForFunction(
          () => document.body.innerText.includes("Надсилання"),
          { timeout: 2_000 },
        ).then(() => true).catch(() => false);
        if (!reachedSending) {
          ctx.findings.push('capture pass: expected the "sending" state label ("Надсилання") after picking a file — the upload never appears to have started');
        }

        // The banner must still be up during this same in-flight window —
        // gated by the identical `holdsUnsavedBytes` function as the state
        // label, so if it were EVER absent here (rest included) that would
        // itself be the real regression context item 4 warns against: bytes
        // genuinely at risk with no visible warning.
        const bannerUpWhileInFlight = await page.evaluate(
          (expected) => document.body.innerText.includes(expected), UNSAVED_PHOTO_WARNING);
        if (!bannerUpWhileInFlight) {
          ctx.findings.push(`capture pass: unsaved-photo banner ("${UNSAVED_PHOTO_WARNING}") is not visible while the upload is in flight ("Надсилання")`);
        }

        // Once the stub resolves (~700ms) the state moves to "failed":
        // `holdsUnsavedBytes("failed")` is false, so the banner must come
        // back DOWN — a banner that never clears would itself be a defect
        // (state.ts's own comment: "failed and discarded are false because
        // the user has already been told").
        const bannerClearedAfterFailure = await page.waitForFunction(
          (expected) => !document.body.innerText.includes(expected),
          { timeout: 5_000 },
          UNSAVED_PHOTO_WARNING,
        ).then(() => true).catch(() => false);
        if (!bannerClearedAfterFailure) {
          ctx.findings.push("capture pass: unsaved-photo banner is still visible after the upload resolved to a failure — should have cleared");
        }

        const bodyTextAfter = await page.evaluate(() => document.body.innerText);
        if (!bodyTextAfter.includes("Потрібна дія")) {
          ctx.findings.push('capture pass: expected the "failed" state label ("Потрібна дія") after the stubbed failure, not found');
        }
        if (bodyTextAfter.includes("Збережено на пристрої")) {
          ctx.findings.push('capture pass: renders the forbidden claim "Збережено на пристрої" after a failed upload');
        }

        await page.screenshot({ path: path.join(SHOTS, "capture-failed.png"), fullPage: true });
      });
      reportDiagnostics("capture in-flight banner", captureDiagnostics, ctx.findings, ctx.missingAssets);
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
      "beforeunload is not exercised in the browser: headless Chrome's handling " +
      "of the beforeunload dialog is version-dependent and Puppeteer cannot " +
      "reliably assert on it across Chrome builds, so guardBeforeUnload/" +
      "holdsUnsavedBytes's WIRING to window.addEventListener is untested by any " +
      "browser pass. The DECISION function itself (holdsUnsavedBytes, discard, " +
      "guardBeforeUnload) is unit-tested with no DOM in src/lib/capture/state.test.ts.",
      "No colour-contrast (WCAG AA) scan is run, and no screen-reader pass " +
      "(NVDA/VoiceOver/JAWS) was performed — same limitation apps/demo/qa/verify.mjs " +
      "states about itself.",
      "Only ONE occurrence shape is exercised end to end (evidenceKind=photo, " +
      "coverage=covered, exactly one occurrence). The three refusal branches " +
      "(no_bindings / work_type_unresolved / no_matching_rule) and a multi-" +
      "occurrence assignment are covered by src/lib/field/obligations.test.ts " +
      "with no browser, not by this file.",
      "The discard control (\"Скасувати фото\") is asserted ABSENT at rest but is " +
      "never clicked here, and the successful-upload receipt path " +
      "(server_confirmed) is not driven in the browser — only the failure path " +
      "this harness's assertions are about. In particular the ABORT a discard now " +
      "performs (capture.tsx's AbortController) is proven only in Node, in " +
      "src/lib/capture/upload.test.ts. Both paths are otherwise covered without a " +
      "browser in tests/field-capture.int.test.ts (the real routes) and " +
      "src/lib/capture/upload.test.ts (the state machine, fake fetch).",
      "No real device/OS was used — headless Chrome via puppeteer only, no " +
      "Safari/iOS, no physical gloved-hand touch input.",
      "The seeded Auth user is deleted after the run (best-effort); the workspace/" +
      "project/contract rows it created under \"Приклад-*\" names are NOT deleted — " +
      "harmless synthetic data, left the same way the Node integration suites " +
      "leave their own truncateAll()-scoped rows between runs, not between a run " +
      "and the next `supabase db reset`.",
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
