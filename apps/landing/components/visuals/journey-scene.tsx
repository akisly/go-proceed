import Image from "next/image";
import { Camera, Check, FileCheck2, FileText, MapPin, ShieldCheck } from "lucide-react";
import type { JourneyChapter } from "../../content/landing-content";

export function JourneyScene({ id }: { id: JourneyChapter["id"] }) {
  if (id === "requirement") return <RequirementScene />;
  if (id === "capture") return <CaptureScene />;
  return <DecisionScene />;
}

function RequirementScene() {
  return (
    <figure aria-label="Вимога R-041 на кресленні" className="landing-blueprint relative h-full min-h-[420px] overflow-hidden bg-surface p-5 md:p-8">
      <figcaption className="flex items-center gap-2 border-b border-line pb-4">
        <MapPin aria-hidden="true" className="size-4 text-ink-muted" strokeWidth={1.75} />
        <span className="index-label text-ink-muted">ЕОМ · аркуш 14 · REV 03</span>
        <span className="index-label ml-auto text-ink-subtle">ВРУ-1</span>
      </figcaption>

      <div className="absolute left-[11%] top-[28%] h-px w-[64%] bg-line-strong" aria-hidden="true" />
      <div className="absolute left-[28%] top-[28%] h-[28%] w-px bg-line-strong" aria-hidden="true" />
      <div className="absolute left-[28%] top-[56%] h-px w-[55%] bg-line-strong" aria-hidden="true" />
      <div className="absolute left-[70%] top-[28%] h-[28%] w-px bg-line-strong" aria-hidden="true" />

      <div className="absolute left-[38%] top-[38%] border border-action-signal bg-surface px-5 py-3 font-mono text-meta font-semibold text-ink shadow-overlay">
        ВРУ-1
      </div>
      <span className="absolute left-[51%] top-[48%] h-[14%] w-px bg-action-signal" aria-hidden="true" />

      <div className="absolute inset-x-5 bottom-5 border border-line-strong bg-surface shadow-float md:inset-x-8 md:bottom-8">
        <div className="flex items-center border-b border-line px-4 py-3">
          <span className="index-label text-ink-muted">R-041</span>
          <span className="ml-auto rounded-pill border border-status-blocked-line bg-status-blocked px-3 py-1 text-micro font-semibold text-status-blocked-fg">
            Блокуюча
          </span>
        </div>
        <p className="px-4 py-5 text-h3 font-semibold leading-snug text-ink">Кабельний лоток до закриття стелі</p>
      </div>
    </figure>
  );
}

function CaptureScene() {
  return (
    <figure aria-label="Польовий доказ EV-0248" className="relative h-full min-h-[420px] overflow-hidden bg-sunken">
      <Image
        src="/images/cable-tray-evidence.png"
        alt="Зафіксований кабельний лоток у зоні ВРУ-1"
        fill
        sizes="(max-width: 1240px) 100vw, 520px"
        className="object-cover"
      />
      <figcaption className="absolute inset-x-5 top-5 flex items-center gap-3 border border-line-inverse bg-inverse px-4 py-3 text-on-inverse shadow-overlay md:inset-x-8 md:top-8">
        <Camera aria-hidden="true" className="size-5 text-action-signal" strokeWidth={1.75} />
        <div>
          <p className="index-label text-on-inverse-muted">EV-0248 · 14:32</p>
          <p className="mt-1 text-data font-semibold">ВРУ-1 · Секція А</p>
        </div>
      </figcaption>
      <div className="absolute inset-x-5 bottom-5 bg-surface p-5 shadow-float md:inset-x-8 md:bottom-8">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-5 text-status-ready-fg" strokeWidth={1.75} />
          <p className="text-data font-semibold text-ink">Походження записано</p>
          <span className="index-label ml-auto text-ink-muted">3 / 3</span>
        </div>
        <p className="mt-3 text-meta leading-relaxed text-ink-muted">Майстер дільниці · польова вебпрограма · оригінал завантажено</p>
      </div>
    </figure>
  );
}

function DecisionScene() {
  return (
    <figure aria-label="Рішення DR-0091, закриття CL-017 і чернетка акта" className="relative h-full min-h-[420px] overflow-hidden bg-subtle p-5 md:p-8">
      <figcaption className="index-label text-ink-muted">Зовнішнє рішення · без доступу до проєкту</figcaption>

      <div className="mt-5 border border-status-ready-line bg-status-ready p-5 shadow-overlay">
        <div className="flex items-center gap-3 text-status-ready-fg">
          <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={1.75} />
          <div>
            <p className="index-label">DR-0091</p>
            <p className="mt-1 text-body font-semibold">Прийнято технічним наглядом</p>
          </div>
        </div>
      </div>

      <div className="ml-8 h-8 w-px bg-action-signal" aria-hidden="true" />
      <div className="flex items-center gap-3 border border-line-strong bg-surface px-4 py-3 shadow-overlay">
        <span className="grid size-7 place-items-center rounded-pill bg-status-ready text-status-ready-fg">
          <Check aria-hidden="true" className="size-4" strokeWidth={2} />
        </span>
        <span className="text-data font-semibold text-ink">CL-017 · закриття дозволено</span>
      </div>

      <div className="ml-8 h-8 w-px bg-action-signal" aria-hidden="true" />
      <div className="border border-line-strong bg-surface p-5 shadow-float">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <FileText aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
          <p className="index-label text-ink-muted">Акт прихованих робіт · чернетка</p>
          <FileCheck2 aria-hidden="true" className="ml-auto size-5 text-status-ready-fg" strokeWidth={1.75} />
        </div>
        <dl className="mt-4 grid gap-3 text-meta md:grid-cols-3 wide:grid-cols-1">
          <div><dt className="text-ink-muted">Робота</dt><dd className="mt-1 font-semibold text-ink">W-014</dd></div>
          <div><dt className="text-ink-muted">Доказ</dt><dd className="mt-1 font-semibold text-ink">EV-0248</dd></div>
          <div><dt className="text-ink-muted">Рішення</dt><dd className="mt-1 font-semibold text-ink">DR-0091</dd></div>
        </dl>
      </div>
    </figure>
  );
}
