import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Accordion, Button, Chip, Pill, PillContent, SectionRule } from "@goproceed/ui/components";

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
