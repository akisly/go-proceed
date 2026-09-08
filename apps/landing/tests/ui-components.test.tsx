import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Accordion, Button, Chip, FeatureGrid, FeatureCell, Pill, PillContent, SectionRule, Bento, BentoCell, ComparePair, CompareCard, CompareArrow, Stepper, Step } from "@goproceed/ui/components";
import { ScrollSettle, ScrollTint } from "@goproceed/ui/motion";

vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

describe("Button size=\"lg\"", () => {
  it("takes its height from the marketing control token", () => {
    const html = renderToStaticMarkup(<Button size="lg">Обговорити пілот</Button>);
    expect(html).toContain("h-(--gp-control-height-marketing)");
    expect(html).toContain("touch:h-(--gp-control-height-touch)");
  });
  // Spec §4: `radius.control` (6px) is the app's; the marketing button carries
  // `radius.panel` (10px). The size map's `rounded-panel` has to survive
  // tw-merge's radius group against BASE's `rounded-control` — assert the
  // merged output, not the map, because that is where the two can disagree.
  it("carries the panel radius, and the other sizes keep control", () => {
    const lg = renderToStaticMarkup(<Button size="lg">Обговорити пілот</Button>);
    expect(lg).toContain("rounded-panel");
    expect(lg).not.toContain("rounded-control");
    for (const size of ["default", "sm", "icon"] as const) {
      const html = renderToStaticMarkup(<Button size={size}>Далі</Button>);
      expect(html).toContain("rounded-control");
      expect(html).not.toContain("rounded-panel");
    }
  });
});

describe("Chip dot", () => {
  it("renders a leading dot only when asked", () => {
    expect(renderToStaticMarkup(<Chip tone="review" dot>на розгляді</Chip>)).toContain('data-chip-dot="true"');
    expect(renderToStaticMarkup(<Chip tone="review">на розгляді</Chip>)).not.toContain("data-chip-dot");
  });

  it("pulses the dot only when asked, and only with a dot", () => {
    const pulsing = renderToStaticMarkup(<Chip tone="review" dot pulse>на розгляді</Chip>);
    expect(pulsing).toContain('data-chip-dot="true"');
    expect(pulsing).toContain("pulse-dot");
    expect(renderToStaticMarkup(<Chip tone="review" dot>на розгляді</Chip>)).not.toContain("pulse-dot");
    expect(renderToStaticMarkup(<Chip tone="review" pulse>на розгляді</Chip>)).not.toContain("pulse-dot");
  });
});

describe("Accordion marker", () => {
  const entries = [{ id: "a", question: "Питання?", answer: "Відповідь." }];
  it("draws a circled plus when marker=\"plus\"", () => {
    const html = renderToStaticMarkup(<Accordion entries={entries} marker="plus" />);
    expect(html).toContain('data-accordion-marker="plus"');
    expect(html).not.toContain("lucide-chevron-down");
  });
  it("keeps the chevron by default", () => {
    expect(renderToStaticMarkup(<Accordion entries={entries} />)).toContain("lucide-chevron-down");
  });
});

describe("Pill", () => {
  it("renders the badge and a trailing arrow, as a link when asChild", () => {
    const html = renderToStaticMarkup(
      <Pill asChild>
        <a href="#pilot"><PillContent badge="Безкоштовний пілот">для субпідрядників</PillContent></a>
      </Pill>,
    );
    expect(html).toContain('<a href="#pilot"');
    expect(html).toContain("Безкоштовний пілот");
    expect(html).toContain('data-slot="pill"');
    expect(html).toContain("→");
  });
});

describe("SectionRule", () => {
  it("is decorative and carries its index and label in mono", () => {
    const html = renderToStaticMarkup(<SectionRule index="01" label="Проблема" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-section-rule="01"');
    expect(html).toContain("01 · Проблема");
    expect(html).toContain("index-label");
  });
});

describe("FeatureGrid", () => {
  it("renders four cells in one bordered container with a spotlight layer each", () => {
    const html = renderToStaticMarkup(
      <FeatureGrid columns={4}>
        {["ПТВ", "Майстер", "Власник", "Технагляд"].map((t) => (
          <FeatureCell key={t} title={t} subtitle="роль">біль</FeatureCell>
        ))}
      </FeatureGrid>,
    );
    expect(html.match(/data-slot="feature-cell"/g)).toHaveLength(4);
    expect(html.match(/data-spotlight="true"/g)).toHaveLength(4);
    expect(html).toContain("md:grid-cols-2");
    expect(html).toContain("wide:grid-cols-4");
  });
});

describe("ScrollSettle", () => {
  it("renders one wrapper with data-settled=\"false\" on the server, and the beam inert", () => {
    const html = renderToStaticMarkup(
      <ScrollSettle><div><i className="beam" aria-hidden="true" />кадр</div></ScrollSettle>,
    );
    expect(html).toContain('data-settled="false"');
    expect(html).not.toContain('data-settled="true"');
    expect(html).toContain('class="beam"');
  });
});

describe("ScrollTint", () => {
  it("keeps the separating space outside each word's inline-block span, not collapsed inside it", () => {
    const text = "Кожен, хто закривав конструкцію";
    const words = text.split(" ");
    const html = renderToStaticMarkup(<ScrollTint text={text} />);
    const visible = html.slice(html.indexOf('aria-hidden="true"'));

    // A space that sits INSIDE the inline-block (the defect) is invisible to
    // a fully-tag-stripped string comparison — the browser collapses it, but
    // renderToStaticMarkup still serializes the character, so a naive
    // "does the text contain the sentence" check passes on both the buggy
    // and the fixed markup. What must never appear is a word span whose own
    // text content ends in whitespace before its closing tag.
    expect(visible).not.toMatch(/\s<\/span>/);

    // The separator must instead be a sibling text node between two word
    // spans — once for every gap between words.
    const gaps = visible.match(/<\/span> <span/g) ?? [];
    expect(gaps).toHaveLength(words.length - 1);
  });
});

describe("Bento", () => {
  it("lets one cell span two rows", () => {
    const html = renderToStaticMarkup(
      <Bento>
        <BentoCell span="rows-2" eyebrow="Доступ" title="Хто що бачить">матриця</BentoCell>
        <BentoCell eyebrow="Незмінність">список</BentoCell>
        <BentoCell eyebrow="Межі v0.1">список</BentoCell>
      </Bento>,
    );
    expect(html.match(/data-slot="bento-cell"/g)).toHaveLength(3);
    expect(html.match(/md:row-span-2/g)).toHaveLength(1);
    expect(html).toContain("Хто що бачить");
  });
});

describe("ComparePair", () => {
  const rows = [{ key: "photo", question: "Де фото?", answer: "У чаті бригади" }];
  it("renders both cards, the arrow, and paired rows by key", () => {
    const html = renderToStaticMarkup(
      <ComparePair>
        <CompareCard tone="was" eyebrow="Зараз" title="Чати, диск, пам'ять" rows={rows} outcome="Акт повертають." />
        <CompareArrow />
        <CompareCard tone="now" eyebrow="З GoProceed" title="Один запис" rows={[{ ...rows[0]!, answer: "На роботі W-014", ref: "EV-0248 · 14:32" }]} outcome="Акт не повертають." />
      </ComparePair>,
    );
    expect(html.match(/data-compare-row="photo"/g)).toHaveLength(2);
    expect(html).toContain('data-compare-tone="was"');
    expect(html).toContain('data-compare-tone="now"');
    expect(html).toContain("EV-0248 · 14:32");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-sunken");
    expect(html).not.toContain("bg-muted");
  });
});

describe("Stepper", () => {
  it("renders steps with a progress-driven line and dots", () => {
    const html = renderToStaticMarkup(
      <Stepper>
        <Step index={0} count={2} when="День 1" title="Реєстр">Дві години.</Step>
        <Step index={1} count={2} when="Тиждень 1" title="Майданчик">Знімає.</Step>
      </Stepper>,
    );
    expect(html.match(/data-slot="step"/g)).toHaveLength(2);
    expect(html).toContain("--gp-progress");
    expect(html).toContain('data-stepper-line="true"');
  });
});

describe("prototype parity — components (2026-09-06)", () => {
  it("Button lifts a pixel on hover on the emphatic curve", () => {
    const html = renderToStaticMarkup(<Button size="lg">Обговорити пілот</Button>);
    expect(html).toContain("hover:-translate-y-px");
    expect(html).toContain("ease-emphatic");
    expect(renderToStaticMarkup(<Button variant="link">лист</Button>)).not.toContain("hover:-translate-y-px");
  });
  it("Accordion opens over the deliberate duration on the emphatic curve", () => {
    const html = renderToStaticMarkup(<Accordion marker="plus" entries={[{ id: "a", question: "Питання?", answer: "Відповідь." }]} />);
    expect(html).toContain("duration-deliberate");
    expect(html).toContain("ease-emphatic");
    expect(html).not.toContain("duration-base");
  });
  it("the «now» compare card carries the accent shadow and pops its checks when asked", () => {
    const rows = [{ key: "photo" as const, question: "Де фото?", answer: "На роботі W-014" }];
    const still = renderToStaticMarkup(<CompareCard tone="now" eyebrow="З GoProceed" title="Один запис" rows={rows} outcome="Акт не повертають." />);
    expect(still).toContain("shadow-float-accent");
    expect(still).not.toContain("scale(0)");
    expect(still).toMatch(/class="mt-0\.5 grid size-5 place-items-center rounded-pill border border-status-ready-fg/);
    const popping = renderToStaticMarkup(<CompareCard tone="now" eyebrow="З GoProceed" title="Один запис" rows={rows} outcome="Акт не повертають." animateChecks />);
    expect(popping).toContain("scale(0)");
    expect(popping).toMatch(/class="mt-0\.5 grid size-5"/);
  });
  it("FeatureCell renders a cell and no pointer tilt", () => {
    // [2026-09-08] Both the tilt and the perspective it needed are gone: the
    // hero's product frame is the only surface on the landing that follows the
    // cursor. The dot spotlight stays — a CSS variable, not motion.
    const html = renderToStaticMarkup(<FeatureGrid columns={4}><FeatureCell title="ПТВ">біль</FeatureCell></FeatureGrid>);
    expect(html).not.toContain("perspective");
    expect(html).not.toContain("data-tilt");
    expect(html).toContain('data-slot="feature-cell"');
    expect(html).toContain('data-spotlight="true"');
  });
});
