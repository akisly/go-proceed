import type { BlockedValueResponse } from "@goproceed/contracts";
import { Panel, PanelHeader, PanelBody, Table, Th, Td, Tr } from "@goproceed/ui/components";
import { unvaluedReasonLabel } from "../../lib/unvalued-reason-labels";
import { formatQuantity } from "../../lib/quantity";

/**
 * Task item 2: "The unvalued register, its own block, so the headline is not
 * read as complete." A SEPARATE panel from the currency totals above it, on
 * purpose — INV-038's whole point is that a line here contributes NOTHING to
 * any total on this screen ("There is deliberately NO money field on this
 * row. A `netMinorUnits: "0"` here is how 'we do not know' becomes 'it is
 * free'.", `packages/contracts/src/blocked-value.ts`'s own header on
 * `unvaluedRegisterRow`), so folding it into the totals panel would visually
 * imply it is part of the same arithmetic it is explicitly excluded from.
 *
 * QUANTITY, NEVER MONEY — the row schema itself has no money field, and this
 * component renders exactly what it is given: `quantity` + `unitCode`, never
 * a computed price.
 *
 * `quantity` GOES THROUGH `formatQuantity` — FIX ROUND 1, IMPORTANT 2. It
 * is `fromScaled6` output (`apps/app/src/lib/blocked-value.ts:643`): a fixed
 * six-fraction-digit, dot-separated string built to round-trip
 * `numeric(20,6)` exactly, not to be read — this row shipped `"10.000000"`
 * before this fix, beside `formatMoney`'s Ukrainian-comma figures elsewhere
 * on the same screen. `unitCode` was already correct (this row, unlike
 * `blockedReason.unvaluedQuantity`, carries one) and is unchanged.
 */
export function UnvaluedRegister({
  register,
}: { register: BlockedValueResponse["unvaluedRegister"] }) {
  if (register.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="Без оцінки" count={register.length} />
      <PanelBody className="p-0">
        <div className="overflow-x-auto">
          {/* `min-w-160`, MATCHING `assignments-list.tsx`'s OWN MEASURED
           * FLOOR, NOT A FRESH GUESS. That file's header records the exact
           * failure a narrower table already shipped once on this screen's
           * neighbour: an uppercase, unbreakable Ukrainian column heading
           * overflowing its `w-1/5` cell at 390/360. This table's headings
           * are shorter («ДОРУЧЕНЬ», 8 characters, is the longest), so
           * reusing the already-measured-safe width should carry over —
           * but named honestly rather than overclaimed: `qa/field.mjs`'s
           * seeded world has no unvalued assignment, so this table renders
           * NOTHING there and no audit has actually measured `scrollWidth`
           * against `clientWidth` on THESE three headings the way the
           * register audit did on its own four. Recorded in that file's own
           * `NOT_COVERED` rather than left to look verified by this
           * comment's confidence alone. */}
          <Table className="min-w-160">
            <thead>
              <Tr>
                <Th className="w-2/5">Причина</Th>
                <Th numeric className="w-1/5">Доручень</Th>
                <Th numeric className="w-2/5">Кількість</Th>
              </Tr>
            </thead>
            <tbody>
              {register.map((row, i) => (
                // No stable id on this row (it is an aggregate, not an
                // entity) — `reason` + `unitCode` is unique within one
                // response by construction (the route groups by exactly
                // those two keys), and `i` is appended only to satisfy React
                // when that pair somehow repeats.
                <Tr key={`${row.reason}-${row.unitCode}-${i}`}>
                  <Td>{unvaluedReasonLabel(row.reason)}</Td>
                  <Td numeric>{row.assignmentCount}</Td>
                  <Td numeric>{formatQuantity(row.quantity)} {row.unitCode}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </PanelBody>
    </Panel>
  );
}
