import { describe, it, expect } from "vitest";
import { nextStateFor } from "./recover";

describe("the problem+json userAction decides what the screen does next", () => {
  it("keeps bytes in hand for every recoverable action", () => {
    expect(nextStateFor("retry_part")).toBe("sending");
    expect(nextStateFor("request_new_upload_grant")).toBe("not_sent");
    expect(nextStateFor("refresh_upload_state_or_request_new_grant")).toBe("awaiting_receipt");
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
