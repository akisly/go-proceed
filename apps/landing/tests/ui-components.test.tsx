import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Accordion, Button, Chip, FeatureGrid, FeatureCell, Pill, PillContent, SectionRule, Bento, BentoCell, ComparePair, CompareCard, CompareArrow } from "@goproceed/ui/components";
import { ScrollSettle } from "@goproceed/ui/motion";

describe("Button size=\"lg\"", () => {
  it("takes its height from the marketing control token", () => {
    const html = renderToStaticMarkup(<Button size="lg">Обговорити пілот</Button>);
    expect(html).toContain("h-(--gp-control-height-marketing)");
    expect(html).toContain("touch:h-(--gp-control-height-touch)");
  });
});

describe("Chip dot", () => {
  it("renders a leading dot only when asked", () => {
    expect(renderToStaticMarkup(<Chip tone="review" dot>на розгляді</Chip>)).toContain('data-chip-dot="true"');
    expect(renderToStaticMarkup(<Chip tone="review">на розгляді</Chip>)).not.toContain("data-chip-dot");
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
  });
});
