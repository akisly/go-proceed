import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const OUT_DIR = "/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d";
const OUTPUT_XLSX = `${OUT_DIR}/goproceed_prospecting_101_2026-08-24.xlsx`;
const existing = JSON.parse(await fs.readFile(`${OUT_DIR}/existing_leads_50.json`, "utf8"));
const researched = JSON.parse(await fs.readFile(`${OUT_DIR}/new_candidates_2026-08-24.json`, "utf8"));

const C = {
  navy: "#17324D",
  teal: "#0D9488",
  blue: "#2563EB",
  sky: "#EAF3FF",
  mint: "#E7F7F3",
  amber: "#F59E0B",
  amberLight: "#FFF4D6",
  green: "#15803D",
  greenLight: "#E9F7ED",
  red: "#B91C1C",
  redLight: "#FDECEC",
  gray900: "#1F2937",
  gray700: "#4B5563",
  gray500: "#6B7280",
  gray300: "#D1D5DB",
  gray200: "#E5E7EB",
  gray100: "#F3F4F6",
  white: "#FFFFFF",
};

const SEGMENT = {
  electrical: "Електромонтаж",
  low_voltage: "Слаботочні системи",
  hvac: "HVAC / вентиляція",
  external_networks: "Зовнішні мережі",
  plumbing: "Внутрішня сантехніка",
  solar: "Сонячна енергетика",
  maintenance: "Сервіс / експлуатація",
  fire_safety: "Пожежна безпека",
  mep: "MEP / інженерні системи",
  commercial_fitout_mep: "Генпідряд / MEP fit-out",
  electrical_low_voltage: "Електрика + слаботочка",
  external_networks_electrical: "Зовнішні мережі + електрика",
  fire_hvac: "Пожежні системи + HVAC",
  fire_hvac_electrical: "Пожежні системи + HVAC + електрика",
  fire_security: "Пожежна безпека + охорона",
  fire_systems: "Пожежні системи",
  hvac_internal: "Внутрішній HVAC",
  industrial_electrical: "Промислова електрика",
  industrial_electrical_fire: "Промислова електрика + пожежні системи",
  industrial_electrical_solar: "Промислова електрика + СЕС",
  industrial_hvac_mep: "Промисловий HVAC / MEP",
  industrial_mep: "Промисловий MEP",
  industrial_refrigeration: "Промислове холодопостачання",
  plumbing_hvac_internal: "Внутрішня сантехніка + HVAC",
  security_fire_low_voltage: "Безпека + пожежні + слаботочка",
  solar_electrical: "СЕС + електрика",
};

const legacyCoverage = {
  electrical: 5,
  low_voltage: 4,
  hvac: 4,
  external_networks: 2,
  plumbing: 5,
  solar: 5,
  maintenance: null,
  fire_safety: 3,
  mep: 5,
};

const legacyTrack = {
  electrical: "Зараз — Н.15",
  low_voltage: "Перевірити — Н.15",
  hvac: "Зараз — Н.14",
  external_networks: "Пізніше — вимоги проєкту",
  plumbing: "Зараз — Н.14",
  solar: "Зараз — Н.15",
  maintenance: "Перекваліфікувати",
  fire_safety: "Перевірити — Н.15",
  mep: "Зараз — Н.14 + Н.15",
};

const normalizeTrack = (value = "") => {
  if (value.startsWith("Now — Н.14 + Н.15")) return "Зараз — Н.14 + Н.15";
  if (value.startsWith("Now — Н.14")) return "Зараз — Н.14";
  if (value.startsWith("Now — Н.15")) return "Зараз — Н.15";
  if (value.startsWith("Validate")) return "Перевірити — Н.15";
  if (value.startsWith("Later")) return "Пізніше — вимоги проєкту";
  if (value.startsWith("Requalify")) return "Перекваліфікувати";
  return value || "Перекваліфікувати";
};

const normalizeDomain = (value = "") => value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const seen = new Set();
const leads = [];

for (const [idx, item] of existing.entries()) {
  const domain = normalizeDomain(item.domain);
  if (domain && seen.has(domain)) continue;
  if (domain) seen.add(domain);
  const hasSignals = [item.hidden_work_intensity, item.crew_signal, item.multi_project_scale, item.doc_complexity, item.reachability].every(v => Number.isFinite(v));
  const coverage = hasSignals ? (legacyCoverage[item.trade] ?? null) : null;
  const status = item.origin === "new_research_2026-07-28" ? "Надіслано 28.07 — follow-up" : "Потрібна повторна перевірка";
  leads.push({
    id: item.pool_id || `OLD-${String(idx + 1).padStart(3, "0")}`,
    wave: item.origin === "new_research_2026-07-28" ? "Досліджено 28.07" : "Legacy 28",
    company: item.company_name,
    segment: SEGMENT[item.trade] || item.trade || "Інше",
    accountType: "Спеціалізований підрядник",
    domain,
    track: legacyTrack[item.trade] || "Перекваліфікувати",
    coverage,
    hidden: hasSignals ? item.hidden_work_intensity : null,
    scale: hasSignals ? Math.max(item.crew_signal || 0, item.multi_project_scale || 0) : null,
    docs: hasSignals ? item.doc_complexity : null,
    buyer: hasSignals ? 5 : null,
    reach: hasSignals ? item.reachability : null,
    status,
    nextAction: item.origin === "new_research_2026-07-28"
      ? "Follow-up: показати перегляд без акаунта; попросити 1 анонімізований акт/АВР"
      : "Перевірити сайт, спеціалізацію та чинний проєкт перед контактом",
    targetRole: "Власник / директор; керівник ПТО",
    evidence: item.fit_evidence || "Legacy-запис: публічні докази потрібно оновити перед контактом.",
    trigger: item.hidden_work_trigger || "Уточнити, які приховані роботи закриваються до перевірки замовником.",
    source: item.verification_url || item.registry_url || (domain ? `https://${domain}` : ""),
    edrpou: item.edrpou || "",
    researchStatus: item.research_status || "imported",
    researchDate: item.origin === "new_research_2026-07-28" ? "2026-07-28" : "",
    owner: "Олександр",
    nextTouch: "",
    notes: item.registry_url ? `Реєстр: ${item.registry_url}` : "",
  });
}

for (const [idx, item] of researched.entries()) {
  const domain = normalizeDomain(item.domain);
  if (domain && seen.has(domain)) continue;
  if (domain) seen.add(domain);
  leads.push({
    id: `AUG-${String(idx + 1).padStart(3, "0")}`,
    wave: "Нова хвиля 24.08",
    company: item.company_name,
    segment: SEGMENT[item.segment] || item.segment || "Інше",
    accountType: item.account_type === "general_contractor" ? "Генеральний підрядник" : "Спеціалізований підрядник",
    domain,
    track: normalizeTrack(item.pilot_track),
    coverage: item.product_coverage,
    hidden: item.hidden_intensity,
    scale: item.scale_signal,
    docs: item.docs_signal,
    buyer: item.buyer_fit,
    reach: item.reachability,
    status: "Новий — не контактували",
    nextAction: "Персоналізувати 1-й контакт за доказом; запропонувати перегляд без акаунта",
    targetRole: item.target_role,
    evidence: item.fit_evidence,
    trigger: item.pilot_trigger,
    source: item.source_url,
    edrpou: "",
    researchStatus: item.research_status,
    researchDate: "2026-08-24",
    owner: "Олександр",
    nextTouch: "",
    notes: "",
  });
}

if (leads.length !== 101) {
  throw new Error(`Expected 101 deduplicated accounts, got ${leads.length}`);
}

const score = (l) => [l.coverage, l.hidden, l.scale, l.docs, l.buyer, l.reach].every(Number.isFinite)
  ? l.coverage * 6 + l.hidden * 4 + l.scale * 3 + l.docs * 3 + l.buyer * 3 + l.reach
  : null;
const priority = (l) => {
  const s = score(l);
  if (s == null) return "Legacy";
  if (s >= 84 && l.coverage >= 4 && l.buyer >= 4) return "A";
  if (s >= 70 && l.coverage >= 3) return "B";
  return "C";
};
leads.sort((a, b) => {
  const rank = { A: 0, B: 1, C: 2, Legacy: 3 };
  return (rank[priority(a)] - rank[priority(b)]) || ((score(b) || 0) - (score(a) || 0)) || a.company.localeCompare(b.company, "uk");
});

const reportTracks = ["Зараз — Н.15", "Зараз — Н.14", "Зараз — Н.14 + Н.15", "Перевірити — Н.15", "Пізніше — вимоги проєкту", "Перекваліфікувати"];
const reportData = {
  summary: [{
    total_accounts: leads.length,
    new_accounts: leads.filter(l => l.wave === "Нова хвиля 24.08").length,
    confirmed_sends: 21,
    replies: 0,
    priority_a: leads.filter(l => priority(l) === "A").length,
    priority_b: leads.filter(l => priority(l) === "B").length,
    supported_now: leads.filter(l => l.track.startsWith("Зараз")).length,
    legacy_to_research: leads.filter(l => priority(l) === "Legacy").length,
  }],
  pilot_tracks: reportTracks.map(track => ({
    pilot_track: track,
    account_count: leads.filter(l => l.track === track).length,
    priority_a_count: leads.filter(l => l.track === track && priority(l) === "A").length,
    new_wave_count: leads.filter(l => l.track === track && l.wave === "Нова хвиля 24.08").length,
    share_of_accounts: Number((leads.filter(l => l.track === track).length / leads.length).toFixed(4)),
    supported_now: track.startsWith("Зараз") ? "Так" : "Ні",
  })),
  top_accounts: leads
    .filter(l => score(l) != null)
    .slice(0, 20)
    .map(l => ({
      company: l.company,
      fit_score: score(l),
      priority: priority(l),
      segment: l.segment,
      pilot_track: l.track,
      target_role: l.targetRole,
      domain: l.domain,
      source_url: l.source,
      wave: l.wave,
    })),
};
await fs.writeFile(`${OUT_DIR}/report_data.json`, JSON.stringify(reportData, null, 2), "utf8");

const wb = Workbook.create();
const dashboard = wb.worksheets.add("Dashboard");
const leadSheet = wb.worksheets.add("Leads");
const pilotSheet = wb.worksheets.add("Pilot Offer");
const outreachSheet = wb.worksheets.add("Outreach");
const methodSheet = wb.worksheets.add("Methodology");

const titleBand = (sheet, range, text, subtitle) => {
  sheet.getRange(range).merge();
  const topLeft = range.split(":")[0];
  sheet.getRange(topLeft).values = [[text]];
  sheet.getRange(range).format = {
    fill: C.navy,
    font: { bold: true, color: C.white, size: 20 },
    verticalAlignment: "center",
  };
  const subtitleRange = `${topLeft[0]}2:${range.split(":")[1][0]}2`;
  sheet.getRange(subtitleRange).merge();
  sheet.getRange(`${topLeft[0]}2`).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: C.navy,
    font: { color: "#D7E3EF", size: 10 },
    verticalAlignment: "center",
  };
};

const section = (sheet, range, text) => {
  sheet.getRange(range).merge();
  sheet.getRange(range.split(":")[0]).values = [[text]];
  sheet.getRange(range).format = {
    fill: C.sky,
    font: { bold: true, color: C.navy, size: 12 },
    verticalAlignment: "center",
    borders: { bottom: { style: "thin", color: C.blue } },
  };
};

// Leads
titleBand(leadSheet, "A1:AA1", "GoProceed — база потенційних клієнтів", "101 компанія • нова хвиля перевірена 24.08.2026 • жоден публічний fit не вважається підтвердженим попитом без розмови");
leadSheet.getRange("A3:AA3").merge();
leadSheet.getRange("A3").values = [["Фокус першої хвилі: внутрішня електрика, сантехніка та HVAC — лише там поточна бібліотека вимог може чесно підтримати пілот."]];
leadSheet.getRange("A3:AA3").format = { fill: C.amberLight, font: { color: "#7C4A03", italic: true, size: 10 }, wrapText: true };

const headers = [["Lead ID", "Хвиля", "Компанія", "Сегмент", "Тип акаунта", "Домен", "Пілотний трек", "Покриття продукту", "Інтенсивність прихованих робіт", "Масштаб", "Документація", "Доступ до покупця", "Досяжність", "Fit score", "Пріоритет", "Статус контакту", "Наступна дія", "Цільова роль", "Доказ відповідності", "Тригер пілоту", "Джерело", "ЄДРПОУ", "Статус дослідження", "Дата дослідження", "Власник", "Наступний контакт", "Нотатки"]];
leadSheet.getRange("A4:AA4").values = headers;
leadSheet.getRange("A4:AA4").format = { fill: C.teal, font: { bold: true, color: C.white, size: 9 }, wrapText: true, verticalAlignment: "center" };

const startRow = 5;
const endRow = startRow + leads.length - 1;
const leadValues = leads.map(l => [
  l.id, l.wave, l.company, l.segment, l.accountType, l.domain, l.track,
  l.coverage ?? "", l.hidden ?? "", l.scale ?? "", l.docs ?? "", l.buyer ?? "", l.reach ?? "",
  "", "", l.status, l.nextAction, l.targetRole, l.evidence, l.trigger, l.source, l.edrpou,
  l.researchStatus, l.researchDate, l.owner, l.nextTouch, l.notes,
]);
leadSheet.getRange(`A${startRow}:AA${endRow}`).values = leadValues;
leadSheet.getRange(`N${startRow}`).formulas = [[`=IF(COUNT(H${startRow}:M${startRow})<6,"",H${startRow}*6+I${startRow}*4+J${startRow}*3+K${startRow}*3+L${startRow}*3+M${startRow})`]];
leadSheet.getRange(`N${startRow}:N${endRow}`).fillDown();
leadSheet.getRange(`O${startRow}`).formulas = [[`=IF(N${startRow}="","Legacy",IF(AND(N${startRow}>=84,H${startRow}>=4,L${startRow}>=4),"A",IF(AND(N${startRow}>=70,H${startRow}>=3),"B","C")))`]];
leadSheet.getRange(`O${startRow}:O${endRow}`).fillDown();

const leadTable = leadSheet.tables.add(`A4:AA${endRow}`, true, "GoProceedLeads");
leadTable.style = "TableStyleMedium2";
leadTable.showBandedRows = true;
leadTable.showFilterButton = true;

leadSheet.getRange(`H${startRow}:M${endRow}`).format.numberFormat = "0";
leadSheet.getRange(`N${startRow}:N${endRow}`).format.numberFormat = "0";
leadSheet.getRange(`A${startRow}:AA${endRow}`).format = { font: { color: C.gray900, size: 9 }, verticalAlignment: "top" };
leadSheet.getRange(`Q${startRow}:U${endRow}`).format.wrapText = true;
leadSheet.getRange(`O${startRow}:O${endRow}`).format.horizontalAlignment = "center";
leadSheet.getRange(`N${startRow}:N${endRow}`).conditionalFormats.add("colorScale", { colors: [C.redLight, C.amberLight, C.greenLight], thresholds: ["min", "50%", "max"] });
leadSheet.getRange(`O${startRow}:O${endRow}`).conditionalFormats.add("containsText", { text: "A", format: { fill: C.greenLight, font: { bold: true, color: C.green } } });
leadSheet.getRange(`O${startRow}:O${endRow}`).conditionalFormats.add("containsText", { text: "B", format: { fill: C.amberLight, font: { bold: true, color: "#92400E" } } });
leadSheet.getRange(`O${startRow}:O${endRow}`).conditionalFormats.add("containsText", { text: "C", format: { fill: C.redLight, font: { bold: true, color: C.red } } });
leadSheet.getRange(`P${startRow}:P305`).dataValidation = { rule: { type: "list", values: ["Новий — не контактували", "Потрібна повторна перевірка", "Надіслано 28.07 — follow-up", "Відповів", "Кваліфікаційна розмова", "Пілот запропоновано", "Пілот погоджено", "Не зараз", "Не fit"] } };
leadSheet.getRange(`Z${startRow}:Z305`).format.numberFormat = "dd.mm.yyyy";
leadSheet.getRange("A1:AA2").format.rowHeight = 28;
leadSheet.getRange("A3:AA4").format.rowHeight = 34;
leadSheet.freezePanes.freezeRows(4);
leadSheet.freezePanes.freezeColumns(3);
leadSheet.showGridlines = false;

const widths = {
  A: 11, B: 18, C: 28, D: 22, E: 21, F: 23, G: 26,
  H: 11, I: 13, J: 9, K: 11, L: 12, M: 10, N: 10, O: 9,
  P: 24, Q: 36, R: 28, S: 48, T: 46, U: 38, V: 12, W: 23,
  X: 13, Y: 14, Z: 14, AA: 32,
};
for (const [col, width] of Object.entries(widths)) leadSheet.getRange(`${col}:${col}`).format.columnWidth = width;

// Dashboard
titleBand(dashboard, "A1:N1", "GoProceed — prospecting cockpit", "Знімок 24.08.2026 • 101 акаунт • мета: перевести публічний fit у розмови, артефакти та безкоштовні design-partner пілоти");
section(dashboard, "A4:F4", "Ключові показники воронки");
dashboard.getRange("A5:F7").values = [
  ["Усього акаунтів", "Нова хвиля 24.08", "Підтверджені відправки", "Пріоритет A", "Пріоритет B", "Підтриманий трек зараз"],
  ["", "", "", "", "", ""],
  ["База для системної кваліфікації", "Офіційні сайти / портфоліо", "21 відправка; 0 відповідей за даними журналу", "Найкращий fit + покриття", "Добрий fit / перевірити", "Н.14, Н.15 або обидва"],
];
dashboard.getRange("A6").formulas = [[`=COUNTA(Leads!$C$5:$C$305)`]];
dashboard.getRange("B6").formulas = [[`=COUNTIF(Leads!$B$5:$B$305,"Нова хвиля 24.08")`]];
dashboard.getRange("C6").values = [[21]];
dashboard.getRange("D6").formulas = [[`=COUNTIF(Leads!$O$5:$O$305,"A")`]];
dashboard.getRange("E6").formulas = [[`=COUNTIF(Leads!$O$5:$O$305,"B")`]];
dashboard.getRange("F6").formulas = [[`=SUM(B12:B14)`]];
dashboard.getRange("A5:F5").format = { fill: C.gray100, font: { bold: true, color: C.gray700, size: 9 }, wrapText: true, horizontalAlignment: "center" };
dashboard.getRange("A6:F6").format = { fill: C.white, font: { bold: true, color: C.navy, size: 22 }, horizontalAlignment: "center", borders: { bottom: { style: "thin", color: C.gray300 } } };
dashboard.getRange("A7:F7").format = { font: { color: C.gray500, size: 8 }, wrapText: true, horizontalAlignment: "center", verticalAlignment: "top" };

section(dashboard, "A10:F10", "Портфель за пілотним треком");
dashboard.getRange("A11:C11").values = [["Пілотний трек", "Акаунти", "Пріоритет A"]];
dashboard.getRange("A11:C11").format = { fill: C.teal, font: { bold: true, color: C.white }, horizontalAlignment: "center" };
const tracks = ["Зараз — Н.15", "Зараз — Н.14", "Зараз — Н.14 + Н.15", "Перевірити — Н.15", "Пізніше — вимоги проєкту", "Перекваліфікувати"];
dashboard.getRange("A12:A17").values = tracks.map(v => [v]);
for (let row = 12; row <= 17; row++) {
  dashboard.getRange(`B${row}`).formulas = [[`=COUNTIF(Leads!$G$5:$G$305,A${row})`]];
  dashboard.getRange(`C${row}`).formulas = [[`=COUNTIFS(Leads!$G$5:$G$305,A${row},Leads!$O$5:$O$305,"A")`]];
}
dashboard.getRange("A12:C17").format = { font: { size: 10, color: C.gray900 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
dashboard.getRange("B12:C17").format.horizontalAlignment = "center";

const chart = dashboard.charts.add("bar", dashboard.getRange("A11:B17"));
chart.title = "Де продукт може зайти в пілот зараз";
chart.titleTextStyle.fontSize = 13;
chart.hasLegend = false;
chart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
chart.yAxis = { numberFormatCode: "0", title: { text: "Кількість акаунтів" } };
chart.setPosition("H4", "N18");

section(dashboard, "A20:N20", "Рекомендована послідовність дій");
dashboard.getRange("A21:N25").values = [
  ["1", "Сьогодні", "21 follow-up", "Надіслати наявним адресатам персональне посилання без реєстрації. Одна дія: прийняти / повернути."],
  ["2", "Дні 1–3", "10 нових A", "Персоналізувати перший рядок за публічним доказом. Не продавати платформу — попросити оцінити конкретний review-flow."],
  ["3", "Дні 3–7", "Артефакт", "Після будь-якої реакції попросити 1 анонімізований акт/АВР або фото прихованої роботи та провести 20-хвилинне інтерв’ю."],
  ["4", "Дні 7–10", "Пілот", "Запропонувати 30–45 днів без ліцензійної плати на одному проєкті з названим спонсором, ПТО, майстром і рев’юером."],
  ["5", "Щоп’ятниці", "Рішення", "Продовжувати сегмент лише якщо з’являються відповіді, артефакти та доступ до реального проєкту. Інакше змінювати повідомлення або сегмент."],
];
dashboard.getRange("A21:A25").format = { fill: C.navy, font: { bold: true, color: C.white, size: 14 }, horizontalAlignment: "center", verticalAlignment: "center" };
dashboard.getRange("B21:C25").format = { fill: C.gray100, font: { bold: true, color: C.navy }, verticalAlignment: "center" };
dashboard.getRange("D21:N25").merge(true);
dashboard.getRange("D21:N25").format = { wrapText: true, verticalAlignment: "center", font: { color: C.gray900, size: 10 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
dashboard.getRange("A21:N25").format.rowHeight = 36;
dashboard.getRange("A:A").format.columnWidth = 16;
dashboard.getRange("B:B").format.columnWidth = 18;
dashboard.getRange("C:C").format.columnWidth = 22;
dashboard.getRange("D:F").format.columnWidth = 16;
dashboard.getRange("G:G").format.columnWidth = 3;
dashboard.getRange("H:N").format.columnWidth = 14;
dashboard.freezePanes.freezeRows(2);
dashboard.showGridlines = false;

// Pilot Offer
titleBand(pilotSheet, "A1:H1", "Безкоштовний design-partner пілот", "30–45 днів • один реальний проєкт • без ліцензійної плати • чесне обмеження поточного покриття Н.14 / Н.15");
section(pilotSheet, "A4:H4", "Пропозиція");
pilotSheet.getRange("A5:H7").merge();
pilotSheet.getRange("A5").values = [["GoProceed допомагає спеціалізованій бригаді підготувати виконану роботу до приймання: зібрати фото, прив’язати їх до вимог і передати рев’юеру одну захищену сторінку без створення акаунта. Пілот безкоштовний, бо нам потрібен спільний доказ цінності на реальному процесі, а не “тест системи” без відповідальності."]];
pilotSheet.getRange("A5:H7").format = { fill: C.mint, font: { color: C.navy, size: 12 }, wrapText: true, verticalAlignment: "center" };

section(pilotSheet, "A9:D9", "Вхідні умови");
section(pilotSheet, "E9:H9", "Що входить");
pilotSheet.getRange("A10:D15").merge(true);
pilotSheet.getRange("E10:H15").merge(true);
pilotSheet.getRange("A10:A15").values = [
  ["• Один активний проєкт з внутрішніми сантехнічними / HVAC або електромонтажними роботами."],
  ["• Названий спонсор з боку компанії та відповідальні ПТО, майстер і рев’юер."],
  ["• Один реальний анонімізований акт/АВР або приклад пакета доказів до старту."],
  ["• 30 хв щотижня на розбір фактичного процесу."],
  ["• Дозвіл фіксувати агреговані метрики без розкриття комерційної інформації."],
  ["• Рішення go / no-go наприкінці 30–45 днів."],
];
pilotSheet.getRange("E10:E15").values = [
  ["• Налаштування одного пілотного процесу та короткий onboarding."],
  ["• Персональні посилання рев’юеру без пароля / реєстрації."],
  ["• Щотижневий розбір вузьких місць і ручна підтримка засновника."],
  ["• Базові метрики до/після та фінальний висновок про цінність."],
  ["• Пріоритетне виправлення блокуючих дефектів у межах погодженого сценарію."],
  ["• Без ліцензійної плати; інтеграції та кастомна розробка не обіцяються."],
];
pilotSheet.getRange("A10:H15").format = { wrapText: true, verticalAlignment: "top", font: { color: C.gray900, size: 10 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
pilotSheet.getRange("A10:H15").format.rowHeight = 32;

section(pilotSheet, "A17:D17", "Метрики успіху");
section(pilotSheet, "E17:H17", "Стоп-умови");
pilotSheet.getRange("A18:D22").merge(true);
pilotSheet.getRange("E18:H22").merge(true);
pilotSheet.getRange("A18:A22").values = [
  ["1. Частка робіт, прийнятих з першого перегляду."],
  ["2. Час від готовності бригади до рішення рев’юера."],
  ["3. Частка доказів, зафіксованих до закриття робіт."],
  ["4. Кількість повернень через неповні фото / документи."],
  ["5. Активність майстра, ПТО і рев’юера щотижня."],
];
pilotSheet.getRange("E18:E22").values = [
  ["• Немає активного проєкту або названого спонсора."],
  ["• Команда не надає жодного реального артефакту."],
  ["• Потрібні роботи поза поточним покриттям і немає вимог проєкту."],
  ["• Пілот перетворюється на необмежену кастомну розробку."],
  ["• Дві послідовні сесії без участі ключових ролей."],
];
pilotSheet.getRange("A18:H22").format = { wrapText: true, verticalAlignment: "top", font: { color: C.gray900, size: 10 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
pilotSheet.getRange("A18:H22").format.rowHeight = 31;

section(pilotSheet, "A24:H24", "Що не обіцяємо");
pilotSheet.getRange("A25:H27").merge();
pilotSheet.getRange("A25").values = [["Захищене посилання не є КЕП або юридичним підписом. Бібліотека вимог поки містить лише 12 пунктів ДБН А.3.1-5:2016 для внутрішніх санітарно-технічних та електромонтажних робіт. Імпорт реальних файлів замовника ще не перевірений на клієнтських даних. Усе інше — предмет discovery, а не гарантія пілоту."]];
pilotSheet.getRange("A25:H27").format = { fill: C.redLight, font: { color: C.red, size: 10 }, wrapText: true, verticalAlignment: "center" };
pilotSheet.getRange("A:H").format.columnWidth = 18;
pilotSheet.freezePanes.freezeRows(2);
pilotSheet.showGridlines = false;

// Outreach
titleBand(outreachSheet, "A1:H1", "Outreach-пакет", "Короткі повідомлення українською • продаємо наступний крок, а не платформу • персоналізація тільки за публічним доказом");
const messages = [
  {
    title: "1. Follow-up для 21 вже надісланого контакту",
    body: "Доброго дня! Надсилаю коротке продовження — ми спростили перевірку виконаної роботи до однієї сторінки без реєстрації: фото, джерело вимоги та рішення «прийняти / повернути». Ось персональне посилання: [персональне посилання]. Чи схоже це на те, як ваш замовник або технагляд приймає [релевантна робота]? Достатньо відповісти одним реченням.",
  },
  {
    title: "2. Перший контакт новому акаунту A",
    body: "Доброго дня! Побачив, що [компанія] виконує [конкретний публічний доказ: тип робіт / кілька об’єктів / власні бригади]. Ми тестуємо GoProceed для моменту перед закриттям прихованої роботи: бригада збирає докази, а ПТО або замовник переглядає одну сторінку без акаунта. Можу надіслати 40-секундний приклад саме для [релевантна робота]?",
  },
  {
    title: "3. Запит одного реального артефакту після відповіді",
    body: "Щоб не вигадувати процес за вас: чи можете показати один анонімізований акт/АВР або перелік фото, який ви реально готуєте перед прийманням? Комерційні дані можна закрити. За 20 хвилин розберемо, де виникає повернення або очікування, і скажемо чесно, чи GoProceed тут доречний.",
  },
  {
    title: "4. Пропозиція безкоштовного пілоту після кваліфікації",
    body: "Пропоную design-partner пілот на одному активному проєкті на 30–45 днів без ліцензійної плати. З вашого боку потрібні спонсор, ПТО, майстер, рев’юер, один реальний анонімізований пакет і 30 хв щотижня. Разом виміряємо приймання з першого разу, час до рішення та повернення через неповні докази. Якщо цінності немає — зупиняємося без зобов’язань.",
  },
];
let row = 4;
for (const msg of messages) {
  section(outreachSheet, `A${row}:H${row}`, msg.title);
  outreachSheet.getRange(`A${row + 1}:H${row + 4}`).merge();
  outreachSheet.getRange(`A${row + 1}`).values = [[msg.body]];
  outreachSheet.getRange(`A${row + 1}:H${row + 4}`).format = { fill: C.white, font: { color: C.gray900, size: 11 }, wrapText: true, verticalAlignment: "center", borders: { bottom: { style: "thin", color: C.gray300 } } };
  row += 6;
}
section(outreachSheet, `A${row}:H${row}`, "Правила персоналізації");
outreachSheet.getRange(`A${row + 1}:H${row + 3}`).merge();
outreachSheet.getRange(`A${row + 1}`).values = [["Перший рядок має містити один перевірений факт із колонки «Доказ відповідності». Не згадувати вигадані болі, економію або “автоматизацію всього”. Перша CTA — дозвіл на короткий приклад; друга — один артефакт; пілот пропонується лише після доступу до реального процесу."]];
outreachSheet.getRange(`A${row + 1}:H${row + 3}`).format = { fill: C.amberLight, font: { color: "#7C4A03", size: 10 }, wrapText: true, verticalAlignment: "center" };
outreachSheet.getRange("A:H").format.columnWidth = 18;
outreachSheet.freezePanes.freezeRows(2);
outreachSheet.showGridlines = false;

// Methodology
titleBand(methodSheet, "A1:H1", "Методологія та межі доказів", "Скоринг визначає порядок дослідження й контакту — не доводить намір купувати");
section(methodSheet, "A4:D4", "Fit score: 0–100");
methodSheet.getRange("A5:D11").values = [
  ["Фактор", "Шкала", "Вага", "Що означає"],
  ["Покриття продукту", "0–5", "×6", "Наскільки роботи збігаються з поточними Н.14 / Н.15"],
  ["Приховані роботи", "0–5", "×4", "Наскільки докази критичні до закриття стель, стін, траншей"],
  ["Масштаб", "0–5", "×3", "Бригади, портфель проєктів, географія, власні ресурси"],
  ["Документація", "0–5", "×3", "Проєктування, ПТО, випробування, акти, введення в експлуатацію"],
  ["Доступ до покупця", "0–5", "×3", "Спеціалізований підрядник ближче до власника / ПТО, ніж великий генпідрядник"],
  ["Досяжність", "0–5", "×1", "Публічний сайт, форма, телефон або зрозумілий маршрут до ролі"],
];
methodSheet.getRange("A5:D5").format = { fill: C.teal, font: { bold: true, color: C.white } };
methodSheet.getRange("A6:D11").format = { wrapText: true, verticalAlignment: "top", borders: { bottom: { style: "thin", color: C.gray200 } } };

section(methodSheet, "E4:H4", "Пріоритети");
methodSheet.getRange("E5:H9").values = [
  ["Клас", "Правило", "Дія", "Сенс"],
  ["A", "Score ≥84; покриття ≥4; buyer fit ≥4", "Контакт у першій хвилі", "Найкраще поєднання fit і чесного покриття"],
  ["B", "Score ≥70; покриття ≥3", "Друга хвиля / уточнити сценарій", "Fit добрий, але потрібна перевірка"],
  ["C", "Нижче порогів", "Не витрачати founder-time зараз", "Слабке покриття або партнерський канал"],
  ["Legacy", "Немає повного набору факторів", "Повторно дослідити", "Старий запис не можна змішувати з перевіреними"],
];
methodSheet.getRange("E5:H5").format = { fill: C.teal, font: { bold: true, color: C.white } };
methodSheet.getRange("E6:H9").format = { wrapText: true, verticalAlignment: "top", borders: { bottom: { style: "thin", color: C.gray200 } } };

section(methodSheet, "A13:H13", "Джерела й обмеження");
methodSheet.getRange("A14:H19").merge(true);
methodSheet.getRange("A14:A19").values = [
  ["• 50 записів імпортовано з aktflow_ukraine_leads_50_demo_outreach_2026-07-28.xlsx; 28 legacy-позицій не мають достатньої публічної перевірки."],
  ["• 51 нова компанія перевірена 24.08.2026 за офіційними сайтами / портфоліо; URL збережено в кожному рядку."],
  ["• 21 відправка підтверджена попереднім журналом; 0 відповідей, інтерв’ю, названих проєктів або пілотних зобов’язань станом на 30.07.2026."],
  ["• Поточна бібліотека: 12 вимог ДБН А.3.1-5:2016 — 5 для Н.14 і 7 для Н.15. Інші роботи не можна обіцяти без вимог конкретного проєкту."],
  ["• Публічна відповідність ≠ підтверджений біль, готовність до пілоту або платоспроможність. Наступний рівень доказу — відповідь, артефакт, інтерв’ю, активний проєкт."],
  ["• Персональні контакти не збиралися; база працює на рівні компаній, ролей і публічних джерел."],
];
methodSheet.getRange("A14:H19").format = { wrapText: true, verticalAlignment: "top", font: { color: C.gray900, size: 10 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
methodSheet.getRange("A14:H19").format.rowHeight = 34;
methodSheet.getRange("A:A").format.columnWidth = 24;
methodSheet.getRange("B:B").format.columnWidth = 12;
methodSheet.getRange("C:C").format.columnWidth = 12;
methodSheet.getRange("D:D").format.columnWidth = 38;
methodSheet.getRange("E:E").format.columnWidth = 14;
methodSheet.getRange("F:F").format.columnWidth = 30;
methodSheet.getRange("G:G").format.columnWidth = 28;
methodSheet.getRange("H:H").format.columnWidth = 35;
methodSheet.freezePanes.freezeRows(2);
methodSheet.showGridlines = false;

// Global row heights and wrapping for title bands.
for (const sheet of wb.worksheets.items) {
  sheet.getRange("1:1").format.rowHeight = 34;
  sheet.getRange("2:2").format.rowHeight = 22;
}

// Structural and formula validation before export.
const overview = await wb.inspect({ kind: "workbook,sheet,table", maxChars: 10000, tableMaxRows: 8, tableMaxCols: 12 });
await fs.writeFile(`${OUT_DIR}/workbook_structure.ndjson`, overview.ndjson, "utf8");
const keyRanges = {};
for (const [sheetName, range] of [["Dashboard", "A1:N25"], ["Leads", `A1:AA${endRow}`], ["Pilot Offer", "A1:H27"], ["Outreach", "A1:H30"], ["Methodology", "A1:H19"]]) {
  const inspection = await wb.inspect({ kind: "table", sheetId: sheetName, range, include: "values,formulas", maxChars: 24000, tableMaxRows: sheetName === "Leads" ? 112 : 40, tableMaxCols: 30, tableMaxCellChars: 180 });
  keyRanges[sheetName] = inspection.ndjson;
}
await fs.writeFile(`${OUT_DIR}/workbook_key_ranges.ndjson`, Object.entries(keyRanges).map(([k,v]) => `--- ${k} ---\n${v}`).join("\n"), "utf8");

const errorScan = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "formula error scan" });
await fs.writeFile(`${OUT_DIR}/workbook_formula_errors.ndjson`, errorScan.ndjson, "utf8");

for (const [sheetName, fileName] of [["Dashboard", "preview_dashboard.png"], ["Leads", "preview_leads.png"], ["Pilot Offer", "preview_pilot_offer.png"], ["Outreach", "preview_outreach.png"], ["Methodology", "preview_methodology.png"]]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: sheetName === "Leads" ? 0.7 : 1, format: "png" });
  await fs.writeFile(`${OUT_DIR}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(OUTPUT_XLSX);
console.log(JSON.stringify({ output: OUTPUT_XLSX, accountCount: leads.length, formulaErrorScan: errorScan.ndjson }));
