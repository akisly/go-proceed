export const PILOT_EMAIL = "akisliy2306@gmail.com";

export type PilotMailFields = {
  name: string;
  company: string;
  contact: string;
  role: string;
  context: string;
};

export function buildPilotMessage(fields: PilotMailFields): string {
  return [
    "Нова заявка на пілот GoProceed",
    "",
    `Ім’я: ${fields.name}`,
    `Компанія: ${fields.company || "Не вказано"}`,
    `Контакт: ${fields.contact}`,
    `Роль: ${fields.role || "Не вказано"}`,
    `Контекст: ${fields.context || "Не вказано"}`,
  ].join("\n");
}

export function buildPilotMailto(fields: PilotMailFields): string {
  const subject = encodeURIComponent("Пілот GoProceed — нова заявка");
  const body = encodeURIComponent(buildPilotMessage(fields));
  return `mailto:${PILOT_EMAIL}?subject=${subject}&body=${body}`;
}
