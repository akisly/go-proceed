import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";
import { EvidenceRail } from "../components/visuals/evidence-rail";

const html = renderToStaticMarkup(<LandingPage />);
const decisionRail = renderToStaticMarkup(<EvidenceRail active="decision" />);

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

  it("centers the wider hero thesis, description and actions as one visual group", () => {
    const hero = html.slice(html.indexOf('id="product"'), html.indexOf('id="workflow"'));

    expect(hero).toContain('data-hero-copy-stack="true"');
    expect(hero).toContain('data-hero-alignment="center"');
    expect(hero).toContain('data-hero-description="true"');
    expect(hero).toContain('data-hero-actions="true"');
    expect(hero).toContain('data-marker-accent="true"');
    expect(hero).toContain(">до доказу,</span>");
    expect(hero).toContain("items-center");
    expect(hero).toContain("text-center");
    expect(hero).toContain("max-w-[40ch]");
    expect(hero).not.toContain("max-w-[30ch]");
    expect(hero).toContain("max-w-[68ch]");
    expect(hero).toContain("justify-center");
    expect(hero).toContain("text-mkt-display-2");
    expect(hero).not.toContain("text-mkt-display-1");
  });

  it("marks the thesis phrase in every primary section heading", () => {
    expect(html.match(/data-marker-accent="true"/g)).toHaveLength(6);

    for (const phrase of [
      "до доказу,",
      "без втрати контексту",
      "переданий контекст",
      "причинами",
      "походження",
      "одному пакеті робіт",
    ]) {
      expect(html).toContain(`data-marker-accent="true">${phrase}</span>`);
    }

    expect(html.match(/data-section-heading-width="wide"/g)).toHaveLength(5);
  });

  it("lets the blueprint field span the full hero before it dissolves", () => {
    const hero = html.slice(html.indexOf('id="product"'), html.indexOf('id="workflow"'));

    expect(hero).toContain('data-hero-grid-flow="true"');
    expect(hero).toContain("landing-hero-field absolute inset-0");
    expect(hero).not.toContain("h-[68%]");
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

  it("drives the evidence journey with Motion instead of CSS transitions", () => {
    const section = html.slice(
      html.indexOf('id="workflow"'),
      html.indexOf('id="field-review"'),
    );

    expect(section).toContain('data-evidence-motion-engine="vocabulary"');
    expect(section).toContain('data-evidence-stage-transition="slide-swap"');
    expect(section.match(/data-evidence-scroll-trigger="stagger"/g) ?? []).toHaveLength(3);
    expect(section.match(/data-evidence-rail-motion="vocabulary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(section).not.toContain("transition-[opacity,transform]");
    expect(section).not.toContain("transition-colors duration-slow");
  });

  it("keeps one evidence point per journey chapter", () => {
    expect(decisionRail.match(/data-evidence-point="true"/g) ?? []).toHaveLength(3);
    expect(decisionRail).toContain("R-041");
    expect(decisionRail).toContain("EV-0248");
    expect(decisionRail).toContain("DR-0091");
    expect(decisionRail).toContain("CL-017");
  });

  it("gives every journey chapter heading a wider reading measure", () => {
    const section = html.slice(
      html.indexOf('id="workflow"'),
      html.indexOf('id="field-review"'),
    );

    expect(section.match(/<h3 class="display mt-6 max-w-\[22ch\]/g) ?? []).toHaveLength(3);
  });

  it("keeps evidence connectors behind their points", () => {
    expect(
      decisionRail.match(/data-evidence-connector="true" class="[^"]*\bz-0\b/g) ?? [],
    ).toHaveLength(2);
    expect(
      decisionRail.match(/data-evidence-point-marker="true" class="[^"]*\bz-10\b/g) ?? [],
    ).toHaveLength(3);
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

  it("shows readiness as one check with three independent outcomes", () => {
    const section = html.slice(
      html.indexOf('id="readiness"'),
      html.indexOf('id="trust"'),
    );
    const workflow = section.slice(
      section.indexOf("<svg"),
      section.indexOf("</svg>") + "</svg>".length,
    );

    expect(workflow).toContain('data-readiness-workflow="true"');
    expect(workflow).toContain('data-readiness-motion-engine="motion"');
    expect(workflow).toContain('data-readiness-cycle="infinite"');
    expect(workflow).toContain("Пакет робіт");
    expect(workflow).toContain("Перевірка повноти");
    expect(workflow.match(/data-readiness-trunk="true"/g) ?? []).toHaveLength(1);
    expect(workflow.match(/data-readiness-branch=/g) ?? []).toHaveLength(3);
    expect(workflow.match(/data-readiness-endpoint=/g) ?? []).toHaveLength(3);
    expect(workflow.match(/data-readiness-signal=/g) ?? []).toHaveLength(4);
    expect(workflow.match(/data-readiness-traveler=/g) ?? []).toHaveLength(4);
    expect(workflow.match(/data-readiness-pulse=/g) ?? []).toHaveLength(6);
    expect(workflow).not.toContain("<animateMotion");
    expect(workflow).not.toContain("<animate ");
    expect(workflow).toContain('data-readiness-signal="trunk" class="stroke-ink-muted"');
    expect(workflow).toContain('data-readiness-traveler="trunk" class="fill-ink-muted stroke-surface"');

    for (const [id, lineTone, dotTone, pulseTone] of [
      ["ready", "status-ready-fg", "status-ready-fg", "action-signal"],
      ["review", "status-review-fg", "status-review-fg", "status-review"],
      ["blocked", "status-blocked-fg", "status-blocked-fg", "status-blocked"],
    ] as const) {
      expect(workflow).toContain(`data-readiness-signal="${id}" class="stroke-${lineTone}"`);
      expect(workflow).toContain(`data-readiness-traveler="${id}" class="fill-${dotTone} stroke-surface"`);
      expect(workflow).toContain(`data-readiness-pulse="${id}-primary"`);
      expect(workflow).toContain(`data-readiness-pulse="${id}-secondary"`);
      expect(workflow.match(new RegExp(`data-readiness-pulse="${id}-(?:primary|secondary)"[^>]*stroke-${pulseTone}`, "g")) ?? []).toHaveLength(2);
    }

    for (const detail of [
      "усі блокуючі вимоги виконані",
      "рішення ще не зафіксоване",
      "є невиконана блокуюча вимога",
    ]) {
      expect(workflow).toContain(detail);
    }
  });

  it("renders the readiness diagram without reaching for Motion", () => {
    const src = readFileSync(
      join(import.meta.dirname, "..", "components/visuals/readiness-workflow.tsx"), "utf8");
    expect(src).not.toContain("motion/react");
    expect(src).toContain("InViewProgress");
    expect(src).toContain("--gp-progress");
  });

  it("shows provenance and the honest v0.1 product boundary", () => {
    expect(html).toContain('aria-label="Квитанція походження EV-0248"');
    expect(html).toContain("Квитанція доказу · EV-0248");
    expect(html).toContain("verified-stamp-uk.png");
    expect(html).not.toContain("Evidence receipt");
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

describe("the evidence rail reaches Motion through the vocabulary", () => {
  it("keeps its markers and connectors in the rendered output", () => {
    expect(decisionRail).toContain('data-evidence-rail="true"');
    expect(decisionRail.match(/data-evidence-point="true"/g)).toHaveLength(3);
    expect(decisionRail.match(/data-evidence-connector="true"/g)).toHaveLength(2);
  });
});
