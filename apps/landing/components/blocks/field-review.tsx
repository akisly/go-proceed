import { landingContent } from "../../content/landing-content";
import { FieldReviewVisual } from "../visuals/field-review-visual";

export function FieldReview() {
  const content = landingContent.fieldReview;

  return (
    <section id="field-review" className="scroll-mt-24 border-y border-line-inverse bg-inverse px-5 py-20 text-on-inverse md:px-8 md:py-28 wide:px-12">
      <div className="mx-auto max-w-content">
        <header className="grid gap-6 wide:grid-cols-[1fr_0.72fr] wide:items-end">
          <h2 className="display max-w-[19ch] text-mkt-display-2">{content.title}</h2>
          <div className="wide:justify-self-end">
            <p className="measure max-w-[58ch] text-body leading-relaxed text-on-inverse-muted">{content.lead}</p>
            <p className="mt-5 max-w-[60ch] border-t border-line-inverse pt-4 text-meta leading-relaxed text-on-inverse-muted">
              {content.networkNote}
            </p>
          </div>
        </header>

        <div className="mt-14">
          <FieldReviewVisual />
        </div>

        <dl className="mt-10 grid border-y border-line-inverse md:grid-cols-3 md:divide-x md:divide-line-inverse">
          {content.roles.map((item) => (
            <div key={item.role} className="border-b border-line-inverse py-5 last:border-b-0 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0">
              <dt className="text-data font-semibold text-on-inverse">{item.role}</dt>
              <dd className="mt-2 max-w-[34ch] text-meta leading-relaxed text-on-inverse-muted">{item.decision}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
