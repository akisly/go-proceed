import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

describe("landing narrative density", () => {
  it("removes the old section catalogue and repeated framing", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    for (const removed of [
      "Контур продукту · 01—04",
      "Один факт у чотирьох робочих поверхнях",
      "Кожен учасник бачить свою роботу з тими самими фактами",
      "Різниця не у сховищі файлів",
      "Перед початком пілоту",
    ]) {
      expect(html).not.toContain(removed);
    }

    expect(html.match(/id="pilot"/g)).toHaveLength(1);
  });
});
