import { describe, it, expect } from "vitest";

import { issueReviewLink, type FetchLike } from "./grants.service";

/**
 * The five outcomes of `issueReviewLink`, driven in plain Node with a fake
 * `fetch` — the same shape `src/lib/capture/upload.test.ts` uses, and for the
 * same reason: `apps/app`'s vitest has no jsdom and no DOM testing library,
 * so the only way to pin behaviour that lives behind a button is to put the
 * behaviour in a function with its collaborator injected.
 *
 * The branch that matters most here is `issued_without_link`. It is INV-044's
 * own shape — a 201 whose body carries no token, because the token was never
 * stored and cannot be reconstructed — and it is exactly the branch a future
 * edit would collapse into `ok` by reaching for `body.link!`, at which point
 * the screen would render `undefined` as a link and tell a person to copy it.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

const OCCURRENCE = "11111111-1111-4111-8111-111111111111";

function issued(overrides: Record<string, unknown> = {}) {
  return {
    grantId: "22222222-2222-4222-8222-222222222222",
    requirementOccurrenceId: OCCURRENCE,
    approverRole: "technical_supervisor",
    recipientEmail: "pryklad@example.test",
    recipientRole: "технічний нагляд",
    permissions: { "external.view_scope": true, "external.decide_evidence": false },
    status: "active",
    expiresAt: "2026-08-29T09:00:00.000Z",
    revocationVersion: 1,
    issuedAt: "2026-08-22T09:00:00.000Z",
    ...overrides,
  };
}

const VALID = {
  occurrenceId: OCCURRENCE,
  recipientEmail: "Pryklad@Example.Test",
  recipientRole: "технічний нагляд",
};

describe("issueReviewLink — the request it actually sends", () => {
  it("posts to the occurrence's grants route with an Idempotency-Key and a JSON content type", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fake: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(201, issued({ link: { url: "https://app.example/external/review#tok", expiresAt: "2026-08-29T09:00:00.000Z", deliveredBy: "caller" } }));
    };

    await issueReviewLink(VALID, fake);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`/v1/occurrences/${OCCURRENCE}/grants`);
    expect(calls[0]!.init?.method).toBe("POST");
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    // `commandRoute` refuses a command with no key (422 VALIDATION_FAILED), so
    // this is not decoration — without it every press is a refusal.
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends the contract's OUTPUT, so the address is lower-cased before it reaches storage", async () => {
    let sent: unknown;
    const fake: FetchLike = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return jsonResponse(201, issued({ link: { url: "https://app.example/external/review#tok", expiresAt: "x", deliveredBy: "caller" } }));
    };

    await issueReviewLink(VALID, fake);

    // `external_access_grants` CHECKs `recipient_email = lower(recipient_email)`.
    // The transform lives in `issueOccurrenceGrantRequest`; this asserts the
    // service ships the parsed value rather than the raw input it was given.
    expect((sent as { recipientEmail: string }).recipientEmail).toBe("pryklad@example.test");
  });

  it("asks for a VIEW-ONLY grant — this screen cannot name the occurrence's approver role", async () => {
    let sent: unknown;
    const fake: FetchLike = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return jsonResponse(201, issued({ link: { url: "https://app.example/external/review#tok", expiresAt: "x", deliveredBy: "caller" } }));
    };

    await issueReviewLink(VALID, fake);

    expect((sent as { permissions: Record<string, boolean> }).permissions).toEqual({
      "external.view_scope": true,
      "external.decide_evidence": false,
    });
    // Seven days is the contract's ceiling AND its default; sending it
    // explicitly is what makes this call's expiry visible at the call site.
    expect((sent as { expiresInDays: number }).expiresInDays).toBe(7);
  });
});

describe("issueReviewLink — the outcomes", () => {
  it("returns the link on a first execution", async () => {
    const fake: FetchLike = async () => jsonResponse(201, issued({
      link: { url: "https://app.example/external/review#tok", expiresAt: "2026-08-29T09:00:00.000Z", deliveredBy: "caller" },
    }));

    const result = await issueReviewLink(VALID, fake);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.link.url).toBe("https://app.example/external/review#tok");
    expect(result.link.expiresAt).toBe("2026-08-29T09:00:00.000Z");
  });

  it("INV-044: a 201 with no link is its own outcome, never an `ok` with an empty url", async () => {
    const fake: FetchLike = async () => jsonResponse(201, issued());
    expect((await issueReviewLink(VALID, fake)).kind).toBe("issued_without_link");
  });

  it("treats a link whose url is missing or empty as the no-link case", async () => {
    const missing: FetchLike = async () => jsonResponse(201, issued({ link: { expiresAt: "x", deliveredBy: "caller" } }));
    const empty: FetchLike = async () => jsonResponse(201, issued({ link: { url: "", expiresAt: "x", deliveredBy: "caller" } }));
    expect((await issueReviewLink(VALID, missing)).kind).toBe("issued_without_link");
    expect((await issueReviewLink(VALID, empty)).kind).toBe("issued_without_link");
  });

  it("refuses a malformed address without making a request at all", async () => {
    let called = false;
    const fake: FetchLike = async () => { called = true; return jsonResponse(201, issued()); };

    const result = await issueReviewLink({ ...VALID, recipientEmail: "не-адреса" }, fake);

    expect(result.kind).toBe("invalid");
    expect(called).toBe(false);
  });

  it("refuses an empty role without making a request at all", async () => {
    let called = false;
    const fake: FetchLike = async () => { called = true; return jsonResponse(201, issued()); };

    expect((await issueReviewLink({ ...VALID, recipientRole: "   " }, fake)).kind).toBe("invalid");
    expect(called).toBe(false);
  });

  it("names a 401 as a dead office session, not as a refusal to explain", async () => {
    const fake: FetchLike = async () => jsonResponse(401, { detail: "Сесія завершилася." });
    expect((await issueReviewLink(VALID, fake)).kind).toBe("session_expired");
  });

  it("carries the server's own Ukrainian `detail` through on a refusal", async () => {
    const fake: FetchLike = async () => jsonResponse(409, {
      detail: "Цій особі вже надіслано чинне посилання на цю вимогу. Відкличте його, щоб надіслати нове.",
    });

    const result = await issueReviewLink(VALID, fake);

    expect(result.kind).toBe("refused");
    if (result.kind !== "refused") return;
    expect(result.detail).toContain("вже надіслано чинне посилання");
  });

  it("falls back to `error` when a non-2xx carries no readable detail", async () => {
    const fake: FetchLike = async () => new Response("<html>502</html>", { status: 502 });
    expect((await issueReviewLink(VALID, fake)).kind).toBe("error");
  });

  it("returns `error` when the request itself never completes", async () => {
    const fake: FetchLike = async () => { throw new TypeError("Failed to fetch"); };
    expect((await issueReviewLink(VALID, fake)).kind).toBe("error");
  });
});
