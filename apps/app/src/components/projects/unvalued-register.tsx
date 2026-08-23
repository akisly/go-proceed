import type { BlockedValueResponse } from "@goproceed/contracts";
import { Panel, PanelHeader, PanelBody, DataTable } from "@goproceed/ui/components";
import { unvaluedRegisterColumns } from "./unvalued-register-columns";

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
 * ON TANSTACK TABLE SINCE 2026-08-23; the three columns, and the two rulings
 * they carry (quantity-never-money, `formatQuantity` over raw six-decimal
 * output), moved to `unvalued-register-columns.tsx` with them. This file keeps
 * what is screen-shaped: the panel, its heading and its count, and the
 * early return.
 *
 * THE EARLY RETURN STAYS, and is not the same thing as `DataTable`'s `empty`.
 * An unvalued register with no rows is GOOD NEWS on this screen — every
 * blocked line has a price — so it renders nothing at all rather than an empty
 * panel announcing a category the reader then has to dismiss. `DataTable`'s
 * `empty` is for a table that is on screen and has no rows; that is a
 * different sentence and this screen never shows it.
 *
 * `min-w-160`, MATCHING `assignments-list.tsx`'s OWN MEASURED FLOOR, NOT A
 * FRESH GUESS. That file's header records the exact failure a narrower table
 * already shipped once on this screen's neighbour: an uppercase, unbreakable
 * Ukrainian column heading overflowing its `w-1/5` cell at 390/360. This
 * table's headings are shorter («ДОРУЧЕНЬ», 8 characters, is the longest), so
 * reusing the already-measured-safe width should carry over — but named
 * honestly rather than overclaimed: `qa/field.mjs`'s seeded world has no
 * unvalued assignment, so this table renders NOTHING there and no audit has
 * actually measured `scrollWidth` against `clientWidth` on THESE three
 * headings the way the register audit did on its own four. That gap is
 * recorded in `qa/field.mjs`'s own `NOT_COVERED` and is unchanged by this
 * migration.
 *
 * THE `overflow-x-auto` WRAPPER IS GONE because `Table` now ships its own
 * container (shadcn's `data-slot="table-container"`), and two nested scroll
 * containers is a defect, not a belt-and-braces. `PanelBody` keeps `p-0` so
 * the table meets the panel's own border.
 */
export function UnvaluedRegister({
  register,
}: { register: BlockedValueResponse["unvaluedRegister"] }) {
  if (register.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="Без оцінки" count={register.length} />
      <PanelBody className="p-0">
        <DataTable
          columns={unvaluedRegisterColumns}
          data={register}
          className="min-w-160"
          empty="Немає позицій без оцінки."
        />
      </PanelBody>
    </Panel>
  );
}
