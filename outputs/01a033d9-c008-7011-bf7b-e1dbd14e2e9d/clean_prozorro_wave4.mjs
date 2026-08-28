import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const AS_OF = new Date('2026-08-24T23:59:59+03:00');
const records = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave4_tender_records_2026-08-24.json'), 'utf8'));

const exclusions = [
  ['survey_or_land', /топограф|геодез|геологіч|землевпоряд|землеустро|землевідвед|кадастров/i],
  ['supervision_or_consulting', /технічн(?:ий|ого)?\s+нагляд|авторськ(?:ий|ого)?\s+нагляд|інженер.?консультант|консультаційн.*будівництв/i],
  ['expertise', /експертиз|експертн.*звіт|експертн.*оцін/i],
  ['design_documentation', /розроб(?:ка|лення).*?(?:проєктн|проектн|кошторисн).*документац|виготовлення.*?(?:проєктн|проектн|кошторисн).*документац|проєктно.?кошторисн|проектно.?кошторисн|коригування.*(?:проєктн|проектн).*документац|послуги з інженерного про[єе]ктування/i],
  ['inspection_or_inventory', /обстеження.*(?:будів|споруд|мереж|конструкц)|паспортизац|технічн.*інвентаризац/i],
];

function excludedReason(title) {
  for (const [reason, pattern] of exclusions) if (pattern.test(title || '')) return reason;
  return '';
}

const excludedRecords = records.map(record => ({ ...record, excluded_reason:excludedReason(record.tender_title) })).filter(x => x.excluded_reason);
const eligibleRecords = records.filter(record => !excludedReason(record.tender_title));

const grouped = new Map();
for (const record of eligibleRecords) {
  const current = grouped.get(record.supplier_edrpou) || {
    supplier_edrpou:record.supplier_edrpou, names:new Set(), urls:new Set(), domains:new Set(), regions:new Set(), localities:new Set(), scales:new Set(),
    segments:new Set(), tenderIds:new Set(), tenderTitles:[], tenderUrls:[], tender_count:0, total_award_value_uah:0,
    active_contract_count:0, latest_award_date:'', latest_delivery_end_date:'',
  };
  current.names.add(record.supplier_name);
  if (record.supplier_url) current.urls.add(record.supplier_url);
  if (record.supplier_domain) current.domains.add(record.supplier_domain);
  if (record.supplier_region) current.regions.add(record.supplier_region);
  if (record.supplier_locality) current.localities.add(record.supplier_locality);
  if (record.supplier_scale) current.scales.add(record.supplier_scale);
  record.segments.forEach(segment => current.segments.add(segment));
  if (!current.tenderIds.has(record.tender_id)) {
    current.tenderIds.add(record.tender_id);
    current.tender_count += 1;
    current.total_award_value_uah += record.award_value_uah;
    if (['active', 'pending'].includes(record.contract_status)) current.active_contract_count += 1;
    current.tenderTitles.push(record.tender_title);
    current.tenderUrls.push(record.tender_url);
    if (record.award_date > current.latest_award_date) current.latest_award_date = record.award_date;
    if (record.delivery_end_date > current.latest_delivery_end_date) current.latest_delivery_end_date = record.delivery_end_date;
  }
  grouped.set(record.supplier_edrpou, current);
}

function intentScore(row) {
  const days = Math.max(0, Math.floor((AS_OF - new Date(row.latest_award_date || '2000-01-01')) / 86400000));
  const recency = days <= 45 ? 30 : days <= 120 ? 24 : days <= 240 ? 16 : days <= 500 ? 8 : 4;
  const activity = Math.min(20, row.tender_count * 5) + Math.min(15, row.active_contract_count * 5);
  const value = row.total_award_value_uah >= 10_000_000 ? 20 : row.total_award_value_uah >= 2_000_000 ? 16 : row.total_award_value_uah >= 500_000 ? 12 : row.total_award_value_uah >= 100_000 ? 8 : 4;
  const breadth = Math.min(10, row.segments.size * 3);
  const entity = [...row.names].some(name => !/^\s*(фоп|фізичн)/iu.test(name)) ? 5 : 2;
  return Math.min(100, recency + activity + value + breadth + entity);
}

const supplierLeads = [...grouped.values()].map(row => {
  const company_name = [...row.names].sort((a,b)=>b.length-a.length)[0] || '';
  const score = intentScore(row);
  const segments = [...row.segments];
  return {
    company_name, edrpou:row.supplier_edrpou, domain:[...row.domains][0] || '', company_url:[...row.urls][0] || '',
    company_type:/^\s*(фоп|фізичн)/iu.test(company_name) ? 'sole_proprietor' : 'legal_entity',
    regions:[...row.regions], localities:[...row.localities], segments, primary_segment:segments[0] || 'Спеціалізований підрядник',
    tender_count:row.tender_count, total_award_value_uah:Math.round(row.total_award_value_uah * 100) / 100,
    active_contract_count:row.active_contract_count, latest_award_date:row.latest_award_date,
    latest_delivery_end_date:row.latest_delivery_end_date, latest_tender_id:[...row.tenderIds].sort().at(-1) || '',
    latest_tender_url:row.tenderUrls[0] || '', tender_ids:[...row.tenderIds],
    tender_titles:[...new Set(row.tenderTitles)].slice(0, 10), tender_urls:[...new Set(row.tenderUrls)].slice(0, 10),
    intent_score:score, intent_priority:score >= 75 ? 'I1' : score >= 58 ? 'I2' : 'I3', evidence_confidence:'high',
    verification_status:'official_prozorro_award_work_scope', research_date:'2026-08-24',
  };
}).sort((a,b)=>b.intent_score-a.intent_score || b.total_award_value_uah-a.total_award_value_uah || a.company_name.localeCompare(b.company_name,'uk'));

const reasonCounts = excludedRecords.reduce((acc, x) => ((acc[x.excluded_reason] = (acc[x.excluded_reason] || 0) + 1), acc), {});
const summary = {
  generated_at:'2026-08-24T23:59:59+03:00',
  input_award_records:records.length,
  excluded_service_records:excludedRecords.length,
  excluded_unique_tenders:new Set(excludedRecords.map(x => x.tender_id)).size,
  excluded_supplier_entities:new Set(excludedRecords.map(x => x.supplier_edrpou)).size,
  exclusion_reason_counts:reasonCounts,
  eligible_award_records:eligibleRecords.length,
  eligible_unique_tenders:new Set(eligibleRecords.map(x => x.tender_id)).size,
  eligible_supplier_leads:supplierLeads.length,
  priority_counts:supplierLeads.reduce((acc, x) => ((acc[x.intent_priority] = (acc[x.intent_priority] || 0) + 1), acc), {}),
  segment_counts:supplierLeads.flatMap(x => x.segments).reduce((acc, x) => ((acc[x] = (acc[x] || 0) + 1), acc), {}),
};

fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave4_tender_records_cleaned_2026-08-24.json'), JSON.stringify(eligibleRecords, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave4_excluded_service_records_2026-08-24.json'), JSON.stringify(excludedRecords, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave4_supplier_leads_cleaned_2026-08-24.json'), JSON.stringify(supplierLeads, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave4_cleaning_summary_2026-08-24.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('Top cleaned leads:');
console.log(supplierLeads.slice(0, 30).map(x => ({ company:x.company_name, edrpou:x.edrpou, segment:x.primary_segment, intent:x.intent_score, priority:x.intent_priority, tenders:x.tender_count, value:x.total_award_value_uah })));
