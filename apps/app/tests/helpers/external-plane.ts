import { EXTERNAL_SESSION_COOKIE } from "../../src/lib/external-link";

/**
 * The four external-plane moves every no-account-reviewer suite makes: issue a
 * grant, exchange the link's fragment token for a session, read the opaque
 * session cookie off the exchange response, and open the scope with it.
 *
 * EXTRACTED 2026-08-28 (TODOS 2026-08-27 residual 9). These four existed in
 * three near-duplicate copies — `m5-external.int.test.ts`,
 * `external-evidence.int.test.ts` and `project-sourced-chain.int.test.ts` —
 * because neither older suite exported its copy and the chain slice could not
 * restructure either. Each suite's DELIBERATE differences survive as
 * parameters, not as forks:
 *
 *   * m5's `origin` override on `exchange` is what its cross-origin refusals
 *     are made of — the request URL stays on the real origin while the header
 *     lies, which is exactly the browser situation the check exists for;
 *   * m5's `externalScope(null)` is the no-cookie refusal, so the cookie
 *     parameter admits null;
 *   * external-evidence addresses grants to varying recipients, so the issue
 *     body is an override merged over the shared default.
 *
 * WHAT IS DELIBERATELY NOT HERE: m5's `submit` (the decisions POST with the
 * CSRF synchronizer header) and both suites' `openLink` composites. `submit`
 * has one consumer and its CSRF/content-type/origin knobs are m5's own
 * refusal matrix; the composites make suite-specific assertions on the way
 * through, and an assertion inside a shared helper is a hidden test.
 *
 * The cookie regex matches the OPAQUE SESSION VALUE the browser would have
 * stored — 43 base64url characters — and never a token; the token never
 * appears in a Set-Cookie and travels only in the link's fragment.
 */

/** The one origin all three suites configure as EXTERNAL_LINK_ORIGIN. */
export const EXTERNAL_TEST_ORIGIN = "https://prykladapp.example";

/** The external role every fixture grant names. */
export const EXTERNAL_TEST_APPROVER = "technical_supervisor";

export async function issueGrant(
  occurrenceId: string, body: Record<string, unknown> = {}, key = crypto.randomUUID(),
): Promise<Response> {
  const { POST } = await import("../../app/v1/occurrences/[occurrenceId]/grants/route");
  const req = new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({
      recipientEmail: "prykladtechnahliad@example.test",
      recipientRole: EXTERNAL_TEST_APPROVER,
      permissions: { "external.view_scope": true, "external.decide_evidence": true },
      ...body,
    }),
  });
  return POST(req, { params: Promise.resolve({ occurrenceId }) });
}

/** The token lives in the FRAGMENT, which is the half a server log never sees. */
export function tokenOf(link: { url: string }): string {
  return new URL(link.url).hash.slice(1);
}

export async function exchange(
  token: string, origin = EXTERNAL_TEST_ORIGIN,
): Promise<Response> {
  const { POST } = await import("../../app/external/exchange/route");
  return POST(new Request(`${EXTERNAL_TEST_ORIGIN}/external/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ token }),
  }));
}

/** The opaque cookie value the browser would have stored. */
export function cookieOf(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = new RegExp(`${EXTERNAL_SESSION_COOKIE}=([A-Za-z0-9_-]{43})`).exec(raw);
  if (!m) throw new Error(`no external session cookie in: ${raw}`);
  return m[1]!;
}

export async function externalScope(cookie: string | null): Promise<Response> {
  const { GET } = await import("../../app/external/occurrence/route");
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `${EXTERNAL_SESSION_COOKIE}=${cookie}`;
  return GET(new Request(`${EXTERNAL_TEST_ORIGIN}/external/occurrence`, { headers }),
    { params: Promise.resolve({}) });
}
