import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("/Users/akisliy/Downloads/aktflow_ukraine_leads_50_demo_outreach_2026-07-28.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Leads 50");
const rows = sheet.getUsedRange(true).values;
const header = rows[3];
const records = rows.slice(4).filter((row) => row[1]).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]])));
const compact = records.map((record) => ({
  pool_id: record.pool_id,
  company_name: record.company_name,
  edrpou: record.edrpou,
  domain: record.domain_normalized,
  trade: record.trade,
  origin: record.lead_origin,
  priority: record.priority,
  fit_score: record.fit_score,
  crew_signal: record.crew_signal,
  hidden_work_intensity: record.hidden_work_intensity,
  multi_project_scale: record.multi_project_scale,
  doc_complexity: record.doc_complexity,
  reachability: record.reachability,
  fit_evidence: record.fit_evidence,
  hidden_work_trigger: record.hidden_work_trigger,
  verification_url: record.verification_url,
  registry_url: record.registry_url,
  research_status: record.research_status,
}));
await fs.writeFile("existing_leads_50.json", JSON.stringify(compact, null, 2));
console.log(JSON.stringify(compact, null, 2));
