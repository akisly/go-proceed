import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const base = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prospects_unified_v5_2026-08-24.json'), 'utf8'));
const unified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prospects_unified_v6_2026-08-24.json'), 'utf8'));
const overlaps = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave5_validated_overlaps_2026-08-24.json'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'wave5_normalization_summary_2026-08-24.json'), 'utf8'));

const cleanId = value => String(value || '').replace(/\D/g, '');
const cleanName = value => String(value || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const duplicateGroups = (rows, keyFn) => {
  const grouped = new Map();
  for (const row of rows) { const key=keyFn(row); if(!key)continue; const current=grouped.get(key)||[]; current.push(row); grouped.set(key,current); }
  return [...grouped.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows:rows.map(x=>({lead_id:x.lead_id,company_name:x.company_name,edrpou:x.edrpou,wave:x.wave}))}));
};
const duplicateLeadIds=duplicateGroups(unified,x=>x.lead_id);
const duplicateEdrpou=duplicateGroups(unified,x=>cleanId(x.edrpou));
const duplicateNames=duplicateGroups(unified,x=>cleanName(x.company_name));
const missingLeadIds=unified.filter(x=>!x.lead_id).map(x=>x.company_name);
const invalidTenderIds=unified.filter(x=>x.latest_tender_id&&!/^UA-\d{4}-\d{2}-\d{2}-\d{6}-[a-z]$/i.test(x.latest_tender_id)).map(x=>({lead_id:x.lead_id,latest_tender_id:x.latest_tender_id}));
const emptyCompanies=unified.filter(x=>!String(x.company_name||'').trim()).map(x=>x.lead_id);
const newRows=unified.filter(x=>String(x.lead_id||'').startsWith('W5-'));
const previous51=unified.filter(x=>x.wave==='Перевірено 51 — 24.08');
const previous51Ids=new Set(base.filter(x=>x.wave==='Перевірено 51 — 24.08').map(x=>x.lead_id));
const previous51Missing=[...previous51Ids].filter(id=>!previous51.some(x=>x.lead_id===id));
const overlapReasonCounts=overlaps.reduce((a,x)=>((a[x.match_reason]=(a[x.match_reason]||0)+1),a),{});
const laneCounts=unified.reduce((a,x)=>((a[x.lane]=(a[x.lane]||0)+1),a),{});
const intentCounts=unified.reduce((a,x)=>((a[x.intent_priority||'—']=(a[x.intent_priority||'—']||0)+1),a),{});
const segmentCounts=unified.reduce((a,x)=>((a[x.segment]=(a[x.segment]||0)+1),a),{});
const wave5SegmentCounts=newRows.reduce((a,x)=>((a[x.segment]=(a[x.segment]||0)+1),a),{});
const companyTypeCounts=unified.reduce((a,x)=>((a[x.account_type||'unknown']=(a[x.account_type||'unknown']||0)+1),a),{});
const report={
  ok:duplicateLeadIds.length===0&&duplicateEdrpou.length===0&&missingLeadIds.length===0&&emptyCompanies.length===0&&invalidTenderIds.length===0&&unified.length===base.length+summary.unique_new_supplier_leads&&newRows.length===summary.unique_new_supplier_leads&&previous51.length===51&&previous51Missing.length===0&&previous51.every(x=>x.evidence_confidence==='high'),
  counts:{base_rows:base.length,unified_rows:unified.length,expected_unified_rows:base.length+summary.unique_new_supplier_leads,wave5_rows:newRows.length,tender_signal_rows:unified.filter(x=>Number(x.tender_count||0)>0).length,live_project_signal_rows:unified.filter(x=>Number(x.live_project_count||0)>0).length,high_confidence_rows:unified.filter(x=>x.evidence_confidence==='high').length,previous_51_rows:previous51.length,previous_51_high_confidence:previous51.filter(x=>x.evidence_confidence==='high').length},
  issues:{duplicateLeadIds,duplicateEdrpou,duplicateNames,missingLeadIds,invalidTenderIds,emptyCompanies,previous51Missing},
  overlapReasonCounts,laneCounts,intentCounts,companyTypeCounts,
  segmentCounts:Object.fromEntries(Object.entries(segmentCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'uk'))),
  wave5SegmentCounts:Object.fromEntries(Object.entries(wave5SegmentCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'uk'))),
  previous51VerificationCounts:previous51.reduce((a,x)=>((a[x.verification_status||'—']=(a[x.verification_status||'—']||0)+1),a),{}),
};
fs.writeFileSync(path.join(OUT_DIR,'wave5_v6_validation_2026-08-24.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
