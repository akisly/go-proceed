/**
 * THE INDEX TILE — a numeral in a hairline square.
 *
 * [2026-09-22, DEV-029] It carried one of four decorative tints for one
 * revision, taken from the reference's KPI chip row. An `impeccable` critique
 * threw that out and the owner agreed to keep the tints in ONE place, the roles
 * grid: on this system two documents teach that colour means state, and four
 * hues decorating an enumeration encode nothing while asking to be read. The
 * fourth tile of the four was already a neutral square by design — «the quiet
 * member» — and it read as well as the other three, which is the whole
 * argument.
 *
 * So the tile is the mono numeral the page already speaks in, and colour on
 * this site stays with states and the brand.
 */
export function IndexTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-field border border-line-strong font-mono text-micro font-medium tabular text-ink-muted">
      {children}
    </span>
  );
}
