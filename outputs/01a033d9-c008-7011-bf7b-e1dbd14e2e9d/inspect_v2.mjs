import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const input = await FileBlob.load("/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d/goproceed_prospecting_268_2026-08-24.xlsx");
const wb = await SpreadsheetFile.importXlsx(input);
for (const [sheetId, range] of [["Dashboard","A4:G15"],["Leads 268","A4:Q25"],["Leads 268","A168:Q180"],["Leads 268","A264:Q272"],["Vertical Map","A4:J30"]]) {
  const x = await wb.inspect({ kind:"table", sheetId, range, include:"values,formulas", maxChars:30000, tableMaxRows:30, tableMaxCols:20, tableMaxCellChars:120 });
  console.log(`--- ${sheetId} ---`);
  console.log(x.ndjson);
}
const errors = await wb.inspect({ kind:"match", searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options:{useRegex:true,maxResults:300}, summary:"final formula error scan" });
console.log("--- Formula errors ---");
console.log(errors.ndjson);
