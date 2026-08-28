import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

process.on('uncaughtException', (error) => {
  console.error('WORKBOOK_ERROR', error?.name, error?.message);
  console.error(String(error?.stack || '').split('\n').slice(-12).join('\n'));
  process.exit(1);
});
process.on('unhandledRejection', (error) => {
  console.error('WORKBOOK_REJECTION', error?.name, error?.message);
  console.error(String(error?.stack || '').split('\n').slice(-12).join('\n'));
  process.exit(1);
});

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const DATE_TAG = '2026-08-25';
const sourcePath = path.join(OUT_DIR, `pilot_shortlist_${DATE_TAG}.json`);
const summaryPath = path.join(OUT_DIR, `pilot_shortlist_summary_${DATE_TAG}.json`);
const outreachPath = path.join(OUT_DIR, `pilot_outreach_A1-N01_${DATE_TAG}.json`);
const outputPath = path.join(OUT_DIR, `goproceed_pilot_conversion_103_${DATE_TAG}.xlsx`);
const previewDir = path.join(OUT_DIR, 'pilot_workbook_previews');

const shortlist = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
const outreachData = JSON.parse(await fs.readFile(outreachPath, 'utf8'));
const dataStart = 5;
const dataEnd = dataStart + shortlist.length - 1;
const GROUP_A1 = 'A1 — Запуск пилота 30–45 дней';
const GROUP_A2 = 'A2 — Квалификация перед пилотом';
const GROUP_B1 = 'B1 — Discovery → пилот';
const STATUS_VALUES = [
  '0 — Не запрошували',
  '1 — Запрошення надіслано',
  '2 — Відповів / цікаво',
  '3 — Артефакт отримано',
  '4 — Discovery проведено',
  '5 — Пілот погоджено',
  '6 — Пілот стартував',
  '7 — Не зараз',
  '8 — Відмова',
  '9 — Не fit',
];
const quoteFormulaText = (value) => String(value).replaceAll('"', '""');
const sumCountifsByStatus = (criteriaPrefix, statusRange, statuses) => `=${statuses.map((status) => `COUNTIFS(${criteriaPrefix},${statusRange},"${quoteFormulaText(status)}")`).join('+')}`;

const C = {
  navy: '#102A43',
  blue: '#2D6CDF',
  teal: '#168C7A',
  green: '#2E9D63',
  amber: '#E7A93B',
  red: '#D64545',
  ink: '#243B53',
  muted: '#627D98',
  pale: '#F4F7FB',
  line: '#D9E2EC',
  white: '#FFFFFF',
  input: '#FFF5CC',
  softGreen: '#E5F5EC',
  softBlue: '#EAF1FF',
  softAmber: '#FFF4DE',
  softRed: '#FDECEC',
};

const wb = Workbook.create();
const dashboard = wb.worksheets.add('Pilot Dashboard');
const leads = wb.worksheets.add('Pilot Shortlist');
const funnel = wb.worksheets.add('Funnel Tracker');
const batches = wb.worksheets.add('Outreach Batches');
const outreach = wb.worksheets.add('A1-N01 Outreach');
const rules = wb.worksheets.add('Rules & Sources');

for (const sheet of [dashboard, leads, funnel, batches, outreach, rules]) {
  sheet.showGridLines = false;
}

function titleBand(sheet, range, title, subtitleRange, subtitle) {
  sheet.getRange(range).merge();
  sheet.getRange(range).values = [[title]];
  sheet.getRange(range).format = {
    fill: C.navy,
    font: { name: 'Arial', size: 18, bold: true, color: C.white },
    verticalAlignment: 'center',
  };
  sheet.getRange(range).format.rowHeight = 34;
  sheet.getRange(subtitleRange).merge();
  sheet.getRange(subtitleRange).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: C.pale,
    font: { name: 'Arial', size: 10, color: C.muted },
    verticalAlignment: 'center',
    wrapText: true,
  };
  sheet.getRange(subtitleRange).format.rowHeight = 28;
}

function headerStyle(range) {
  range.format = {
    fill: C.blue,
    font: { name: 'Arial', size: 10, bold: true, color: C.white },
    verticalAlignment: 'center',
    wrapText: true,
    borders: { preset: 'outside', style: 'thin', color: C.blue },
  };
  range.format.rowHeight = 34;
}

function bodyFont(range) {
  range.format.font = { name: 'Arial', size: 9, color: C.ink };
  range.format.verticalAlignment = 'top';
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

// Pilot Shortlist — the editable source of truth for the conversion funnel.
titleBand(
  leads,
  'A1:AE1',
  'GoProceed — Pilot Shortlist',
  'A2:AE2',
  `103 selected accounts from ${summary.source_accounts.toLocaleString('en-US')} researched companies. Edit yellow cells only; a pilot counts as agreed only when status is 5/6 and Agreement evidence is filled.`,
);

const leadHeaders = [
  '#', 'Group', 'Queue', 'Batch', 'Readiness', 'Company', 'EDRPOU', 'Segment', 'Fit group',
  'Intent', 'Live projects', 'Award value (UAH)', 'Latest award', 'Delivery end', 'Contact route',
  'Browser status', 'Browser evidence', 'Original contact', 'Funnel status', 'Interest', 'Artifact',
  'Pilot agreed', 'Pilot start', 'Owner', 'Next step', 'Tender ID', 'Tender title', 'Tender URL',
  'Company URL', 'Agreement evidence', 'Notes',
];
leads.getRange('A4:AE4').values = [leadHeaders];
headerStyle(leads.getRange('A4:AE4'));

const leadRows = shortlist.map((x) => [
  x.outreach_order,
  x.pilot_group,
  x.outreach_queue,
  x.outreach_batch,
  x.pilot_readiness_score,
  x.company_name,
  String(x.edrpou || ''),
  x.segment,
  x.fit_group,
  x.intent_score,
  x.live_project_count,
  x.total_award_value_uah,
  parseDate(x.latest_award_date),
  parseDate(x.latest_delivery_end_date),
  x.contact_route_quality,
  x.browser_verification_status,
  x.browser_verification_evidence,
  x.contact_status,
  x.pilot_funnel_status,
  null,
  null,
  null,
  null,
  x.owner,
  x.next_step,
  x.latest_tender_id,
  x.latest_tender_title,
  x.latest_tender_url,
  x.browser_verification_url || x.company_url,
  x.agreement_evidence,
  x.notes,
]);
leads.getRange(`A${dataStart}:AE${dataEnd}`).values = leadRows;
bodyFont(leads.getRange(`A${dataStart}:AE${dataEnd}`));
leads.getRange(`T${dataStart}`).formulas = [[`=OR(LEFT(S${dataStart},1)="2",LEFT(S${dataStart},1)="3",LEFT(S${dataStart},1)="4",LEFT(S${dataStart},1)="5",LEFT(S${dataStart},1)="6")`]];
leads.getRange(`T${dataStart}:T${dataEnd}`).fillDown();
leads.getRange(`U${dataStart}`).formulas = [[`=OR(LEFT(S${dataStart},1)="3",LEFT(S${dataStart},1)="4",LEFT(S${dataStart},1)="5",LEFT(S${dataStart},1)="6")`]];
leads.getRange(`U${dataStart}:U${dataEnd}`).fillDown();
leads.getRange(`V${dataStart}`).formulas = [[`=AND(OR(LEFT(S${dataStart},1)="5",LEFT(S${dataStart},1)="6"),LEN(AD${dataStart})>0)`]];
leads.getRange(`V${dataStart}:V${dataEnd}`).fillDown();

leads.getRange(`G${dataStart}:G${dataEnd}`).format.numberFormat = '@';
leads.getRange(`E${dataStart}:E${dataEnd}`).format.numberFormat = '0';
leads.getRange(`J${dataStart}:K${dataEnd}`).format.numberFormat = '0';
leads.getRange(`L${dataStart}:L${dataEnd}`).format.numberFormat = '#,##0';
leads.getRange(`M${dataStart}:N${dataEnd}`).format.numberFormat = 'yyyy-mm-dd';
leads.getRange(`W${dataStart}:W${dataEnd}`).format.numberFormat = 'yyyy-mm-dd';
leads.getRange(`Q${dataStart}:Q${dataEnd}`).format.wrapText = true;
leads.getRange(`Y${dataStart}:AE${dataEnd}`).format.wrapText = true;
leads.getRange(`S${dataStart}:S${dataEnd}`).dataValidation = {
  rule: {
    type: 'list',
    values: STATUS_VALUES,
  },
};
leads.getRange(`S${dataStart}:S${dataEnd}`).format.fill = C.input;
leads.getRange(`W${dataStart}:W${dataEnd}`).format.fill = C.input;
leads.getRange(`X${dataStart}:X${dataEnd}`).format.fill = C.input;
leads.getRange(`AD${dataStart}:AE${dataEnd}`).format.fill = C.input;
leads.getRange(`E${dataStart}:E${dataEnd}`).conditionalFormats.add('dataBar', { color: C.blue, gradient: true });
leads.getRange(`B${dataStart}:B${dataEnd}`).conditionalFormats.add('beginsWith', { text: 'A1', format: { fill: C.softGreen, font: { bold: true, color: C.green } } });
leads.getRange(`B${dataStart}:B${dataEnd}`).conditionalFormats.add('beginsWith', { text: 'A2', format: { fill: C.softAmber, font: { bold: true, color: '#8A5A00' } } });
leads.getRange(`B${dataStart}:B${dataEnd}`).conditionalFormats.add('beginsWith', { text: 'B1', format: { fill: C.softBlue, font: { bold: true, color: C.blue } } });
leads.getRange(`S${dataStart}:S${dataEnd}`).conditionalFormats.add('beginsWith', { text: '5', format: { fill: C.softGreen, font: { bold: true, color: C.green } } });
leads.getRange(`S${dataStart}:S${dataEnd}`).conditionalFormats.add('beginsWith', { text: '6', format: { fill: C.green, font: { bold: true, color: C.white } } });
leads.getRange(`V${dataStart}:V${dataEnd}`).conditionalFormats.add('cellIs', { operator: 'equal', formula: 'TRUE', format: { fill: C.softGreen, font: { bold: true, color: C.green } } });
const leadsTable = leads.tables.add(`A4:AE${dataEnd}`, true, 'PilotShortlistTable');
leadsTable.style = 'TableStyleMedium2';
leads.freezePanes.freezeRows(4);
leads.freezePanes.freezeColumns(6);

const leadWidths = {
  A: 6, B: 31, C: 15, D: 12, E: 11, F: 42, G: 12, H: 26, I: 31, J: 9, K: 10,
  L: 16, M: 13, N: 13, O: 28, P: 28, Q: 48, R: 24, S: 28, T: 10, U: 10, V: 12,
  W: 13, X: 16, Y: 46, Z: 22, AA: 50, AB: 36, AC: 34, AD: 40, AE: 36,
};
for (const [col, width] of Object.entries(leadWidths)) leads.getRange(`${col}:${col}`).format.columnWidth = width;
leads.getRange(`${dataStart}:${dataEnd}`).format.rowHeight = 42;

// Funnel tracker — formula-driven and scoped to the A1 launch cohort.
titleBand(
  funnel,
  'A1:H1',
  'Pilot Funnel — A1 launch cohort',
  'A2:H2',
  'Actual counts are calculated from Pilot Shortlist. “Pilot agreed” stays zero until explicit agreement evidence is entered.',
);
funnel.getRange('A4:H4').values = [[
  'Stage', 'Actual', 'Step conversion', 'Definition', 'Required proof', 'Working target', 'Gap', 'Notes',
]];
headerStyle(funnel.getRange('A4:H4'));
const funnelRows = [
  ['A1 eligible', null, null, 'Strong direct N.14/N.15 candidates selected for the first cycle', 'Readiness + live-project evidence', null, null, 'Start with new-outbound batches of 10'],
  ['Invited', null, null, 'A pilot invitation or re-engagement was sent', 'Date/channel recorded in Notes', null, null, 'Do not blast all candidates at once'],
  ['Interested', null, null, 'Positive reply or explicit interest', 'Reply summary in Notes', null, null, 'No inferred interest'],
  ['Artifact received', null, null, 'One anonymized project/document package was received', 'Artifact reference in Notes', null, null, 'Needed before workflow validation'],
  ['Discovery completed', null, null, '20-minute call or workflow review completed', 'Date + result in Notes', null, null, 'Confirm own execution and PТО workflow'],
  ['Pilot agreed', null, null, 'Explicit acceptance of a free 30–45 day pilot', 'Agreement evidence in Pilot Shortlist', null, null, 'Formula requires evidence'],
  ['Pilot started', null, null, 'Pilot is operating on an agreed package', 'Status 6 + start date', null, null, 'Track one accountable owner'],
];
funnel.getRange('A5:H11').values = funnelRows;
bodyFont(funnel.getRange('A5:H11'));
const g = `'Pilot Shortlist'!$B$${dataStart}:$B$${dataEnd}`;
const st = `'Pilot Shortlist'!$S$${dataStart}:$S$${dataEnd}`;
const interest = `'Pilot Shortlist'!$T$${dataStart}:$T$${dataEnd}`;
const artifact = `'Pilot Shortlist'!$U$${dataStart}:$U$${dataEnd}`;
const agreed = `'Pilot Shortlist'!$V$${dataStart}:$V$${dataEnd}`;
const start = `'Pilot Shortlist'!$W$${dataStart}:$W$${dataEnd}`;
funnel.getRange('B5').formulas = [[`=COUNTIF(${g},"${GROUP_A1}")`]];
funnel.getRange('B6').formulas = [[sumCountifsByStatus(`${g},"${GROUP_A1}"`, st, STATUS_VALUES.slice(1))]];
funnel.getRange('B7').formulas = [[`=COUNTIFS(${g},"${GROUP_A1}",${interest},TRUE)`]];
funnel.getRange('B8').formulas = [[`=COUNTIFS(${g},"${GROUP_A1}",${artifact},TRUE)`]];
funnel.getRange('B9').formulas = [[sumCountifsByStatus(`${g},"${GROUP_A1}"`, st, STATUS_VALUES.slice(4, 7))]];
funnel.getRange('B10').formulas = [[`=COUNTIFS(${g},"${GROUP_A1}",${agreed},TRUE)`]];
funnel.getRange('B11').formulas = [[`=COUNTIFS(${g},"${GROUP_A1}",${st},"${STATUS_VALUES[6]}",${start},"<>")`]];
funnel.getRange('C5').values = [['—']];
funnel.getRange('C6').formulas = [['=IFERROR(B6/B5,0)']];
funnel.getRange('C6:C11').fillDown();
funnel.getRange('G5').values = [['']];
funnel.getRange('G6').formulas = [['=IF(F6="","",F6-B6)']];
funnel.getRange('G6:G11').fillDown();
funnel.getRange('B5:B11').format.numberFormat = '0';
funnel.getRange('C6:C11').format.numberFormat = '0.0%';
funnel.getRange('F5:F11').format.fill = C.input;
funnel.getRange('F5:F11').format.numberFormat = '0';
funnel.getRange('G5:G11').format.numberFormat = '0';
funnel.getRange('A5:A11').format.font = { name: 'Arial', size: 10, bold: true, color: C.ink };
funnel.getRange('B5:B11').format.font = { name: 'Arial', size: 14, bold: true, color: C.blue };
funnel.getRange('D5:H11').format.wrapText = true;
funnel.getRange('A:A').format.columnWidth = 24;
funnel.getRange('B:B').format.columnWidth = 12;
funnel.getRange('C:C').format.columnWidth = 16;
funnel.getRange('D:D').format.columnWidth = 42;
funnel.getRange('E:E').format.columnWidth = 34;
funnel.getRange('F:G').format.columnWidth = 15;
funnel.getRange('H:H').format.columnWidth = 36;
funnel.getRange('5:11').format.rowHeight = 42;
funnel.freezePanes.freezeRows(4);
const funnelTable = funnel.tables.add('A4:H11', true, 'PilotFunnelTable');
funnelTable.style = 'TableStyleMedium2';

// Outreach batches — ten-account execution units and separate re-engagement queues.
titleBand(
  batches,
  'A1:M1',
  'Outreach Batches',
  'A2:M2',
  'Run one batch, review replies and objections, then release the next batch. Re-engagement is intentionally kept separate.',
);
const batchOrder = [...new Set(shortlist.map((x) => x.outreach_batch))];
const batchRows = batchOrder.map((batch) => {
  const members = shortlist.filter((x) => x.outreach_batch === batch);
  const first = members[0];
  const names = members.slice(0, 3).map((x) => x.company_name.replace(/ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ/giu, 'ТОВ')).join('; ');
  let action = 'Hold until the prior batch is reviewed';
  if (batch === 'A1-N01') action = 'Send first; review after 10';
  else if (batch.startsWith('A1-N')) action = 'Release only after prior A1 batch review';
  else if (batch.startsWith('A1-R')) action = 'Re-engage with a new tender signal';
  else if (batch.startsWith('A2-')) action = 'Qualify own execution + PТО before pilot offer';
  else if (batch.startsWith('B1-')) action = 'Reserve: discovery only';
  else if (batch.startsWith('C-')) action = 'Channel conversation only';
  return [batch, first.pilot_group, first.outreach_queue, null, null, null, null, null, null, null, null, action, names];
});
batches.getRange('A4:M4').values = [[
  'Batch', 'Group', 'Queue', 'Candidates', 'Invited', 'Interested', 'Artifact', 'Discovery', 'Agreed',
  'Reply rate', 'Agreement rate', 'Release rule', 'First companies',
]];
headerStyle(batches.getRange('A4:M4'));
const batchEnd = 4 + batchRows.length;
batches.getRange(`A5:M${batchEnd}`).values = batchRows;
bodyFont(batches.getRange(`A5:M${batchEnd}`));
for (let row = 5; row <= batchEnd; row += 1) {
  batches.getRange(`D${row}`).formulas = [[`=COUNTIF('Pilot Shortlist'!$D$${dataStart}:$D$${dataEnd},A${row})`]];
  batches.getRange(`E${row}`).formulas = [[sumCountifsByStatus(`'Pilot Shortlist'!$D$${dataStart}:$D$${dataEnd},A${row}`, `'Pilot Shortlist'!$S$${dataStart}:$S$${dataEnd}`, STATUS_VALUES.slice(1))]];
  batches.getRange(`F${row}`).formulas = [[`=COUNTIFS('Pilot Shortlist'!$D$${dataStart}:$D$${dataEnd},A${row},'Pilot Shortlist'!$T$${dataStart}:$T$${dataEnd},TRUE)`]];
  batches.getRange(`G${row}`).formulas = [[`=COUNTIFS('Pilot Shortlist'!$D$${dataStart}:$D$${dataEnd},A${row},'Pilot Shortlist'!$U$${dataStart}:$U$${dataEnd},TRUE)`]];
  batches.getRange(`H${row}`).formulas = [[sumCountifsByStatus(`'Pilot Shortlist'!$D$${dataStart}:$D$${dataEnd},A${row}`, `'Pilot Shortlist'!$S$${dataStart}:$S$${dataEnd}`, STATUS_VALUES.slice(4, 7))]];
  batches.getRange(`I${row}`).formulas = [[`=COUNTIFS('Pilot Shortlist'!$D$${dataStart}:$D$${dataEnd},A${row},'Pilot Shortlist'!$V$${dataStart}:$V$${dataEnd},TRUE)`]];
  batches.getRange(`J${row}`).formulas = [[`=IFERROR(F${row}/E${row},0)`]];
  batches.getRange(`K${row}`).formulas = [[`=IFERROR(I${row}/E${row},0)`]];
}
batches.getRange(`D5:I${batchEnd}`).format.numberFormat = '0';
batches.getRange(`J5:K${batchEnd}`).format.numberFormat = '0.0%';
batches.getRange(`L5:M${batchEnd}`).format.wrapText = true;
batches.getRange(`A5:A${batchEnd}`).format.font = { name: 'Arial', size: 10, bold: true, color: C.blue };
batches.getRange('A:A').format.columnWidth = 14;
batches.getRange('B:B').format.columnWidth = 31;
batches.getRange('C:C').format.columnWidth = 16;
batches.getRange('D:I').format.columnWidth = 12;
batches.getRange('J:K').format.columnWidth = 15;
batches.getRange('L:L').format.columnWidth = 40;
batches.getRange('M:M').format.columnWidth = 50;
batches.getRange(`5:${batchEnd}`).format.rowHeight = 38;
batches.freezePanes.freezeRows(4);
const batchTable = batches.tables.add(`A4:M${batchEnd}`, true, 'OutreachBatchesTable');
batchTable.style = 'TableStyleMedium2';

// A1-N01 outreach pack — verified corporate routes and message drafts. No send is inferred.
titleBand(
  outreach,
  'A1:T1',
  'A1-N01 — Verified Outreach Pack',
  'A2:T2',
  'Ten researched corporate routes and company-specific drafts. Yellow cells are operational inputs. Replace the demo-link placeholder, add the sender and obtain explicit authorization before any external send.',
);
const outreachHeaders = [
  '#', 'Company', 'EDRPOU', 'Segment', 'Score', 'Channel', 'Corporate route', 'Route quality',
  'Route source', 'Tender signal', 'Tender URL', 'Recipient role', 'Subject', 'First touch',
  'Follow-up', 'Send gate', 'Funnel status', 'Sent at', 'Reply summary', 'Agreement evidence',
];
outreach.getRange('A4:T4').values = [outreachHeaders];
headerStyle(outreach.getRange('A4:T4'));
const outreachRows = outreachData.records.map((x) => [
  x.priority_order,
  x.company,
  String(x.edrpou || ''),
  x.segment,
  x.readiness_score,
  x.channel,
  x.corporate_route,
  x.route_quality,
  x.route_source_url,
  x.tender_signal,
  x.tender_url,
  x.recipient_role,
  x.subject,
  x.first_touch,
  x.follow_up,
  x.send_readiness,
  x.funnel_status,
  null,
  x.reply_summary,
  x.agreement_evidence,
]);
const outreachEnd = 4 + outreachRows.length;
outreach.getRange(`A5:T${outreachEnd}`).values = outreachRows;
bodyFont(outreach.getRange(`A5:T${outreachEnd}`));
outreach.getRange(`C5:C${outreachEnd}`).format.numberFormat = '@';
outreach.getRange(`E5:E${outreachEnd}`).format.numberFormat = '0';
outreach.getRange(`I5:O${outreachEnd}`).format.wrapText = true;
outreach.getRange(`P5:T${outreachEnd}`).format.wrapText = true;
outreach.getRange(`Q5:Q${outreachEnd}`).dataValidation = {
  rule: { type: 'list', values: STATUS_VALUES },
};
outreach.getRange(`Q5:T${outreachEnd}`).format.fill = C.input;
outreach.getRange(`R5:R${outreachEnd}`).format.numberFormat = 'yyyy-mm-dd';
outreach.getRange(`E5:E${outreachEnd}`).conditionalFormats.add('dataBar', { color: C.blue, gradient: true });
outreach.getRange(`F5:F${outreachEnd}`).conditionalFormats.add('beginsWith', { text: 'email', format: { fill: C.softBlue, font: { bold: true, color: C.blue } } });
outreach.getRange(`F5:F${outreachEnd}`).conditionalFormats.add('beginsWith', { text: 'phone', format: { fill: C.softAmber, font: { bold: true, color: '#8A5A00' } } });
outreach.getRange(`P5:P${outreachEnd}`).conditionalFormats.add('beginsWith', { text: 'ready', format: { fill: C.softGreen, font: { bold: true, color: C.green } } });
outreach.getRange(`P5:P${outreachEnd}`).conditionalFormats.add('beginsWith', { text: 'blocked', format: { fill: C.softRed, font: { bold: true, color: C.red } } });
outreach.getRange(`Q5:Q${outreachEnd}`).conditionalFormats.add('beginsWith', { text: '5', format: { fill: C.softGreen, font: { bold: true, color: C.green } } });
outreach.getRange(`Q5:Q${outreachEnd}`).conditionalFormats.add('beginsWith', { text: '6', format: { fill: C.green, font: { bold: true, color: C.white } } });
const outreachTable = outreach.tables.add(`A4:T${outreachEnd}`, true, 'A1N01OutreachTable');
outreachTable.style = 'TableStyleMedium2';
outreach.freezePanes.freezeRows(4);
outreach.freezePanes.freezeColumns(7);
const outreachWidths = {
  A: 6, B: 34, C: 12, D: 24, E: 9, F: 11, G: 27, H: 29, I: 35, J: 48,
  K: 35, L: 31, M: 43, N: 72, O: 58, P: 28, Q: 28, R: 13, S: 42, T: 42,
};
for (const [col, width] of Object.entries(outreachWidths)) outreach.getRange(`${col}:${col}`).format.columnWidth = width;
outreach.getRange(`5:${outreachEnd}`).format.rowHeight = 110;

// Rules, definitions, and source metadata.
titleBand(
  rules,
  'A1:F1',
  'Rules & Sources',
  'A2:F2',
  'Visible scoring rules make the shortlist auditable. Yellow cells throughout the workbook are intended for user input.',
);
rules.getRange('A4:B9').values = [
  ['Source / metric', 'Value'],
  ['Source accounts', summary.source_accounts],
  ['Selected accounts', summary.shortlist_accounts],
  ['A1 launch now', summary.group_counts['A1 — Запуск пилота 30–45 дней'] || 0],
  ['A2 qualify first', summary.group_counts['A2 — Квалификация перед пилотом'] || 0],
  ['B1 discovery reserve', summary.group_counts['B1 — Discovery → пилот'] || 0],
];
headerStyle(rules.getRange('A4:B4'));
bodyFont(rules.getRange('A5:B9'));
rules.getRange('A12:F12').values = [['Group', 'Entry rule', 'Commercial motion', 'Do not do', 'Exit condition', 'Current count']];
headerStyle(rules.getRange('A12:F12'));
rules.getRange('A13:F16').values = [
  ['A1', 'Direct N.14/N.15, score ≥80, live project, no public/requalification signal, usable evidence/route', 'Offer a narrow free 30–45 day pilot', 'Do not send more than one batch before review', 'Explicit agreement evidence', summary.group_counts['A1 — Запуск пилота 30–45 дней'] || 0],
  ['A2', 'Direct N.14/N.15, score ≥68, but route or own-execution question remains', 'Qualify first; then move to A1', 'Do not promise a pilot before fit confirmation', 'Own execution + PТО + active package confirmed', summary.group_counts['A2 — Квалификация перед пилотом'] || 0],
  ['B1', 'Adjacent workflow with strong process fit', 'Two-week discovery before any pilot', 'Do not position as shipped N.14/N.15 fit', 'Workflow-fit verdict', summary.group_counts['B1 — Discovery → пилот'] || 0],
  ['C', 'General contractor / channel signal', 'Ask for introduction to PТО or specialist subcontractor', 'Do not count as direct pilot account', 'Named internal or subcontractor workflow owner', summary.group_counts['C — Генподрядчик / канал'] || 0],
];
bodyFont(rules.getRange('A13:F16'));
rules.getRange('B13:E16').format.wrapText = true;
rules.getRange('A19:C19').values = [['Funnel status', 'Meaning', 'Required evidence']];
headerStyle(rules.getRange('A19:C19'));
rules.getRange('A20:C29').values = [
  ['0 — Не запрошували', 'No outreach sent', 'None'],
  ['1 — Запрошення надіслано', 'Invitation sent', 'Date/channel in Notes'],
  ['2 — Відповів / цікаво', 'Positive reply or explicit interest', 'Reply summary'],
  ['3 — Артефакт отримано', 'Anonymized project package received', 'Artifact reference'],
  ['4 — Discovery проведено', 'Workflow review completed', 'Date + fit verdict'],
  ['5 — Пілот погоджено', 'Free pilot explicitly accepted', 'Agreement evidence is mandatory'],
  ['6 — Пілот стартував', 'Pilot operating on one package', 'Agreement evidence + start date'],
  ['7 — Не зараз', 'Valid fit, wrong timing', 'Reason / revisit date'],
  ['8 — Відмова', 'Explicit decline', 'Reason if shared'],
  ['9 — Не fit', 'Qualification disproved fit', 'Short fit verdict'],
];
bodyFont(rules.getRange('A20:C29'));
rules.getRange('B20:C29').format.wrapText = true;
rules.getRange('A32:B37').values = [
  ['Source file', 'Purpose'],
  ['prospects_unified_v8_2026-08-24.json', 'Authoritative 2,178-account source base'],
  ['pilot_shortlist_2026-08-25.json', 'Selected and ranked pilot cohorts'],
  ['pilot_browser_verification_2026-08-25.json', 'Focused company-level Browser verification'],
  ['Prozorro tender URLs in Pilot Shortlist', 'Live project and work-scope evidence'],
  ['pilot_outreach_A1-N01_2026-08-25.json', 'Verified corporate routes, copy and send guardrails for the first batch'],
];
headerStyle(rules.getRange('A32:B32'));
bodyFont(rules.getRange('A33:B37'));
rules.getRange('A:A').format.columnWidth = 28;
rules.getRange('B:B').format.columnWidth = 58;
rules.getRange('C:E').format.columnWidth = 40;
rules.getRange('F:F').format.columnWidth = 14;
rules.getRange('13:16').format.rowHeight = 58;
rules.getRange('20:29').format.rowHeight = 32;
rules.freezePanes.freezeRows(2);

// Dashboard — executive view for deciding what to send next.
titleBand(
  dashboard,
  'A1:N1',
  'GoProceed — Pilot Conversion Control',
  'A2:N2',
  `As of ${DATE_TAG}. Acquisition is paused: the operating goal is to convert the strongest existing companies into explicit free-pilot agreements.`,
);

const cards = [
  ['A4:B4', 'A5:B6', 'Source accounts', `='Rules & Sources'!B5`, C.navy],
  ['C4:D4', 'C5:D6', 'A1 launch now', `=COUNTIF('Pilot Shortlist'!$B$${dataStart}:$B$${dataEnd},"${GROUP_A1}")`, C.green],
  ['E4:F4', 'E5:F6', 'A2 qualify first', `=COUNTIF('Pilot Shortlist'!$B$${dataStart}:$B$${dataEnd},"${GROUP_A2}")`, C.amber],
  ['G4:H4', 'G5:H6', 'B1 discovery reserve', `=COUNTIF('Pilot Shortlist'!$B$${dataStart}:$B$${dataEnd},"${GROUP_B1}")`, C.blue],
  ['I4:J4', 'I5:J6', 'Interested', `=COUNTIF('Pilot Shortlist'!$T$${dataStart}:$T$${dataEnd},TRUE)`, C.teal],
  ['K4:L4', 'K5:L6', 'Pilot agreed', `=COUNTIF('Pilot Shortlist'!$V$${dataStart}:$V$${dataEnd},TRUE)`, C.green],
  ['M4:N4', 'M5:N6', 'Pilot started', `=COUNTIFS('Pilot Shortlist'!$S$${dataStart}:$S$${dataEnd},"${STATUS_VALUES[6]}",'Pilot Shortlist'!$W$${dataStart}:$W$${dataEnd},"<>")`, C.navy],
];
for (const [labelRange, valueRange, label, formula, color] of cards) {
  dashboard.getRange(labelRange).merge();
  dashboard.getRange(labelRange).values = [[label]];
  dashboard.getRange(labelRange).format = { fill: color, font: { name: 'Arial', size: 9, bold: true, color: C.white }, horizontalAlignment: 'center', verticalAlignment: 'center' };
  dashboard.getRange(valueRange).merge();
  dashboard.getRange(valueRange).formulas = [[formula]];
  dashboard.getRange(valueRange).format = { fill: C.white, font: { name: 'Arial', size: 22, bold: true, color }, horizontalAlignment: 'center', verticalAlignment: 'center', borders: { preset: 'outside', style: 'thin', color: C.line } };
  dashboard.getRange(valueRange).format.numberFormat = '#,##0';
}

dashboard.getRange('A8:N8').merge();
dashboard.getRange('A8:N8').values = [['Decision for the next cycle']];
dashboard.getRange('A8:N8').format = { fill: C.navy, font: { name: 'Arial', size: 11, bold: true, color: C.white }, verticalAlignment: 'center' };
dashboard.getRange('A9:N11').merge();
dashboard.getRange('A9:N11').values = [[
  'A1-N01 is researched and drafted for 10 new companies. Replace the demo-link placeholder, add the sender and obtain explicit authorization before sending. Review replies, objections and artifact availability before releasing A1-N02. There are currently zero confirmed pilot agreements.',
]];
dashboard.getRange('A9:N11').format = { fill: C.softBlue, font: { name: 'Arial', size: 11, color: C.ink }, wrapText: true, verticalAlignment: 'center', borders: { preset: 'outside', style: 'thin', color: C.line } };

dashboard.getRange('J14:K14').values = [['Funnel stage', 'Actual']];
dashboard.getRange('J15:J21').values = [['A1 eligible'], ['Invited'], ['Interested'], ['Artifact'], ['Discovery'], ['Agreed'], ['Started']];
for (let r = 15; r <= 21; r += 1) dashboard.getRange(`K${r}`).formulas = [[`='Funnel Tracker'!B${r - 10}`]];
headerStyle(dashboard.getRange('J14:K14'));
bodyFont(dashboard.getRange('J15:K21'));
dashboard.getRange('K15:K21').format.numberFormat = '0';

dashboard.getRange('M14:N14').values = [['Active cohort', 'Count']];
dashboard.getRange('M15:M17').values = [['A1'], ['A2'], ['Re-engagement']];
dashboard.getRange('N15').formulas = [[`=COUNTIF('Pilot Shortlist'!$B$${dataStart}:$B$${dataEnd},"${GROUP_A1}")`]];
dashboard.getRange('N16').formulas = [[`=COUNTIF('Pilot Shortlist'!$B$${dataStart}:$B$${dataEnd},"${GROUP_A2}")`]];
dashboard.getRange('N17').formulas = [[`=COUNTIF('Pilot Shortlist'!$C$${dataStart}:$C$${dataEnd},"Re-engagement")`]];
headerStyle(dashboard.getRange('M14:N14'));
bodyFont(dashboard.getRange('M15:N17'));

const funnelChart = dashboard.charts.add('bar', dashboard.getRange('J14:K21'));
funnelChart.title = 'A1 pilot funnel (accounts)';
funnelChart.hasLegend = false;
funnelChart.xAxis = { axisType: 'textAxis', textStyle: { fontSize: 9 } };
funnelChart.yAxis = { numberFormatCode: '0', min: 0 };
funnelChart.setPosition('A14', 'H29');

dashboard.getRange('J23:N23').merge();
dashboard.getRange('J23:N23').values = [['Guardrail']];
dashboard.getRange('J23:N23').format = { fill: C.red, font: { name: 'Arial', size: 10, bold: true, color: C.white }, horizontalAlignment: 'center' };
dashboard.getRange('J24:N28').merge();
dashboard.getRange('J24:N28').values = [[
  'Do not mark “Pilot agreed” from fit, tender activity or silence. Set status 5/6 only after an explicit positive reply and add the evidence in Pilot Shortlist.',
]];
dashboard.getRange('J24:N28').format = { fill: C.softRed, font: { name: 'Arial', size: 10, color: C.ink }, wrapText: true, verticalAlignment: 'center', borders: { preset: 'outside', style: 'thin', color: C.red } };
for (let col = 0; col < 14; col += 1) dashboard.getCell(0, col).format.columnWidth = 12;
dashboard.getRange('A:N').format.columnWidth = 13;
dashboard.getRange('A:A').format.columnWidth = 16;
dashboard.getRange('J:J').format.columnWidth = 20;
dashboard.getRange('M:M').format.columnWidth = 18;
dashboard.freezePanes.freezeRows(2);

// Compact checks before export.
const dashboardCheck = await wb.inspect({
  kind: 'table',
  range: 'Pilot Dashboard!A1:N28',
  include: 'values,formulas',
  tableMaxRows: 28,
  tableMaxCols: 14,
  maxChars: 12000,
});
console.log(dashboardCheck.ndjson);
const errors = await wb.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
  maxChars: 6000,
});
console.log(errors.ndjson);

await fs.mkdir(previewDir, { recursive: true });
for (const [sheetName, range, fileName, scale] of [
  ['Pilot Dashboard', 'A1:N29', 'dashboard.png', 1.4],
  ['Pilot Shortlist', 'A1:AE18', 'shortlist.png', 1.1],
  ['Funnel Tracker', 'A1:H11', 'funnel.png', 1.4],
  ['Outreach Batches', `A1:M${batchEnd}`, 'batches.png', 1.2],
  ['A1-N01 Outreach', `A1:T${outreachEnd}`, 'a1-n01-outreach.png', 0.9],
  ['Rules & Sources', 'A1:F37', 'rules.png', 1.1],
]) {
  const image = await wb.render({ sheetName, range, scale, format: 'png' });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await image.arrayBuffer()));
}

await fs.mkdir(OUT_DIR, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, sheets: 6, rows: shortlist.length, outreachRows: outreachData.records.length, batchCount: batchOrder.length, dataEnd }, null, 2));
