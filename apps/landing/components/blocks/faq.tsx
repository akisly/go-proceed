import { Accordion } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

export function Faq() {
  return (
    <SectionShell
      id="faq"
      eyebrow="Перед початком пілоту"
      title="Питання, які варто прояснити до першої фіксації"
      lead="Межі продукту тут сформульовані так само прямо, як вимоги до доказу."
      className="bg-canvas"
    >
      <div className="grid gap-10 border-line-strong pt-3 wide:grid-cols-[0.38fr_0.62fr] wide:gap-20">
        <div className="pt-5">
          <p className="index-label text-ink-muted">Коротко й без припущень</p>
          <p className="mt-5 max-w-[29ch] text-data leading-relaxed text-ink-muted">
            Якщо ваш процес має іншу межу відповідальності, це краще побачити на одному пакеті робіт, а не після масштабування.
          </p>
        </div>
        <Accordion
          entries={landingContent.faq.map((entry) => ({ ...entry }))}
          className="border-t border-line"
        />
      </div>
    </SectionShell>
  );
}
