import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../../components/brand-mark";

export const metadata = { robots: { index: false } };

export default function OgPage() {
  const h = landingContent.hero;
  return (
    <main className="relative grid h-[630px] w-[1200px] content-between bg-canvas p-16">
      <p className="flex items-center gap-4 text-h1 font-semibold text-ink"><BrandMark className="size-12" />{landingContent.nav.brand}</p>
      <div>
        <h1 className="display max-w-[16ch] text-[72px] leading-[1.05] tracking-tightest text-ink">
          {h.title.slice(0, h.title.indexOf(h.titleAccent))}<span className="text-accent">{h.titleAccent}</span>{h.title.slice(h.title.indexOf(h.titleAccent) + h.titleAccent.length)}
        </h1>
        <p className="mt-6 max-w-[40ch] text-[24px] leading-relaxed text-ink-secondary">{h.pill.badge} · {h.pill.text}</p>
      </div>
    </main>
  );
}
