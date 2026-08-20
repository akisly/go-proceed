import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

export function Statement() {
  return (
    <section className="px-5 py-20 md:px-8 md:py-32 wide:px-12">
      <Reveal className="mx-auto max-w-content">
        <p className="index-label text-ink-muted">{landingContent.statement.label}</p>
        <p className="display mt-6 max-w-[26ch] text-mkt-display-2 text-ink">
          {landingContent.statement.text}
        </p>
      </Reveal>
    </section>
  );
}
