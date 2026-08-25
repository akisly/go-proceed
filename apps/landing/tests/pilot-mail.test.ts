import { describe, expect, it } from "vitest";
import { buildPilotMailto, buildPilotMessage } from "../content/pilot-mail";

const fields = {
  name: "Олена",
  company: "Монтаж Плюс",
  contact: "olena@example.com",
  role: "Керівник ПТВ",
  context: "Один пакет прихованих електромонтажних робіт",
};

describe("pilot email hand-off", () => {
  it("builds a readable Ukrainian message", () => {
    const message = buildPilotMessage(fields);

    expect(message).toContain("Ім’я: Олена");
    expect(message).toContain("Компанія: Монтаж Плюс");
    expect(message).toContain("Контакт: olena@example.com");
    expect(message).toContain("Один пакет прихованих електромонтажних робіт");
  });

  it("addresses and encodes the temporary mailto action", () => {
    const mailto = decodeURIComponent(buildPilotMailto(fields));

    expect(mailto).toContain("mailto:akisliy2306@gmail.com");
    expect(mailto).toContain("Пілот GoProceed — нова заявка");
    expect(mailto).toContain("Один пакет прихованих електромонтажних робіт");
  });

  it("renders omitted optional fields honestly", () => {
    expect(buildPilotMessage({ ...fields, company: "", role: "", context: "" }))
      .toContain("Компанія: Не вказано");
  });
});
