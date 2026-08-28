import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const BASE_PATH = path.join(OUT_DIR, 'prospects_unified_268_2026-08-24.json');
const AS_OF = new Date('2026-08-24T23:00:00+03:00');

const configs = [
  { segment: 'Електромонтаж', query: 'електромонтажні роботи', match: /(електромонтаж|електричн.*мереж|силов.*кабел|кабельн.*ліні)/iu },
  { segment: 'Електромонтаж', query: 'монтаж електричних мереж', match: /(монтаж|будівницт|реконструкц).*(електричн|електромереж|кабель)/iu },
  { segment: 'Електромонтаж', query: 'заземлення електровимірювальні роботи', match: /(заземл|електровимір|опору ізоляц|блискавкозахист)/iu },
  { segment: 'Пожежогасіння', query: 'монтаж системи пожежної сигналізації', match: /(монтаж|встановлення|пусконалагодж).*(пожежн|сигналіза)/iu },
  { segment: 'Безпека / СКУД / CCTV', query: 'монтаж системи відеоспостереження', match: /(монтаж|встановлення|облаштування).*(відеоспостереж|відеонагляд)/iu },
  { segment: 'Безпека / СКУД / CCTV', query: 'монтаж системи контролю доступу', match: /(монтаж|встановлення|облаштування).*(контрол.*доступ|скуд|охоронн.*сигнал)/iu },
  { segment: 'HVAC / ОВіК', query: 'монтаж системи вентиляції', match: /(монтаж|встановлення|реконструкц).*(вентиляц|кондиціон)/iu },
  { segment: 'HVAC / ОВіК', query: 'монтаж системи опалення', match: /(монтаж|встановлення|реконструкц|капітальн.*ремонт).*(опален|теплопостач)/iu },
  { segment: 'Внутрішні сантехнічні системи', query: 'монтаж водопостачання та каналізації', match: /(монтаж|будівницт|реконструкц|ремонт).*(водопостач|водовідвед|каналіза)/iu },
  { segment: 'Водоочищення / очисні споруди', query: 'реконструкція очисних споруд', match: /(будівницт|реконструкц|ремонт|модернізац).*(очисн.*споруд|водоочист|станц.*очищ)/iu },
  { segment: 'ГНБ / безтраншейні роботи', query: 'горизонтально направлене буріння', match: /(горизонтальн.*(направ|спрям).*бур|гнб|безтраншей)/iu },
  { segment: 'ВОЛЗ / телеком', query: 'будівництво ВОЛЗ', match: /(будівницт|прокладання|монтаж|реконструкц).*(волз|волоконно.?оптич|оптичн.*кабел)/iu },
  { segment: 'Резервне живлення', query: 'монтаж системи безперебійного живлення', match: /(монтаж|встановлення|пусконалагодж).*(безперебійн.*живлен|дбж|ups|генератор)/iu },
  { segment: 'Сонячна енергетика', query: 'монтаж сонячної електростанції', match: /(монтаж|встановлення|будівницт).*(сонячн.*електростанц|фотоелектр|сонячн.*панел)/iu },
  { segment: 'Газопостачання / котельні', query: 'монтаж котельні', match: /(монтаж|реконструкц|будівницт|модернізац).*(котельн|теплогенератор)/iu },
  { segment: 'Медичні гази', query: 'монтаж системи медичних газів', match: /(монтаж|встановлення|реконструкц).*(медичн.*газ|киснепровод|киснев.*станц)/iu },
  { segment: 'Автоматизація / SCADA', query: 'монтаж системи автоматизації SCADA', match: /(монтаж|впровадження|реконструкц|автоматизац).*(scada|асутп|диспетчеризац|автоматизац)/iu },
  { segment: 'Технологічні трубопроводи', query: 'монтаж технологічних трубопроводів', match: /(монтаж|реконструкц|ремонт).*(технологічн.*трубопровод|промислов.*трубопровод)/iu },
  { segment: 'Промисловий холод', query: 'монтаж холодильного обладнання', match: /(монтаж|встановлення|реконструкц).*(холодильн.*обладнан|холодильн.*установ|холодопостач)/iu },
  { segment: 'Мости / інфраструктура', query: 'ремонт мосту', match: /(ремонт|реконструкц|будівницт).*(мост|шляхопровод)/iu },
  { segment: 'Ремонт і підсилення бетону', query: 'підсилення залізобетонних конструкцій', match: /(підсилення|відновлення|ремонт).*(залізобетон|бетонн.*конструкц|фундамент)/iu },
  { segment: 'Насосні станції', query: 'реконструкція насосної станції', match: /(реконструкц|будівницт|ремонт|модернізац).*(насосн.*станц|кнс)/iu },
  { segment: 'Теплові мережі', query: 'реконструкція теплових мереж', match: /(реконструкц|будівницт|ремонт|заміна).*(теплов.*мереж|теплотрас)/iu },
  { segment: 'Зовнішні мережі', query: 'будівництво зовнішніх інженерних мереж', match: /(будівницт|реконструкц|монтаж).*(зовнішн.*інженерн.*мереж|інженерн.*мереж)/iu },
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url, options = {}, attempt = 1) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        'accept': 'application/json',
        'user-agent': 'GoProceed-prospect-research/1.0',
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (attempt < 4) {
      await delay(400 * attempt);
      return fetchJson(url, options, attempt + 1);
    }
    throw error;
  }
  if (!response.ok) {
    if (attempt < 7 && (response.status === 429 || response.status >= 500)) {
      const retryAfter = Number(response.headers.get('retry-after') || 0) * 1000;
      const waitMs = response.status === 429
        ? Math.max(retryAfter, Math.min(30000, 5000 * attempt))
        : Math.min(10000, 1000 * attempt);
      await delay(waitMs);
      return fetchJson(url, options, attempt + 1);
    }
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  }
  return response.json();
}

async function mapLimit(values, limit, mapper) {
  const result = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      try {
        result[index] = await mapper(values[index], index);
      } catch (error) {
        result[index] = { __error: String(error), input: values[index] };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return result;
}

function tenderYear(tenderId) {
  const match = /^UA-(\d{4})-/.exec(tenderId || '');
  return match ? Number(match[1]) : 0;
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[«»“”"'`]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.href;
  } catch {
    return '';
  }
}

function domainFromUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return '';
  try {
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function supplierUrl(supplier) {
  const candidates = [supplier?.identifier?.uri, supplier?.contactPoint?.url];
  for (const candidate of candidates) {
    const url = normalizeUrl(candidate);
    if (url && !/(prozorro|facebook|instagram|linkedin|youtube|t\.me)/i.test(url)) return url;
  }
  return '';
}

const searchHits = [];
for (const config of configs) {
  for (let page = 1; page <= 3; page += 1) {
    const url = new URL('https://prozorro.gov.ua/api/search/tenders');
    url.searchParams.set('text', config.query);
    url.searchParams.set('page', String(page));
    const payload = await fetchJson(url, { method: 'POST' });
    for (const row of payload.data || []) {
      if (tenderYear(row.tenderID) < 2025) continue;
      if (!config.match.test(row.title || '')) continue;
      searchHits.push({
        segment: config.segment,
        search_query: config.query,
        ...row,
      });
    }
    await delay(350);
  }
  console.error(`search ${config.segment}: ${searchHits.length} matching hits accumulated`);
  await delay(800);
}

const byTender = new Map();
for (const hit of searchHits) {
  const existing = byTender.get(hit.tenderID) || { ...hit, segments: [], search_queries: [] };
  if (!existing.segments.includes(hit.segment)) existing.segments.push(hit.segment);
  if (!existing.search_queries.includes(hit.search_query)) existing.search_queries.push(hit.search_query);
  byTender.set(hit.tenderID, existing);
}

const tenderSeeds = [...byTender.values()];
let detailProgress = 0;
const enriched = await mapLimit(tenderSeeds, 5, async seed => {
  const summary = await fetchJson(`https://prozorro.gov.ua/api/tenders/${encodeURIComponent(seed.tenderID)}/summary`);
  if (!summary.id) throw new Error(`No API id for ${seed.tenderID}`);
  const full = await fetchJson(`https://public-api.prozorro.gov.ua/api/2.5/tenders/${summary.id}`);
  detailProgress += 1;
  if (detailProgress % 25 === 0) console.error(`details ${detailProgress}/${tenderSeeds.length}`);
  return { seed, summary, tender: full.data };
});

const tenderRecords = [];
for (const entry of enriched) {
  if (!entry || entry.__error) continue;
  const { seed, tender } = entry;
  const contractsByAward = new Map((tender.contracts || []).map(contract => [contract.awardID, contract]));
  const activeAwards = (tender.awards || []).filter(award => award.status === 'active' && (award.suppliers || []).length);
  for (const award of activeAwards) {
    const contract = contractsByAward.get(award.id) || null;
    const deliveryEndDates = (tender.items || []).map(item => item.deliveryDate?.endDate).filter(Boolean).sort();
    for (const supplier of award.suppliers || []) {
      const edrpou = supplier.identifier?.id || '';
      if (!edrpou) continue;
      const url = supplierUrl(supplier);
      tenderRecords.push({
        tender_id: tender.tenderID,
        tender_uuid: tender.id,
        tender_url: `https://prozorro.gov.ua/tender/${tender.tenderID}`,
        public_api_url: `https://public-api.prozorro.gov.ua/api/2.5/tenders/${tender.id}`,
        tender_title: tender.title || seed.title,
        tender_status: tender.status,
        tender_value_uah: Number(tender.value?.amount || 0),
        award_value_uah: Number(award.value?.amount || contract?.value?.amount || 0),
        award_date: award.date || tender.dateModified,
        contract_status: contract?.status || '',
        contract_id: contract?.contractID || '',
        delivery_end_date: deliveryEndDates.at(-1) || '',
        supplier_name: supplier.identifier?.legalName || supplier.name || '',
        supplier_edrpou: edrpou,
        supplier_scale: supplier.scale || '',
        supplier_url: url,
        supplier_domain: domainFromUrl(url),
        supplier_region: supplier.address?.region || '',
        supplier_locality: supplier.address?.locality || '',
        segments: seed.segments,
        search_queries: seed.search_queries,
        buyer_name: tender.procuringEntity?.identifier?.legalName || tender.procuringEntity?.name || seed.procuringEntity?.name || '',
      });
    }
  }
}

const grouped = new Map();
for (const record of tenderRecords) {
  const key = record.supplier_edrpou;
  const current = grouped.get(key) || {
    supplier_edrpou: key,
    supplier_names: new Set(),
    supplier_urls: new Set(),
    supplier_domains: new Set(),
    supplier_regions: new Set(),
    supplier_localities: new Set(),
    supplier_scales: new Set(),
    segments: new Set(),
    tender_ids: new Set(),
    tender_titles: [],
    tender_urls: [],
    tender_count: 0,
    total_award_value_uah: 0,
    max_award_value_uah: 0,
    active_contract_count: 0,
    recent_2026_count: 0,
    latest_award_date: '',
    latest_delivery_end_date: '',
  };
  current.supplier_names.add(record.supplier_name);
  if (record.supplier_url) current.supplier_urls.add(record.supplier_url);
  if (record.supplier_domain) current.supplier_domains.add(record.supplier_domain);
  if (record.supplier_region) current.supplier_regions.add(record.supplier_region);
  if (record.supplier_locality) current.supplier_localities.add(record.supplier_locality);
  if (record.supplier_scale) current.supplier_scales.add(record.supplier_scale);
  for (const segment of record.segments) current.segments.add(segment);
  if (!current.tender_ids.has(record.tender_id)) {
    current.tender_ids.add(record.tender_id);
    current.tender_count += 1;
    current.total_award_value_uah += record.award_value_uah;
    current.max_award_value_uah = Math.max(current.max_award_value_uah, record.award_value_uah);
    if (record.contract_status === 'active' || record.contract_status === 'pending') current.active_contract_count += 1;
    if (tenderYear(record.tender_id) === 2026) current.recent_2026_count += 1;
    current.tender_titles.push(record.tender_title);
    current.tender_urls.push(record.tender_url);
    if (record.award_date > current.latest_award_date) current.latest_award_date = record.award_date;
    if (record.delivery_end_date > current.latest_delivery_end_date) current.latest_delivery_end_date = record.delivery_end_date;
  }
  grouped.set(key, current);
}

function intentScore(row) {
  const latest = row.latest_award_date ? new Date(row.latest_award_date) : new Date('2000-01-01');
  const recencyDays = Math.max(0, Math.floor((AS_OF - latest) / 86400000));
  const recency = recencyDays <= 45 ? 30 : recencyDays <= 120 ? 24 : recencyDays <= 240 ? 16 : 8;
  const activity = Math.min(20, row.tender_count * 5) + Math.min(15, row.active_contract_count * 5);
  const value = row.total_award_value_uah >= 10_000_000 ? 20 : row.total_award_value_uah >= 2_000_000 ? 16 : row.total_award_value_uah >= 500_000 ? 12 : row.total_award_value_uah >= 100_000 ? 8 : 4;
  const breadth = Math.min(10, row.segments.size * 3);
  const corporate = [...row.supplier_names].some(name => !/^\s*(фоп|фізичн)/iu.test(name)) ? 5 : 2;
  return Math.min(100, recency + activity + value + breadth + corporate);
}

const tenderLeads = [...grouped.values()].map(row => {
  const score = intentScore(row);
  const primaryName = [...row.supplier_names].sort((a, b) => b.length - a.length)[0] || '';
  const primaryUrl = [...row.supplier_urls][0] || '';
  const primaryDomain = [...row.supplier_domains][0] || '';
  const segments = [...row.segments];
  const priority = score >= 75 ? 'I1' : score >= 58 ? 'I2' : 'I3';
  return {
    company_name: primaryName,
    edrpou: row.supplier_edrpou,
    domain: primaryDomain,
    company_url: primaryUrl,
    company_type: /^\s*(фоп|фізичн)/iu.test(primaryName) ? 'sole_proprietor' : 'legal_entity',
    regions: [...row.supplier_regions],
    localities: [...row.supplier_localities],
    segments,
    primary_segment: segments[0] || 'Інженерний підрядник',
    tender_count: row.tender_count,
    total_award_value_uah: Math.round(row.total_award_value_uah * 100) / 100,
    max_award_value_uah: Math.round(row.max_award_value_uah * 100) / 100,
    active_contract_count: row.active_contract_count,
    recent_2026_count: row.recent_2026_count,
    latest_award_date: row.latest_award_date,
    latest_delivery_end_date: row.latest_delivery_end_date,
    latest_tender_id: [...row.tender_ids].sort().at(-1) || '',
    latest_tender_url: row.tender_urls[0] || '',
    tender_ids: [...row.tender_ids],
    tender_titles: [...new Set(row.tender_titles)].slice(0, 8),
    tender_urls: [...new Set(row.tender_urls)].slice(0, 8),
    intent_score: score,
    intent_priority: priority,
    evidence_confidence: 'high',
    verification_status: 'official_prozorro_award',
    research_date: '2026-08-24',
  };
}).sort((a, b) => b.intent_score - a.intent_score || b.total_award_value_uah - a.total_award_value_uah || a.company_name.localeCompare(b.company_name, 'uk'));

const base = JSON.parse(fs.readFileSync(BASE_PATH, 'utf8'));
const baseByEdrpou = new Map(base.filter(row => row.edrpou).map(row => [String(row.edrpou), row]));
const baseByName = new Map(base.map(row => [normalizeText(row.company_name), row]));

const overlaps = [];
const newLeads = [];
for (const lead of tenderLeads) {
  const match = baseByEdrpou.get(String(lead.edrpou)) || baseByName.get(normalizeText(lead.company_name));
  if (match) {
    overlaps.push({ ...lead, matched_lead_id: match.lead_id, matched_company_name: match.company_name });
  } else {
    newLeads.push(lead);
  }
}

const summary = {
  generated_at: '2026-08-24T23:00:00+03:00',
  source: 'Official Prozorro search API plus official public tender API',
  search_configs: configs.length,
  search_pages_per_config: 3,
  matching_search_hits: searchHits.length,
  unique_tenders_scanned: tenderSeeds.length,
  successful_tender_details: enriched.filter(row => row && !row.__error).length,
  tender_records_with_active_awards: tenderRecords.length,
  unique_supplier_leads: tenderLeads.length,
  overlaps_with_base_268: overlaps.length,
  new_supplier_leads: newLeads.length,
  tender_detail_errors: enriched.filter(row => row?.__error).length,
  priority_counts: tenderLeads.reduce((acc, row) => ((acc[row.intent_priority] = (acc[row.intent_priority] || 0) + 1), acc), {}),
  segment_counts: tenderLeads.flatMap(row => row.segments).reduce((acc, segment) => ((acc[segment] = (acc[segment] || 0) + 1), acc), {}),
};

fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_search_hits_2026-08-24.json'), JSON.stringify(searchHits, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_tender_records_2026-08-24.json'), JSON.stringify(tenderRecords, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_supplier_leads_2026-08-24.json'), JSON.stringify(tenderLeads, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_overlaps_2026-08-24.json'), JSON.stringify(overlaps, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_new_leads_2026-08-24.json'), JSON.stringify(newLeads, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_summary_2026-08-24.json'), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
