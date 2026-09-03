import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";
import { projectCapability } from "@goproceed/contracts";

// The project capability vocabulary is stated in three places and derived in
// none: the grant API's zod enum, the routes' TypeScript union, and the database
// check constraint. v0.1-M2-A extended two of the three and shipped a slice
// whose grants were rejected with a 422 the fixtures swallowed. This test is the
// cheap standing guard against the next occurrence.

let c: Client;
beforeAll(async () => { c = await adminClient(); });
afterAll(async () => { await c.end(); });

it("keeps the grant API enum and the database constraint in agreement", async () => {
  const r = await c.query<{ src: string }>(
    `select pg_get_constraintdef(oid) as src from pg_constraint
      where conname = 'project_access_grants_capability_check'`);
  const constraint = r.rows[0];
  expect(constraint).toBeDefined();

  const inDatabase = [...constraint!.src.matchAll(/'([a-z_]+\.[a-z_]+)'::text/g)]
    .map((m) => m[1]!).sort();
  const inApi = [...projectCapability.options].sort();

  expect(inApi).toEqual(inDatabase);
});

it("names the field-channel reply capability in the grant vocabulary", () => {
  expect(projectCapability.options).toContain("communication.reply");
});
