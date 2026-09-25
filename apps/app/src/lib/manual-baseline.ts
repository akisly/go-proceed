import { createHash, randomUUID } from "node:crypto";
import { HttpProblem, problem } from "./http";
import type { Tx } from "@goproceed/database";
import type { FieldError, WorkItemView } from "@goproceed/contracts";
import {
  canonicalPriceBasis, decimalText, fitsNumeric18_6, mulToMinorUnits,
  normalizeUnitCode, parseLocalizedDecimal, rescale, splitByBasis, withinTolerance,
  MAX_MINOR_UNITS,
  type Decimal, type Midpoint, type PriceBasis, type TaxMode,
} from "@goproceed/domain";

/**
 * The hand-typed baseline: the arithmetic, the unit resolution and the content
 * address shared by contract_versions.create/.publish and the three
 * work_items operations.
 *
 * ADR-006 decision 2 makes manual work-line entry a FIRST-CLASS v0.1 capability.
 * Everything below therefore derives a typed line exactly the way
 * packages/domain/src/import/validate.ts derives an imported one — same
 * canonical basis, same rounding midpoint, same tolerance rule, same
 * unit-precision pinning — so that the two are indistinguishable in the
 * published version. Where this file departs from validateRow it is because a
 * typed line has no import row result, and that is stated at the departure.
 */

/** The money basis a contract version pinned when it was created. */
export interface VersionPins {
  currency: string;
  taxMode: TaxMode;
  taxRateBps: number | null;
  midpoint: Midpoint;
  minorScale: number;
  tolAbsMinor: bigint;
  tolBps: number;
  priceBasis: PriceBasis | null;
}

export interface ContractVersionRow {
  currency: string;
  tax_mode: string;
  tax_rate_bps: number | null;
  rounding_policy: { midpoint?: string } | null;
  source_tolerance_minor_units: string | number;
  source_tolerance_bps: string | number;
}

/**
 * Pins are read off the VERSION, never off the contract. The version copied
 * them when it was created and a published version is reproducible only if the
 * numbers under it cannot move when the contract is edited afterwards. Same
 * reason import_batches.publish:180-183 writes what validate decided rather
 * than recomputing.
 */
export function pinsFrom(v: ContractVersionRow): VersionPins {
  const taxMode = v.tax_mode as TaxMode;
  return {
    currency: v.currency,
    taxMode,
    taxRateBps: v.tax_rate_bps === null ? null : Number(v.tax_rate_bps),
    midpoint: v.rounding_policy?.midpoint === "half_even" ? "half_even" : "half_up",
    minorScale: 2,
    tolAbsMinor: BigInt(v.source_tolerance_minor_units),
    tolBps: Number(v.source_tolerance_bps),
    priceBasis: canonicalPriceBasis(taxMode),
  };
}

export function validationFailed(requestId: string, detail: string, fieldErrors: FieldError[]): HttpProblem {
  return new HttpProblem(422, problem("VALIDATION_FAILED", detail, {
    requestId, retryable: false, userAction: "correct_fields", fieldErrors,
  }));
}

/**
 * REFUSE A WORK TYPE THAT NAMES NOTHING — the write-path half of migration
 * 0050, written once so `work_items.create` and `work_items.update` cannot
 * drift in what they accept.
 *
 * WHAT IS CHECKED, AND WHY IT IS THE STRONGEST CHECK AVAILABLE AT THIS MOMENT.
 * The real predicate is «this line's work type matches a rule version bound to
 * this baseline», and it is not computable here: a line is typed onto a DRAFT,
 * `contract_versions.bind_rules` may run afterwards, and nothing orders the
 * two, so at this moment the bound set is legitimately empty. What CAN be
 * asserted is that the key names a real work type in this workspace —
 * `app.work_type_key_is_bindable` (migration 0050 §4): a published rule version
 * anywhere in the workspace, OR a rule version this draft has already bound
 * (which survives the version's retirement, INV-067).
 *
 * The narrow question is asked later, by `contract_versions.publish`, where
 * both sets exist. Neither check subsumes the other and both are needed: this
 * one catches the typo at the keystroke, that one catches the unbound rule
 * before the baseline becomes immutable.
 *
 * WHY THE ROUTE ASKS AT ALL, when the trigger already refuses. Same division as
 * `contract_versions.bind_rules` and `app.guard_rule_binding_window()`: the
 * trigger makes the rule structural so no write path can forget it; this
 * function gives the caller a catalogued field error instead of a raise that
 * reaches the wire as a 500. A typo is an ordinary user mistake and must come
 * back as one.
 */
export async function requireBindableWorkType(
  tx: Tx, requestId: string,
  q: { workspaceId: string; contractVersionId: string; workTypeKey: string | null },
): Promise<void> {
  if (q.workTypeKey === null) return;
  const r = await tx.query(
    `select app.work_type_key_is_bindable($1, $2, $3) as ok`,
    [q.workspaceId, q.contractVersionId, q.workTypeKey]);
  if (r.rows[0]?.ok === true) return;
  throw validationFailed(requestId,
    "Такий вид робіт не відповідає жодній опублікованій версії правила в цьому "
    + "робочому просторі. Оберіть вид робіт зі списку опублікованих правил або "
    + "залиште поле порожнім.",
    // The value is NOT echoed: VALIDATION_FAILED's log policy is
    // `field_codes_no_values` (technical/error-catalog.csv:15), and the path
    // plus the message is what the caller needs to correct it.
    [{ path: "workTypeKey", message: "work type names no rule version this workspace can bind" }]);
}

/** Wire decimal → Decimal. The request schema has already fixed the syntax. */
function toDecimal(text: string): Decimal {
  const parsed = parseLocalizedDecimal(text, "en-US");
  if (!parsed.ok) {
    // Unreachable through a route: `decimal` in @goproceed/contracts is
    // /^\d+(\.\d{1,6})?$/ and en-US parses exactly that. Never silently coerce.
    throw new Error(`manual baseline: unparsable decimal ${JSON.stringify(text)}`);
  }
  return parsed.value;
}

export interface LineInput {
  description: string;
  unitCode: string;
  contractQuantity: string;
  unitPriceState: "known" | "zero" | "missing";
  unitPrice: string | null;
  sourceAmountMinor: string | null;
  sourceKey: string | null;
  workCode: string | null;
  section: string | null;
  externalRef: string | null;
  predecessorWorkItemId: string | null;
}

export interface ResolvedUnit { id: string; code: string; precision: number }

export interface DerivedLine {
  /** Quantity RESCALED to the unit's precision — see deriveLine. */
  contractQuantityText: string;
  unitPriceText: string | null;
  priceBasis: PriceBasis | null;
  netMinor: bigint;
  taxMinor: bigint;
  grossMinor: bigint;
}

/**
 * The money a typed line is worth, under the version's pins.
 *
 * THREE DEPARTURES FROM validateRow, each because a typed line has no import
 * row result and therefore nowhere to record a resolution:
 *
 *  * QUANTITY_ROUNDED is not a warning here, because a typed line has no
 *    preview surface to carry one. The quantity is still pinned to the unit's
 *    precision exactly as validate.ts:98-103 pins it, and the pinned value is
 *    returned in the command's own response — so the ПТВ sees the number that
 *    was stored rather than the number that was typed, which is the same
 *    disclosure the importer's preview makes.
 *  * AMOUNT_MISMATCH (INV-054) is a REFUSAL, not a resolvable blocking row.
 *    public.source_amount_resolutions is keyed on an import row result
 *    (0012:203-210); a typed line has nowhere to put the reason an approval
 *    would need, so accepting one would record an approval nobody made. The
 *    caller's remedy is to correct the line or to clear its source amount.
 *  * PRICE_MISSING_AMOUNT_PRESENT is a REFUSAL for the same reason.
 *
 * The refusals are raised HERE, at create and at correction, rather than at
 * publication. INV-054 says the discrepancy blocks publication; on the import
 * path it does so by keeping the batch out of `preview_ready`, which is a
 * per-row check that runs long before publish. Refusing the line is the same
 * gate at the same phase — and it means publication has no unreachable
 * re-derivation to perform, because a line that could fail it cannot enter the
 * draft.
 */
export function deriveLine(
  requestId: string, input: LineInput, unit: ResolvedUnit, pins: VersionPins,
): DerivedLine {
  const quantity = toDecimal(input.contractQuantity);
  const pinnedScaled = rescale(quantity, unit.precision, pins.midpoint);
  const pinnedQuantity: Decimal = { scaled: pinnedScaled, scale: unit.precision };
  if (!fitsNumeric18_6(pinnedQuantity)) {
    throw validationFailed(requestId, "Кількість не вміщується в numeric(18,6).",
      [{ path: "contractQuantity", message: "beyond numeric(18,6)" }]);
  }

  let unitPrice: Decimal | null = null;
  if (input.unitPriceState === "known") {
    if (input.unitPrice === null) {
      throw new Error("manual baseline: state 'known' with no price reached the command");
    }
    unitPrice = toDecimal(input.unitPrice);
    if (!fitsNumeric18_6(unitPrice)) {
      throw validationFailed(requestId, "Ціна не вміщується в numeric(18,6).",
        [{ path: "unitPrice", message: "beyond numeric(18,6)" }]);
    }
  }

  // qty × price is already stated in the contract's canonical basis: an
  // inclusive-tax contract carries gross unit prices, an exclusive one net.
  let derivedMinor: bigint | null = null;
  if (unitPrice !== null) {
    derivedMinor = mulToMinorUnits(pinnedQuantity, unitPrice, pins.minorScale, pins.midpoint);
  } else if (input.unitPriceState === "zero") {
    derivedMinor = 0n;
  }

  const sourceMinor = input.sourceAmountMinor === null ? null : BigInt(input.sourceAmountMinor);

  if (sourceMinor !== null && derivedMinor === null) {
    throw validationFailed(requestId,
      "Рядок має суму з кошторису, але не має ціни за одиницю — похідну суму нема з чим звірити. "
      + "Вкажіть ціну або приберіть суму.",
      [{ path: "sourceAmountMinor", message: "no derived amount to compare against" }]);
  }
  if (sourceMinor !== null && derivedMinor !== null
      && !withinTolerance(sourceMinor, derivedMinor, pins.tolAbsMinor, pins.tolBps)) {
    throw validationFailed(requestId,
      "Сума з кошторису розходиться з похідною сумою понад допуск договору (INV-054). "
      + "Виправте кількість, ціну або суму.",
      [{ path: "sourceAmountMinor", message: "outside the contract's pinned tolerance" }]);
  }

  // A line with no derived amount is UNVALUED, not free: the money columns are
  // NOT NULL so they carry zero, and unit_price_state is what keeps it out of
  // the numeric value-at-risk sum (INV-038). Same shape import_batches.publish
  // writes with `mp.net ?? "0"`.
  let netMinor = 0n, taxMinor = 0n, grossMinor = 0n;
  if (derivedMinor !== null) {
    const split = splitByBasis(
      derivedMinor, pins.priceBasis, pins.taxRateBps, pins.taxMode, pins.midpoint);
    netMinor = split.net; taxMinor = split.tax; grossMinor = split.gross;
    const abs = (v: bigint) => (v < 0n ? -v : v);
    if ([netMinor, taxMinor, grossMinor].some((v) => abs(v) > MAX_MINOR_UNITS)) {
      throw validationFailed(requestId, "Сума рядка виходить за межі, які може зберігати система.",
        [{ path: "contractQuantity", message: "derived amount out of range" }]);
    }
  }

  return {
    contractQuantityText: decimalText(String(pinnedQuantity.scaled), pinnedQuantity.scale),
    unitPriceText: unitPrice === null ? null : decimalText(String(unitPrice.scaled), unitPrice.scale),
    // Tied to the price STATE, as import_batches.publish ties it: an imported
    // zero price still carries its parsed 0, so it states the basis, and only
    // a missing price states none. Keying on the Decimal here left a typed
    // zero line with no basis beside an imported one with it (DEV-088, BL-022).
    priceBasis: input.unitPriceState === "missing" ? null : pins.priceBasis,
    netMinor, taxMinor, grossMinor,
  };
}

/**
 * The unit as written, resolved to a unit_definitions row by normalized code,
 * find-or-create — the same resolution the importer runs at
 * apps/app/app/v1/import-batches/[batchId]/validate/route.ts:215-232.
 *
 * REGISTRATION IS PERMITTED UNDER contracts.edit, and that is a decision the
 * schema comment in @goproceed/contracts work-items.ts:107-115 left open. The
 * importer registers an unseen unit only for an actor holding the WORKSPACE
 * capability units.manage; manual entry is governed by the PROJECT capability
 * contracts.edit. It is settled in favour of registering, because
 * technical/permissions/capabilities.csv:7 says units.manage governs NO
 * operation in either scope CSV and that «v0.1 needs only the units a manually
 * entered work line carries». Nothing seeds public.unit_definitions and no
 * v0.1 route creates one, so refusing here would make a pilot unable to type
 * «м. п.» for the first time with no route anywhere to fix it. The registered
 * row takes unit_precision's column default of 3 (0012:15); a workspace that
 * needs another precision has no v0.1 route to set one, which is the v0.2
 * unit-management work ADR-006 decision 5 defers.
 */
export async function resolveUnit(
  tx: Tx, workspaceId: string, userId: string, unitCode: string,
): Promise<ResolvedUnit> {
  const normalized = normalizeUnitCode(unitCode);
  const found = await tx.query(
    `select id, code, unit_precision from public.unit_definitions
      where workspace_id = $1 and normalized_code = $2`,
    [workspaceId, normalized]);
  if (found.rows.length > 0) {
    return { id: found.rows[0].id, code: found.rows[0].code, precision: found.rows[0].unit_precision };
  }
  const created = await tx.query(
    `insert into public.unit_definitions (id, workspace_id, code, created_by)
     values ($1,$2,$3,$4)
     on conflict (workspace_id, normalized_code) do nothing
     returning id, code, unit_precision`,
    [randomUUID(), workspaceId, unitCode.trim(), userId]);
  // DO NOTHING returns no row when a concurrent command registered the same
  // code first; re-read rather than failing the whole line.
  const row = created.rows[0] ?? (await tx.query(
    `select id, code, unit_precision from public.unit_definitions
      where workspace_id = $1 and normalized_code = $2`,
    [workspaceId, normalized])).rows[0];
  if (!row) throw new Error(`manual baseline: unit ${normalized} neither found nor created`);
  return { id: row.id, code: row.code, precision: row.unit_precision };
}

export interface WorkItemRow {
  id: string; position: number;
  source_key: string | null; work_code: string | null;
  description: string; section: string | null;
  work_type_key: string | null;
  unit_code: string; unit_precision: number;
  contract_quantity: string | number;
  unit_price_state: string;
  unit_price_decimal: string | number | null;
  valuation_basis: string;
  net_amount_minor_units: string | number;
  tax_amount_minor_units: string | number;
  gross_amount_minor_units: string | number;
  source_amount_minor_units: string | number | null;
  predecessor_work_item_id: string | null;
}

/**
 * One row → the one view. Shared by contract_versions.get and the three
 * work_items commands so that a line reads identically however it is fetched —
 * the M1 exit gate is that a hand-typed line is indistinguishable from an
 * imported one, and two mappers are two chances for it not to be.
 */
export function workItemView(w: WorkItemRow): WorkItemView {
  return {
    workItemId: w.id,
    position: w.position,
    sourceKey: w.source_key,
    workCode: w.work_code,
    description: w.description,
    workTypeKey: w.work_type_key ?? null,
    section: w.section,
    unitCode: w.unit_code,
    unitPrecision: w.unit_precision,
    contractQuantity: String(w.contract_quantity),
    unitPriceState: w.unit_price_state as WorkItemView["unitPriceState"],
    unitPriceDecimal: w.unit_price_decimal === null ? null : String(w.unit_price_decimal),
    valuationBasis: w.valuation_basis as WorkItemView["valuationBasis"],
    netMinor: String(w.net_amount_minor_units),
    taxMinor: String(w.tax_amount_minor_units),
    grossMinor: String(w.gross_amount_minor_units),
    sourceAmountMinor: w.source_amount_minor_units === null
      ? null : String(w.source_amount_minor_units),
    predecessorWorkItemId: w.predecessor_work_item_id,
  };
}

/**
 * `/2` from the slice that added `workTypeKey` to the hashed tuple (migration
 * 0050). `/1` hashed fourteen elements per line and did not name the work type.
 */
export const LINE_MANIFEST_SCHEME = "goproceed-manual-baseline/2";

/**
 * The content address of a line set — what `contract_versions.publish` asks the
 * caller to confirm, and what it stores in `source_manifest_hash`.
 *
 * THREE PROPERTIES IT IS BUILT FOR, each of which is a decision:
 *
 *  * It is computable BY THE CALLER from what the API returned. Every field is
 *    one `contract_versions.get` shows, in the order it shows them, so the
 *    caller confirms exactly the line set it was shown rather than a digest it
 *    has to take on trust.
 *  * `position` and `workItemId` are NOT in it. Position is carried by the
 *    array's order, and publication renumbers a draft whose lines have gaps —
 *    a digest containing positions would be invalidated by the renumbering it
 *    is meant to survive. Excluding the id means removing a line and retyping
 *    it identically is not a content change, which is the honest reading of
 *    "the same line set".
 *  * The pins are in it, so the digest names the money basis and not only the
 *    numbers.
 *
 * WHAT IT DOES NOT COVER, named rather than left to be discovered:
 * `work_items.external_ref` is stored and is not in `WorkItemView`, so it is
 * not on any surface the caller can recompute from and it is not in this
 * digest. A concurrent correction that changed ONLY an external reference
 * would not be caught by this guard. Closing that means returning the field,
 * which is a contract change and belongs in the slice that needs it.
 *
 * `workTypeKey` IS COVERED, and it is covered for exactly the reason
 * `external_ref` is not: it is in `WorkItemView`, so a caller can recompute the
 * digest of what it was shown, and it decides which obligations the line
 * carries. A second typist classifying a line between review and publication
 * would otherwise change the whole gate under the reviewer with the
 * concurrency guard silent.
 *
 * ADDING IT CHANGES EVERY DIGEST THIS FUNCTION PRODUCES, so the scheme string
 * moves to `/2`. That is what the scheme string is for: a stored
 * `source_manifest_hash` computed under `/1` no longer equals the recomputation
 * of the same lines, and a version string in the preimage makes that a visible
 * mismatch rather than an unexplained one. Whether any such hash exists
 * anywhere is not a claim this file can make — this checkout has no database —
 * which is exactly why the version moves rather than being argued about.
 */
export function lineManifestHash(pins: VersionPins, items: WorkItemView[]): string {
  const canonical = JSON.stringify({
    scheme: LINE_MANIFEST_SCHEME,
    pins: {
      currency: pins.currency,
      taxMode: pins.taxMode,
      taxRateBps: pins.taxRateBps,
      midpoint: pins.midpoint,
    },
    // Tuples, not objects: an array cannot acquire a key order that drifts.
    lines: items.map((w) => [
      w.sourceKey, w.workCode, w.description, w.workTypeKey, w.section,
      w.unitCode, w.unitPrecision, w.contractQuantity,
      w.unitPriceState, w.unitPriceDecimal, w.valuationBasis,
      w.netMinor, w.taxMinor, w.grossMinor,
      w.sourceAmountMinor, w.predecessorWorkItemId,
    ]),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface DraftLocation {
  workspaceId: string; projectId: string; contractId: string;
  contractVersionId: string; status: string;
}

/**
 * Resolve a work item to its version WITHOUT revealing whether an id that is
 * invisible under RLS exists: the row is read inside the tenant transaction, so
 * a foreign id is indistinguishable from an absent one, exactly as
 * apps/app/app/v1/parties/[partyId]/route.ts:17-23 handles it.
 */
export async function locateWorkItem(
  tx: Tx, workItemId: string,
): Promise<(DraftLocation & { workItemId: string }) | null> {
  const r = await tx.query(
    `select w.id, w.workspace_id, w.project_id, w.contract_id, w.contract_version_id,
            v.status
       from public.work_items w
       join public.contract_versions v
         on v.workspace_id = w.workspace_id and v.id = w.contract_version_id
      where w.id = $1`, [workItemId]);
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    workItemId: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    contractId: row.contract_id,
    contractVersionId: row.contract_version_id,
    status: row.status,
  };
}

export function requireDraft(requestId: string, status: string): void {
  if (status === "draft") return;
  // INV-015. 409 rather than 403: the caller is permitted to edit drafts of
  // this contract and this particular version is simply past the point where
  // editing means anything. VERSION_CONFLICT is the catalog's contract-version
  // state code (technical/error-catalog.csv:12), its status is 409, its
  // retryable flag is true and its user action — refresh, compare, retry — is
  // the right instruction: the correction belongs in a successor version. The
  // catalog's log policy for this code is `versions_only`, so no identifier is
  // echoed into the detail.
  throw new HttpProblem(409, problem("VERSION_CONFLICT",
    "Версію договору вже опубліковано — її позиції незмінні. Виправлення публікують наступною версією.",
    { requestId, retryable: true, userAction: "refresh_compare_retry" }));
}

export const notFoundWorkItem = (requestId: string): HttpProblem =>
  new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Позицію робіт не знайдено.",
    { requestId, retryable: false, userAction: "return_to_list" }));

/**
 * Classifies a row-locking read of a contract version that came back EMPTY, and
 * always throws.
 *
 * WHY AN EMPTY LOCK IS NOT AN ABSENT ROW. `cv_update`
 * (0042:395-398) is `using (status = 'draft' and ...)`, and PostgreSQL applies
 * an UPDATE policy's USING expression to every row-LOCKING read as well as to
 * UPDATE itself — CREATE POLICY, «Policies Applied by Command Type»: SELECT FOR
 * UPDATE/SHARE requires the UPDATE USING too. So the instant a version becomes
 * `published` it disappears from `select ... for update` for goproceed_app, while
 * remaining perfectly visible to a plain SELECT under `cv_select`.
 *
 * Every route that re-read the version with `for update` to check its state was
 * therefore blind to the one state it was checking for. `requireDraft`'s
 * catalogued 409 VERSION_CONFLICT — «Версію договору вже опубліковано» — was
 * unreachable dead code on those paths: work_items.create answered 404, and
 * work_items.update/.remove read `rows[0].status` off an empty result and
 * answered 500. A caller who had just published a version and edited it once
 * more was told the version did not exist, or that the server had broken.
 *
 * A PLAIN RE-READ IS SAFE HERE, and does not reintroduce a race.
 * `app.guard_contract_version()` (0042:257-265) admits only draft -> published,
 * so the status is monotonic: a row that has left `draft` never returns to it,
 * and a second read can only confirm the transition that hid it. Nothing is
 * mutated on the strength of this read — it decides which REFUSAL to send.
 *
 * The RLS is not touched. CLAUDE.md is explicit that QA must not modify auth,
 * RLS, grants or migrations, and `cv_update` is right on its own terms: a
 * published version must not be lockable for update. What was wrong is routes
 * treating «could not lock» as «does not exist».
 */
export async function refuseUnlockableVersion(
  tx: Tx, requestId: string, workspaceId: string, versionId: string,
): Promise<never> {
  const seen = await tx.query(
    `select status from public.contract_versions
      where workspace_id = $1 and id = $2`, [workspaceId, versionId]);
  // requireDraft returns for a draft and throws 409 for anything else. Falling
  // through means the row is visible AND still a draft, so the lock was lost to
  // something other than status; 404 stays the conservative answer.
  if (seen.rows.length > 0) requireDraft(requestId, seen.rows[0].status as string);
  throw notFoundVersion(requestId);
}

export const notFoundVersion = (requestId: string): HttpProblem =>
  new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію договору не знайдено.",
    { requestId, retryable: false, userAction: "return_to_list" }));
