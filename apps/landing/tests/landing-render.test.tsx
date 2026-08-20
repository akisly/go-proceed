import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

const html = renderToStaticMarkup(<LandingPage />);

describe("landing semantic frame", () => {
  it("publishes one main heading and the first narrative landmarks", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);

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
});
