/**
 * THE ID SCHEMA IN THIS PACKAGE IS `z.string().guid()`, NOT `.uuid()` —
 * a zod 4 decision made on 2026-08-24, and the reason is a real 422 risk
 * rather than a style preference.
 *
 * Zod 4 tightened `.uuid()` to RFC 9562: the version nibble and the variant
 * nibble are now checked, so `66666666-6666-6666-6666-666666666666` is
 * rejected where zod 3 accepted it. Postgres's own `uuid` type checks NEITHER
 * — it accepts any 8-4-4-4-12 hex string — so a contract on `.uuid()` is
 * strictly narrower than the column it describes, and the gap is reachable by
 * every hand-inserted row this product has (the staging «Приклад-» world, the
 * SQL seeds, every fixture).
 *
 * MEASURED BEFORE CHOOSING, not argued: of the 112 distinct UUID literals in
 * this repository's `packages/`, `apps/`, `supabase/`, `scripts/` and
 * `migration/` sources, **88 are rejected by zod 4's `.uuid()` and 0 by
 * `.guid()`**. `gen_random_uuid()` emits v4 and passes either way; everything
 * written by hand does not.
 *
 * `.guid()` (`zod/v4/classic/schemas.d.ts:119`) is the shape-only check —
 * exactly what zod 3's `.uuid()` did and exactly what the database enforces.
 * Choosing it means this upgrade changes no request that used to be accepted.
 * If a specific field should ever demand a real v4, zod 4 ships `.uuidv4()`
 * on the same interface (line 123) and that is a per-field product decision,
 * not a library default to inherit by accident.
 */

export * from "./problem";
export * from "./organizations";
export * from "./me-context";
export * from "./workspaces";
export * from "./members";
export * from "./invitations";
export * from "./parties";
export * from "./projects";
export * from "./project-access";
export * from "./contracts-baseline";
export * from "./imports";
export * from "./contract-versions";
export * from "./work-items";
export * from "./requirements";
export * from "./requirement-library";
export * from "./requirement-rules";
export * from "./requirement-occurrences";
export * from "./assignments";
export * from "./evidence";
export * from "./progress";
export * from "./progress-adjustments";
export * from "./uploads";
export * from "./work-stages";
export * from "./requirement-decisions";
export * from "./readiness";
export * from "./blocked-value";
export * from "./stage-closures";
export * from "./statutory-acts";
// `technical/openapi/scope-v0.1.csv:56-58` names the owner of the four external
// operations' contracts `@goproceed/contracts#external` — this module. There is
// no subpath export in package.json (`main` is `./src/index.ts` and nothing
// else), so `#external` is read as «the external module of the contracts
// package» rather than as an exports-map entry, and it is re-exported here like
// every other module. A real subpath export would be a packaging change owned by
// nothing in this slice.
export * from "./external";
export * from "./project-requirements";
