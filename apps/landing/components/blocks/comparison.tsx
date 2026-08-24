import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.comparison;

export function Comparison() {
  return (
    <SectionShell eyebrow={content.eyebrow} title={content.title} lead={content.lead} className="bg-subtle">
      <Reveal y={0}>
        <div
          role="region"
          aria-label="Порівняння доказового контуру"
          className="overflow-hidden rounded-section border border-line-strong bg-surface"
        >
          <div data-mobile-comparison="true" className="md:hidden">
            <div className="flex items-center justify-between border-b border-line bg-subtle px-5 py-4">
              <span className="index-label text-ink-muted">Порівняння</span>
              <span className="font-mono text-micro text-ink-subtle">05 критеріїв</span>
            </div>
            {content.rows.map((row, index) => (
              <article key={row.criterion} className="border-b border-line p-5 last:border-b-0">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-micro text-ink-subtle">0{index + 1}</span>
                  <h3 className="text-data font-semibold text-ink">{row.criterion}</h3>
                </div>
                <dl className="mt-5 space-y-4 pl-8">
                  <div>
                    <dt className="index-label text-ink-subtle">Розрізнені канали</dt>
                    <dd className="mt-2 text-data leading-relaxed text-ink-muted">{row.fragmented}</dd>
                  </div>
                  <div className="border-l-2 border-action-signal bg-subtle px-4 py-3">
                    <dt className="index-label text-ink-muted">GoProceed</dt>
                    <dd className="mt-2 text-data font-medium leading-relaxed text-ink">{row.goproceed}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          {/* THE BREAKPOINT MOVED FROM THE TABLE TO A WRAPPER. shadcn's
            * `Table` renders its own container div
            * (`data-slot="table-container"`), so `hidden md:table` on the
            * `<table>` would have left that container in flow at every width.
            * The wrapper is the thing that appears at `md`; the table inside
            * it keeps the UA's own `display: table`.
            *
            * AND THE PER-ROW `border-0` IS GONE, not lost: the rule moved
            * from the cell to the row when these primitives became shadcn's,
            * and `TableBody` carries `[&_tr:last-child]:border-0` for exactly
            * this, so the override had nothing left to switch off.
            *
            * IT WAS NOT A §4.1 VIOLATION, and an earlier version of this
            * comment said it was. §4.1's row reads «`bg-${tone}` → a literal
            * class string per branch», i.e. it forbids building a class out of
            * a RUNTIME value and prescribes literal strings per branch as the
            * fix. The old code interpolated `borderExist`, whose only two
            * values were the literal `'border-0'` and `''` written three lines
            * above — so the scanner did see `border-0` and the CSS was
            * emitted. The pattern was compliant, just roundabout. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">Критерій</TableHead>
                  <TableHead className="w-[36%]">Розрізнені канали</TableHead>
                  <TableHead className="w-[40%] bg-subtle">GoProceed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.rows.map((row) => (
                  // The GoProceed cell carries a rule one step lighter than
                  // its neighbours', which is how this block read before the
                  // table primitives changed. Because that rule is on the CELL,
                  // `TableBody`'s row-level last-child reset does not reach it,
                  // so the last row zeroes its own cells here. Verified in the
                  // built stylesheet and by computed style at 1068 and 360.
                  <TableRow key={row.criterion} className="last:[&>td]:border-b-0">
                    <TableCell className="font-semibold">{row.criterion}</TableCell>
                    <TableCell className="text-ink-muted">{row.fragmented}</TableCell>
                    <TableCell className="border-b border-line bg-subtle font-medium">{row.goproceed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Reveal>
    </SectionShell>
  );
}
