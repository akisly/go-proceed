import { ArrowUpRight } from "lucide-react";
import { landingContent } from "../../content/landing-content";
import { PilotEnquiryForm } from "../pilot-enquiry-form";

export function PilotEnquiry() {
  const content = landingContent.pilot;

  return (
    <section id="pilot" className="scroll-mt-24 border-y border-line-inverse bg-inverse px-5 py-20 text-on-inverse md:px-8 md:py-28 wide:px-12">
      <div className="mx-auto max-w-content">
        <div className="grid gap-10 wide:grid-cols-[0.72fr_1.28fr] wide:items-start wide:gap-16">
          <div className="wide:sticky wide:top-28">
            <h2 className="display max-w-[13ch] text-mkt-display-2">{content.title}</h2>
            <p className="measure mt-6 max-w-[48ch] text-body leading-relaxed text-on-inverse-muted">{content.lead}</p>
            <div className="mt-8 border-t border-line-inverse pt-5">
              <p className="text-meta text-on-inverse-muted">Один маршрут для перевірки</p>
              <p className="mt-2 flex items-center gap-2 text-data font-semibold">
                Вимога → доказ → рішення → закриття
                <ArrowUpRight aria-hidden="true" className="size-4 text-action-signal" strokeWidth={1.75} />
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-section border border-line-inverse shadow-float">
            <PilotEnquiryForm />
          </div>
        </div>

        <div className="mt-20 border-t border-line-inverse pt-10 md:mt-28 md:pt-14">
          <h3 className="display max-w-[18ch] text-mkt-display-3">Що варто знати до першої фіксації</h3>
          <div className="mt-8 grid gap-x-12 wide:grid-cols-2">
            {content.faq.map((entry) => (
              <details key={entry.id} className="group border-t border-line-inverse py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-body font-semibold marker:content-none">
                  {entry.question}
                  <span aria-hidden="true" className="text-h3 font-normal text-on-inverse-muted transition-transform duration-fast group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="measure max-w-[64ch] pb-2 pr-8 text-data leading-relaxed text-on-inverse-muted">{entry.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
