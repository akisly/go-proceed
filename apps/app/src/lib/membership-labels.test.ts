import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MEMBERSHIP_ROLE_LABELS,
  MEMBERSHIP_STATUS_LABELS,
  membershipRoleLabel,
  membershipStatusLabel,
} from "./membership-labels";

/**
 * The label maps against the CHECK constraints they claim to cover, read out
 * of `technical/schema.sql` on every run.
 *
 * WHY NOT JUST LIST THE SEVENTEEN STRINGS HERE. A test that repeats the map's
 * own keys proves only that someone typed them twice. The failure this file
 * exists to catch is the one that happens LATER: a migration widens
 * `memberships.role` with a fourteenth value, nothing here changes, and the
 * new role renders as `site_inspector` on a Ukrainian screen with every suite
 * green. Deriving the expectation from the schema is what makes that a red
 * test instead of a bug report from the pilot.
 *
 * THE TABLE BLOCK IS EXTRACTED FIRST, AND THAT IS NOT TIDINESS.
 * `technical/schema.sql` carries `role text not null check (role in (…))`
 * TWICE — `public.memberships` (thirteen values) and `public.invitations`
 * (twelve; no `owner`, because an invitation cannot mint one) — and
 * `status … check (status in (…))` on a dozen unrelated tables. A regex run
 * over the whole file finds whichever happens to come first and would have
 * asserted this map against the wrong constraint. So: find the owning
 * `create table` block, then look for the column inside it.
 *
 * `packages/testing/src/copy-catalog-fidelity.test.ts` scopes its own parse
 * the same way, for the same reason, against a different file.
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const SCHEMA = join(REPO_ROOT, "technical", "schema.sql");
const COPY_CATALOG = join(REPO_ROOT, "technical", "copy-catalog.csv");

function checkedValues(table: string, column: string): string[] {
  const sql = readFileSync(SCHEMA, "utf8");
  const block = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!block) throw new Error(`no \`create table public.${table}\` block in technical/schema.sql`);
  const check = new RegExp(`\\n\\s*${column}\\s[\\s\\S]*?check \\(${column} in\\s*\\(([^)]*)\\)`)
    .exec(block[1]!);
  if (!check) throw new Error(`no check constraint on ${table}.${column} in technical/schema.sql`);
  return [...check[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

describe("every membership role the database permits has a Ukrainian label", () => {
  it("covers memberships.role", () => {
    const permitted = checkedValues("memberships", "role");
    // Guards the regex itself: a pattern that silently matched nothing, or
    // matched `public.invitations`'s twelve-value list instead, would other-
    // wise pass this suite by asking nothing of the map.
    expect(permitted).toContain("owner");
    expect(permitted.length).toBe(13);

    const missing = permitted.filter((role) => !(role in MEMBERSHIP_ROLE_LABELS));
    expect(missing).toEqual([]);
  });

  it("covers memberships.status", () => {
    const permitted = checkedValues("memberships", "status");
    expect(permitted).toContain("active");
    expect(permitted.length).toBe(4);

    const missing = permitted.filter((status) => !(status in MEMBERSHIP_STATUS_LABELS));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", () => {
    // The other direction, and it has teeth for the same reason
    // `copy-catalog-fidelity.test.ts`'s does: a label for a value that was
    // renamed out of the schema is a dead entry nobody notices, and the next
    // reader trusts it as evidence the value still exists.
    const roles = new Set(checkedValues("memberships", "role"));
    expect(Object.keys(MEMBERSHIP_ROLE_LABELS).filter((r) => !roles.has(r))).toEqual([]);

    const statuses = new Set(checkedValues("memberships", "status"));
    expect(Object.keys(MEMBERSHIP_STATUS_LABELS).filter((s) => !statuses.has(s))).toEqual([]);
  });

  it("labels every value in Ukrainian, never by echoing the identifier back", () => {
    // A label that is the raw value spelled the same way is indistinguishable
    // from a missing one at the call site, since that is exactly what the
    // fallback returns.
    for (const [role, label] of Object.entries(MEMBERSHIP_ROLE_LABELS)) {
      expect(label).not.toBe(role);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
    for (const [status, label] of Object.entries(MEMBERSHIP_STATUS_LABELS)) {
      expect(label).not.toBe(status);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
  });
});

/**
 * The maps against `technical/copy-catalog.csv`, which
 * `docs/design/03-ui-references.md` maps to plane's `packages/constants` — the
 * one place a reviewer, a translator or a support reply looks up a string this
 * product renders.
 *
 * A CATALOG ROW IS ONLY WORTH SOMETHING IF IT IS TRUE. The row and the map are
 * two copies of the same Ukrainian sentence, and the copy nobody renders is
 * the one that goes stale: `packages/testing/src/status-label-fidelity.test.ts`
 * exists because exactly that happened to the mobile client's generated
 * labels, silently, with three other suites green.
 *
 * Only the first two fields are read, and the naive split is safe for them
 * specifically: `key` is an identifier and every `ui_uk` below is a single
 * label with no comma and no quote — asserted rather than assumed, because the
 * day one of them gains a comma this parser would truncate it and compare a
 * fragment.
 */
function catalogLabels(prefix: string): Map<string, string> {
  const rows = readFileSync(COPY_CATALOG, "utf8").split("\n").filter((l) => l.startsWith(prefix));
  return new Map(rows.map((line) => {
    const [key, uiUk] = line.split(",");
    if (uiUk === undefined || uiUk.includes('"')) {
      throw new Error(`copy-catalog row "${key}" needs a real CSV parser now: ${line.slice(0, 80)}`);
    }
    return [key!.slice(prefix.length), uiUk];
  }));
}

describe("the catalog says what the code renders", () => {
  it("carries one row per role, with the same Ukrainian string", () => {
    const catalog = catalogLabels("membership.role.");
    expect([...catalog.keys()].sort()).toEqual(Object.keys(MEMBERSHIP_ROLE_LABELS).sort());
    for (const [role, label] of Object.entries(MEMBERSHIP_ROLE_LABELS)) {
      expect(catalog.get(role)).toBe(label);
    }
  });

  it("carries one row per status, with the same Ukrainian string", () => {
    const catalog = catalogLabels("membership.status.");
    expect([...catalog.keys()].sort()).toEqual(Object.keys(MEMBERSHIP_STATUS_LABELS).sort());
    for (const [status, label] of Object.entries(MEMBERSHIP_STATUS_LABELS)) {
      expect(catalog.get(status)).toBe(label);
    }
  });
});

describe("an unknown value stays readable", () => {
  // `meContextResponse` types both fields as `z.string()`, so a server one
  // deploy ahead can legitimately send a value this client has never seen.
  it("returns the raw role when nothing is mapped", () => {
    expect(membershipRoleLabel("site_inspector")).toBe("site_inspector");
    expect(membershipRoleLabel("")).toBe("");
  });

  it("returns the raw status when nothing is mapped", () => {
    expect(membershipStatusLabel("archived")).toBe("archived");
  });

  it("does not resolve inherited Object.prototype keys as labels", () => {
    // `MEMBERSHIP_ROLE_LABELS[role]` on a plain object literal would answer
    // `toString` and `constructor` with a function, which then renders as
    // source code. `Object.freeze` does not close that; the fallback's `??`
    // does not either, because the inherited value is not nullish.
    expect(membershipRoleLabel("toString")).toBe("toString");
    expect(membershipStatusLabel("constructor")).toBe("constructor");
  });
});
