import { describe, it, expect } from "vitest";
import { fieldErrorsFrom, unmappedFrom } from "./problem-field-errors";

describe("fieldErrorsFrom", () => {
  it("groups messages by their path", () => {
    const problem = { fieldErrors: [
      { path: "workItemId", message: "Оберіть рядок." },
      { path: "plannedQuantity", message: "Не число." },
    ] };
    expect(fieldErrorsFrom(problem)).toEqual({
      workItemId: [{ message: "Оберіть рядок." }],
      plannedQuantity: [{ message: "Не число." }],
    });
  });

  it("keeps both messages when one path fails twice", () => {
    const problem = { fieldErrors: [
      { path: "plannedQuantity", message: "Не число." },
      { path: "plannedQuantity", message: "Забагато знаків." },
    ] };
    expect(fieldErrorsFrom(problem).plannedQuantity).toHaveLength(2);
  });

  it("returns an empty map for a problem with no fieldErrors, and never throws", () => {
    expect(fieldErrorsFrom({})).toEqual({});
    expect(fieldErrorsFrom(null)).toEqual({});
    expect(fieldErrorsFrom("not a problem")).toEqual({});
  });
});

describe("unmappedFrom", () => {
  it("reports messages whose path is not a field on this form, so nothing vanishes", () => {
    const problem = { fieldErrors: [
      { path: "workItemId", message: "Оберіть рядок." },
      { path: "somethingElse", message: "Невідоме поле." },
    ] };
    expect(unmappedFrom(problem, ["workItemId", "plannedQuantity"])).toEqual(["Невідоме поле."]);
  });
});
