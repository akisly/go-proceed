import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("/Users/akisliy/Downloads/aktflow_ukraine_leads_50_demo_outreach_2026-07-28.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);

console.log(JSON.stringify(workbook.worksheets.items.map((sheet) => ({
  name: sheet.name,
  range: sheet.getUsedRange(true)?.address ?? null,
})), null, 2));

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange(true);
  if (!used) continue;
  const values = used.values;
  console.log(`\n--- ${sheet.name} ---`);
  console.log(JSON.stringify(values.slice(0, 6), null, 2));
}
