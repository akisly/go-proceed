import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("/Users/akisliy/Downloads/aktflow_ukraine_leads_50_demo_outreach_2026-07-28.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 18,
  tableMaxCellChars: 160,
});
console.log(overview.ndjson);

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange(true);
  if (!used) continue;
  const detail = await workbook.inspect({
    kind: "table",
    sheetId: sheet.name,
    range: used.address,
    include: "values,formulas",
    maxChars: 30000,
    tableMaxRows: 100,
    tableMaxCols: 30,
    tableMaxCellChars: 240,
  });
  console.log(`\n--- ${sheet.name} ${used.address} ---`);
  console.log(detail.ndjson);
}
