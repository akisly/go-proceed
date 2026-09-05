import { landingContent } from "../../content/landing-content";

export function Sources() {
  return (
    <div id="sources" aria-hidden="true" className="scroll-mt-20 px-4 py-16 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        {landingContent.sources.label}
      </div>
    </div>
  );
}
