import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const OUT_DIR = "/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d";
const WAVE = Number(process.env.PROSPECTING_WAVE || 7);
const VERSION = Number(process.env.PROSPECTING_VERSION || WAVE + 1);
const DATE_TAG = process.env.PROSPECTING_DATE_TAG || "2026-08-24";
const AS_OF_LABEL = DATE_TAG.split("-").reverse().join(".");
const PROSPECTS_FILE = process.env.PROSPECTS_FILE || `prospects_unified_v${VERSION}_${DATE_TAG}.json`;
const prospects = JSON.parse(await fs.readFile(`${OUT_DIR}/${PROSPECTS_FILE}`, "utf8"));
const wave7Summary = JSON.parse(await fs.readFile(`${OUT_DIR}/prozorro_wave${WAVE}_summary_final_${DATE_TAG}.json`, "utf8"));
const wave7Normalization = JSON.parse(await fs.readFile(`${OUT_DIR}/wave${WAVE}_normalization_summary_${DATE_TAG}.json`, "utf8"));
const OUTPUT_XLSX = process.env.PROSPECTING_OUTPUT_XLSX || `${OUT_DIR}/goproceed_prospecting_${prospects.length}_${DATE_TAG}.xlsx`;
const BASE_COUNT = Number(wave7Normalization.base_total || prospects.length - wave7Normalization.unique_new_supplier_leads);
const BROWSER_VERIFIED_COUNT = Number(process.env.BROWSER_VERIFIED_COUNT || 9);
const leadsSheetName = `Leads ${prospects.length}`;
const segmentCount = new Set(prospects.map(x => x.segment)).size;
const tenderSignals = prospects
  .filter(x => (x.tender_count ?? 0) > 0)
  .sort((a, b) => (b.intent_score ?? 0) - (a.intent_score ?? 0) || (b.live_project_count ?? 0) - (a.live_project_count ?? 0) || a.company_name.localeCompare(b.company_name, "uk"));

const C = {
  navy: "#17324D", teal: "#0D9488", blue: "#2563EB", sky: "#EAF3FF", mint: "#E7F7F3",
  amber: "#F59E0B", amberLight: "#FFF4D6", green: "#15803D", greenLight: "#E9F7ED",
  red: "#B91C1C", redLight: "#FDECEC", purple: "#7C3AED", purpleLight: "#F1EAFE",
  gray900: "#1F2937", gray700: "#4B5563", gray500: "#6B7280", gray300: "#D1D5DB",
  gray200: "#E5E7EB", gray100: "#F3F4F6", white: "#FFFFFF",
};

const wb = Workbook.create();
const dash = wb.worksheets.add("Dashboard");
const leads = wb.worksheets.add(leadsSheetName);
const tenderSheet = wb.worksheets.add("Tender Signals");
const verticals = wb.worksheets.add("Vertical Map");
const pilot = wb.worksheets.add("Pilot Offer");
const outreach = wb.worksheets.add("Outreach");
const method = wb.worksheets.add("Methodology");

function titleBand(sheet, lastCol, title, subtitle) {
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${lastCol}1`).format = { fill: C.navy, font: { bold: true, color: C.white, size: 20 }, verticalAlignment: "center" };
  sheet.getRange(`A2:${lastCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${lastCol}2`).format = { fill: C.navy, font: { color: "#D7E3EF", size: 10 }, verticalAlignment: "center" };
  sheet.getRange("1:1").format.rowHeight = 34;
  sheet.getRange("2:2").format.rowHeight = 22;
}
function section(sheet, range, text) {
  sheet.getRange(range).merge();
  sheet.getRange(range.split(":")[0]).values = [[text]];
  sheet.getRange(range).format = { fill: C.sky, font: { bold: true, color: C.navy, size: 12 }, verticalAlignment: "center", borders: { bottom: { style: "thin", color: C.blue } } };
}

// Leads sheet
titleBand(leads, "AO", "GoProceed — перевірена база потенційних клієнтів", `${prospects.length} компаній • +${wave7Normalization.unique_new_supplier_leads} у Wave ${WAVE} • ${tenderSignals.length} з офіційним проєктним слідом • ${segmentCount} сегментних міток`);
leads.getRange("A3:AO3").merge();
leads.getRange("A3").values = [["P1/P2 — fit для пілоту. D1/D2 — discovery fit. I1/I2 — найсильніший тендерний намір. Публічна перемога підтверджує активність, але не інтерес до GoProceed."]];
leads.getRange("A3:AO3").format = { fill: C.amberLight, font: { color: "#7C4A03", italic: true, size: 10 }, wrapText: true };

const headers = [[
  "Lead ID", "Хвиля", "Компанія", "Сегмент", "Lane", "Пріоритет", "Домен", "Маршрут",
  "Покриття вимог", "Workflow fit", "Приховані роботи", "Масштаб", "Документація", "Buyer fit", "Досяжність",
  "Pilot-now score", "Expansion score", "Впевненість доказу", "Статус перевірки", "Доступ до джерела",
  "Статус контакту", "Наступна дія", "Цільова роль", "Доказ відповідності", "Тригер",
  "Джерело", "ЄДРПОУ", "Дата дослідження", "Власник", "Наступний контакт", "Нотатки",
  "Intent score", "Intent priority", "Тендерів", "Поточних проєктів", "Сума перемог, грн", "Останній тендер",
  "Дата перемоги", "Строк виконання", "Тендерні сегменти", "Статус сайту",
]];
leads.getRange("A4:AO4").values = headers;
leads.getRange("A4:AO4").format = { fill: C.teal, font: { bold: true, color: C.white, size: 9 }, wrapText: true, verticalAlignment: "center" };

const start = 5;
const end = start + prospects.length - 1;
leads.getRange(`A${start}:AO${end}`).values = prospects.map(x => [
  x.lead_id, x.wave, x.company_name, x.segment, x.lane, x.priority, x.domain, x.route,
  x.current_requirement_coverage ?? "", x.workflow_fit ?? "", x.hidden_intensity ?? "", x.scale_signal ?? "", x.docs_signal ?? "", x.buyer_fit ?? "", x.reachability ?? "",
  "", "", x.evidence_confidence, x.verification_status, x.source_access,
  x.contact_status, x.next_action, x.target_role, x.fit_evidence, x.pilot_trigger,
  x.source_url, x.edrpou, x.research_date, x.owner, "", "",
  x.intent_score ?? 0, x.intent_priority ?? "—", x.tender_count ?? 0, x.live_project_count ?? 0, x.total_award_value_uah ?? 0,
  x.latest_tender_url ?? "", x.latest_award_date ? new Date(x.latest_award_date) : "", x.latest_delivery_end_date ? new Date(x.latest_delivery_end_date) : "",
  x.tender_segments ?? "", x.website_status ?? x.verification_status ?? "",
]);
leads.getRange(`P${start}`).formulas = [[`=IF(COUNT(I${start}:O${start})<7,"",I${start}*8+J${start}*3+K${start}*2+L${start}*2+M${start}*2+N${start}*2+O${start})`]];
leads.getRange(`P${start}:P${end}`).fillDown();
leads.getRange(`Q${start}`).formulas = [[`=IF(COUNT(J${start}:O${start})<6,"",J${start}*5+K${start}*4+M${start}*4+L${start}*3+N${start}*2+O${start}*2)`]];
leads.getRange(`Q${start}:Q${end}`).fillDown();
const leadsTable = leads.tables.add(`A4:AO${end}`, true, `ProspectsV${VERSION}`);
leadsTable.style = "TableStyleMedium2";
leadsTable.showBandedRows = true;
leadsTable.showFilterButton = true;
leads.getRange(`A${start}:AO${end}`).format = { font: { color: C.gray900, size: 9 }, verticalAlignment: "top" };
leads.getRange(`V${start}:Z${end}`).format.wrapText = true;
leads.getRange(`I${start}:Q${end}`).format.numberFormat = "0";
leads.getRange(`F${start}:F${end}`).format.horizontalAlignment = "center";
leads.getRange(`F${start}:F${end}`).conditionalFormats.add("beginsWith", { text: "P", format: { fill: C.greenLight, font: { bold: true, color: C.green } } });
leads.getRange(`F${start}:F${end}`).conditionalFormats.add("beginsWith", { text: "D", format: { fill: C.purpleLight, font: { bold: true, color: C.purple } } });
leads.getRange(`F${start}:F${end}`).conditionalFormats.add("containsText", { text: "L", format: { fill: C.amberLight, font: { bold: true, color: "#92400E" } } });
leads.getRange(`P${start}:Q${end}`).conditionalFormats.add("colorScale", { colors: [C.redLight, C.amberLight, C.greenLight], thresholds: ["min", "50%", "max"] });
leads.getRange(`R${start}:R${end}`).conditionalFormats.add("containsText", { text: "high", format: { fill: C.greenLight, font: { bold: true, color: C.green } } });
leads.getRange(`R${start}:R${end}`).conditionalFormats.add("containsText", { text: "low", format: { fill: C.redLight, font: { bold: true, color: C.red } } });
leads.getRange(`AF${start}:AF${end}`).conditionalFormats.add("colorScale", { colors: [C.gray100, C.amberLight, C.greenLight], thresholds: ["min", "50%", "max"] });
leads.getRange(`AG${start}:AG${end}`).conditionalFormats.add("containsText", { text: "I1", format: { fill: C.greenLight, font: { bold: true, color: C.green } } });
leads.getRange(`AG${start}:AG${end}`).conditionalFormats.add("containsText", { text: "I2", format: { fill: C.amberLight, font: { bold: true, color: "#92400E" } } });
leads.getRange(`AJ${start}:AJ${end}`).format.numberFormat = "#,##0";
leads.getRange(`AL${start}:AM${end}`).format.numberFormat = "yyyy-mm-dd";
leads.getRange(`AN${start}:AO${end}`).format.wrapText = true;
leads.getRange(`U${start}:U${end}`).dataValidation = { rule: { type: "list", values: ["Новий — не контактували", "Потрібна повторна перевірка", "Надіслано 28.07 — follow-up", "Відповів", "Кваліфікаційна розмова", "Артефакт отримано", "Пілот запропоновано", "Пілот погоджено", "Не зараз", "Не fit"] } };
leads.getRange(`AD${start}:AD${end}`).format.numberFormat = "dd.mm.yyyy";
leads.getRange("A3:AO4").format.rowHeight = 34;
leads.freezePanes.freezeRows(4);
leads.freezePanes.freezeColumns(3);
leads.showGridlines = false;

const widths = { A:11,B:22,C:28,D:27,E:20,F:10,G:23,H:38,I:11,J:10,K:12,L:9,M:11,N:9,O:10,P:11,Q:11,R:12,S:30,T:32,U:24,V:38,W:30,X:48,Y:48,Z:38,AA:12,AB:13,AC:14,AD:14,AE:32,AF:11,AG:12,AH:9,AI:12,AJ:18,AK:38,AL:14,AM:14,AN:28,AO:26 };
for (const [col, width] of Object.entries(widths)) leads.getRange(`${col}:${col}`).format.columnWidth = width;

// Tender signals sheet
titleBand(tenderSheet, "N", `Tender-proven shortlist — ${tenderSignals.length} компаній`, `${wave7Normalization.unique_new_supplier_leads} нових у Wave ${WAVE} після дедуплікації • ${wave7Normalization.live_project_signal_count} зі строком виконання не раніше ${AS_OF_LABEL} • офіційні дані Prozorro`);
tenderSheet.getRange("A3:N3").merge();
tenderSheet.getRange("A3").values = [["Сортування: Intent score → кількість поточних проєктів. Сума перемог використовується лише для пріоритизації: у спільних закупівлях одна сума може бути приписана кільком постачальникам."]];
tenderSheet.getRange("A3:N3").format = { fill: C.amberLight, font: { color: "#7C4A03", italic: true, size: 10 }, wrapText: true };
tenderSheet.getRange("A4:N4").values = [["Ранг", "Компанія", "ЄДРПОУ", "Сегмент", "Lane", "Intent", "Score", "Тендерів", "Поточних", "Сума перемог, грн", "Дата перемоги", "Строк виконання", "Останній тендер", "URL тендера"]];
tenderSheet.getRange("A4:N4").format = { fill: C.teal, font: { bold: true, color: C.white, size: 9 }, wrapText: true, verticalAlignment: "center" };
const tenderStart = 5;
const tenderEnd = tenderStart + tenderSignals.length - 1;
tenderSheet.getRange(`A${tenderStart}:N${tenderEnd}`).values = tenderSignals.map((x, i) => [
  i + 1, x.company_name, x.edrpou, x.segment, x.lane, x.intent_priority, x.intent_score, x.tender_count, x.live_project_count,
  x.total_award_value_uah, x.latest_award_date ? new Date(x.latest_award_date) : "", x.latest_delivery_end_date ? new Date(x.latest_delivery_end_date) : "",
  x.latest_tender_title, x.latest_tender_url,
]);
const tenderTable = tenderSheet.tables.add(`A4:N${tenderEnd}`, true, `TenderSignalsV${VERSION}`);
tenderTable.style = "TableStyleMedium2";
tenderTable.showBandedRows = true;
tenderSheet.getRange(`A${tenderStart}:N${tenderEnd}`).format = { font: { color: C.gray900, size: 9 }, verticalAlignment: "top" };
tenderSheet.getRange(`J${tenderStart}:J${tenderEnd}`).format.numberFormat = "#,##0";
tenderSheet.getRange(`K${tenderStart}:L${tenderEnd}`).format.numberFormat = "yyyy-mm-dd";
tenderSheet.getRange(`M${tenderStart}:N${tenderEnd}`).format.wrapText = true;
tenderSheet.getRange(`F${tenderStart}:F${tenderEnd}`).conditionalFormats.add("containsText", { text: "I1", format: { fill: C.greenLight, font: { bold: true, color: C.green } } });
tenderSheet.getRange(`F${tenderStart}:F${tenderEnd}`).conditionalFormats.add("containsText", { text: "I2", format: { fill: C.amberLight, font: { bold: true, color: "#92400E" } } });
tenderSheet.getRange(`G${tenderStart}:G${tenderEnd}`).conditionalFormats.add("colorScale", { colors: [C.gray100, C.amberLight, C.greenLight], thresholds: ["min", "50%", "max"] });
const tenderWidths = { A:8,B:34,C:13,D:28,E:20,F:10,G:9,H:9,I:11,J:18,K:14,L:14,M:56,N:40 };
for (const [col, width] of Object.entries(tenderWidths)) tenderSheet.getRange(`${col}:${col}`).format.columnWidth = width;
tenderSheet.freezePanes.freezeRows(4);
tenderSheet.freezePanes.freezeColumns(2);
tenderSheet.showGridlines = false;

// Dashboard
titleBand(dash, "N", "GoProceed — market expansion cockpit", `${prospects.length} унікальних компаній • +${wave7Normalization.unique_new_supplier_leads} у Wave ${WAVE} без дублювання • знімок ${AS_OF_LABEL}`);
section(dash, "A4:G4", "Ключові показники");
dash.getRange("A5:G7").values = [
  ["Усього", "Тендерний сигнал", "Поточний строк", "High confidence", "Pilot now", "Expansion", "Intent I1"],
  ["", "", "", "", "", "", ""],
  ["Унікальні компанії", "Офіційна перемога Prozorro", `Строк виконання ≥ ${AS_OF_LABEL}`, "Офіційний або індексований доказ", "Поточне Н.14/Н.15", "Сильний workflow, потрібні вимоги", "Найсильніший проектний намір"],
];
dash.getRange("A6").formulas = [[`=COUNTA('${leadsSheetName}'!$C$5:$C$${end})`]];
dash.getRange("B6").formulas = [[`=COUNTIF('${leadsSheetName}'!$AH$5:$AH$${end},">0")`]];
dash.getRange("C6").formulas = [[`=COUNTIF('${leadsSheetName}'!$AI$5:$AI$${end},">0")`]];
dash.getRange("D6").formulas = [[`=COUNTIF('${leadsSheetName}'!$R$5:$R$${end},"high")`]];
dash.getRange("E6").formulas = [[`=COUNTIF('${leadsSheetName}'!$E$5:$E$${end},"Pilot now")`]];
dash.getRange("F6").formulas = [[`=COUNTIF('${leadsSheetName}'!$E$5:$E$${end},"Expansion discovery")`]];
dash.getRange("G6").formulas = [[`=COUNTIF('${leadsSheetName}'!$AG$5:$AG$${end},"I1")`]];
dash.getRange("A5:G5").format = { fill: C.gray100, font: { bold: true, color: C.gray700, size: 9 }, wrapText: true, horizontalAlignment: "center" };
dash.getRange("A6:G6").format = { font: { bold: true, color: C.navy, size: 22 }, horizontalAlignment: "center", borders: { bottom: { style: "thin", color: C.gray300 } } };
dash.getRange("A7:G7").format = { font: { color: C.gray500, size: 8 }, wrapText: true, horizontalAlignment: "center" };

section(dash, "A10:F10", "База за маршрутом");
dash.getRange("A11:D11").values = [["Lane", "Акаунти", "Top priority", "High confidence"]];
dash.getRange("A11:D11").format = { fill: C.teal, font: { bold: true, color: C.white }, horizontalAlignment: "center" };
const lanes = ["Pilot now", "Expansion discovery", "Later / requirements", "Requalify"];
dash.getRange("A12:A15").values = lanes.map(x => [x]);
for (let row = 12; row <= 15; row++) {
  dash.getRange(`B${row}`).formulas = [[`=COUNTIF('${leadsSheetName}'!$E$5:$E$${end},A${row})`]];
  dash.getRange(`D${row}`).formulas = [[`=COUNTIFS('${leadsSheetName}'!$E$5:$E$${end},A${row},'${leadsSheetName}'!$R$5:$R$${end},"high")`]];
}
dash.getRange("C12").formulas = [[`=COUNTIF('${leadsSheetName}'!$F$5:$F$${end},"P1")`]];
dash.getRange("C13").formulas = [[`=COUNTIF('${leadsSheetName}'!$F$5:$F$${end},"D1")`]];
dash.getRange("C14:C15").values = [[0],[0]];
dash.getRange("A12:D15").format = { borders: { bottom: { style: "thin", color: C.gray200 } }, font: { size: 10, color: C.gray900 } };
dash.getRange("B12:D15").format.horizontalAlignment = "center";

const laneChart = dash.charts.add("bar", dash.getRange("A11:B15"));
laneChart.title = "Розмір кожного маршруту";
laneChart.titleTextStyle.fontSize = 13;
laneChart.hasLegend = false;
laneChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
laneChart.yAxis = { numberFormatCode: "0", title: { text: "Кількість компаній" } };
laneChart.setPosition("H4", "N17");

section(dash, "A19:N19", "Що змінилося після тендерного розширення");
dash.getRange("A20:N24").values = [
  ["1", "Розмір бази", `База зросла з ${BASE_COUNT} до ${prospects.length} компаній: додано ${wave7Normalization.unique_new_supplier_leads} унікальних підрядників Wave ${WAVE} після перевірки ${wave7Summary.unique_new_tenders_scanned} нових тендерів, відсікання ${wave7Summary.excluded_service_or_supply_records} записів суміжних послуг і дедуплікації.`],
  ["2", "Сильніший тригер", `У ${tenderSignals.length} компаній є офіційний тендерний слід; у ${wave7Normalization.live_project_signal_count} опублікований строк виконання не раніше ${AS_OF_LABEL}. Це конкретний привід для персоналізованого контакту, а не підтвердження активного майданчика.`],
  ["3", "Більше галузей", `Wave ${WAVE} окремо охопила дорожню розмітку й огородження, залізничні та трамвайні колії, укриття, внутрішнє оздоблення, фасади, вікна/двері, доступність, газові й водні мережі, спортивні майданчики та реставрацію.`],
  ["4", "Два офери", "Pilot now — 30–45 днів на Н.14/Н.15. Expansion — 2-тижневий workflow discovery на одному реальному пакеті без обіцянки готового нормативного покриття."],
  ["5", "Правило довіри", "Тендерна перемога доводить проєктну активність, але не біль і не інтерес до GoProceed. Наступний доказ: відповідь → артефакт → інтерв’ю → спонсор і активний проєкт."],
];
dash.getRange("A20:A24").format = { fill: C.navy, font: { bold: true, color: C.white, size: 14 }, horizontalAlignment: "center", verticalAlignment: "center" };
dash.getRange("B20:B24").format = { fill: C.gray100, font: { bold: true, color: C.navy }, verticalAlignment: "center" };
dash.getRange("C20:N24").merge(true);
dash.getRange("C20:N24").format = { wrapText: true, verticalAlignment: "center", font: { color: C.gray900, size: 10 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
dash.getRange("A20:N24").format.rowHeight = 38;
dash.getRange("A:A").format.columnWidth = 15;
dash.getRange("B:B").format.columnWidth = 22;
dash.getRange("C:G").format.columnWidth = 14;
dash.getRange("H:N").format.columnWidth = 14;
dash.freezePanes.freezeRows(2);
dash.showGridlines = false;

// Vertical map
titleBand(verticals, "J", `Карта ${segmentCount} сегментних міток`, "Розширено за межі санітарно-технічних та електромонтажних робіт; споріднені назви збережені як у джерелах для подальшої нормалізації");
verticals.getRange("A4:J4").values = [["Вертикаль", "Компаній", "Покриття зараз", "Workflow fit", "Прихованість", "Документація", "Маршрут", "Що закривається", "Перший артефакт", "Початковий CTA"]];
verticals.getRange("A4:J4").format = { fill: C.teal, font: { bold: true, color: C.white, size: 9 }, wrapText: true };
const baseMapRows = [
  ["Покрівлі та гідроізоляція", 0, 0, 5, 5, 4, "Discovery", "Покрівельний пиріг, шви, примикання", "Фото вузлів + акт прихованих робіт", "Покажіть 1 типовий пакет до гарантії"],
  ["Вентильовані фасади та скління", 0, 0, 5, 5, 4, "Discovery", "Анкери, утеплення, мембрани, відсічки", "Фото кронштейнів / утеплення", "Як технагляд приймає до облицювання?"],
  ["Промислові підлоги та бетон", 0, 0, 5, 4, 4, "Discovery", "Основа, армування, шви, вологість", "Карта заливки + протоколи основи", "Покажіть 1 карту контролю перед заливкою"],
  ["Палі, фундаменти та підсилення", 0, 0, 5, 5, 5, "Discovery", "Армування, глибина, бетонування", "Журнал паль / випробування", "Де збирається доказ по кожній палі?"],
  ["Металоконструкції та промисловий монтаж", 0, 1, 4, 3, 5, "Discovery", "Зварні/болтові вузли, покриття", "Журнал зварювання + акти", "Який пакет повертає технагляд?"],
  ["Пасивний вогнезахист", 0, 1, 5, 5, 5, "Discovery", "Товщина, проходки, підготовка", "Акт обробки + заміри", "Покажіть пакет перед закриттям"],
  ["Промислова теплоізоляція", 0, 1, 5, 5, 4, "Discovery", "Труби й ізоляція під кожухом", "Фото поверхні, товщини, швів", "Як доводите шар до монтажу кожуха?"],
  ["СКС, BMS та слаботочна інтеграція", 0, 3, 5, 5, 5, "Discovery / partial Н.15", "Траси, маркування, порт-тести", "Протокол Fluke / ПНР", "Покажіть пакет здачі одного поверху"],
  ["Чисті приміщення та стерильні зони", 0, 3, 5, 5, 5, "Discovery / partial Н.14/15", "Герметичність, HEPA, автоматика", "Кваліфікаційний протокол", "Розберімо один validation-пакет"],
  ["Ліфти, ескалатори та підйомники", 0, 1, 4, 4, 5, "Discovery", "Закладні, напрямні, електрика", "Акти монтажу + випробування", "Де губиться доказ до реєстрації?"],
  ["Басейни, водні комплекси та SPA", 0, 3, 5, 5, 5, "Discovery / partial Н.14/15", "Закладні, труби, гідроізоляція", "Фото закладних + гідротест", "Покажіть пакет до оздоблення чаші"],
  ["Дорожні роботи та благоустрій", 0, 0, 5, 5, 5, "Discovery", "Основа, шари, ущільнення", "Лабораторний протокол + фото", "Як здається шар до наступного?"],
  ["ГНБ / безтраншейні мережі", 0, 1, 5, 5, 5, "Discovery", "Пілотна свердловина, розширення, протягування", "Журнал буріння + геоприв'язка", "Покажіть пакет здачі одного переходу"],
  ["Водоочищення та очисні споруди", 0, 1, 5, 5, 5, "Discovery", "Трубопроводи, резервуари, мембрани, ПНР", "Акти + гідротести + ПНР", "Розберімо один пакет здачі споруди"],
  ["Промислова автоматизація / SCADA", 0, 1, 5, 4, 5, "Discovery", "Шафи, кабелі, loop-check, FAT/SAT", "Loop-check + протокол ПНР", "Покажіть handoff монтаж → ПНР"],
  ["Промисловий холод", 0, 1, 5, 5, 5, "Discovery", "Трубопроводи, ізоляція, вакуумування, ПНР", "Протоколи герметичності + ПНР", "Покажіть пакет запуску однієї системи"],
  ["Пожежогасіння", 0, 1, 5, 5, 5, "Discovery", "Труби, проходки, адресація, випробування", "Акти + протоколи випробувань", "Покажіть пакет до введення"],
  ["Резервне живлення", 0, 2, 5, 4, 5, "Discovery / partial Н.15", "АВР, кабелі, заземлення, тест навантаження", "Протокол АВР / ДБЖ", "Розберімо один тест під навантаженням"],
  ["Безпека / СКУД / CCTV", 0, 2, 5, 4, 5, "Discovery / partial Н.15", "Траси, адресація, налаштування", "Виконавча схема + acceptance-test", "Покажіть пакет здачі одного об'єкта"],
  ["ВОЛЗ / телеком-мережі", 0, 1, 5, 5, 5, "Discovery", "Траси, муфти, зварювання волокон", "Рефлектограми + виконавча схема", "Покажіть пакет здачі однієї ділянки"],
  ["Газопостачання / котельні", 0, 1, 5, 5, 5, "Discovery", "Зварні стики, автоматика, випробування", "Журнал стиків + ПНР", "Розберімо пакет введення котельні"],
  ["Медичні гази", 0, 1, 5, 5, 5, "Discovery", "Пайка, чистота, маркування, валідація", "Протокол чистоти + випробування", "Покажіть один validation-пакет"],
  ["Стиснене повітря / компресорні", 0, 1, 5, 5, 4, "Discovery", "Пневмомережі, дренаж, фільтрація", "Герметичність + ПНР", "Покажіть пакет запуску компресорної"],
  ["Технологічні трубопроводи", 0, 1, 5, 5, 5, "Discovery", "Стики, НК, опори, гідровипробування", "Журнал стиків + НК + гідротест", "Розберімо один ізометричний пакет"],
  ["Мости та інфраструктура", 0, 1, 5, 5, 5, "Discovery", "Армування, бетон, гідроізоляція, лабораторія", "Акт прихованих + лабораторний протокол", "Покажіть пакет одного конструктиву"],
  ["Підсилення та ремонт бетону", 0, 1, 5, 5, 5, "Discovery", "Підготовка, ін'єкції, армування, торкрет", "Фото етапів + акт + контроль міцності", "Покажіть пакет до захисного шару"],
];
const average = (rows, key) => Math.round(rows.reduce((sum, x) => sum + Number(x[key] ?? 0), 0) / Math.max(rows.length, 1));
const segmentNames = [...new Set(prospects.map(x => x.segment))].sort((a, b) => a.localeCompare(b, "uk"));
const mapRows = segmentNames.map(segmentName => {
  const rows = prospects.filter(x => x.segment === segmentName);
  const known = baseMapRows.find(r => r[0] === segmentName);
  const pilotCount = rows.filter(x => x.lane === "Pilot now").length;
  const route = pilotCount > rows.length / 2 ? "Pilot now" : "Expansion discovery";
  return [
    segmentName,
    rows.length,
    average(rows, "current_requirement_coverage"),
    average(rows, "workflow_fit"),
    average(rows, "hidden_intensity"),
    average(rows, "docs_signal"),
    route,
    known?.[7] ?? "Фото, акти, протоколи та виконавча документація до закриття або ПНР",
    known?.[8] ?? "Один анонімізований пакет приймання з поточного проєкту",
    known?.[9] ?? "Покажіть один пакет: перевіримо fit і запропонуємо вузький безкоштовний пілот",
  ];
});
const mapStart = 5;
const mapEnd = mapStart + mapRows.length - 1;
verticals.getRange(`A${mapStart}:J${mapEnd}`).values = mapRows;
verticals.getRange(`A${mapStart}:J${mapEnd}`).format = { wrapText: true, verticalAlignment: "top", font: { color: C.gray900, size: 9 }, borders: { bottom: { style: "thin", color: C.gray200 } } };
verticals.getRange(`B${mapStart}:F${mapEnd}`).format.horizontalAlignment = "center";
verticals.getRange(`A${mapStart}:A${mapEnd}`).format.font = { bold: true, color: C.navy };
verticals.getRange(`A${mapStart}:J${mapEnd}`).format.rowHeight = 42;
const vWidths = {A:30,B:10,C:12,D:10,E:10,F:12,G:24,H:38,I:38,J:38};
for (const [col,w] of Object.entries(vWidths)) verticals.getRange(`${col}:${col}`).format.columnWidth = w;
verticals.freezePanes.freezeRows(4);
verticals.showGridlines = false;

// Pilot offer
titleBand(pilot, "J", "Два безкоштовні офери замість одного", "Пілот доводить цінність на поточному покритті; discovery sprint перевіряє нову вертикаль без фальшивої обіцянки готового продукту");
section(pilot, "A4:E4", "A. Design-partner пілот — Pilot now");
section(pilot, "F4:J4", "B. Workflow discovery sprint — Expansion");
pilot.getRange("A5:E7").merge();
pilot.getRange("F5:J7").merge();
pilot.getRange("A5").values = [["30–45 днів на одному активному проєкті без ліцензійної плати. Підходить для внутрішніх сантехнічних/HVAC та електромонтажних робіт у межах погодженого Н.14/Н.15 subset."]];
pilot.getRange("F5").values = [["2 тижні без ліцензійної плати: розібрати один реальний пакет приймання, вимоги проєкту та ролі. Результат — карта workflow, verdict fit/no-fit і вузький scope майбутнього пілоту."]];
pilot.getRange("A5:E7").format = { fill: C.greenLight, font: { color: C.navy, size: 11 }, wrapText: true, verticalAlignment: "center" };
pilot.getRange("F5:J7").format = { fill: C.purpleLight, font: { color: "#4C1D95", size: 11 }, wrapText: true, verticalAlignment: "center" };

section(pilot, "A9:E9", "Умови входу");
section(pilot, "F9:J9", "Умови входу");
pilot.getRange("A10:E15").merge(true);
pilot.getRange("F10:J15").merge(true);
pilot.getRange("A10:A15").values = [
  ["• Один активний проєкт і названий спонсор."], ["• ПТО, майстер і рев’юер."], ["• Один анонімізований акт/АВР або пакет фото."],
  ["• 30 хв щотижня."], ["• Метрики до/після."], ["• Go/no-go на 30–45 день."],
];
pilot.getRange("F10:F15").values = [
  ["• Один реальний пакет приймання з нової вертикалі."], ["• Вимоги / специфікація конкретного проєкту."], ["• 60 хв з виконробом або ПТО."],
  ["• 30 хв з рев’юером / технаглядом."], ["• Дозвіл змоделювати 1 вузький workflow."], ["• Жодної обіцянки інтеграції чи повного покриття."],
];
pilot.getRange("A10:J15").format = { wrapText: true, verticalAlignment: "top", borders: { bottom: { style: "thin", color: C.gray200 } }, font: { size: 10, color: C.gray900 } };
pilot.getRange("A10:J15").format.rowHeight = 31;

section(pilot, "A17:E17", "Метрики пілоту");
section(pilot, "F17:J17", "Результат discovery sprint");
pilot.getRange("A18:E22").merge(true);
pilot.getRange("F18:J22").merge(true);
pilot.getRange("A18:A22").values = [["1. Приймання з першого перегляду."],["2. Час до рішення рев’юера."],["3. Докази до закриття робіт."],["4. Повернення через неповний пакет."],["5. Щотижнева активність ролей."]];
pilot.getRange("F18:F22").values = [["1. Підтверджений або спростований workflow pain."],["2. Список вимог і джерел істини."],["3. Карта ролей і handoff."],["4. Один прототип пакета приймання."],["5. Рішення: build / partner / stop."]];
pilot.getRange("A18:J22").format = { wrapText: true, verticalAlignment: "top", borders: { bottom: { style: "thin", color: C.gray200 } }, font: { size: 10, color: C.gray900 } };
pilot.getRange("A18:J22").format.rowHeight = 31;
section(pilot, "A24:J24", "Незмінні межі");
pilot.getRange("A25:J27").merge();
pilot.getRange("A25").values = [["Захищене посилання не є КЕП. Поточна бібліотека містить 12 вимог: 5 для Н.14 і 7 для Н.15. У нових вертикалях GoProceed не має готового нормативного покриття: пілот можливий лише після отримання вимог конкретного проєкту та погодження вузького scope."]];
pilot.getRange("A25:J27").format = { fill: C.redLight, font: { color: C.red, size: 10 }, wrapText: true, verticalAlignment: "center" };
pilot.getRange("A:J").format.columnWidth = 16;
pilot.freezePanes.freezeRows(2);
pilot.showGridlines = false;

// Outreach
titleBand(outreach, "J", "Outreach за сигналом і маршрутом", "I1/I2: почати з конкретного тендера. P-ліди: показати готовий review-flow. D-ліди: попросити артефакт до продуктової обіцянки");
const messages = [
  ["1. I1/I2 — контакт від конкретного тендера", "Доброго дня! Побачив, що [компанія] перемогла у [UA-номер / назва робіт], строк виконання — до [дата]. GoProceed допомагає зібрати фото, акти й протоколи до закриття робіт та віддати ПТО/замовнику одну сторінку на перевірку. Пропоную безкоштовно розібрати один ваш пакет приймання; якщо fit підтвердиться — запустимо вузький пілот на цьому проєкті без ліцензійної плати. Хто у вас відповідає за ПТО або виконавчу документацію?"],
  ["2. P1/P2 — перший контакт для пілоту зараз", "Доброго дня! Побачив, що [компанія] виконує [публічний доказ]. Ми тестуємо GoProceed у момент перед закриттям [електромонтажної / внутрішньої санітарно-технічної роботи]: бригада збирає докази, а ПТО або замовник переглядає одну сторінку без акаунта. Можу надіслати 40-секундний приклад саме для [робота]?"],
  ["3. D1/D2 — перший контакт для нової вертикалі", "Доброго дня! Побачив у [компанія] роботи з [водоочищення / ВОЛЗ / котелень / SCADA / іншого]. Перевіряємо гіпотезу: найбільше повернень виникає там, де доказ треба зібрати до закриття наступним етапом або до ПНР. Не хочу продавати готову систему без вашого процесу. Чи можете показати один анонімізований пакет приймання або перелік фото/протоколів? За 20 хв скажемо чесно, чи є тут fit."],
  ["4. Follow-up для 21 попередньої відправки", "Доброго дня! Ми спростили перевірку до однієї сторінки без реєстрації: фото, джерело вимоги та «прийняти / повернути». Ось персональне посилання: [посилання]. Чи схоже це на ваш реальний handoff між бригадою, ПТО і замовником? Достатньо відповісти одним реченням."],
  ["5. Безкоштовний пілот після кваліфікації", "Пропоную design-partner пілот на одному активному проєкті на 30–45 днів без ліцензійної плати. Потрібні спонсор, ПТО, майстер, рев’юер, один реальний пакет і 30 хв щотижня. Разом виміряємо приймання з першого разу, час до рішення та повернення через неповні докази."],
];
let orow = 4;
for (const [heading, body] of messages) {
  section(outreach, `A${orow}:J${orow}`, heading);
  outreach.getRange(`A${orow + 1}:J${orow + 4}`).merge();
  outreach.getRange(`A${orow + 1}`).values = [[body]];
  outreach.getRange(`A${orow + 1}:J${orow + 4}`).format = { wrapText: true, verticalAlignment: "center", font: { size: 11, color: C.gray900 }, borders: { bottom: { style: "thin", color: C.gray300 } } };
  orow += 6;
}
section(outreach, `A${orow}:J${orow}`, "Правило, яке захищає довіру");
outreach.getRange(`A${orow + 1}:J${orow + 3}`).merge();
outreach.getRange(`A${orow + 1}`).values = [["Для Lane = Expansion discovery не використовувати формулювання «у нас уже є рішення для вашої галузі». Чесне формулювання: «ми бачимо схожий workflow і хочемо перевірити його на одному реальному артефакті». Пілот пропонується лише після отримання вимог проєкту."]];
outreach.getRange(`A${orow + 1}:J${orow + 3}`).format = { fill: C.amberLight, font: { color: "#7C4A03", size: 10 }, wrapText: true, verticalAlignment: "center" };
outreach.getRange("A:J").format.columnWidth = 16;
outreach.freezePanes.freezeRows(2);
outreach.showGridlines = false;

// Methodology
titleBand(method, "J", `Методологія v${VERSION}`, `${prospects.length} унікальних компаній; product-fit і tender-intent оцінюються окремо, щоб проєктна активність не маскувала слабке покриття продукту`);
section(method, "A4:E4", "Pilot-now score — 0–100");
section(method, "F4:J4", "Expansion score — 0–100");
method.getRange("A5:E12").values = [
  ["Фактор","Шкала","Вага","Навіщо","Обмеження"],
  ["Покриття вимог","0–5","×8","Головний guardrail готового пілоту","Поза Н.14/Н.15 майже завжди 0–3"],
  ["Workflow fit","0–5","×3","Повторюваний handoff доказів","Не доводить біль"],
  ["Приховані роботи","0–5","×2","Доказ зникає після наступного етапу","Гіпотеза з публічних даних"],
  ["Масштаб","0–5","×2","Бригади, об’єкти, географія","Може бути маркетингом"],
  ["Документація","0–5","×2","Акти, тести, ПТО, введення","Потрібен реальний артефакт"],
  ["Buyer fit","0–5","×2","Близькість до власника / ПТО","Генпідрядник часто канал"],
  ["Досяжність","0–5","×1","Чи є робочий маршрут до компанії","Не містить персональних контактів"],
];
method.getRange("F5:J12").values = [
  ["Фактор","Шкала","Вага","Навіщо","Обмеження"],
  ["Workflow fit","0–5","×5","Наскільки процес схожий на core job","Потрібне інтерв’ю"],
  ["Приховані роботи","0–5","×4","Ціна пізнього доказу","Потрібен кейс повернення"],
  ["Документація","0–5","×4","Щільність приймального пакета","Потрібен зразок"],
  ["Масштаб","0–5","×3","Повторюваність між об’єктами","Не дорівнює WTP"],
  ["Buyer fit","0–5","×2","Доступ до decision-maker","Не перевірено"],
  ["Досяжність","0–5","×2","Можливість почати discovery","Сайт може бути недоступний"],
  ["Покриття вимог","—","не входить","Окремо, щоб не вбити нові ніші","Все одно gate перед пілотом"],
];
method.getRange("A5:J5").format = { fill: C.teal, font: { bold: true, color: C.white, size: 9 } };
method.getRange("A6:J12").format = { wrapText: true, verticalAlignment: "top", borders: { bottom: { style: "thin", color: C.gray200 } }, font: { size: 9, color: C.gray900 } };
section(method, "A14:J14", "Перевірка джерел і трактування статусів");
method.getRange("A15:J22").merge(true);
method.getRange("A15:A22").values = [
  ["• 51 попередній лід переперевірено: 46 офіційних сторінок підтвердились прямим запитом; 5 розібрані вручну через браузер і пошуковий індекс."],
  [`• ${BROWSER_VERIFIED_COUNT} сильних нових компаній перевірено у Browser: офіційні корпоративні/державні сторінки та реєстрові профілі; персональні контакти не збиралися.`],
  [`• Поточна база v${VERSION} поєднує попередні хвилі та Wave ${WAVE}; ${wave7Normalization.high_confidence_count} компанії мають high-confidence evidence, ${tenderSignals.length} — офіційний тендерний сигнал.`],
  [`• Wave ${WAVE}: ${wave7Summary.search_configs} конфігурацій і ${wave7Summary.search_pages} сторінок; ${wave7Summary.matching_search_hits} збігів, ${wave7Summary.unique_new_tenders_scanned} унікальних нових тендерів, ${wave7Summary.successful_tender_details} успішних detail-запитів, ${wave7Summary.remaining_tender_detail_errors} помилок після retry.`],
  [`• Із Wave ${WAVE} вилучено ${wave7Summary.excluded_service_or_supply_records} award-записів експертизи, проєктування, нагляду/консалтингу, інвентаризації, землеустрою та досліджень; ${wave7Summary.eligible_award_records} записів залишено у contractor pool.`],
  [`• Після видалення ${wave7Normalization.invalid_or_redacted_removed} службових/редагованих постачальників і дедуплікації: ${wave7Normalization.overlaps_with_base} вже були у базі, ${wave7Normalization.unique_new_supplier_leads} додано.`],
  ["• Intent score враховує кількість перемог, опублікований строк виконання та свіжість award. I1/I2 — черговість контакту, а не прогноз купівлі."],
  ["• У базі немає персональних контактів. Сума перемог — не TAM; публічна перемога підтверджує проєктну активність та юридичну особу, але не відповідь, біль або інтерес до GoProceed."],
];
method.getRange("A15:J22").format = { wrapText: true, verticalAlignment: "top", borders: { bottom: { style: "thin", color: C.gray200 } }, font: { size: 10, color: C.gray900 } };
method.getRange("A15:J22").format.rowHeight = 34;
method.getRange("A:A").format.columnWidth = 24;
method.getRange("B:C").format.columnWidth = 11;
method.getRange("D:E").format.columnWidth = 30;
method.getRange("F:F").format.columnWidth = 24;
method.getRange("G:H").format.columnWidth = 11;
method.getRange("I:J").format.columnWidth = 30;
method.freezePanes.freezeRows(2);
method.showGridlines = false;

// Validation and report datasets
const structure = await wb.inspect({ kind: "workbook,sheet,table", maxChars: 12000, tableMaxRows: 8, tableMaxCols: 12 });
await fs.writeFile(`${OUT_DIR}/workbook_v${VERSION}_structure.ndjson`, structure.ndjson, "utf8");
const formulaErrors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "formula error scan" });
await fs.writeFile(`${OUT_DIR}/workbook_v${VERSION}_formula_errors.ndjson`, formulaErrors.ndjson, "utf8");
const key = await wb.inspect({ kind: "table", sheetId: leadsSheetName, range: `A1:AO${end}`, include: "values,formulas", maxChars: 42000, tableMaxRows: 45, tableMaxCols: 41, tableMaxCellChars: 160 });
await fs.writeFile(`${OUT_DIR}/workbook_v${VERSION}_leads_inspect.ndjson`, key.ndjson, "utf8");
const tenderKey = await wb.inspect({ kind: "table", sheetId: "Tender Signals", range: `A1:N${tenderEnd}`, include: "values,formulas", maxChars: 36000, tableMaxRows: 55, tableMaxCols: 14, tableMaxCellChars: 180 });
await fs.writeFile(`${OUT_DIR}/workbook_v${VERSION}_tenders_inspect.ndjson`, tenderKey.ndjson, "utf8");

const preview = await wb.render({ sheetName: "Dashboard", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(`${OUT_DIR}/preview_v${VERSION}_dashboard.png`, new Uint8Array(await preview.arrayBuffer()));
const visualChecks = [
  [leadsSheetName, "A1:AO18", "leads"],
  ["Tender Signals", "A1:N25", "tender_signals"],
  ["Vertical Map", "A1:J42", "vertical_map"],
  ["Pilot Offer", "A1:J28", "pilot_offer"],
  ["Outreach", "A1:J37", "outreach"],
  ["Methodology", "A1:J22", "methodology"],
];
for (const [sheetName, range, slug] of visualChecks) {
  const rendered = await wb.render({ sheetName, range, scale: 0.8, format: "png" });
  await fs.writeFile(`${OUT_DIR}/preview_v${VERSION}_${slug}.png`, new Uint8Array(await rendered.arrayBuffer()));
}

const laneRows = ["Pilot now","Expansion discovery","Later / requirements","Requalify"].map(lane => ({
  lane,
  account_count: prospects.filter(x => x.lane === lane).length,
  top_priority_count: prospects.filter(x => x.lane === lane && ["P1","D1"].includes(x.priority)).length,
  high_confidence_count: prospects.filter(x => x.lane === lane && x.evidence_confidence === "high").length,
  medium_confidence_count: prospects.filter(x => x.lane === lane && x.evidence_confidence === "medium").length,
  source_wave_count_snapshot: prospects.filter(x => x.lane === lane && x.research_date === DATE_TAG).length,
}));
const currentTop = prospects.filter(x => x.lane === "Pilot now").sort((a,b) => (b.intent_score ?? 0)-(a.intent_score ?? 0) || b.pilot_now_score-a.pilot_now_score || a.company_name.localeCompare(b.company_name)).slice(0, 20).map(x => ({ company:x.company_name, priority:x.priority, intent_priority:x.intent_priority, intent_score:x.intent_score, pilot_now_score:x.pilot_now_score, live_projects:x.live_project_count, segment:x.segment, target_role:x.target_role, domain:x.domain, source_url:x.source_url, latest_tender_url:x.latest_tender_url, evidence_confidence:x.evidence_confidence }));
const expansionTop = prospects.filter(x => x.lane === "Expansion discovery").sort((a,b) => (b.intent_score ?? 0)-(a.intent_score ?? 0) || b.expansion_score-a.expansion_score || a.company_name.localeCompare(b.company_name)).slice(0, 25).map(x => ({ company:x.company_name, priority:x.priority, intent_priority:x.intent_priority, intent_score:x.intent_score, expansion_score:x.expansion_score, live_projects:x.live_project_count, segment:x.segment, target_role:x.target_role, domain:x.domain, source_url:x.source_url, latest_tender_url:x.latest_tender_url, evidence_confidence:x.evidence_confidence }));
const tenderTop = tenderSignals.slice(0, 40).map(x => ({ company:x.company_name, edrpou:x.edrpou, segment:x.segment, lane:x.lane, intent_priority:x.intent_priority, intent_score:x.intent_score, tender_count:x.tender_count, live_project_count:x.live_project_count, total_award_value_uah:x.total_award_value_uah, latest_award_date:x.latest_award_date, latest_delivery_end_date:x.latest_delivery_end_date, latest_tender_title:x.latest_tender_title, latest_tender_url:x.latest_tender_url, domain:x.domain, website_status:x.website_status ?? x.verification_status }));
const segmentSummary = segmentNames.map(segment => {
  const rows = prospects.filter(x => x.segment === segment);
  return { segment, account_count:rows.length, tender_signal_count:rows.filter(x => x.tender_count>0).length, live_project_count:rows.filter(x => x.live_project_count>0).length, pilot_now_count:rows.filter(x => x.lane === "Pilot now").length, expansion_count:rows.filter(x => x.lane === "Expansion discovery").length };
}).sort((a,b) => b.account_count-a.account_count || b.tender_signal_count-a.tender_signal_count || a.segment.localeCompare(b.segment, "uk"));
const isSoleAccount = x => ["sole_proprietor_contractor", "sole_proprietor"].includes(x.account_type);
const reportData = {
  summary:[{ total_accounts:prospects.length, base_before_wave:BASE_COUNT, wave:WAVE, wave_search_configs:wave7Summary.search_configs, wave_search_pages:wave7Summary.search_pages, wave_search_hits:wave7Summary.matching_search_hits, wave_unique_tenders_scanned:wave7Summary.unique_new_tenders_scanned, wave_successful_tender_details:wave7Summary.successful_tender_details, wave_tender_detail_errors:wave7Summary.remaining_tender_detail_errors, wave_raw_award_records:wave7Summary.raw_award_records, wave_excluded_service_records:wave7Summary.excluded_service_or_supply_records, wave_eligible_award_records:wave7Summary.eligible_award_records, wave_eligible_supplier_leads:wave7Summary.unique_supplier_leads, wave_valid_suppliers:wave7Normalization.valid_supplier_leads, wave_overlaps_with_base:wave7Normalization.overlaps_with_base, wave_new_unique_suppliers:wave7Normalization.unique_new_supplier_leads, high_confidence:prospects.filter(x=>x.evidence_confidence==="high").length, pilot_now:prospects.filter(x=>x.lane==="Pilot now").length, expansion_discovery:prospects.filter(x=>x.lane==="Expansion discovery").length, later:prospects.filter(x=>x.lane==="Later / requirements").length, legacy:prospects.filter(x=>x.lane==="Requalify").length, tender_signal_accounts:tenderSignals.length, planned_active_accounts:prospects.filter(x=>x.live_project_count>0).length, intent_i1:prospects.filter(x=>x.intent_priority==="I1").length, intent_i2:prospects.filter(x=>x.intent_priority==="I2").length, legal_entities:tenderSignals.filter(x=>!isSoleAccount(x)).length, sole_proprietors:tenderSignals.filter(isSoleAccount).length, evidenced_sends:21, replies:0 }],
  lanes:laneRows,
  current_top:currentTop,
  expansion_top:expansionTop,
  tender_top:tenderTop,
  segments:segmentSummary,
  sources:[
    { label:"Prozorro tender search", url:"https://prozorro.gov.ua/search/tender" },
    { label:`Top Wave ${WAVE} official tender sample`, url:prospects.find(x=>x.lead_id === `W${WAVE}-001`)?.latest_tender_url },
    { label:"Browser-verified company site — Опитний Завод М", url:"http://zavodm.com.ua/" },
  ],
  caveats:[
    "Tender award proves project activity and legal identity, not interest in GoProceed.",
    `Planned-active means the published delivery end date is on or after ${DATE_TAG}; it is not a confirmed on-site status.`,
    "Award value is an attributed prioritization signal; consortium or joint awards can repeat the full published amount across suppliers.",
    "Procurements for design, supervision, consulting, technical conditions, expertise, land management, survey, and inspection were saved separately and excluded from the core contractor lead count.",
    "No personal contacts are included; target roles and official public sources are provided for compliant outreach research.",
  ],
};
await fs.writeFile(`${OUT_DIR}/report_data_v${VERSION}.json`, JSON.stringify(reportData, null, 2), "utf8");

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(OUTPUT_XLSX);
console.log(JSON.stringify({ output: OUTPUT_XLSX, rows: prospects.length, formulaErrors: formulaErrors.ndjson, reportData }));
