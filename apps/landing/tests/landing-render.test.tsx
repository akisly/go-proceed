import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

const html = renderToStaticMarkup(<LandingPage />);

describe("landing evidence journey", () => {
  it("uses one consistent project mark and one main heading", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/data-brand-mark="true"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
  });

  it("renders six purposeful scenes in reading order", () => {
    const ids = ["product", "workflow", "field-review", "readiness", "trust", "pilot"];
    let cursor = -1;

    for (const id of ids) {
      const next = html.indexOf(`id="${id}"`);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }

    expect(html).not.toContain('id="proof"');
    expect(html).not.toContain('id="roles"');
    expect(html).not.toContain('data-tour-mode="timed-tabs"');
    expect(html).not.toContain('aria-label="Порівняння доказового контуру"');
  });

  it("opens with one focused evidence dossier and working pilot actions", () => {
    const hero = html.slice(html.indexOf('id="product"'), html.indexOf('id="workflow"'));

    expect(hero).toContain('aria-label="Досьє доказу EV-0248"');
    expect(hero).toContain("R-041");
    expect(hero).toContain("EV-0248");
    expect(hero).toContain("Очікує рішення");
    expect(hero).toContain('href="#pilot"');
    expect(html.match(/href="#pilot"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('aria-disabled="true"');
  });

  it("stacks the hero thesis, description and actions as three deliberate rows", () => {
    const hero = html.slice(html.indexOf('id="product"'), html.indexOf('id="workflow"'));

    expect(hero).toContain('data-hero-copy-stack="true"');
    expect(hero).toContain('data-hero-description="true"');
    expect(hero).toContain('data-hero-actions="true"');
    expect(hero).toContain('data-hero-accent="true"');
    expect(hero).toContain(">до доказу,</span>");
    expect(hero).toContain("text-mkt-display-2");
    expect(hero).not.toContain("text-mkt-display-1");
  });

  it("server-renders the evidence route without autoplay", () => {
    const section = html.slice(
      html.indexOf('id="workflow"'),
      html.indexOf('id="field-review"'),
    );

    for (const id of ["R-041", "EV-0248", "DR-0091", "CL-017"]) {
      expect(section).toContain(id);
    }

    expect(section.match(/data-journey-chapter=/g)).toHaveLength(3);
    expect(section).not.toContain("Пауза");
    expect(section).not.toContain('role="tablist"');
  });

  it("shows the field hand-off and online-only boundary", () => {
    const section = html.slice(
      html.indexOf('id="field-review"'),
      html.indexOf('id="readiness"'),
    );

    expect(section).toContain("Без облікового запису");
    expect(section).toContain("активного з’єднання");
    expect(section).toContain("Майстер");
    expect(section).toContain("ПТВ");
    expect(section).toContain("Технагляд");
  });

  it("labels project state as demonstration data", () => {
    expect(html).toContain('aria-label="Стан демонстраційного пакета робіт"');
    expect(html).toContain("Демонстраційні дані");
    expect(html).toContain("Готово");
    expect(html).toContain("На розгляді");
    expect(html).toContain("Заблоковано");
  });

  it("shows provenance and the honest v0.1 product boundary", () => {
    expect(html).toContain('aria-label="Квитанція походження EV-0248"');
    expect(html).toContain("Працює у поточному контурі");
    expect(html).toContain("Не заявляємо");
    expect(html).toContain("Чернетка акта не є підписаним документом");
  });

  it("renders an honest accessible pilot form", () => {
    const pilot = html.slice(html.indexOf('id="pilot"'), html.indexOf("<footer"));

    expect(pilot).toContain("<form");
    expect(pilot).toContain('name="name"');
    expect(pilot).toContain('name="contact"');
    expect(pilot).toContain('required=""');
    expect(pilot).toContain('aria-live="polite"');
    expect(pilot).toContain("поштовий клієнт");
    expect(pilot).not.toContain("Заявку надіслано");
  });

  it("keeps the factual FAQ in the closing scene", () => {
    const pilot = html.slice(html.indexOf('id="pilot"'), html.indexOf("<footer"));

    expect(pilot).toContain("Чи можна фіксувати матеріали без мережі?");
    expect(pilot).toContain("Чернетка акта є готовим підписаним документом?");
    expect(pilot).toContain("<details");
  });

  it("finishes with a factual product-scope footer", () => {
    expect(html).toContain("<footer");
    expect(html).toContain("Частина показаних сценаріїв перебуває у розробці");
  });
});
