# Evidence read — Plan D slice D1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let ПТВ find a photo by assignment instead of by scrolling a chat, and let технагляд — who has no account — actually see that photo before deciding.

**Architecture:** Two byte paths, each matched to its plane's rule. The member plane gets a short-lived signed URL (TTL 60s, ceiling enforced in our own helper because the server enforces none); the external plane gets a same-origin stream, because that page's own CSP (`img-src 'self'`) blocks a Supabase-hosted URL outright. Both routes are catalogued and both land in ADR-009 as one dated amendment. Neither wrapper can do what these routes need today, so the wrappers come first.

**Tech Stack:** Next 16.3 App Router route handlers, `@supabase/storage-js@2.112.3` (reached only through `supabase-js`; never imported directly), node-pg through `withTenantTx`/`withExternalTx`, zod contracts in `packages/contracts`, vitest (unit in `apps/app/src/**/*.test.ts`, integration in `apps/app/tests/*.int.test.ts`), the design gate of `docs/design/02-building-ui.md`.

**Spec:** [`../specs/2026-08-22-evidence-read-design.md`](../specs/2026-08-22-evidence-read-design.md) — approved 2026-08-22 and revised the same day against source. Read it before Task 1; its «What research changed» section refutes a claim an earlier draft made, and the plan below is written against the corrected version.

**Base:** branch `claude/plan-d`, commit `14bbfe5`.

## Global Constraints

- **A signed URL is a bearer capability.** TTL ≤ 60 seconds. Never written to audit, outbox, idempotency bodies, logs or notifications. Never returned with `Cache-Control` absent. It cannot be used to list adjacent objects.
- **Never log a raw storage key.** `docs/architecture/files-and-storage.md` §Downloads: logs record the domain object and the authorization result. `evidence-storage.ts`'s existing functions violate this by interpolating the key into their error messages — **do not copy that house style**; the existing violation is filed in `TODOS.md` and is not this slice's to fix.
- **No workspace id is ever taken from the client.** Resolve the resource with no workspace predicate (RLS supplies it), read the ids off that row, then check capability.
- **`aktflow_app` / `aktflow_service` are dead names.** The live roles are `goproceed_app`, `goproceed_service`, `goproceed_worker`. Migration text still carries the old ones; nothing new may.
- **Ukrainian copy only**, and every new user-facing string gets a row in `technical/copy-catalog.csv` whose `context` column names a file that exists.
- **UI work is bound by `docs/design/02-building-ui.md`** — read §3.1, answer §3.3's three questions, run §5. Role names never values; a Tailwind class is never a template literal; animation only from `@goproceed/ui/motion`. Components live in `packages/ui`, screens follow plane's hierarchy per `docs/design/03-ui-references.md`: `app/**` is routes only, components are kebab-case under a domain folder, anything that talks to an API is a `src/services/*.service.ts`.
- **`apps/mobile` and `apps/landing` are untouched by every task.**
- **CI is billing-paused until 2026-09-01.** Verify locally in CI's shape. Integration tests need the three DB URLs exported the way `.github/workflows/ci.yml:53-57` exports them:
  ```
  APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres
  SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres
  SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
  ```
  Without them six tests fail with «APP_DB_URL is not set» and nothing else is wrong.
- **The browser pass runs from `apps/app`** (`pnpm --filter @goproceed/app qa`) or from anywhere after slice D0's hardening — `node apps/app/qa/field.mjs`.

---

## File structure

| File | Responsibility |
|---|---|
| `apps/app/src/lib/command.ts` | gains a headers channel on `HandlerResult`; `queryRoute` stops discarding it |
| `apps/app/src/lib/evidence-storage.ts` | gains `createSignedReadUrl`, `createSignedReadUrls`, `openObjectStream` — read access, no key in any message |
| `packages/contracts/src/evidence.ts` | the member response schema; parsed at the route boundary like `meContextResponse` |
| `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts` | member read: authorize, query, sign, `no-store` |
| `apps/app/app/external/evidence/route.ts` | external stream: own `Response`, own headers, no wrapper |
| `apps/app/src/services/evidence.service.ts` | the dashboard's one door to both reads |
| `apps/app/src/services/assignments.service.ts` | the assignments list |
| `apps/app/src/components/evidence/*.tsx` | the evidence screen's parts |
| `apps/app/src/components/assignments/*.tsx` | the list's parts |
| `apps/app/app/dash/projects/[projectId]/assignments/page.tsx` | route only |
| `apps/app/app/dash/assignments/[assignmentId]/page.tsx` | route only |
| `technical/openapi/scope-v0.1.csv` | two new operation rows |
| `docs/decisions/ADR-009-three-pilot-surfaces.md` | one dated amendment covering both |
| `apps/app/qa/field.mjs` | the seventh audit — the whole loop, both planes |

---

## Task 1: `queryRoute` can set response headers

Every member-plane GET in this app ships with no cache directive, because `queryRoute` hard-codes an empty header map. Route 1 must send `Cache-Control: no-store` or it hands a bearer capability to the next shared cache that asks. `ok()` already takes the argument; nothing fills it.

**Files:**
- Modify: `apps/app/src/lib/command.ts:17` (`HandlerResult`), `apps/app/src/lib/command.ts:85` (`queryRoute`'s `ok` call)
- Test: `apps/app/src/lib/command.test.ts` (create)

**Interfaces:**
- Consumes: `ok(status, body, requestId, extraHeaders)` from `apps/app/src/lib/http.ts:47-59` — already accepts `extraHeaders`, spread **last**, so a handler can override `content-type` if it ever needs to.
- Produces: `HandlerResult = { status: number; body: unknown; expiresAt?: Date; headers?: Record<string, string> }`. Task 3 sets `headers: { "cache-control": "no-store" }`.

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/lib/command.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("./auth", () => ({ requireUser: async () => ({ userId: "u" }) }));

import { queryRoute } from "./command";

const REQ_ID = "0123456789abcdef";
const req = () => new Request("http://x/v1/thing", { headers: { "x-request-id": REQ_ID } });

describe("queryRoute headers channel", () => {
  it("passes a handler's headers through to the response", async () => {
    const route = queryRoute(async () => ({
      status: 200, body: { ok: true }, headers: { "cache-control": "no-store" },
    }));
    const res = await route(req(), { params: Promise.resolve({}) });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("x-request-id")).toBe(REQ_ID);
  });

  it("sends no cache directive when the handler asks for none", async () => {
    const route = queryRoute(async () => ({ status: 200, body: {} }));
    const res = await route(req(), { params: Promise.resolve({}) });
    expect(res.headers.get("cache-control")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @goproceed/app exec vitest run src/lib/command.test.ts
```
Expected: the first test FAILS — `cache-control` is `null`, because `queryRoute` passes `{}`.

- [ ] **Step 3: Make it pass**

In `apps/app/src/lib/command.ts`, extend the result type:

```ts
export interface HandlerResult {
  status: number;
  body: unknown;
  expiresAt?: Date;
  /**
   * Response headers the handler needs and the wrapper cannot know about.
   * Added 2026-08-22 for `GET /v1/assignments/{id}/evidence`, which returns
   * short-lived signed storage URLs: a bearer capability in a shared cache is
   * a capability handed to whoever asks next, and until this existed NO
   * member-plane GET in this app sent any cache directive at all.
   * `ok()` spreads these last, so a handler may also override `content-type`.
   */
  headers?: Record<string, string>;
}
```

and in `queryRoute` replace the hard-coded `{}`:

```ts
      const out = await run({ req, requestId, userId, params });
      return ok(out.status, out.body, requestId, out.headers ?? {});
```

- [ ] **Step 4: Run the test, then the whole app suite**

```bash
pnpm --filter @goproceed/app exec vitest run src/lib/command.test.ts
```
Expected: PASS.

```bash
APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres \
SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres \
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
pnpm --filter @goproceed/app test
```
Expected: everything that passed before still passes (847 as of `14bbfe5`, plus your two).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/command.ts apps/app/src/lib/command.test.ts
git commit -m "feat(http): queryRoute stops discarding the handler's response headers"
```

---

## Task 2: read access in `evidence-storage.ts`

**Files:**
- Modify: `apps/app/src/lib/evidence-storage.ts` (append; do not touch the existing functions)
- Test: `apps/app/tests/evidence-storage-read.int.test.ts` (create — it talks to the real local storage API)

**Interfaces:**
- Consumes: the memoized `storage(bucket)` helper at `evidence-storage.ts:42-48`.
- Produces:
  - `EVIDENCE_URL_TTL_SECONDS = 60`
  - `createSignedReadUrl(bucket: string, key: string): Promise<string>`
  - `createSignedReadUrls(bucket: string, keys: string[]): Promise<Map<string, string>>` — keys that failed are **absent from the map**, never present with a broken value.
  - `openObjectStream(bucket: string, key: string): Promise<ReadableStream<Uint8Array>>`

Facts established against the installed `@supabase/storage-js@2.112.3` — do not re-derive, and do not import that package directly (it does not resolve from `apps/app`; reach it through the client):

- `createSignedUrl` returns `{ data: { signedUrl }, error: null } | { data: null, error }` and does **not** throw on storage failure.
- `createSignedUrls` reports **per-path failure inline**: HTTP 200, entries carrying `error: string` with `signedUrl: null`. Each entry has both `signedURL` (server-relative, unusable) and `signedUrl` (absolute, the one you want).
- `expiresIn` is **seconds**. The server rejects `< 1` and accepts anything above — `999999999` was accepted, which is 31 years. The ceiling is ours alone.
- A missing object comes back HTTP **400** with a body saying `statusCode: "404"`.
- `download(path).asStream()` resolves to the raw `Response.body` as a `ReadableStream`, never buffered.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/evidence-storage-read.int.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  EVIDENCE_BUCKET, EVIDENCE_URL_TTL_SECONDS,
  putObject, newEvidenceKey,
  createSignedReadUrl, createSignedReadUrls, openObjectStream,
} from "../src/lib/evidence-storage";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

describe("evidence storage: read access", () => {
  it("signs a URL that actually serves the bytes, and expires in 60 seconds", async () => {
    const key = newEvidenceKey();
    await putObject(key, JPEG, "image/jpeg");

    const url = await createSignedReadUrl(EVIDENCE_BUCKET, key);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);

    // The TTL is OURS: the storage server enforces only `expiresIn >= 1`.
    // Decode the token rather than trusting the constant.
    const token = new URL(url).searchParams.get("token")!;
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
    ) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(EVIDENCE_URL_TTL_SECONDS);
    expect(EVIDENCE_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
  });

  it("omits a key it could not sign instead of returning a broken URL", async () => {
    const good = newEvidenceKey();
    await putObject(good, JPEG, "image/jpeg");
    const missing = `${randomUUID()}/${randomUUID()}`;

    const map = await createSignedReadUrls(EVIDENCE_BUCKET, [good, missing]);
    expect(map.has(good)).toBe(true);
    expect(map.has(missing)).toBe(false);
    expect(map.get(good)).toMatch(/^http/);
  });

  it("streams without buffering, and never puts the key in the error", async () => {
    const key = newEvidenceKey();
    await putObject(key, JPEG, "image/jpeg");

    const stream = await openObjectStream(EVIDENCE_BUCKET, key);
    expect(stream).toBeInstanceOf(ReadableStream);
    const chunks: Uint8Array[] = [];
    for await (const c of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(c);
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(Buffer.from(JPEG));

    const gone = `${randomUUID()}/${randomUUID()}`;
    await expect(openObjectStream(EVIDENCE_BUCKET, gone)).rejects.toThrow(
      // The message must NOT carry the key — files-and-storage.md §Downloads.
      expect.objectContaining({ message: expect.not.stringContaining(gone) }) as Error,
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres \
SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres \
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
pnpm --filter @goproceed/app exec vitest run tests/evidence-storage-read.int.test.ts
```
Expected: FAIL at import — `createSignedReadUrl` is not exported.

- [ ] **Step 3: Implement**

Append to `apps/app/src/lib/evidence-storage.ts`:

```ts
/**
 * THE CEILING IS OURS AND NOTHING BELOW US ENFORCES IT.
 *
 * `docs/architecture/files-and-storage.md` §Downloads: a signed URL «uses the
 * shortest practical TTL, normally no more than 60 seconds». Measured against
 * the local storage API on 2026-08-22, the server enforces only a LOWER bound —
 * `expiresIn: 0` and `-1` are rejected with «body/expiresIn must be >= 1», and
 * `999999999` (about 31 years) was accepted and produced a token with that
 * expiry. So this constant, and the fact that no function here takes a TTL
 * argument, is the entire enforcement.
 */
export const EVIDENCE_URL_TTL_SECONDS = 60;

/**
 * NO KEY IN ANY MESSAGE THROWN FROM HERE DOWN.
 *
 * The functions above this line interpolate the storage key into their errors,
 * which reach `console.error` through `toProblemResponse`'s unmapped branch —
 * against `files-and-storage.md`'s «Logs record the domain object and
 * authorization result, never the signed URL or raw storage key». That is a
 * recorded defect (TODOS.md) and deliberately NOT the style copied here.
 * A key is the input to a signing operation the service key can perform; a
 * leaked key narrows an attacker's search to nothing.
 */
function readFailed(what: string, message: string): Error {
  return new Error(`storage: ${what} failed: ${message}`);
}

/** A short-lived read grant for exactly one object. */
export async function createSignedReadUrl(bucket: string, key: string): Promise<string> {
  const { data, error } = await storage(bucket)
    .createSignedUrl(key, EVIDENCE_URL_TTL_SECONDS);
  // NOTE: a missing object arrives as HTTP 400 with a body saying 404, so
  // `error.status` must not be mapped to a response status by any caller.
  if (error || !data) throw readFailed("signed read", error?.message ?? "no data");
  return data.signedUrl;
}

/**
 * The batch form. One storage call per screen rather than one per photo.
 *
 * PER-PATH FAILURES ARE REPORTED INLINE, NOT THROWN: the call returns 200 with
 * entries carrying `error` and a null URL. A key that could not be signed is
 * ABSENT from the returned map — never present with a broken value, so a caller
 * cannot render a dead image and call it evidence.
 *
 * Each entry carries both `signedURL` (server-relative) and `signedUrl`
 * (absolute). Only the second is usable.
 */
export async function createSignedReadUrls(
  bucket: string, keys: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const { data, error } = await storage(bucket)
    .createSignedUrls(keys, EVIDENCE_URL_TTL_SECONDS);
  if (error || !data) throw readFailed("signed read batch", error?.message ?? "no data");
  for (const entry of data) {
    if (entry.error || !entry.path || !entry.signedUrl) continue;
    out.set(entry.path, entry.signedUrl);
  }
  return out;
}

/**
 * The object as a stream, for the external plane's same-origin proxy.
 *
 * `download(key).asStream()` resolves to the raw `Response.body`; nothing is
 * buffered, unlike `downloadObject` above, which reads the whole object into a
 * `Uint8Array` because its one caller needs the bytes in hand to hash them.
 */
export async function openObjectStream(
  bucket: string, key: string,
): Promise<ReadableStream<Uint8Array>> {
  const { data, error } = await storage(bucket).download(key).asStream();
  if (error || !data) throw readFailed("stream", error?.message ?? "no data");
  return data as ReadableStream<Uint8Array>;
}
```

- [ ] **Step 4: Run the test**

```bash
APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres \
SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres \
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
pnpm --filter @goproceed/app exec vitest run tests/evidence-storage-read.int.test.ts
```
Expected: 3 passed. If `asStream()` is not a function, you are resolving a different `storage-js` — check `pnpm --filter @goproceed/app why @supabase/storage-js` before changing the code, and note the old tree at `/Users/akisliy/Downloads/aktflow-product-package 2` resolves `supabase-js@2.47.10`, which this worktree does not.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/evidence-storage.ts apps/app/tests/evidence-storage-read.int.test.ts
git commit -m "feat(storage): read access — a signed URL whose 60s ceiling is ours, and a stream that does not buffer"
```

---

## Task 3: `GET /v1/assignments/{assignmentId}/evidence`

**Files:**
- Create: `packages/contracts/src/evidence.ts`, `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts`
- Modify: `packages/contracts/src/index.ts` (one `export *` line), `technical/openapi/scope-v0.1.csv` (one row)
- Test: `apps/app/tests/evidence-read.int.test.ts` (create)

**Interfaces:**
- Consumes: `queryRoute` + `HandlerResult.headers` (Task 1); `createSignedReadUrls` and `EVIDENCE_URL_TTL_SECONDS` (Task 2).
- Produces: `assignmentEvidenceResponse` (zod) and `AssignmentEvidenceResponse` (type), consumed by Task 6's service.

The shape, deliberately grouped rather than flat — the pain is retrieval by obligation, not a feed:

```ts
{
  groups: [
    { occurrenceId: "…uuid…" | null, evidence: [ { … } ] }
  ]
}
```

- [ ] **Step 1: Write the contract**

Create `packages/contracts/src/evidence.ts`:

```ts
import { z } from "zod";

export const evidenceObjectView = z.object({
  evidenceObjectId: z.string().uuid(),
  mediaType: z.string(),
  byteSize: z.number().int(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  originalFilename: z.string().nullable(),
  originMethod: z.string(),
  captureTimeTrust: z.string(),
  claimedCaptureTime: z.string().nullable(),
  serverReceivedAt: z.string(),
  /**
   * A SHORT-LIVED BEARER CAPABILITY, NOT AN IDENTIFIER.
   * TTL is 60 seconds (`EVIDENCE_URL_TTL_SECONDS`). It is never persisted
   * anywhere by anyone: not in audit, not in the outbox, not in an idempotency
   * body, not in a log. Absent when the object could not be signed, so a
   * client renders «недоступне» rather than a broken image.
   */
  readUrl: z.string().url().optional(),
});

export const assignmentEvidenceResponse = z.object({
  groups: z.array(z.object({
    /**
     * NULL IS A REAL GROUP, NOT A DEFECT. `upload_intents.requirement_occurrence_id`
     * is nullable by design — `uploads.ts` calls the optionality «the fallback's
     * only remaining door», and every capture outside the requirement flow has
     * none. A consumer that drops this group shows an assignment as having no
     * evidence when it has evidence.
     */
    occurrenceId: z.string().uuid().nullable(),
    evidence: z.array(evidenceObjectView),
  })),
});

export type EvidenceObjectView = z.infer<typeof evidenceObjectView>;
export type AssignmentEvidenceResponse = z.infer<typeof assignmentEvidenceResponse>;
```

Add to `packages/contracts/src/index.ts`, after the `export * from "./assignments";` line:

```ts
export * from "./evidence";
```

- [ ] **Step 2: Write the failing test**

Create `apps/app/tests/evidence-read.int.test.ts`. Reuse `boundOccurrence()` from `apps/app/tests/field-capture.int.test.ts` — it is the only helper that builds library → rule version → line → bindings → publish → assignment → materialised occurrence, then intent → real PUT → finalize. Copy its import list from that file's head.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq } from "./helpers/fixtures";
import { assignmentEvidenceResponse } from "@goproceed/contracts";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: A }) }));

// … build the fixture exactly as field-capture.int.test.ts does: one assignment,
// one occurrence-bound photo, and ONE FALLBACK PHOTO whose intent carries no
// requirementOccurrenceId.

describe("GET /v1/assignments/{id}/evidence", () => {
  beforeEach(truncateAll);

  it("returns both the occurrence-bound photo and the one with no occurrence", async () => {
    const res = await GET(jsonReq(`/v1/assignments/${assignmentId}/evidence`),
      { params: Promise.resolve({ assignmentId }) });
    expect(res.status).toBe(200);

    const body = assignmentEvidenceResponse.parse(await res.json());
    const bound = body.groups.find((g) => g.occurrenceId === occurrenceId);
    const fallback = body.groups.find((g) => g.occurrenceId === null);

    expect(bound?.evidence).toHaveLength(1);
    // THE ONE THAT WOULD SILENTLY VANISH under an inner join or a null filter.
    expect(fallback?.evidence).toHaveLength(1);
    // …and the null group is last.
    expect(body.groups.at(-1)?.occurrenceId).toBeNull();
  });

  it("sends no-store, because the body carries bearer capabilities", async () => {
    const res = await GET(jsonReq(`/v1/assignments/${assignmentId}/evidence`),
      { params: Promise.resolve({ assignmentId }) });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not leak the signed URL into audit or the outbox", async () => {
    const res = await GET(jsonReq(`/v1/assignments/${assignmentId}/evidence`),
      { params: Promise.resolve({ assignmentId }) });
    const body = assignmentEvidenceResponse.parse(await res.json());
    const token = new URL(body.groups[0]!.evidence[0]!.readUrl!).searchParams.get("token")!;

    const audit = await q(`select payload::text as t from public.audit_events`);
    const outbox = await q(`select payload::text as t from public.transaction_outbox`);
    for (const r of [...audit.rows, ...outbox.rows]) {
      expect(r.t).not.toContain(token);
    }
    // NOTE: «never in logs» is NOT asserted here and cannot be — this app has no
    // application logging at all (three console.error calls, all on error
    // paths). Recorded in TODOS.md; the rule still binds every future line.
  });

  it("refuses a caller without project.view", async () => { /* …403 SCOPE_PROJECT_DENIED… */ });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
APP_DB_URL=… SERVICE_DB_URL=… SUPABASE_DB_URL=… \
pnpm --filter @goproceed/app exec vitest run tests/evidence-read.int.test.ts
```
Expected: FAIL — the route module does not exist.

- [ ] **Step 4: Implement the route**

Create `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts`. The authorization shape is copied verbatim from `apps/app/app/v1/assignments/[assignmentId]/requirement-occurrences/route.ts:49-68` — resolve first with no workspace predicate, read the ids off the row, then membership, then capability:

```ts
export const GET = queryRoute(async (a) => {
  const assignmentId = a.params.assignmentId!;
  return withTenantTx(
    { actorUserId: a.userId, organizationId: null, requestId: a.requestId },
    async (tx) => {
      const asg = await tx.query(
        `select workspace_id, project_id from public.work_assignments where id = $1`,
        [assignmentId]);
      if (asg.rows.length === 0) throw new HttpProblem(404, problem(/* … */));
      const workspaceId = asg.rows[0].workspace_id as string;
      const projectId = asg.rows[0].project_id as string;

      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });

      // `status = 'available'` is LOGICALLY REDUNDANT with the join — only
      // app.finalize_upload_intent writes finalized_evidence_object_id, and it
      // sets status in the same UPDATE. It is written anyway because NO CHECK
      // CONSTRAINT ties the two columns: the invariant is held by a revoked
      // UPDATE grant (migration 0031), and a future migration re-granting it
      // would break this with nothing red. The two defences fail differently.
      const rows = await tx.query(
        `select ui.requirement_occurrence_id,
                eo.id, eo.media_type, eo.byte_size::text as byte_size, eo.content_hash,
                eo.original_filename, eo.origin_method, eo.capture_time_trust,
                eo.claimed_capture_time, eo.server_received_at,
                eo.storage_bucket, eo.storage_key
           from public.upload_intents ui
           join public.evidence_objects eo
             on eo.workspace_id = ui.workspace_id
            and eo.id = ui.finalized_evidence_object_id
          where ui.workspace_id = $1
            and ui.work_assignment_id = $2
            and ui.status = 'available'
          order by ui.requirement_occurrence_id nulls last,
                   eo.server_received_at, eo.id`,
        [workspaceId, assignmentId]);

      // `storage_bucket` comes from the ROW, never from EVIDENCE_BUCKET: the
      // uniques are (storage_bucket, storage_key) and (workspace_id, storage_key),
      // so a second bucket is representable and the constant would break.
      const byBucket = new Map<string, string[]>();
      for (const r of rows.rows) {
        const list = byBucket.get(r.storage_bucket as string) ?? [];
        list.push(r.storage_key as string);
        byBucket.set(r.storage_bucket as string, list);
      }
      const signed = new Map<string, string>();
      for (const [bucket, keys] of byBucket) {
        for (const [k, url] of await createSignedReadUrls(bucket, keys)) signed.set(k, url);
      }

      // Grouping preserves the null bucket and its position: the SQL already
      // ordered `nulls last`, so walking rows in order and starting a new group
      // whenever the occurrence id changes keeps it at the end.
      const groups: { occurrenceId: string | null; evidence: unknown[] }[] = [];
      for (const r of rows.rows) {
        const occ = (r.requirement_occurrence_id as string | null) ?? null;
        let g = groups.at(-1);
        if (!g || g.occurrenceId !== occ) { g = { occurrenceId: occ, evidence: [] }; groups.push(g); }
        g.evidence.push({
          evidenceObjectId: r.id, mediaType: r.media_type,
          byteSize: Number(r.byte_size), contentHash: r.content_hash,
          originalFilename: r.original_filename ?? null,
          originMethod: r.origin_method, captureTimeTrust: r.capture_time_trust,
          claimedCaptureTime: r.claimed_capture_time
            ? new Date(r.claimed_capture_time as string).toISOString() : null,
          serverReceivedAt: new Date(r.server_received_at as string).toISOString(),
          readUrl: signed.get(r.storage_key as string),
        });
      }

      return {
        status: 200,
        body: assignmentEvidenceResponse.parse({ groups }),
        // The body carries bearer capabilities. A shared cache holding this
        // response hands them to whoever asks next.
        headers: { "cache-control": "no-store" },
      };
    });
});
```

- [ ] **Step 5: Run the test until it passes, then the whole suite**

```bash
APP_DB_URL=… SERVICE_DB_URL=… SUPABASE_DB_URL=… \
pnpm --filter @goproceed/app exec vitest run tests/evidence-read.int.test.ts
APP_DB_URL=… SERVICE_DB_URL=… SUPABASE_DB_URL=… pnpm --filter @goproceed/app test
```

- [ ] **Step 6: Add the catalogue row**

In `technical/openapi/scope-v0.1.csv`, after the `requirement_occurrences.list` row:

```
evidence.list,GET,/v1/assignments/{assignmentId}/evidence,query,natural,member,@goproceed/contracts,@goproceed/contracts,v0.1-M6
```

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/evidence.ts packages/contracts/src/index.ts \
        apps/app/app/v1/assignments/\[assignmentId\]/evidence/route.ts \
        apps/app/tests/evidence-read.int.test.ts technical/openapi/scope-v0.1.csv
git commit -m "feat(v1): evidence by assignment — grouped by obligation, and the fallback photos are a group too"
```

---

## Task 4: `GET /external/evidence` — the bytes технагляд has never been able to see

**Files:**
- Create: `apps/app/app/external/evidence/route.ts`
- Modify: `technical/openapi/scope-v0.1.csv` (one row), `docs/decisions/ADR-009-three-pilot-surfaces.md` (one dated amendment covering BOTH routes)
- Test: `apps/app/tests/external-evidence.int.test.ts` (create)

**Interfaces:**
- Consumes: `openObjectStream` (Task 2); `withExternalTx`, `resolveExternalSession`, `externalNoStore` from `apps/app/src/lib/external-session.ts`.
- Produces: nothing later tasks import; Task 7's browser audit drives it over HTTP.

Four things settled by research — do not re-derive:

1. **No new grant, no new policy.** `eo_external_select` already admits «objects finalized from an *available* intent on this session's one occurrence», and `storage_key`/`storage_bucket` are already selectable — the existing route simply never selects them. Verified positively: an external session selecting those columns gets zero rows and **no permission error**, while `audit_events` gets `permission denied`.
2. **`externalQueryRoute` cannot be used.** It `JSON.stringify`s and hard-codes `application/json`, and it passes no route params. Build the `Response` directly, the way `apps/app/app/external/review/route.ts:145` already does for the same reason — and **re-apply by hand** the four headers `externalNoStore` would have given: `cache-control: no-store, no-cache, must-revalidate, private`, `referrer-policy: no-referrer`, `x-content-type-options: nosniff`, `x-frame-options: DENY`.
3. **`nosniff` makes `Content-Type` load-bearing** — and `media_type` is server-sniffed at finalize (`evidence-inspection.ts` recognises `image/jpeg`, `image/png`, `application/pdf`, `image/heic` and blocks anything else before a row exists), so the column is trustworthy for exactly this.
4. **Revocation is per-request and that is all.** Assert the next request is refused. **Do not write a test that claims an in-flight transfer stops** — nothing in this repo implements that, and the spec says so.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/external-evidence.int.test.ts`, modelled on `apps/app/tests/m5-external.int.test.ts` (which already exchanges a grant for a session and asserts a 404 after revoke at `:567-582`):

```ts
describe("GET /external/evidence", () => {
  it("serves the bytes of an object on the session's own occurrence", async () => {
    const res = await GET(new Request(
      `http://x/external/evidence?evidenceObjectId=${evidenceObjectId}`,
      { headers: { cookie: sessionCookie } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  it("refuses an object on a SIBLING occurrence", async () => {
    const res = await GET(/* …siblingEvidenceObjectId… */);
    expect(res.status).toBe(404);
  });

  it("refuses after the grant is revoked", async () => {
    await revokeGrant(grantId);
    const res = await GET(/* …same object… */);
    expect(res.status).toBe(404);
    // NOT ASSERTED, AND NOT ACHIEVABLE: that a transfer already in flight stops.
    // Revocation is revalidated per request — twice, at session resolution and
    // per statement — and «during» is implemented nowhere in this repo.
  });
});
```

- [ ] **Step 2: Run it and watch it fail** (route module missing).

- [ ] **Step 3: Implement**

```ts
export async function GET(req: Request): Promise<Response> {
  const requestId = requestIdFrom(req);
  try {
    const scope = await resolveExternalSession(req, requestId);   // refuses a revoked grant here
    const id = new URL(req.url).searchParams.get("evidenceObjectId") ?? "";

    const row = await withExternalTx(
      { organizationId: scope.workspaceId, requestId, externalSessionId: scope.sessionId },
      async (tx) => {
        // Selected by id AND asserted to be one row: `eo_external_select` is
        // what actually scopes this to the session's occurrence, and asserting
        // the count means a policy that ever widened fails loudly here instead
        // of quietly serving a sibling — the same discipline
        // `external/occurrence/route.ts` applies to its own single row.
        const r = await tx.query(
          `select storage_bucket, storage_key, media_type, byte_size::text as byte_size
             from public.evidence_objects where id = $1`, [id]);
        if (r.rows.length !== 1) return null;
        return r.rows[0];
      });

    if (!row) return jsonProblem(404, problem("EXTERNAL_SHARE_INVALID", /* … */));

    const stream = await openObjectStream(row.storage_bucket, row.storage_key);
    return new Response(stream, {
      status: 200,
      headers: {
        // `media_type` is SERVER-SNIFFED at finalize, never client-declared,
        // which is what makes it safe to echo under `nosniff`.
        "content-type": row.media_type,
        "content-length": row.byte_size,
        // Re-applied by hand: `externalNoStore` cannot be used, because
        // `externalQueryRoute` cannot emit bytes.
        "cache-control": "no-store, no-cache, must-revalidate, private",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    return toProblemResponse(err, requestId);
  }
}
```

- [ ] **Step 4: Run the test, then the whole suite.**

- [ ] **Step 5: Catalogue both operations and amend ADR-009**

`technical/openapi/scope-v0.1.csv`, after `external.occurrence_scope`:

```
external.evidence_bytes,GET,/external/evidence,query,natural,external,none (binary stream),none (binary stream),v0.1-M6
```

Then append to `docs/decisions/ADR-009-three-pilot-surfaces.md` a dated amendment — **an addition, never a rewrite of the original text** — recording that D1 adds two catalogued read operations, why the «no new API» rule bends here (the external plane's acceptance walk cannot complete without the image), and that the member plane signs while the external plane streams because that page's CSP admits nothing else.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(external): the reviewer can finally see the photo — a same-origin stream, because the page's own CSP forbids a signed URL"
```

---

## Task 5: the assignments list

**Files:**
- Create: `apps/app/src/services/assignments.service.ts`, `apps/app/src/components/assignments/assignments-list.tsx`, `apps/app/src/components/assignments/no-assignments-empty-state.tsx`, `apps/app/app/dash/projects/[projectId]/assignments/page.tsx`
- Modify: `technical/copy-catalog.csv`

Read-only, one call to the existing `GET /v1/projects/{projectId}/assignments`. D3 adds creation on top of this list; do not build a second one. Follow `workspaces.service.ts`'s discriminated-result shape (`{kind:"ok"} | {kind:"session_expired"} | {kind:"error"}`) and parse through a contracts schema if one exists — if `@goproceed/contracts` has no assignments-list schema, leave the one-line comment naming what adding it would take rather than inventing a contract in the app.

- [ ] **Step 1:** Read `docs/design/02-building-ui.md` §3.1, §3.3, §4.1. Note which §3.3 question each new component answers.
- [ ] **Step 2:** Write the service, the two components, the route file (routes wire and render — nothing else).
- [ ] **Step 3:** Ukrainian copy with catalog rows: heading «Доручення», empty state «У цьому проєкті ще немає доручень.»
- [ ] **Step 4:** Run the §5 gate and `pnpm --filter @goproceed/app build`. Paste the output.
- [ ] **Step 5:** Commit — `feat(dash): the assignments list, read-only — D3 adds creation on top of it`

---

## Task 6: the evidence screen

**Files:**
- Create: `apps/app/src/services/evidence.service.ts`, `apps/app/src/components/evidence/{evidence-by-occurrence,evidence-card,no-evidence-empty-state}.tsx`, `apps/app/app/dash/assignments/[assignmentId]/page.tsx`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Consumes: `assignmentEvidenceResponse` (Task 3). Parse the response through it in the service — `apiGet<T>`'s type parameter is a compile-time cast and asserts nothing about what the network returned.

- [ ] **Step 1:** Read the design gate as in Task 5.
- [ ] **Step 2:** Build the screen: one section per occurrence, each photo showing `server_received_at`, `origin_method`, `capture_time_trust` and `content_hash` — the facts ПТВ retypes into Word today.
- [ ] **Step 3: The null group is a labelled section, last, with its own Ukrainian copy** — «Без прив'язки до вимоги». A photo in it is evidence the field client captured outside the requirement flow; it is not an error and must never be hidden.
- [ ] **Step 4:** `readUrl` is optional in the contract. When it is absent, render «Зображення тимчасово недоступне», never a broken `<img>`. Images are `loading="lazy"` in fixed-size containers — these are full-size originals, because Supabase image transformation is a paid add-on (recorded in `TODOS.md`).
- [ ] **Step 5:** Run the §5 gate, the app build, and §6's six-viewport + reduced-motion pass. Paste the output.
- [ ] **Step 6:** Commit — `feat(dash): evidence by assignment — grouped by obligation, and the unbound photos are shown too`

---

## Task 7: «Відправити на перевірку», and the loop closed end to end

**Files:**
- Create: `apps/app/src/services/grants.service.ts`, `apps/app/src/components/evidence/issue-review-link.tsx`
- Modify: `apps/app/qa/field.mjs` (the seventh audit, and its header + `NOT_COVERED`), `technical/copy-catalog.csv`

Until now `POST /v1/occurrences/{occurrenceId}/grants` has been reachable only by curl, so even a working external read would still have needed the owner's hands.

- [ ] **Step 1:** The service and the control. On success the screen shows the link **once**, beside a sentence that does not soften INV-044: the token cannot be reconstructed or retried, and the only recovery is an authorized revoke-and-reissue. Copy: «Посилання показано один раз. Скопіюйте його зараз — відновити його неможливо, лише відкликати й видати нове.»
- [ ] **Step 2: The seventh browser audit — the whole loop, both planes.** In `apps/app/qa/field.mjs`, after the dashboard audit D0 added:
  1. ПТВ opens the assignment and sees the photo (assert the `<img>`'s `naturalWidth > 0`, not that a screenshot looks right);
  2. presses «Відправити на перевірку» and the link appears once;
  3. **a second browser context with no cookies** opens that link and sees the image — again asserted on `naturalWidth`, plus the absence of any `sb-*` cookie in that context, so the audit proves the no-account path rather than reusing the signed-in one.
- [ ] **Step 3:** Update `field.mjs`'s header and its `NOT_COVERED` list. After this change the harness covers the external plane; a stale header there is exactly the kind of untruth this repo's gate exists to prevent.
- [ ] **Step 4:** Run the full gate: `node packages/testing/qa/motion-audit.mjs`, `pnpm --filter @goproceed/testing test`, `pnpm turbo run typecheck`, both builds, `pnpm --filter @goproceed/app test` with the three DB URLs, and **three consecutive** `node apps/app/qa/field.mjs` runs. Paste the output.
- [ ] **Step 5:** Commit — `feat(dash): the review link is issued from the screen, and the whole loop is asserted in a browser`

---

## Self-review

**Spec coverage.** Wrappers → Task 1. Storage helper, TTL ceiling, batch semantics, stream → Task 2. Member route, contract, `no-store`, leak test, null-occurrence test, catalogue row → Task 3. External stream, CSP-driven hand-built headers, revocation test, catalogue row, ADR-009 amendment → Task 4. Assignments list → Task 5. Evidence screen and the null bucket → Task 6. Grant issuing and the seventh audit → Task 7. The spec's «out of scope» items appear in no task, deliberately.

**Placeholder scan.** Tasks 1–4 carry real code and real commands. Tasks 5–7 carry file lists, exact copy and exact gate commands but not full component source — they are UI work bound by a procedure (`02-building-ui.md`) that the executor must read anyway, and prescribing markup here would compete with it. The one thing that must not be left vague — the null group's treatment — is spelled out as its own step.

**Type consistency.** `assignmentEvidenceResponse` / `AssignmentEvidenceResponse` and `evidenceObjectView` are defined in Task 3 and consumed by that name in Task 6. `createSignedReadUrls` returns `Map<string, string>` in Task 2 and is consumed as a Map in Task 3. `EVIDENCE_URL_TTL_SECONDS` is defined in Task 2 and asserted in Task 2's own test. `HandlerResult.headers` is defined in Task 1 and set in Task 3.

**One risk this plan does not remove.** Task 4 is the first streaming response in this codebase and the first non-JSON route on either plane. Whether Vercel's Node runtime in `arn1` streams it without buffering is **not established** — nothing in the repo streams, so there is no deployed evidence. It does not block the slice (correctness is identical either way; only memory behaviour differs), and it is worth a note in the PR rather than a task here.
