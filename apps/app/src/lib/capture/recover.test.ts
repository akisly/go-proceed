import { describe, it, expect } from "vitest";
import { nextStateFor } from "./recover";

describe("the problem+json userAction decides what the screen does next", () => {
  it("never shows an in-progress label for an action nothing acts on", () => {
    // THE CORRECTION (final review, Important 4). These two used to return
    // "sending" and "awaiting_receipt" — labels that assert an operation is
    // under way — while `uploadCapture` set the state and returned, with no
    // retry of the PUT and no re-GET of the intent anywhere in this client.
    // "Потрібна дія" (the `failed` label) is the truth: the client stopped and
    // the next move is the foreman's. If either of these ever legitimately
    // returns an in-progress state again, it must be because the code that
    // performs that operation landed alongside it.
    expect(nextStateFor("retry_part")).toBe("failed");
    expect(nextStateFor("refresh_upload_state_or_request_new_grant")).toBe("failed");
  });

  it("keeps the honest not-sent label where the client makes no claim of progress", () => {
    expect(nextStateFor("request_new_upload_grant")).toBe("not_sent");
  });

  it("never reports a state that claims an operation is in flight", () => {
    // The structural version of the assertion above: no userAction may map to
    // a label that says something is happening, because nothing is. This one
    // catches a NEW mapping added later that reintroduces the same lie.
    for (const a of ["retry_part", "request_new_upload_grant", "sign_in",
                     "refresh_upload_state_or_request_new_grant",
                     "recapture_or_contact_support", "something_new", ""]) {
      expect(["sending", "awaiting_receipt"], a).not.toContain(nextStateFor(a));
    }
  });

  it("gives up only where the server says the capture itself is finished", () => {
    expect(nextStateFor("recapture_or_contact_support")).toBe("failed");
  });

  it("returns an expired session to not_sent, not failed — the bytes are still in hand and the capture was never attempted against a valid session", () => {
    expect(nextStateFor("sign_in")).toBe("not_sent");
  });

  it("never invents a saved state from an error", () => {
    for (const a of ["retry_part", "request_new_upload_grant", "sign_in",
                     "refresh_upload_state_or_request_new_grant",
                     "recapture_or_contact_support", "something_new"]) {
      expect(nextStateFor(a), a).not.toBe("server_confirmed");
    }
  });

  it("falls back to failed for an action it does not know, rather than to a guess", () => {
    expect(nextStateFor("something_new")).toBe("failed");
  });
});
