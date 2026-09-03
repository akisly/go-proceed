import { describe, expect, it } from "vitest";
import {
  adminDatabaseUrl, hasIsolatedDatabaseCredentials, LOCAL_ADMIN_URL,
} from "./fixtures";

describe("fixture admin database selection", () => {
  it("uses the explicit isolated admin database when one is provided", () => {
    expect(adminDatabaseUrl({ TEST_DB_ADMIN_URL: "postgresql://isolated-admin/test" }))
      .toBe("postgresql://isolated-admin/test");
  });

  it("keeps the local admin database only as the legacy fallback", () => {
    expect(adminDatabaseUrl({})).toBe(LOCAL_ADMIN_URL);
  });

  it("does not treat whitespace-only credentials as an isolated database", () => {
    expect(hasIsolatedDatabaseCredentials({
      APP_DB_URL: "postgresql://app/test",
      SERVICE_DB_URL: "postgresql://service/test",
      TEST_DB_ADMIN_URL: "   ",
    })).toBe(false);
    expect(adminDatabaseUrl({ TEST_DB_ADMIN_URL: "   " })).toBe(LOCAL_ADMIN_URL);
  });
});
