import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const workbookPath = path.join(outputDir, 'goproceed_pilot_conversion_103_2026-08-25.xlsx');
const previewDir = path.join(outputDir, 'pilot_workbook_final_verification');

await fs.mkdir(previewDir, { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const summary = await workbook.inspect({
  kind: 'workbook,sheet,table',
  maxChars: 9000,
  tableMaxRows: 6,
  tableMaxCols: 10,
  tableMaxCellChars: 100,
});
console.log(summary.ndjson);

const target = await workbook.inspect({
  kind: 'region,computedStyle',
  sheetId: 'Pilot Shortlist',
  range: 'A1:AE12',
  maxChars: 7000,
});
console.log(target.ndjson);

const outreachCheck = await workbook.inspect({
  kind: 'table',
  range: 'A1-N01 Outreach!A1:T14',
  include: 'values,formulas',
  tableMaxRows: 14,
  tableMaxCols: 20,
  maxChars: 18000,
});
console.log(outreachCheck.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
  maxChars: 6000,
});
console.log(errors.ndjson);

for (const sheetName of ['Pilot Dashboard', 'Pilot Shortlist', 'Funnel Tracker', 'Outreach Batches', 'A1-N01 Outreach', 'Rules & Sources']) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
  const fileName = `${sheetName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.png`;
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}
