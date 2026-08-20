import { Table, Td, Th, Tr } from "@goproceed/ui/components";
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

          <Table className="hidden table-fixed md:table">
            <thead>
              <Tr>
                <Th className="w-[24%]">Критерій</Th>
                <Th className="w-[36%]">Розрізнені канали</Th>
                <Th className="w-[40%] bg-subtle">GoProceed</Th>
              </Tr>
            </thead>
            <tbody>
              {content.rows.map((row, index, self) => {
                const borderExist = index === self.length - 1 ? 'border-0' : '';

                return (
                  <Tr key={row.criterion}>
                    <Td className={`${borderExist} font-semibold`}>{row.criterion}</Td>
                    <Td className={`${borderExist} text-ink-muted`}>{row.fragmented}</Td>
                    <Td className={`${borderExist} border-line bg-subtle font-medium`}>{row.goproceed}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </Reveal>
    </SectionShell>
  );
}
