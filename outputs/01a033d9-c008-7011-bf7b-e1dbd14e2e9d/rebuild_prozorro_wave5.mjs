import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const WAVE = process.env.PROZORRO_WAVE || '5';
const DATE_TAG = process.env.PROZORRO_DATE_TAG || '2026-08-24';
const AS_OF = new Date(process.env.PROZORRO_AS_OF || `${DATE_TAG}T23:59:59+03:00`);
const recordsRaw = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_tender_records_raw_merged_' + DATE_TAG + '.json'), 'utf8'));
const searchSummary = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_summary_' + DATE_TAG + '.json'), 'utf8'));
const retrySummary = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_retry_summary_' + DATE_TAG + '.json'), 'utf8'));

const exclusions = [
  ['survey_or_land', /топограф|геодез|геологіч|землевпоряд|землеустро|землевідвед|кадастров|інженерн.*вишукуван/iu],
  ['supervision_or_consulting', /технічн(?:ий|ого)?\s+нагляд|авторськ(?:ий|ого)?\s+нагляд|інженер.?консультант|консультаційн.*(?:будівництв|послуг)|отримання технічних умов|надання технічних умов|архітектурн.*інженерн.*планувальн.*послуг|перевірк.*обсяг.*фактично виконан.*робіт|послуги з нагляду|здійснення функцій служби замовника|науково.?технічн.*супровід/iu],
  ['expertise', /експертиз|експертн.*звіт|експертн.*оцін|сертифікаці|оцінк.*відповідност/iu],
  ['design_documentation', /розроб(?:ка|лення).*?(?:проєктн|проектн|кошторисн).*документац|виготовлення.*?(?:проєктн|проектн|кошторисн).*документац|проєктно.?кошторисн|проектно.?кошторисн|коригування.*(?:проєктн|проектн).*документац|послуги з інженерного про[єе]ктування|про[єе]ктні роботи|про[єе]ктно.?вишукувальн|роботи з розробки.*(?:робоч.*)?про[єе]кт|виготовлення.*робоч.*про[єе]кт|розробк.*робоч.*про[єе]кт|робочий про[єе]кт\b|підготовк.*про[єе]ктів та ескізів|архітектурн.*про[єе]ктуван/iu],
  ['research_or_environmental', /науково.?дослідн.*робот|наукове обґрунтування|оцінк.*вплив.*довкіл|овд\b|екологічн.*досліджен/iu],
  ['inspection_or_inventory', /обстеження.*(?:будів|споруд|мереж|конструкц|дна|тунел)|паспортизац|технічн.*інвентаризац|діагностик.*конструкц/iu],
  ['maintenance_only', /^(?!.*(?:монтаж|встановлення|підключення|будівницт|реконструкц|ремонт|облаштування|влаштування|модернізац|прокладання|пусконалагодж)).*(?:технічне|сервісне|регламентне)\s+обслуговування/iu],
  ['training_or_rental', /навчання|підвищення кваліфікац|оренда.*(?:технік|машин|обладнан)|прокат.*обладнан/iu],
  ['equipment_only', /^(?!.*(?:монтаж|встановлення|підключення|будівницт|реконструкц|ремонт|облаштування|влаштування|модернізац|прокладання|пусконалагодж|виконання робіт)).*(?:поставка|закупівля|придбання|товар|обладнання).*$/iu],
];
const excludedReason = title => exclusions.find(([, pattern]) => pattern.test(title || ''))?.[0] || '';
const sanitizeSupplierName = value => String(value || '')
  .split(/\.\s*КВБ:|,\s*відповідно до інформації ЄДР|кінцеві бенефіціарні власники/iu)[0]
  .replace(/\s+/g,' ')
  .trim();
const normalizedSegments = record => {
  const title=String(record.tender_title || '');
  const preferred=[];
  if(/полігон.*(?:відход|тпв)|сміттєзвалищ|переробк.*відход/iu.test(title)) preferred.push('Полігони відходів');
  if(/пожежн.*сигналізаці|керування евакуюван|пожежн.*спостеріган/iu.test(title)) preferred.push('Пожежні системи');
  if(/систем.*раннього виявлення|централізован.*моніторинг|систем.*оповіщення/iu.test(title)) preferred.push('Промислова автоматизація / SCADA');
  if(/електромонтажн.*робот|кабельн.*ліні|силов.*кабел/iu.test(title)) preferred.push('Промислова електрика / ПНР');
  return [...new Set([...preferred,...(record.segments || [])])];
};
const excludedRecords = recordsRaw.map(record => ({ ...record, excluded_reason:excludedReason(record.tender_title) })).filter(x => x.excluded_reason);
const records = recordsRaw.filter(record => !excludedReason(record.tender_title));

const grouped = new Map();
for (const record of records) {
  const current = grouped.get(record.supplier_edrpou) || {
    supplier_edrpou:record.supplier_edrpou, names:new Set(), urls:new Set(), domains:new Set(), regions:new Set(), localities:new Set(), scales:new Set(),
    segments:new Set(), tenderIds:new Set(), tenderTitles:[], tenderUrls:[], tender_count:0, total_award_value_uah:0,
    active_contract_count:0, latest_award_date:'', latest_delivery_end_date:'',
  };
  current.names.add(sanitizeSupplierName(record.supplier_name)); if (record.supplier_url) current.urls.add(record.supplier_url); if (record.supplier_domain) current.domains.add(record.supplier_domain);
  if (record.supplier_region) current.regions.add(record.supplier_region); if (record.supplier_locality) current.localities.add(record.supplier_locality); if (record.supplier_scale) current.scales.add(record.supplier_scale);
  normalizedSegments(record).forEach(segment => current.segments.add(segment));
  if (!current.tenderIds.has(record.tender_id)) {
    current.tenderIds.add(record.tender_id); current.tender_count += 1; current.total_award_value_uah += record.award_value_uah;
    if (['active','pending'].includes(record.contract_status)) current.active_contract_count += 1;
    current.tenderTitles.push(record.tender_title); current.tenderUrls.push(record.tender_url);
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
  const score = intentScore(row); const segments = [...row.segments];
  return {
    company_name, edrpou:row.supplier_edrpou, domain:[...row.domains][0] || '', company_url:[...row.urls][0] || '',
    company_type:/^\s*(фоп|фізичн)/iu.test(company_name) ? 'sole_proprietor' : 'legal_entity', regions:[...row.regions], localities:[...row.localities],
    segments, primary_segment:segments[0] || 'Спеціалізований підрядник', tender_count:row.tender_count,
    total_award_value_uah:Math.round(row.total_award_value_uah * 100) / 100, active_contract_count:row.active_contract_count,
    latest_award_date:row.latest_award_date, latest_delivery_end_date:row.latest_delivery_end_date,
    latest_tender_id:[...row.tenderIds].sort().at(-1) || '', latest_tender_url:row.tenderUrls[0] || '', tender_ids:[...row.tenderIds],
    tender_titles:[...new Set(row.tenderTitles)].slice(0,10), tender_urls:[...new Set(row.tenderUrls)].slice(0,10),
    intent_score:score, intent_priority:score >= 75 ? 'I1' : score >= 58 ? 'I2' : 'I3', evidence_confidence:'high',
    verification_status:'official_prozorro_award_work_scope', research_date:DATE_TAG,
  };
}).sort((a,b)=>b.intent_score-a.intent_score || b.total_award_value_uah-a.total_award_value_uah || a.company_name.localeCompare(b.company_name,'uk'));

const reasonCounts = excludedRecords.reduce((acc, x) => ((acc[x.excluded_reason] = (acc[x.excluded_reason] || 0) + 1), acc), {});
const summary = {
  generated_at:AS_OF.toISOString(), source:'Official Prozorro search and public tender APIs; retry complete',
  search_configs:searchSummary.search_configs, search_pages:searchSummary.search_pages, prior_tender_ids_excluded:searchSummary.prior_tender_ids_excluded,
  matching_search_hits:searchSummary.matching_search_hits, unique_new_tenders_scanned:searchSummary.unique_new_tenders_scanned,
  successful_tender_details:searchSummary.unique_new_tenders_scanned,
  remaining_tender_detail_errors:retrySummary.remaining_errors, raw_award_records:recordsRaw.length,
  excluded_service_or_supply_records:excludedRecords.length, exclusion_reason_counts:reasonCounts,
  eligible_award_records:records.length, eligible_unique_tenders:new Set(records.map(x=>x.tender_id)).size,
  unique_supplier_leads:supplierLeads.length, priority_counts:supplierLeads.reduce((a,x)=>((a[x.intent_priority]=(a[x.intent_priority]||0)+1),a),{}),
  segment_counts:supplierLeads.flatMap(x=>x.segments).reduce((a,x)=>((a[x]=(a[x]||0)+1),a),{}),
};
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_tender_records_cleaned_final_' + DATE_TAG + '.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_excluded_records_final_' + DATE_TAG + '.json'), JSON.stringify(excludedRecords, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_supplier_leads_final_' + DATE_TAG + '.json'), JSON.stringify(supplierLeads, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_summary_final_' + DATE_TAG + '.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
