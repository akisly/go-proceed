import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq } from "./helpers/fixtures";
import { listLibrary } from "./helpers/manual-baseline";
import { readDodatokN, DODATOK_N_SOURCE_STANDARD, type DodatokNRow } from "./helpers/dodatok-n";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked, no migration was applied,
 * and no claim is made that any assertion below passes.
 *
 * ---------------------------------------------------------------------------
 * THIS SUITE IS EXPECTED TO FAIL TODAY, AND THAT IS WHAT IT IS FOR.
 *
 * Plan task 3 (docs/superpowers/plans/2026-08-06-v0.1-implementation.md:1038-1044)
 * owes a constant compiled out of
 * technical/requirements/dbn-a31-5-2016-dodatok-n.csv and its materialisation
 * per workspace at `workspaces.create`. Nothing in the tree implements it:
 * apps/app/app/v1/workspaces/route.ts writes the organization, the owner
 * membership, an audit row and an outbox row, and no library row. Until that
 * lands, `requirement_library.list` answers `{items: []}` in every workspace,
 * `requirement_rule_versions.publish` cannot succeed at all — its
 * `requirementLibraryItemId` must resolve to a row in the workspace — and
 * therefore nothing can be bound and no baseline can be published.
 *
 * The assertions below are the REQUIRED behaviour, written against the command
 * rather than against a helper: seeding the rows here first and then reading
 * them back would compare the CSV with itself and would go green while the
 * product shipped an empty library. What makes this suite pass is task 3, and
 * nothing else.
 *
 * WHY THE SEEDING IS A COMMAND AND NOT A MIGRATION. These rows are
 * workspace-scoped (entity-catalog.csv, relationship-catalog.csv, and
 * migration 0041 §1 builds the table that way) and there is no workspace at
 * migration time. docs/domain/domain-model.md calls the content
 * workspace-INDEPENDENT and is the document that is wrong; migration 0042 §6
 * records that it owes a correction, and this suite does not make it.
 *
 * WHY IT LIVES HERE AND NOT IN packages/testing. The plan files this as
 * packages/testing/src/requirement-library-fidelity.test.ts. That package has
 * no way to invoke a route, and the seeding path IS a route command — a
 * database-only version of this test could only assert that rows somebody
 * inserted match the CSV, which is the tautology described above. The three
 * storability clauses task 3 also names (no row with a NULL tag or source) are
 * a database question and DO live there, in
 * packages/testing/src/m1-rules-schema.test.ts.
 */

const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MEMBER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OUTSIDER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = OWNER;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/** The CSV, read independently of anything the product does with it. */
const CSV: DodatokNRow[] = readDodatokN();

interface StoredItem {
  libraryItemId: string;
  sourceStandard: string;
  positionCode: string;
  positionTitleUk: string;
  itemNo: number;
  itemTextUk: string;
  normativeCharacter: string;
  verification: string;
  sourceCitation: string;
  actFormAssumption: string | null;
  actFormBasis: string;
}

let workspaceId: string;

async function createWorkspace(displayName: string): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/route");
  const res = await POST(jsonReq("http://x", { displayName }), { params: Promise.resolve({}) });
  if (res.status !== 201) {
    throw new Error(`workspaces.create returned ${res.status} ${await res.text()}`);
  }
  return (await res.json()).workspaceId as string;
}

/** The stored rows, read straight from the table in the standard's own order. */
async function storedRows(ws: string): Promise<StoredItem[]> {
  const rows = await q<{
    id: string; source_standard: string; position_code: string; position_title_uk: string;
    item_no: number; item_text_uk: string; normative_character: string; verification: string;
    source_citation: string; act_form_assumption: string | null; act_form_basis: string;
  }>(`select id, source_standard, position_code, position_title_uk, item_no, item_text_uk,
             normative_character, verification, source_citation,
             act_form_assumption, act_form_basis
        from public.requirement_library_items
       where workspace_id = $1 order by position_code, item_no`, [ws]);
  return rows.map((r) => ({
    libraryItemId: r.id,
    sourceStandard: r.source_standard,
    positionCode: r.position_code,
    positionTitleUk: r.position_title_uk,
    itemNo: Number(r.item_no),
    itemTextUk: r.item_text_uk,
    normativeCharacter: r.normative_character,
    verification: r.verification,
    sourceCitation: r.source_citation,
    actFormAssumption: r.act_form_assumption,
    actFormBasis: r.act_form_basis,
  }));
}

/**
 * Identical UTF-16 strings encode to identical UTF-8 bytes, so the first
 * assertion already implies the second. Both are made because "byte for byte"
 * is the requirement and the first line is what produces a readable diff when
 * a single character has drifted.
 */
function sameBytes(actual: string, expected: string, label: string): void {
  expect(actual, label).toBe(expected);
  expect(Buffer.from(actual, "utf-8").equals(Buffer.from(expected, "utf-8")), label).toBe(true);
}

beforeEach(async () => {
  await truncateAll();
  current = OWNER;
  workspaceId = await createWorkspace("Приклад-Простір Додатка Н");
});

describe("the library seeding command produces the twelve Додаток Н rows", () => {
  it("reads twelve rows out of the CSV in the first place", () => {
    // Guards the guard: if the content file were emptied or reordered, every
    // fidelity assertion below would compare nothing against nothing.
    expect(CSV).toHaveLength(12);
    expect(CSV.filter((r) => r.position === "Н.14")).toHaveLength(5);
    expect(CSV.filter((r) => r.position === "Н.15")).toHaveLength(7);
  });

  it("materialises exactly twelve rows into a newly created workspace", async () => {
    const stored = await storedRows(workspaceId);
    expect(stored).toHaveLength(12);
  });

  it("is 5 for Н.14 and 7 for Н.15, numbered 1..5 and 1..7", async () => {
    const stored = await storedRows(workspaceId);
    const n14 = stored.filter((r) => r.positionCode === "Н.14");
    const n15 = stored.filter((r) => r.positionCode === "Н.15");
    expect(n14).toHaveLength(5);
    expect(n15).toHaveLength(7);
    expect(n14.map((r) => r.itemNo)).toEqual([1, 2, 3, 4, 5]);
    expect(n15.map((r) => r.itemNo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // The extent is also structural (0041's dodatok_n_extent_check), so a
    // thirteenth row is unrepresentable rather than merely absent — asserted at
    // the database layer in packages/testing/src/m1-rules-schema.test.ts.
  });

  it("stores every wording byte for byte as the CSV carries it", async () => {
    const stored = await storedRows(workspaceId);
    for (const row of CSV) {
      const item = stored.find((s) => s.positionCode === row.position && s.itemNo === row.itemNo);
      const label = `${row.position}/${row.itemNo}`;
      expect(item, label).toBeDefined();
      if (!item) continue;
      sameBytes(item.itemTextUk, row.itemTextUk, `${label} item_text_uk`);
      sameBytes(item.positionTitleUk, row.positionTitleUk, `${label} position_title_uk`);
      // The verification tag and the source travel WITH the string or the
      // string is unrenderable — hidden-works-content-rules.md §"Architectural
      // requirement" is binding on every normative string the product displays.
      sameBytes(item.verification, row.verification, `${label} verification`);
      sameBytes(item.sourceCitation, row.source, `${label} source_citation`);
    }
  });

  it("names the standard the attribution is composed from", async () => {
    // The CSV has no source_standard column and the column is NOT NULL, so the
    // seeding command supplies it. There is exactly one admissible value:
    // apps/app/src/lib/requirement-content.ts composes
    // «ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15» from it, and
    // that form is what the allow-list gives literally. A row naming any other
    // standard would attribute Додаток Н to a document it does not come from.
    const stored = await storedRows(workspaceId);
    for (const item of stored) {
      expect(item.sourceStandard, `${item.positionCode}/${item.itemNo}`)
        .toBe(DODATOK_N_SOURCE_STANDARD);
    }
  });

  it("records Додаток Н as довідковий and the act form as the product's own assumption", async () => {
    const stored = await storedRows(workspaceId);
    for (const item of stored) {
      const label = `${item.positionCode}/${item.itemNo}`;
      // Prohibition B: «орієнтовн» occurs zero times in the standard.
      // Prohibition C: Додаток Н is never presented as mandatory or exhaustive.
      expect(item.normativeCharacter, label).toBe("dovidkovyi");
      // Prohibition G: neither ДБН А.3.1-5:2016 nor ДСТУ 9258:2023 says which
      // position takes which act form.
      expect(item.actFormBasis, label).toBe("product_assumption");
      // Every VERIFIED_PRIMARY row rests on one download of the official file
      // that no reviewer can reopen (hidden-works-content-rules.md §"Open
      // items"). UNVERIFIED is not storable, so the only other value a re-fetch
      // may produce is VERIFIED_SECONDARY.
      expect(["VERIFIED_PRIMARY", "VERIFIED_SECONDARY"], label).toContain(item.verification);
    }
  });
});

describe("requirement_library.list returns exactly what was seeded", () => {
  it("answers with the twelve rows in the standard's own sequence", async () => {
    const res = await listLibrary(workspaceId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(12);
    // Ordered by position then item number, because the ORDER is part of the
    // content: a list rendered in insertion order presents the standard
    // rearranged.
    expect(body.items.map((i: StoredItem) => `${i.positionCode}/${i.itemNo}`)).toEqual(
      CSV.map((r) => `${r.position}/${r.itemNo}`));
  });

  it("carries the tag and the source with every string it returns", async () => {
    const res = await listLibrary(workspaceId);
    const body = await res.json();
    for (const item of body.items as StoredItem[]) {
      const row = CSV.find((r) => r.position === item.positionCode && r.itemNo === item.itemNo);
      expect(row, `${item.positionCode}/${item.itemNo}`).toBeDefined();
      if (!row) continue;
      sameBytes(item.itemTextUk, row.itemTextUk, `${item.positionCode}/${item.itemNo} text`);
      sameBytes(item.sourceCitation, row.source, `${item.positionCode}/${item.itemNo} source`);
      expect(item.verification).toBe(row.verification);
    }
  });

  it("is readable by a plain member, not only by owner and admin", async () => {
    // ADR-006 step 2 has the FOREMAN reading the obligation before work starts,
    // and a foreman holds the `member` governance role. Migration 0041's
    // `rli_select` asks for active membership and says so;
    // technical/permissions/capabilities.csv:9 files the operation under
    // requirement_rules.manage (owner/admin) and therefore disagrees.
    // docs/README.md §"Source of truth" puts an applied migration above the
    // permission catalog, so THE CSV OWES A CORRECTION — and this assertion is
    // what goes red if the route is narrowed to match the CSV instead.
    await q(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'member','active')`, [workspaceId, MEMBER]);
    current = MEMBER;
    const res = await listLibrary(workspaceId);
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(12);
  });

  it("shows nothing to somebody who is not a member", async () => {
    current = OUTSIDER;
    const res = await listLibrary(workspaceId);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("MEMBERSHIP_INACTIVE");
  });

  it("offers no create, update or delete counterpart", async () => {
    // Content is a repository change under hidden-works-content-rules.md
    // §"Change control" and never a runtime command: no row of
    // technical/openapi/scope-v0.1.csv writes this table, and 0041 deliberately
    // creates no such operation. A write route added later fails here.
    const mod = await import("../app/v1/workspaces/[workspaceId]/requirement-library/route");
    expect(Object.keys(mod).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k)))
      .toEqual([]);
  });
});

describe("the content is materialised per workspace", () => {
  it("gives a second workspace its own twelve rows", async () => {
    // The rows are workspace-scoped because entity-catalog.csv and
    // relationship-catalog.csv scope them so and INV-001 needs a tenant-safe
    // key. Both readings are honoured because a rule version COPIES the quoted
    // text, its tag and its source into its own immutable content, so no
    // tenant's obligation depends on a shared row.
    const second = await createWorkspace("Приклад-Другий простір");
    const first = await storedRows(workspaceId);
    const other = await storedRows(second);
    expect(other).toHaveLength(12);

    // Distinct rows, identical content.
    const firstIds = new Set(first.map((r) => r.libraryItemId));
    expect(other.every((r) => !firstIds.has(r.libraryItemId))).toBe(true);
    expect(other.map((r) => r.itemTextUk)).toEqual(first.map((r) => r.itemTextUk));
  });

  it("does not leak one workspace's rows into another's list", async () => {
    const second = await createWorkspace("Приклад-Третій простір");
    const res = await listLibrary(second);
    const body = await res.json();
    const firstIds = new Set((await storedRows(workspaceId)).map((r) => r.libraryItemId));
    expect(body.items).toHaveLength(12);
    expect((body.items as StoredItem[]).every((i) => !firstIds.has(i.libraryItemId))).toBe(true);
  });
});
