import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const base = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prospects_unified_v4_2026-08-24.json'), 'utf8'));
const unified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prospects_unified_v5_2026-08-24.json'), 'utf8'));
const overlaps = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave4_validated_overlaps_2026-08-24.json'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'wave4_normalization_summary_2026-08-24.json'), 'utf8'));

const cleanId = value => String(value || '').replace(/\D/g, '');
const cleanName = value => String(value || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const duplicateGroups = (rows, keyFn) => {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const current = grouped.get(key) || [];
    current.push(row);
    grouped.set(key, current);
  }
  return [...grouped.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ key, rows: rows.map(x => ({ lead_id:x.lead_id, company_name:x.company_name, edrpou:x.edrpou, wave:x.wave })) }));
};

const duplicateLeadIds = duplicateGroups(unified, x => x.lead_id);
const duplicateEdrpou = duplicateGroups(unified, x => cleanId(x.edrpou));
const duplicateNames = duplicateGroups(unified, x => cleanName(x.company_name));
const missingLeadIds = unified.filter(x => !x.lead_id).map(x => x.company_name);
const invalidTenderIds = unified.filter(x => x.latest_tender_id && !/^UA-\d{4}-\d{2}-\d{2}-\d{6}-[a-z]$/i.test(x.latest_tender_id)).map(x => ({ lead_id:x.lead_id, latest_tender_id:x.latest_tender_id }));
const emptyCompanies = unified.filter(x => !String(x.company_name || '').trim()).map(x => x.lead_id);
const newRows = unified.filter(x => String(x.lead_id || '').startsWith('W4-'));
const overlapReasonCounts = overlaps.reduce((acc, x) => ((acc[x.match_reason] = (acc[x.match_reason] || 0) + 1), acc), {});
const laneCounts = unified.reduce((acc, x) => ((acc[x.lane] = (acc[x.lane] || 0) + 1), acc), {});
const intentCounts = unified.reduce((acc, x) => ((acc[x.intent_priority || '—'] = (acc[x.intent_priority || '—'] || 0) + 1), acc), {});
const segmentCounts = unified.reduce((acc, x) => ((acc[x.segment] = (acc[x.segment] || 0) + 1), acc), {});
const wave4SegmentCounts = newRows.reduce((acc, x) => ((acc[x.segment] = (acc[x.segment] || 0) + 1), acc), {});
const companyTypeCounts = unified.reduce((acc, x) => ((acc[x.account_type || 'unknown'] = (acc[x.account_type || 'unknown'] || 0) + 1), acc), {});
const topOverlaps = overlaps.map(x => ({ company_name:x.company_name, edrpou:x.edrpou, matched_lead_id:x.matched_lead_id, matched_company_name:x.matched_company_name, reason:x.match_reason, tender_count:x.tender_count })).slice(0, 100);

const report = {
  ok: duplicateLeadIds.length === 0 && duplicateEdrpou.length === 0 && missingLeadIds.length === 0 && emptyCompanies.length === 0 && invalidTenderIds.length === 0 && unified.length === base.length + summary.unique_new_supplier_leads && newRows.length === summary.unique_new_supplier_leads,
  counts: {
    base_rows:base.length,
    unified_rows:unified.length,
    expected_unified_rows:base.length + summary.unique_new_supplier_leads,
    wave4_rows:newRows.length,
    tender_signal_rows:unified.filter(x => Number(x.tender_count || 0) > 0).length,
    live_project_signal_rows:unified.filter(x => Number(x.live_project_count || 0) > 0).length,
    high_confidence_rows:unified.filter(x => x.evidence_confidence === 'high').length,
  },
  issues: { duplicateLeadIds, duplicateEdrpou, duplicateNames, missingLeadIds, invalidTenderIds, emptyCompanies },
  overlapReasonCounts,
  laneCounts,
  intentCounts,
  companyTypeCounts,
  segmentCounts:Object.fromEntries(Object.entries(segmentCounts).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0], 'uk'))),
  wave4SegmentCounts:Object.fromEntries(Object.entries(wave4SegmentCounts).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0], 'uk'))),
  topOverlaps,
};

fs.writeFileSync(path.join(OUT_DIR, 'wave4_v5_validation_2026-08-24.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
