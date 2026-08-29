import { describe, expect, it } from "vitest";
import { adminDatabaseUrl, LOCAL_ADMIN_URL } from "./fixtures";

describe("fixture admin database selection", () => {
  it("uses the explicit isolated admin database when one is provided", () => {
    expect(adminDatabaseUrl({ TEST_DB_ADMIN_URL: "postgresql://isolated-admin/test" }))
      .toBe("postgresql://isolated-admin/test");
  });

  it("keeps the local admin database only as the legacy fallback", () => {
    expect(adminDatabaseUrl({})).toBe(LOCAL_ADMIN_URL);
  });
});
