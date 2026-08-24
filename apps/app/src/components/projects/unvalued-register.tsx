"use client";

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
 * On TanStack Table since 2026-08-23; the columns, and the two rulings they
 * carry (quantity-never-money, `formatQuantity` over raw six-decimal output),
 * live in `unvalued-register-columns.tsx`.
 *
 * THE EARLY RETURN STAYS, and is not the same thing as `DataTable`'s `empty`.
 * An unvalued register with no rows is GOOD NEWS on this screen — every
 * blocked line has a price — so it renders nothing at all rather than an empty
 * panel announcing a category the reader then has to dismiss.
 *
 * `min-w-160` matches `assignments-list.tsx`'s measured floor rather than
 * being measured again for these headings. The seeded QA world has no unvalued
 * assignment, so `qa/field.mjs` never renders this table and has never
 * measured `scrollWidth` against `clientWidth` on it; that gap is recorded in
 * that file's `NOT_COVERED`. `unvalued-register.test.tsx` beside this file
 * renders the table and asserts its columns, its formatting and this floor,
 * without a viewport.
 *
 * IT IS A CLIENT COMPONENT. `useTable` is a hook, so a TanStack table renders
 * on the client; the column definitions hold functions, so they are imported
 * from a `"use client"` module. Next still server-renders the markup on first
 * paint. `assignments-list.tsx` is on this side of the boundary too — the
 * alternative left an RSC serialization boundary that no browser in this
 * repository exercises.
 *
 * The scroll container is `Table`'s own (`data-slot="table-container"`), so
 * this file adds none; `PanelBody` keeps `p-0` so the table meets the panel's
 * border.
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
