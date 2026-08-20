import { Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const position = [
  "wide:-rotate-1 wide:translate-y-5",
  "wide:relative wide:z-10",
  "wide:rotate-1 wide:translate-y-8",
] as const;

export function RolesDossier() {
  return (
    <SectionShell
      id="roles"
      eyebrow="Один контур, різні рішення"
      title="Кожен учасник бачить свою роботу з тими самими фактами"
      lead="Інтерфейс не змушує власника, ПТВ і майстра читати однаковий екран. Він зберігає спільне походження даних і змінює їхню робочу форму."
      className="bg-canvas"
    >
      <Stagger step="loose" className="grid gap-5 wide:grid-cols-3 wide:gap-0 wide:px-8 wide:pb-10">
        {landingContent.roles.map((role, index) => (
          <StaggerItem key={role.id} y={20} className={position[index]}>
            <article className="relative min-h-[520px] border border-line-strong bg-surface p-6 shadow-overlay md:p-8">
              <div className="absolute right-5 top-5 grid size-10 place-items-center rounded-pill border border-line font-mono text-micro text-ink-muted">
                0{index + 1}
              </div>
              <p className="index-label pr-14 text-ink-muted">Досьє ролі · {role.id}</p>
              <h3 className="display mt-8 max-w-[15ch] text-mkt-display-3 text-ink">{role.role}</h3>
              <p className="mt-4 text-data leading-relaxed text-ink-muted">{role.context}</p>

              <dl className="mt-10 divide-y divide-line border-y border-line">
                <DossierRow label="Бачить" value={role.sees} />
                <DossierRow label="Вирішує" value={role.decides} />
                <DossierRow label="Отримує" value={role.receives} />
              </dl>

              <p className="index-label absolute bottom-6 left-6 text-ink-subtle md:bottom-8 md:left-8">
                GoProceed · рольовий контекст
              </p>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </SectionShell>
  );
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 py-5 md:grid-cols-[90px_1fr]">
      <dt className="index-label text-ink-muted">{label}</dt>
      <dd className="text-data leading-relaxed text-ink">{value}</dd>
    </div>
  );
}
