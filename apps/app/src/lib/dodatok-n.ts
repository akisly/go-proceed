import type { Tx } from "@goproceed/database";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker: `pnpm`, `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked and no migration was applied.
 * No claim is made that it compiles, that any suite using it passes, or that
 * the INSERT below succeeds. Static reading is the only check that was
 * available, plus one byte comparison described under DRIFT below.
 *
 * ---------------------------------------------------------------------------
 * The shipped Додаток Н content as PRODUCTION data, and the materialisation of
 * it into a workspace at provisioning (plan task 3,
 * docs/superpowers/plans/2026-08-06-v0.1-implementation.md:1038-1044).
 *
 * WHY THIS EXISTS AT ALL. Until it landed, nothing in a real deployment put a
 * row in public.requirement_library_items. The chain that broke, end to end:
 * `requirement_library.list` answered `{items: []}` in every workspace;
 * `publishRequirementRuleVersionRequest` required a `requirementLibraryItemId`
 * that resolved in the workspace (ADR-010's project-sourced alternative did
 * not exist yet) and refused one that did not, so `requirement_rule_versions.
 * publish` returned 422 always; with no rule version there was nothing for
 * `contract_versions.bind_rules` to bind; and INV-083 then refused every
 * publication forever. Twelve missing rows made the whole of ADR-005 decision 2
 * unreachable outside the test fixtures.
 *
 * TODAY, `publishRequirementRuleVersionRequest`'s own `superRefine` requires
 * exactly one of `requirementLibraryItemId` or `projectSourcedRequirementItemId`
 * — never both, never neither.
 *
 * WHY A CONSTANT AND NOT A READ OF THE CSV. technical/requirements/ is a
 * repository path, not a deployment artifact: the running application has no
 * guarantee the file is on its filesystem, and a regulatory string that is
 * present in the repository and absent in the deployed bundle is exactly the
 * failure the content rules exist to prevent. The content therefore ships as
 * code. This is a THIRD copy of the wording — after the CSV itself and the two
 * test readers — and the paragraph on DRIFT below is what pays for it.
 *
 * WHY THE TEST READERS ARE NOT IMPORTED. packages/testing/src/dodatok-n.ts and
 * apps/app/tests/helpers/dodatok-n.ts both read the CSV at test time, and
 * apps/app/tests/requirement-library-fidelity.int.test.ts compares what THIS
 * module stored against what one of them read. Importing either here would make
 * that suite compare the CSV with itself and go green over an empty library —
 * the precise defect it was written to catch. Both readers say so in their own
 * headers; this is the other half of that arrangement.
 *
 * DRIFT, AND WHAT CATCHES IT. Three copies of a regulatory string is three
 * chances to drift, so the divergence has to be loud. Two things make it so:
 *
 *  * The twelve `itemTextUk` values, the two position titles and the source
 *    string below were GENERATED out of
 *    technical/requirements/dbn-a31-5-2016-dodatok-n.csv rather than typed, and
 *    the generated literals were then compared byte for byte against a fresh
 *    parse of that CSV. That comparison is a byte check of this file against
 *    the content file; it is not a test run and settles nothing about the
 *    INSERT, the route or the database.
 *  * requirement-library-fidelity.int.test.ts asserts, per row, that what
 *    `workspaces.create` STORED is byte-identical to the CSV — through
 *    `Buffer.equals`, not only `toBe`. A one-character edit to this file that
 *    is not made to the CSV fails there, and a change to the CSV that is not
 *    made here fails there too.
 *
 * Editing the wording below without editing the CSV is a content change under
 * docs/product/hidden-works-content-rules.md §"Change control" and is not a
 * code change, whatever it looks like in a diff.
 *
 * WHAT THE ROWS DELIBERATELY DO NOT CARRY:
 *
 *  * `act_form_assumption` is left NULL. Prohibition G: neither ДБН
 *    А.3.1-5:2016 nor ДСТУ 9258:2023 says which position takes which act form,
 *    so v0.1 asserts no mapping at all. The column exists so that a mapping,
 *    if one is ever made, can only be recorded as `product_assumption`; leaving
 *    it empty asserts less than filling it, and less is what is established.
 *  * `normative_character` and `act_form_basis` are omitted from the INSERT and
 *    take their CHECK-forced defaults ('dovidkovyi', 'product_assumption').
 *    Each column has exactly one storable value; writing it here would suggest
 *    this command is the thing deciding it, when the constraint is. Same
 *    reasoning contract_versions.bind_rules gives for
 *    `bound_rule_version_is_published`.
 */

/**
 * The standard every row belongs to.
 *
 * THE CSV HAS NO source_standard COLUMN and this is the third place that gap is
 * absorbed — packages/testing/src/dodatok-n.ts:63 and
 * apps/app/tests/helpers/dodatok-n.ts:59 are the other two, and both record the
 * same debt. public.requirement_library_items.source_standard is NOT NULL and
 * apps/app/src/lib/requirement-content.ts:48-50 composes the attribution from
 * it — «ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15», which
 * hidden-works-content-rules.md §"What the product MAY assert" item 1 gives
 * literally — so there is exactly one value these twelve rows may carry.
 *
 * THE CSV OWES THE COLUMN. Until it carries one, a correction to the standard's
 * designation has to reach three files, and the fidelity suite cannot catch a
 * wrong value here because it has nothing to compare it against: it asserts
 * this constant against the stored rows, which is the same assertion twice.
 * That is a real hole and it is stated rather than hidden.
 */
export const DODATOK_N_SOURCE_STANDARD = "ДБН А.3.1-5:2016";

export interface DodatokNItem {
  /**
   * Only Н.14 and Н.15 are allow-listed. «Н.1–Н.13» is not an allow-listed
   * range and there is no value here that could hold one; 0041's
   * `position_code` CHECK stores no other.
   */
  positionCode: "Н.14" | "Н.15";
  positionTitleUk: string;
  itemNo: number;
  itemTextUk: string;
  /**
   * INV-073. `UNVERIFIED` is absent from this union for the same reason it is
   * absent from the column's CHECK: an unverified string must never be shown as
   * normative, and the cheapest guarantee is that it cannot exist.
   *
   * STAYS TWO-VALUED EVEN AFTER MIGRATION 0059, AND THAT IS THE MIGRATION'S OWN
   * DECISION, NOT A GAP HERE. Migration 0059's own "WHAT THIS DOES NOT CHANGE"
   * says `public.requirement_library_items` "IS NOT TOUCHED: it keeps ... its
   * two-value verification CHECK, so nothing this migration adds can put a line
   * into Додаток Н." The seeded Додаток Н set is a different relation with its
   * own extent constraint, and nothing a workspace types can reach it
   * (hidden-works-content-rules.md §"Project-sourced strings"). `PROJECT_
   * DOCUMENTATION` names an origin a workspace supplies for its OWN occurrence;
   * every row this module writes is instead the shipped standard's own text, so
   * it could never carry that tag.
   */
  verification: "VERIFIED_PRIMARY" | "VERIFIED_SECONDARY";
  /** The whole provenance string, stored verbatim as `source_citation`. */
  sourceCitation: string;
}

/**
 * The two position titles and the one provenance string, bound once.
 *
 * SHARED BECAUSE THE CONTENT IS SHARED, not to save lines: the CSV carries the
 * identical 300-character provenance string on all twelve rows and one title
 * per position, and twelve transcriptions of the same string are twelve
 * chances for a one-character drift between rows of the same file. Nothing is
 * hidden by the sharing — requirement-library-fidelity.int.test.ts compares
 * each STORED row against its own CSV row, so the moment the CSV stops being
 * uniform this binding produces a wrong value and that suite fails on the row
 * that diverged.
 *
 * If the CSV ever carries a per-row source or a second title for one position,
 * these two bindings become per-row fields. That is a code change, and the
 * fidelity suite is what will demand it.
 */
const TITLE_N14 = "Внутрішні санітарно-технічні роботи";
const TITLE_N15 = "Монтаж електротехнічних установок";

/**
 * Provenance, verbatim from the CSV's `source` column.
 *
 * IT USED TO SAY «URL/дата/хеш не збережені», AND THAT STOPPED BEING TRUE ON
 * 2026-08-10. The clause was accurate for as long as it stood: the audit behind
 * these twelve rows downloaded the official ДБН file once, retained nothing, and
 * recorded neither URL nor date nor hash, so the VERIFIED_PRIMARY tag rested on
 * a fetch no reviewer could reopen. hidden-works-content-rules.md §"Open items"
 * said the same at length and this string pointed at it.
 *
 * Both halves of that gap are now closed, and by the SAME FILE these rows were
 * transcribed from — identified by content and not by name: 636 603 bytes, the
 * byte count the audit itself recorded, and
 * `sha256=4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3`.
 * The owner supplied the URL, the file was fetched from it, and the digest was
 * computed independently of anything already written down. The condition this
 * comment used to name — «a re-fetch that does not reproduce the same bytes must
 * downgrade every row it touches to VERIFIED_SECONDARY» — was tested and did not
 * fire. The tag is on firmer ground than when it was written, not weaker.
 *
 * WHY THE CORRECTION HAD TO REACH THIS STRING AND NOT ONLY THE DESIGN DOCUMENT.
 * It travels into `public.requirement_library_items.source_citation`, from there
 * into every rule version that quotes one of these items, and from there into
 * `requirement_occurrences.norm_ref_source`, which `renderStatutoryAct` prints
 * inside every decision block. Until the render started working the sentence was
 * only ever read in a CSV. It is now printed in a document a client's lawyer
 * reads, which is exactly the reach the old comment claimed for the caveat and
 * is why the correction cannot stop at the design document either.
 *
 * ROWS ALREADY WRITTEN KEEP THE OLD STRING, AND THAT IS THE SCHEMA'S DECISION
 * RATHER THAN A CHOICE MADE HERE. `requirement_library_items_immutable`
 * (0041:618) and `requirement_occurrences_immutable` (0043:986) reject every
 * update, so there is no backfill to perform and none to argue about. It is also
 * the right answer twice over: a citation records what was cited, and a frozen
 * act's `content_hash` was computed over the string its occurrence carried — a
 * backfill would have broken every act ever frozen, which is the failure
 * migration 0056 exists to prevent on the project's name.
 *
 * The independence caveat is not derived and is unchanged, because it is still
 * true: one fetch reproduced is not two independent sources agreeing.
 */
const SOURCE_SINGLE_FETCH = "ДБН А.3.1-5:2016 Додаток Н; офіційний файл e-construction.gov.ua, https://e-construction.gov.ua/laws_detail/3879707932224390963, завантажено 2026-08-10, sha256=4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3; незалежність будь-яких додаткових копій не встановлена";

/**
 * The twelve items of Додаток Н positions Н.14 and Н.15, verbatim.
 *
 * GENERATED OUT OF technical/requirements/dbn-a31-5-2016-dodatok-n.csv AND
 * COMPARED BACK AGAINST IT BYTE FOR BYTE. Not typed by hand: the strings carry
 * Ukrainian orthography, a straight apostrophe (U+0027) in «з'єднань», and
 * punctuation that a transcription can silently normalise.
 */
export const DODATOK_N_ITEMS: readonly DodatokNItem[] = [
  {
    positionCode: "Н.14",
    positionTitleUk: TITLE_N14,
    itemNo: 1,
    itemTextUk: "Підготовка ніш, каналів та борозен для прокладання в них трубопроводів та встановлення санітарно-технічних приладів.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.14",
    positionTitleUk: TITLE_N14,
    itemNo: 2,
    itemTextUk: "Забезпечення правильності уклонів, гнуття труб, встановлення санітарно-технічних приладів.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.14",
    positionTitleUk: TITLE_N14,
    itemNo: 3,
    itemTextUk: "Виконання зварних з'єднань.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.14",
    positionTitleUk: TITLE_N14,
    itemNo: 4,
    itemTextUk: "Монтаж арматури, запобіжних пристроїв, автоматики та контрольно-вимірювальних приладів.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.14",
    positionTitleUk: TITLE_N14,
    itemNo: 5,
    itemTextUk: "Прийняття санітарно-технічних приладів і систем.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 1,
    itemTextUk: "Улаштування траншей і основ під монтаж кабелів.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 2,
    itemTextUk: "Улаштування прокладки кабелю у траншеї.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 3,
    itemTextUk: "Улаштування кабельних муфт.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 4,
    itemTextUk: "Улаштування захисного покриття кабелів.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 5,
    itemTextUk: "Перевірка дротів освітлювальних мереж, прокладених по стінах та в борозні під штукатурку.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 6,
    itemTextUk: "Улаштування заземлення та занулення.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
  {
    positionCode: "Н.15",
    positionTitleUk: TITLE_N15,
    itemNo: 7,
    itemTextUk: "Прийняття готової конструкції електротехнічних установок.",
    verification: "VERIFIED_PRIMARY",
    sourceCitation: SOURCE_SINGLE_FETCH,
  },
];

/**
 * INV-073 in this module, not only in the column.
 *
 * The architectural requirement of hidden-works-content-rules.md §"Required
 * disclaimers" is that a normative string carries its verification tag and its
 * source IN THE DATA, and that a string with no source is unrenderable. The
 * table enforces that with NOT NULL plus non-blank CHECKs, and this runs one
 * layer earlier: a row that lost its tag or its source through an edit to this
 * file never reaches the INSERT, because the module refuses to load.
 *
 * FAILING AT IMPORT IS THE POINT. A blank source discovered at request time
 * would refuse one workspace creation; discovered here it refuses to start the
 * route at all, and «the product will not serve» is the correct response to
 * regulatory content that has lost its provenance. This can only fire on an
 * edit to the literals above — it is a repository-change guard, and it has
 * nothing to say about a row already in a database.
 *
 * The extent check is Prohibition A restated: Н.14 has exactly five items and
 * Н.15 exactly seven. It is also structural (0041's
 * `requirement_library_items_dodatok_n_extent_check`), so an eighth Н.15 item is
 * unstorable as well as unbuildable; both layers exist because the CHECK cannot
 * see a MISSING item and this can.
 */
function assertShippedContentIsRenderable(items: readonly DodatokNItem[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    const at = `${item.positionCode}/${item.itemNo}`;
    if (item.verification.trim() === "" || item.sourceCitation.trim() === "") {
      throw new Error(
        `Додаток Н ${at} carries no verification tag or no source and is therefore `
        + "unrenderable (INV-073, hidden-works-content-rules.md §Architectural requirement)");
    }
    if (item.itemTextUk.trim() === "" || item.positionTitleUk.trim() === "") {
      throw new Error(`Додаток Н ${at} carries no text`);
    }
    if (seen.has(at)) throw new Error(`Додаток Н ${at} is listed twice`);
    seen.add(at);
  }
  const n14 = items.filter((i) => i.positionCode === "Н.14").map((i) => i.itemNo);
  const n15 = items.filter((i) => i.positionCode === "Н.15").map((i) => i.itemNo);
  const expected = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join(",");
  if (n14.join(",") !== expected(5) || n15.join(",") !== expected(7)) {
    throw new Error(
      `Додаток Н ships Н.14 items 1..5 and Н.15 items 1..7; this build carries `
      + `Н.14 [${n14.join(",")}] and Н.15 [${n15.join(",")}]`);
  }
}
assertShippedContentIsRenderable(DODATOK_N_ITEMS);

/**
 * Materialise the twelve rows into one workspace, inside the caller's
 * transaction.
 *
 * WHERE IT IS CALLED FROM, AND WHY THERE. `workspaces.create`, AFTER the owner
 * membership insert and inside the same transaction. The order is not
 * cosmetic: `rli_insert` (0041:758-759) admits the write only when
 * `app.member_role(workspace_id)` is 'owner' or 'admin', and that function
 * reads public.memberships — so before the membership row exists, RLS refuses
 * every one of these twelve rows. 0041:752-757 states the same ordering as the
 * assumption its INSERT policy is written against; this is the code that makes
 * the statement true, which it was not when the policy shipped.
 *
 * WHY PROVISIONING AND NOT FIRST READ. Both were live options (0041:182-189
 * records the decision as open, and says its policy assumes this one). Seeding
 * here means the library is a fact about a workspace from the moment it exists:
 * `requirement_library.list` is a query with no write plane, seed-on-first-read
 * would make a GET write, and it would need `rli_insert` widened to every
 * active member — a policy replacement in exchange for nothing. 0041:186-189
 * says that paragraph is where to look if the other option is ever chosen.
 *
 * WHY IT IS NOT A MIGRATION. The rows are workspace-scoped
 * (entity-catalog.csv:33, relationship-catalog.csv:59) and there is no
 * workspace at migration time.
 *
 * WHY IT IS NOT A RUNTIME COMMAND EITHER. Library content is a repository
 * change under hidden-works-content-rules.md §"Change control": no row of
 * technical/openapi/scope-v0.1.csv writes this table, there is no
 * `requirement_library.create` operation, and this function is deliberately not
 * one — it takes no content argument and has nothing a caller could vary.
 *
 * NO `on conflict`. The unique key is (workspace_id, source_standard,
 * position_code, item_no) and the workspace was created two statements ago, so
 * a conflict here would mean a workspace id collided. Swallowing that would
 * hide it; the 23505 is the correct outcome and it rolls the whole provisioning
 * back.
 *
 * Returns the number of rows written, which the caller records in its audit
 * details — so «this workspace was provisioned with the library» is a fact in
 * the trail and not an assumption a reader has to make.
 */
export async function seedRequirementLibrary(tx: Tx, workspaceId: string): Promise<number> {
  const COLS = 8;
  const values: unknown[] = [];
  const tuples: string[] = [];
  // In the standard's own order: Н.14 1..5, then Н.15 1..7. The list route
  // orders by (position_code, item_no) anyway, so nothing depends on insertion
  // order — it is written this way because a row set that reads in the
  // standard's sequence in every place it appears is one fewer thing to check.
  DODATOK_N_ITEMS.forEach((item, i) => {
    const b = i * COLS;
    tuples.push(`(${Array.from({ length: COLS }, (_, c) => `$${b + c + 1}`).join(",")})`);
    values.push(workspaceId, DODATOK_N_SOURCE_STANDARD, item.positionCode,
      item.positionTitleUk, item.itemNo, item.itemTextUk,
      item.verification, item.sourceCitation);
  });
  await tx.query(
    `insert into public.requirement_library_items
       (workspace_id, source_standard, position_code, position_title_uk,
        item_no, item_text_uk, verification, source_citation)
     values ${tuples.join(",")}`, values);
  return DODATOK_N_ITEMS.length;
}
