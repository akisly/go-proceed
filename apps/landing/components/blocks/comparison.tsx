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
          tabIndex={0}
          className="overflow-x-auto rounded-section border border-line-strong bg-surface"
        >
          <Table className="min-w-[780px]">
            <thead>
              <Tr>
                <Th className="w-[24%]">Критерій</Th>
                <Th className="w-[36%]">Розрізнені канали</Th>
                <Th className="w-[40%] bg-subtle">GoProceed</Th>
              </Tr>
            </thead>
            <tbody>
              {content.rows.map((row) => (
                <Tr key={row.criterion}>
                  <Td className="font-semibold">{row.criterion}</Td>
                  <Td className="text-ink-muted">{row.fragmented}</Td>
                  <Td className="border-l border-line bg-subtle font-medium">{row.goproceed}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Reveal>
    </SectionShell>
  );
}
