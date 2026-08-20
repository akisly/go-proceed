import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

describe("landing narrative density", () => {
  it("moves from the problem directly into the product instead of repeating a manifesto", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).not.toContain("Принцип GoProceed");
    expect(html).not.toContain("Не звіт про те, що роботу нібито виконано");
  });
});
