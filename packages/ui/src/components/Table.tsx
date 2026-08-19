import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cx } from "./cn";

/**
 * Thin wrappers whose whole job is to make three rulings unforgettable.
 *
 * 1. **`table-fixed`.** Column geometry becomes a property of the element
 *    instead of something maintained per row. v1 shipped a defect it called
 *    "fourteen grids" — a per-row grid definition that drifted — and this is
 *    the fix. Never reintroduce a per-row grid.
 *
 * 2. **Numeric columns are right-aligned and tabular.** That is what makes a
 *    shortfall scannable: 620/620 and 180/150 differ in SHAPE when their digits
 *    share a right edge. `numeric` sets both, so they cannot be applied apart.
 *
 * 3. **This is a real `<table>`.** Changing `display` on table elements strips
 *    their implicit ARIA roles, which is why the "responsive table" trick
 *    forces you to hand `role="table"/"row"/"cell"` back and maintain an
 *    invisible second copy of the semantics. On a phone the register renders as
 *    cards instead — a different hierarchy, not a reflow, because the phone
 *    leads with money and state while the desk leads with identity.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cx("w-full table-fixed border-collapse text-data", className)}>
      {children}
    </table>
  );
}

export function Th({
  numeric = false, className, children, ...rest
}: { numeric?: boolean; children: ReactNode } & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-line-strong px-3 py-2 text-meta font-medium uppercase tracking-wide text-ink-muted",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  numeric = false, className, children, ...rest
}: { numeric?: boolean; children: ReactNode } & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cx(
        "border-b border-line-strong px-3 py-2.5 text-ink",
        numeric ? "tabular text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cx("transition-colors duration-fast ease-out hover:bg-subtle", className)}>
      {children}
    </tr>
  );
}
