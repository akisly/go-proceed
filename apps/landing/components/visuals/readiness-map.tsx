import { AlertTriangle, Check, Clock3, LockKeyhole } from "lucide-react";
import { landingContent } from "../../content/landing-content";

const tone = {
  ready: {
    surface: "bg-status-ready",
    border: "border-status-ready-line",
    foreground: "text-status-ready-fg",
    icon: Check,
  },
  review: {
    surface: "bg-status-review",
    border: "border-status-review-line",
    foreground: "text-status-review-fg",
    icon: Clock3,
  },
  blocked: {
    surface: "bg-status-blocked",
    border: "border-status-blocked-line",
    foreground: "text-status-blocked-fg",
    icon: LockKeyhole,
  },
} as const;

export function ReadinessMap() {
  const content = landingContent.readiness;

  return (
    <figure aria-label="Стан демонстраційного пакета робіт" className="grid wide:grid-cols-[1.18fr_0.82fr]">
      <div className="border-b border-line p-5 md:p-8 wide:border-b-0 wide:border-r wide:p-10">
        <figcaption className="index-label text-ink-muted">{content.sampleLabel}</figcaption>
        <svg
          role="img"
          aria-labelledby="readiness-title readiness-desc"
          viewBox="0 0 760 250"
          className="mt-8 hidden h-auto w-full md:block"
        >
          <title id="readiness-title">Стан робіт у доказовому контурі</title>
          <desc id="readiness-desc">Дванадцять робіт готові, сім перебувають на розгляді, три заблоковані невиконаними вимогами.</desc>
          <path d="M110 125H650" className="stroke-line-strong" strokeWidth="1" />
          <path d="M380 125V210H650" className="stroke-line-strong" strokeWidth="1" fill="none" />
          <circle cx="110" cy="125" r="48" className="fill-status-ready stroke-status-ready-line" />
          <circle cx="380" cy="125" r="48" className="fill-status-review stroke-status-review-line" />
          <circle cx="650" cy="125" r="48" className="fill-status-blocked stroke-status-blocked-line" />
          <text x="110" y="119" textAnchor="middle" className="fill-status-ready-fg font-mono text-[24px] font-semibold">12</text>
          <text x="110" y="143" textAnchor="middle" className="fill-status-ready-fg text-[12px]">готово</text>
          <text x="380" y="119" textAnchor="middle" className="fill-status-review-fg font-mono text-[24px] font-semibold">07</text>
          <text x="380" y="143" textAnchor="middle" className="fill-status-review-fg text-[12px]">розгляд</text>
          <text x="650" y="119" textAnchor="middle" className="fill-status-blocked-fg font-mono text-[24px] font-semibold">03</text>
          <text x="650" y="143" textAnchor="middle" className="fill-status-blocked-fg text-[12px]">блок</text>
          <text x="515" y="110" textAnchor="middle" className="fill-ink-muted text-[11px]">рішення не записане</text>
          <text x="520" y="226" textAnchor="middle" className="fill-ink-muted text-[11px]">невиконана вимога</text>
        </svg>

        <dl className="mt-8 grid md:grid-cols-3">
          {content.nodes.map((node) => {
            const styles = tone[node.id];
            const Icon = styles.icon;
            return (
              <div key={node.id} className="border-t border-line py-5 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                <div className={`grid size-9 place-items-center rounded-pill border ${styles.surface} ${styles.border} ${styles.foreground}`}>
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                </div>
                <dd className="mt-4 font-mono text-h2 font-semibold text-ink">{node.value}</dd>
                <dt className="mt-1 text-data font-semibold text-ink">{node.label}</dt>
                <p className="mt-2 text-meta leading-relaxed text-ink-muted">{node.detail}</p>
              </div>
            );
          })}
        </dl>
      </div>

      <aside className="flex flex-col justify-between bg-subtle p-5 md:p-8 wide:p-10">
        <div>
          <div className="flex items-center gap-3 text-status-blocked-fg">
            <AlertTriangle aria-hidden="true" className="size-5" strokeWidth={1.75} />
            <p className="index-label">Причина блокування · W-015</p>
          </div>
          <p className="mt-6 max-w-[28ch] text-mkt-display-3 text-ink">Не вистачає не статусу. Не вистачає конкретного доказу.</p>
          <p className="mt-5 max-w-[46ch] text-body leading-relaxed text-ink-muted">{content.note}</p>
        </div>
        <div className="mt-10 border-t border-line-strong pt-5">
          <p className="text-meta text-ink-muted">Наступна дія</p>
          <p className="mt-2 text-data font-semibold text-ink">Додати фото вогнезахисного проходження для R-052</p>
        </div>
      </aside>
    </figure>
  );
}
