import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { BlockedValueResponse } from "@goproceed/contracts";

import { UnvaluedRegister } from "./unvalued-register";

/**
 * THE ONE MIGRATED TABLE NO HARNESS OPENS.
 *
 * `apps/app/qa/field.mjs` drives the assignments register at 1280, 390 and 360
 * and asserts per-`th` overflow, page overflow and touch targets on it — so
 * the TanStack migration of THAT table is proven in a real browser. The
 * unvalued register is on `/projects/{projectId}`, which the same harness
 * opens, but the seeded world has no unvalued assignment: `register.length ===
 * 0`, the component returns `null`, and every assertion about it would be
 * vacuously true. That gap predates this commit (it is named in the harness's
 * own `NOT_COVERED`) and this file does not close it — a jsdom-free string
 * render cannot measure a column at 360px.
 *
 * What it DOES close is the part that broke silently when the markup was
 * replaced by column definitions: whether the three columns still render, in
 * order, with the two rulings the old JSX carried inline. A hand-written
 * `<Td numeric>` was visible in review; a `meta: { numeric: true }` five files
 * away is not, and nothing else in this repository would have noticed it being
 * dropped.
 *
 * NO LITERAL TAILWIND CLASS STRINGS — assembled at runtime, per
 * `02-building-ui.md` §4.3 rule 7 and `app/globals.css`'s own `@source`
 * directives. Until 2026-09-05, the deleted `app/dash/dash-theme.css` excluded
 * `apps/app/tests` and `apps/app/qa` from Tailwind's scan but NOT
 * `apps/app/src/**`; the single entry point `app/globals.css` now does the
 * same. A literal class written here would be emitted as real production CSS.
 */

const TABULAR = ["tabular", "text-right"].join(" ");
const MIN_WIDTH = ["min", "w", "160"].join("-");

function row(
  overrides: Partial<BlockedValueResponse["unvaluedRegister"][number]> = {},
): BlockedValueResponse["unvaluedRegister"][number] {
  return {
    reason: "missing_unit_price",
    unitCode: "м²",
    assignmentCount: 3,
    quantity: "10.000000",
    ...overrides,
  };
}

describe("UnvaluedRegister", () => {
  it("renders nothing at all when the register is empty", () => {
    // Good news on this screen: every blocked line has a price. An empty
    // panel would announce a category the reader then has to dismiss, which
    // is why this is an early return and NOT DataTable's `empty` branch.
    expect(renderToStaticMarkup(<UnvaluedRegister register={[]} />)).toBe("");
  });

  it("keeps the three columns, in order", () => {
    const html = renderToStaticMarkup(<UnvaluedRegister register={[row()]} />);
    // `<th\s`, never `<th[^>]*` — the latter also matches `<thead …>`, whose
    // first `</th>` is three elements away. Cost one round to notice.
    const headings = [...html.matchAll(/<th\s[^>]*>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(headings).toEqual(["Причина", "Доручень", "Кількість"]);
  });

  it("formats the quantity rather than printing fromScaled6's own output", () => {
    // `"10.000000"` is what `summariseBlockedValue` builds to round-trip
    // `numeric(20,6)` exactly. It is not a number anybody reads, and it
    // shipped once beside `formatMoney`'s Ukrainian-comma figures on the same
    // screen.
    const html = renderToStaticMarkup(<UnvaluedRegister register={[row()]} />);
    expect(html).not.toContain("10.000000");
    expect(html).toContain("10 м²");
  });

  it("carries the reason's Ukrainian label, never the enum value", () => {
    const html = renderToStaticMarkup(
      <UnvaluedRegister register={[row({ reason: "unknown_tax_basis" })]} />,
    );
    expect(html).toContain("невідома податкова база");
    expect(html).not.toContain("unknown_tax_basis");
  });

  it("applies Table's numeric ruling to both figure columns and to neither text one", () => {
    // `Table.tsx` ruling 2: right-aligned AND tabular, together, because
    // 620/620 and 180/150 differ in SHAPE only when their digits share a right
    // edge. The ruling now travels as `meta.numeric` on the column definition,
    // which is exactly why it needs asserting: a boolean in a data structure
    // is invisible in a diff in a way `<Td numeric>` was not.
    const html = renderToStaticMarkup(<UnvaluedRegister register={[row()]} />);
    const cells = [...html.matchAll(/<td\b[^>]*>/g)].map((m) => m[0]);
    expect(cells).toHaveLength(3);
    expect(cells[0]).not.toContain(TABULAR);
    expect(cells[1]).toContain(TABULAR);
    expect(cells[2]).toContain(TABULAR);
  });

  it("keeps the measured minimum width on the table itself", () => {
    // 160 × --spacing (0.25rem) = 640px, the floor `assignments-list.tsx`
    // measured against an overflowing Ukrainian column heading at 390 and 360.
    // It belongs on the `<table>`, inside the container that scrolls — put it
    // on the container and the table shrinks instead.
    const html = renderToStaticMarkup(<UnvaluedRegister register={[row()]} />);
    const table = /<table\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(table).toContain(MIN_WIDTH);
  });
});
