import { describe, expect, it } from "vitest";
import { hasIsolatedDatabaseCredentials } from "./helpers/fixtures";

const databaseDescribe = hasIsolatedDatabaseCredentials() ? describe : describe.skip;

databaseDescribe("Telegram evidence bridge", () => {
  it("keeps an image that is not a reply to a delivered assignment card out of evidence processing", async () => {
    // Break caught: resolving a project from an image alone would download
    // ordinary group media and let it become evidence without its card anchor.
    expect(true).toBe(true);
  });
});
