import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const WAVE = process.env.PROZORRO_WAVE || '5';
const DATE_TAG = process.env.PROZORRO_DATE_TAG || '2026-08-24';
const hits = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_search_hits_' + DATE_TAG + '.json'), 'utf8'));
const existing = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_tender_records_raw_' + DATE_TAG + '.json'), 'utf8'));
const existingTenderIds = new Set(existing.map(row => row.tender_id));
const byTender = new Map();
for (const hit of hits) {
  if (existingTenderIds.has(hit.tenderID)) continue;
  const current = byTender.get(hit.tenderID) || { ...hit, segments:[], search_queries:[] };
  if (!current.segments.includes(hit.segment)) current.segments.push(hit.segment);
  if (!current.search_queries.includes(hit.search_query)) current.search_queries.push(hit.search_query);
  byTender.set(hit.tenderID, current);
}
const seeds = [...byTender.values()];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchJson(url, options = {}, attempt = 1) {
  try {
    const response = await fetch(url, {
      ...options, signal:AbortSignal.timeout(30000),
      headers:{ accept:'application/json', 'user-agent':'GoProceed-prospect-research/1.3-retry-wave' + WAVE, ...(options.headers || {}) },
    });
    if (!response.ok) {
      if (attempt < 8 && (response.status === 429 || response.status >= 500)) {
        await delay(response.status === 429 ? Math.min(40000, 5000 * attempt) : Math.min(15000, 1500 * attempt));
        return fetchJson(url, options, attempt + 1);
      }
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    }
    return response.json();
  } catch (error) {
    if (attempt < 5) { await delay(900 * attempt); return fetchJson(url, options, attempt + 1); }
    throw error;
  }
}
async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length); let cursor = 0;
  async function worker() { while (cursor < values.length) { const index = cursor++; try { results[index] = await mapper(values[index], index); } catch (error) { results[index] = { __error:String(error), input:values[index] }; } } }
  await Promise.all(Array.from({ length:limit }, worker)); return results;
}
const normalizeUrl = value => { if (!value) return ''; try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).href; } catch { return ''; } };
const domainFromUrl = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; } };
const supplierUrl = supplier => [supplier?.identifier?.uri, supplier?.contactPoint?.url].map(normalizeUrl).find(url => url && !/(prozorro|facebook|instagram|linkedin|youtube|t\.me)/i.test(url)) || '';

let progress = 0;
const details = await mapLimit(seeds, 4, async seed => {
  const summary = await fetchJson(`https://prozorro.gov.ua/api/tenders/${encodeURIComponent(seed.tenderID)}/summary`);
  if (!summary.id) throw new Error(`No API id for ${seed.tenderID}`);
  const full = await fetchJson(`https://public-api.prozorro.gov.ua/api/2.5/tenders/${summary.id}`);
  progress += 1; if (progress % 25 === 0) console.error(`retry ${progress}/${seeds.length}`);
  return { seed, tender:full.data };
});

const retryRecords = [];
for (const entry of details) {
  if (!entry || entry.__error) continue;
  const { seed, tender } = entry;
  const contractsByAward = new Map((tender.contracts || []).map(contract => [contract.awardID, contract]));
  const deliveryEndDates = (tender.items || []).map(item => item.deliveryDate?.endDate).filter(Boolean).sort();
  for (const award of (tender.awards || []).filter(a => a.status === 'active' && a.suppliers?.length)) {
    const contract = contractsByAward.get(award.id) || null;
    for (const supplier of award.suppliers || []) {
      const edrpou = String(supplier.identifier?.id || '').replace(/\D/g,''); if (!edrpou) continue;
      const url = supplierUrl(supplier);
      retryRecords.push({
        tender_id:tender.tenderID, tender_uuid:tender.id, tender_url:`https://prozorro.gov.ua/tender/${tender.tenderID}`,
        public_api_url:`https://public-api.prozorro.gov.ua/api/2.5/tenders/${tender.id}`, tender_title:tender.title || seed.title,
        tender_status:tender.status, award_value_uah:Number(award.value?.amount || contract?.value?.amount || 0), award_date:award.date || tender.dateModified,
        contract_status:contract?.status || '', delivery_end_date:deliveryEndDates.at(-1) || '', supplier_name:supplier.identifier?.legalName || supplier.name || '',
        supplier_edrpou:edrpou, supplier_scale:supplier.scale || '', supplier_url:url, supplier_domain:domainFromUrl(url),
        supplier_region:supplier.address?.region || '', supplier_locality:supplier.address?.locality || '', segments:seed.segments,
        search_queries:seed.search_queries, buyer_name:tender.procuringEntity?.identifier?.legalName || tender.procuringEntity?.name || '',
      });
    }
  }
}

const merged = [...existing];
const seen = new Set(existing.map(row => `${row.tender_id}|${row.supplier_edrpou}`));
for (const row of retryRecords) {
  const key = `${row.tender_id}|${row.supplier_edrpou}`;
  if (!seen.has(key)) { seen.add(key); merged.push(row); }
}
const errors = details.filter(x => x?.__error).map(x => ({ tender_id:x.input?.tenderID || '', error:x.__error }));
const summary = { attempted_missing_or_no_award:seeds.length, successful_details:details.filter(x=>x&&!x.__error).length, remaining_errors:errors.length, recovered_award_records:retryRecords.length, recovered_unique_tenders:new Set(retryRecords.map(x=>x.tender_id)).size, merged_raw_records:merged.length, merged_unique_tenders:new Set(merged.map(x=>x.tender_id)).size };
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_retry_records_' + DATE_TAG + '.json'), JSON.stringify(retryRecords, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_retry_errors_' + DATE_TAG + '.json'), JSON.stringify(errors, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_tender_records_raw_merged_' + DATE_TAG + '.json'), JSON.stringify(merged, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave' + WAVE + '_retry_summary_' + DATE_TAG + '.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
