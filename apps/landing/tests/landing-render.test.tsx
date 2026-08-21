import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

const html = renderToStaticMarkup(<LandingPage />);

describe("landing semantic frame", () => {
  it("uses the same project mark across site chrome and product previews", () => {
    const navigationStart = html.indexOf('<nav aria-label="Головна навігація"');
    const brandLinkEnd = html.indexOf("</a>", navigationStart);
    const brandLinkHtml = html.slice(navigationStart, brandLinkEnd);

    expect(navigationStart).toBeGreaterThan(-1);
    expect(brandLinkHtml).toContain("<img");
    expect(brandLinkHtml).toContain('alt=""');
    expect(brandLinkHtml).toContain("GoProceed");
    expect(html.match(/data-brand-mark="true"/g) ?? []).toHaveLength(4);
    expect(html).not.toContain(">GP</span>");
  });

  it("publishes one main heading and the first narrative landmarks", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');

    for (const id of ["product", "proof"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("keeps every pilot action inert", () => {
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("disabled");
    expect(html).not.toContain('href="/pilot');
    expect(html).not.toContain("<form");
  });

  it("renders the full evidence workflow in reading order", () => {
    const workflowStart = html.indexOf('id="workflow"');
    expect(workflowStart).toBeGreaterThan(-1);

    let previous = workflowStart;
    for (const label of ["Робота", "Вимога", "Доказ", "Рішення", "Закриття", "Акт"]) {
      const next = html.indexOf(label, previous + 1);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }

    expect(html).toContain("Блокуюча вимога не дозволяє записати етап закритим");
  });

  it("server-renders every product-tour chapter for reduced-motion access", () => {
    for (const title of [
      "Команда знає критерій до того, як він стане проблемою",
      "Майстер бачить не форму, а наступний потрібний доказ",
      "Нагляд отримує рівно той контекст, який потрібен для рішення",
      "Чернетка акта збирається з зафіксованих фактів",
    ]) {
      expect(html).toContain(title);
    }
  });

  it("shows the product as a real dashboard and a field application", () => {
    expect(html).toContain('aria-label="Огляд робочого простору GoProceed"');
    expect(html).toContain("Реєстр робіт");
    expect(html).toContain("Черга доказів");
    expect(html).toContain("Інспектор вимоги");
    expect(html).toContain("Польовий застосунок");
    expect(html).toContain("2 з 3 матеріалів додано");
  });

  it("places the dashboard inside the hero before the proof strip", () => {
    const heroStart = html.indexOf('id="product"');
    const dashboard = html.indexOf('aria-label="Огляд робочого простору GoProceed"');
    const proofStart = html.indexOf('id="proof"');

    expect(heroStart).toBeGreaterThan(-1);
    expect(dashboard).toBeGreaterThan(heroStart);
    expect(dashboard).toBeLessThan(proofStart);
  });

  it("presents the proof strip as one labelled sequence of four stages", () => {
    const proofStart = html.indexOf('id="proof"');
    const proofEnd = html.indexOf("</section>", proofStart);
    const proofHtml = html.slice(proofStart, proofEnd);

    expect(proofStart).toBeGreaterThan(-1);
    expect(proofHtml).toContain('aria-labelledby="proof-title"');
    expect(proofHtml).toContain('<ol');
    expect(proofHtml.match(/<li/g)).toHaveLength(4);
  });

  it("uses timed clickable tabs instead of a scroll-driven product tour", () => {
    expect(html).toContain('data-tour-mode="timed-tabs"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-tour-progress="true"');
  });

  it("stabilizes the desktop product tour without restoring oversized panels", () => {
    const tourStart = html.indexOf('data-tour-mode="timed-tabs"');
    const tourEnd = html.indexOf("</section>", tourStart);
    const tourHtml = html.slice(tourStart, tourEnd);

    expect(tourStart).toBeGreaterThan(-1);
    expect(tourHtml).toContain("wide:min-h-[460px]");
    expect(tourHtml).not.toContain("min-h-[560px]");
    expect(tourHtml).not.toContain("min-h-[620px]");
    expect(tourHtml).not.toContain("min-h-[480px]");
  });

  it("renders the evidence route as three labelled product scenes", () => {
    const workflowStart = html.indexOf('id="workflow"');
    const workflowEnd = html.indexOf("</section>", workflowStart);
    const workflowHtml = html.slice(workflowStart, workflowEnd);

    expect(workflowStart).toBeGreaterThan(-1);
    expect(workflowHtml).toContain('aria-label="Доказовий ланцюг"');
    expect(workflowHtml.match(/<figure/g) ?? []).toHaveLength(3);

    for (const label of ["Робота і вимога", "Доказ і рішення", "Закриття і акт"]) {
      expect(workflowHtml).toContain(`aria-label="${label}"`);
    }
  });

  it("keeps the evidence scenes free of the square blueprint grid", () => {
    const workflowStart = html.indexOf('id="workflow"');
    const workflowEnd = html.indexOf("</section>", workflowStart);

    const workflowHtml = html.slice(workflowStart, workflowEnd);

    expect(workflowHtml).not.toContain("landing-paper-grid");
    expect(workflowHtml).not.toContain("landing-blueprint");
  });

  it("gives each project role a concrete decision dossier", () => {
    for (const role of [
      "Власник або комерційний директор",
      "Керівник ПТВ",
      "Майстер на майданчику",
    ]) {
      expect(html).toContain(role);
    }
    expect(html).toContain('id="roles"');
  });

  it("renders the comparison, integrity receipt, and pilot without invented pricing", () => {
    expect(html).toContain('aria-label="Порівняння доказового контуру"');
    expect(html).toContain('data-mobile-comparison="true"');
    expect(html).toContain('aria-label="Квитанція походження доказу EV-0248"');
    expect(html).toContain('id="pilot"');

    const pilotStart = html.indexOf('id="pilot"');
    const pilotEnd = html.indexOf("</section>", pilotStart);
    expect(html.slice(pilotStart, pilotEnd)).not.toContain("₴");
  });

  it("finishes with factual FAQ, inert final action, and mock disclaimer", () => {
    expect(html).toContain('id="faq"');
    expect(html).toContain("Чи можна фіксувати матеріали без мережі?");
    expect(html).toContain("Кнопка у цьому макеті не надсилає дані");
    expect(html).toContain("Візуальний макет продукту");
    expect(html).toContain("<footer");
  });

  it("uses vector disclosure icons instead of a typographic FAQ glyph", () => {
    const faqStart = html.indexOf('id="faq"');
    const faqEnd = html.indexOf("</section>", faqStart);
    const faqHtml = html.slice(faqStart, faqEnd);

    expect(faqStart).toBeGreaterThan(-1);
    expect(faqHtml).toContain("lucide-chevron-down");
    expect(faqHtml).not.toContain("⌄");
  });

  it("removes repeated framing and finishes with the single pilot section", () => {
    expect(html).not.toContain("Переробка починається там, де вимога існує окремо від виконання");
    expect(html).not.toContain("Перевірте, чи може ваша команда закривати етапи на підставі фактів");

    const faqStart = html.indexOf('id="faq"');
    const pilotStart = html.indexOf('id="pilot"');
    expect(faqStart).toBeGreaterThan(-1);
    expect(pilotStart).toBeGreaterThan(faqStart);
    expect(html.match(/id="pilot"/g)).toHaveLength(1);
  });
});
