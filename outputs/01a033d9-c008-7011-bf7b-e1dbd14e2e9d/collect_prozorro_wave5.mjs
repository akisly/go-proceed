import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const AS_OF = new Date('2026-08-24T23:59:59+03:00');

const readJson = name => JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), 'utf8'));
const priorTenderIds = new Set();
for (const file of ['prozorro_wave3_tender_records_2026-08-24.json', 'prozorro_wave4_tender_records_2026-08-24.json']) {
  for (const row of readJson(file)) if (row.tender_id) priorTenderIds.add(row.tender_id);
}
for (const row of readJson('prospects_unified_v5_2026-08-24.json')) {
  if (row.latest_tender_id) priorTenderIds.add(row.latest_tender_id);
}

const configs = [
  { segment:'Промисловий холод', query:'монтаж холодильного обладнання', pages:[1,6], match:/(монтаж|встановлення|реконструкц|модернізац|капітальн.*ремонт).*(холодильн.*обладнан|холодильн.*установ|холодопостач)/iu },
  { segment:'Промисловий холод', query:'холодильна камера монтаж', pages:[1,6], match:/(монтаж|встановлення|будівницт|реконструкц|облаштування).*(холодильн.*камер|морозильн.*камер|холодильн.*склад)/iu },
  { segment:'Медичні гази', query:'система медичних газів монтаж', pages:[1,6], match:/(монтаж|встановлення|реконструкц|капітальн.*ремонт|облаштування).*(медичн.*газ|газопостачан.*мед|киснепостач)/iu },
  { segment:'Медичні гази', query:'киснепровід монтаж', pages:[1,6], match:/(монтаж|реконструкц|ремонт|облаштування).*(киснепровод|киснев.*систем|централізован.*кисн)/iu },
  { segment:'Стиснене повітря / компресорні', query:'компресорна станція реконструкція', pages:[1,6], match:/(монтаж|реконструкц|будівницт|модернізац|капітальн.*ремонт).*(компресорн.*станц|компресорн.*установ|компресорн)/iu },
  { segment:'Стиснене повітря / компресорні', query:'система стисненого повітря монтаж', pages:[1,6], match:/(монтаж|реконструкц|будівницт|облаштування).*(стиснен.*повітр|пневмомереж|повітропровод)/iu },
  { segment:'Чисті приміщення', query:'чисті приміщення монтаж', pages:[1,6], match:/(монтаж|облаштування|будівницт|реконструкц|капітальн.*ремонт).*(чист.*приміщ|чист.*зон|стерильн.*зон)/iu },
  { segment:'Чисті приміщення', query:'операційний блок реконструкція', pages:[1,6], match:/(реконструкц|капітальн.*ремонт|облаштування|будівницт).*(операційн.*блок|операційн.*зал|реанімаційн.*відділен)/iu },
  { segment:'Технологічні трубопроводи', query:'монтаж технологічних трубопроводів', pages:[1,6], match:/(монтаж|реконструкц|будівницт|заміна|капітальн.*ремонт).*(технологічн.*трубопровод|промислов.*трубопровод)/iu },
  { segment:'Технологічні трубопроводи', query:'монтаж паропроводу', pages:[1,6], match:/(монтаж|реконструкц|будівницт|заміна|ремонт).*(паропровод|конденсатопровод|трубопровод.*пар)/iu },
  { segment:'Сонячна енергетика', query:'будівництво сонячної електростанції', pages:[1,6], match:/(будівницт|монтаж|реконструкц|влаштування).*(сонячн.*електростанц|фотоелектричн.*станц|сес\b)/iu },
  { segment:'Сонячна енергетика', query:'монтаж фотоелектричних модулів', pages:[1,6], match:/(монтаж|встановлення|влаштування).*(фотоелектричн.*модул|сонячн.*панел|фотовольтаїчн)/iu },
  { segment:'Резервне живлення', query:'дизель генератор монтаж', pages:[1,6], match:/(монтаж|встановлення|підключення|облаштування|реконструкц).*(дизель.?генератор|дизельн.*електростанц|генераторн.*установ)/iu },
  { segment:'Резервне живлення', query:'безперебійне живлення монтаж', pages:[1,6], match:/(монтаж|встановлення|підключення|реконструкц).*(безперебійн.*живлен|дбж\b|ups\b|резервн.*електроживлен)/iu },
  { segment:'Накопичення енергії / BESS', query:'система накопичення енергії монтаж', pages:[1,6], match:/(монтаж|встановлення|будівницт|підключення).*(накопичення.*енергі|зберігання.*енергі|bess\b|акумуляторн.*станц)/iu },
  { segment:'ВОЛЗ / телеком', query:'будівництво волоконно оптичної лінії', pages:[1,6], match:/(будівницт|монтаж|прокладання|реконструкц).*(волоконно.?оптичн|оптичн.*ліні|волз\b)/iu },
  { segment:'ВОЛЗ / телеком', query:'телекомунікаційна мережа монтаж', pages:[1,6], match:/(будівницт|монтаж|прокладання|реконструкц).*(телекомунікаційн.*мереж|мереж.*зв.?язк|кабельн.*каналізац)/iu },
  { segment:'Промислова автоматизація / SCADA', query:'SCADA монтаж', pages:[1,6], match:/(монтаж|впровадження|модернізац|реконструкц|створення).*(scada|асутп|автоматизован.*систем.*керуван)/iu },
  { segment:'Промислова автоматизація / SCADA', query:'система телемеханіки реконструкція', pages:[1,6], match:/(монтаж|впровадження|модернізац|реконструкц|створення).*(телемеханік|телеметрі|диспетчерськ.*керуван)/iu },
  { segment:'ГНБ / безтраншейні роботи', query:'горизонтально направлене буріння', pages:[1,6], match:/(горизонтальн.*направлен.*бурін|гнб\b|прокол.*під.*дорог|безтраншейн.*прокладан)/iu },
  { segment:'ГНБ / безтраншейні роботи', query:'безтраншейна санація трубопроводу', pages:[1,6], match:/(безтраншейн|санаці|релайнінг|протягування).*(трубопровод|каналізац|водопровод|колектор)/iu },
  { segment:'Насосні станції', query:'реконструкція насосної станції', pages:[1,6], match:/(реконструкц|будівницт|капітальн.*ремонт|модернізац).*(насосн.*станц|насосн.*обладнан)/iu },
  { segment:'Насосні станції', query:'каналізаційна насосна станція будівництво', pages:[1,6], match:/(будівницт|реконструкц|капітальн.*ремонт|модернізац).*(каналізаційн.*насосн|кнс\b)/iu },
  { segment:'Зовнішні мережі', query:'будівництво зовнішніх мереж водопостачання', pages:[1,6], match:/(будівницт|реконструкц|капітальн.*ремонт|прокладання).*(зовнішн.*мереж.*водопостач|водопровідн.*мереж|водогон)/iu },
  { segment:'Зовнішні мережі', query:'будівництво каналізаційного колектора', pages:[1,6], match:/(будівницт|реконструкц|капітальн.*ремонт|прокладання).*(каналізаційн.*колектор|мереж.*водовідвед|зовнішн.*каналізац)/iu },
  { segment:'ЦОД / серверні', query:'центр обробки даних будівництво', pages:[1,6], match:/(будівницт|реконструкц|облаштування|модернізац).*(центр.*обробк.*дан|цод\b|data.?center)/iu },
  { segment:'ЦОД / серверні', query:'серверне приміщення реконструкція', pages:[1,6], match:/(реконструкц|облаштування|капітальн.*ремонт|модернізац).*(серверн.*приміщ|серверн.*кімнат|машинн.*зал)/iu },
  { segment:'Антикорозійний захист', query:'антикорозійний захист металоконструкцій', pages:[1,6], match:/(антикорозійн|протикорозійн).*(захист|оброб|покрит|фарбув).*(металоконструкц|трубопровод|резервуар|мост)|(?:фарбування|обробка).*(металоконструкц).*(антикорозійн|протикорозійн)/iu },
  { segment:'Антикорозійний захист', query:'фарбування промислових металоконструкцій', pages:[1,6], match:/(фарбування|очищення|піскострумин).*(металоконструкц|резервуар|трубопровод|сталев.*конструкц)/iu },
  { segment:'Ремонт і підсилення бетону', query:'підсилення будівельних конструкцій', pages:[1,6], match:/(підсилення|посилення|відновлення).*(будівельн.*конструкц|несуч.*конструкц|залізобетон|фундамент)/iu },
  { segment:'Ремонт і підсилення бетону', query:'ремонт залізобетонних конструкцій', pages:[1,6], match:/(ремонт|відновлення|підсилення).*(залізобетонн.*конструкц|бетонн.*конструкц|монолітн.*конструкц)/iu },
  { segment:'Промислова аспірація', query:'монтаж системи аспірації', pages:[1,6], match:/(монтаж|реконструкц|будівницт|модернізац).*(аспіраці|пиловидален|пилогазоочищ)/iu },
  { segment:'Димовидалення', query:'монтаж системи димовидалення', pages:[1,6], match:/(монтаж|реконструкц|влаштування|капітальн.*ремонт).*(димовидален|протидимн.*вентиляц|підпор.*повітр)/iu },
  { segment:'Блискавкозахист / заземлення', query:'монтаж блискавкозахисту', pages:[1,6], match:/(монтаж|встановлення|влаштування|реконструкц).*(блискавкозахист|грозозахист|заземлен)/iu },
  { segment:'Промислові ворота / докове обладнання', query:'монтаж промислових воріт', pages:[1,6], match:/(монтаж|встановлення|заміна|реконструкц).*(промислов.*воріт|секційн.*воріт|ангарн.*воріт|доков.*обладнан)/iu },
  { segment:'Крани / вантажопідіймальні системи', query:'монтаж кранового обладнання', pages:[1,6], match:/(монтаж|реконструкц|модернізац|капітальн.*ремонт).*(кранов.*обладнан|мостов.*кран|кран.?балк|вантажопідіймальн)/iu },
  { segment:'Залізнична інфраструктура', query:'ремонт залізничної колії', pages:[1,6], match:/(ремонт|реконструкц|будівницт|модернізац).*(залізничн.*колі|колійн.*господарств|стрілочн.*перевод)/iu },
  { segment:'Залізнична електрифікація', query:'електрифікація залізниці', pages:[1,6], match:/(будівницт|реконструкц|монтаж|модернізац).*(контактн.*мереж|електрифікац.*заліз|тягов.*підстанц)/iu },
  { segment:'Промислова електрика / ПНР', query:'пусконалагоджувальні електромонтажні роботи', pages:[1,6], match:/(пусконалагоджувальн|пуско.?налагоджувальн).*(електр|електрообладнан|релейн.*захист|автоматик)/iu },
  { segment:'Теплові пункти', query:'реконструкція індивідуального теплового пункту', pages:[1,6], match:/(реконструкц|монтаж|будівницт|модернізац|капітальн.*ремонт).*(індивідуальн.*теплов.*пункт|теплов.*пункт|ітп\b)/iu },
  { segment:'Промислові котельні', query:'реконструкція промислової котельні', pages:[1,6], match:/(реконструкц|будівницт|монтаж|модернізац|капітальн.*ремонт).*(котельн|котлоагрегат|котельн.*обладнан)/iu },
];

const exclusions = [
  ['survey_or_land', /топограф|геодез|геологіч|землевпоряд|землеустро|землевідвед|кадастров/iu],
  ['supervision_or_consulting', /технічн(?:ий|ого)?\s+нагляд|авторськ(?:ий|ого)?\s+нагляд|інженер.?консультант|консультаційн.*будівництв/iu],
  ['expertise', /експертиз|експертн.*звіт|експертн.*оцін/iu],
  ['design_documentation', /розроб(?:ка|лення).*?(?:проєктн|проектн|кошторисн).*документац|виготовлення.*?(?:проєктн|проектн|кошторисн).*документац|проєктно.?кошторисн|проектно.?кошторисн|коригування.*(?:проєктн|проектн).*документац|послуги з інженерного про[єе]ктування/iu],
  ['inspection_or_inventory', /обстеження.*(?:будів|споруд|мереж|конструкц)|паспортизац|технічн.*інвентаризац/iu],
  ['equipment_only', /^(?!.*(?:монтаж|встановлення|підключення|будівницт|реконструкц|ремонт|облаштування|влаштування|модернізац|прокладання|пусконалагодж)).*(?:поставка|закупівля|придбання|товар).*$/iu],
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchJson(url, options = {}, attempt = 1) {
  try {
    const response = await fetch(url, {
      ...options,
      signal:AbortSignal.timeout(25000),
      headers:{ accept:'application/json', 'user-agent':'GoProceed-prospect-research/1.2', ...(options.headers || {}) },
    });
    if (!response.ok) {
      if (attempt < 7 && (response.status === 429 || response.status >= 500)) {
        await delay(response.status === 429 ? Math.min(30000, 4000 * attempt) : Math.min(12000, 1200 * attempt));
        return fetchJson(url, options, attempt + 1);
      }
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    }
    return response.json();
  } catch (error) {
    if (attempt < 4) { await delay(600 * attempt); return fetchJson(url, options, attempt + 1); }
    throw error;
  }
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length); let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      try { results[index] = await mapper(values[index], index); }
      catch (error) { results[index] = { __error:String(error), input:values[index] }; }
    }
  }
  await Promise.all(Array.from({ length:limit }, worker));
  return results;
}

const tenderYear = id => Number(/^UA-(\d{4})-/.exec(id || '')?.[1] || 0);
const normalizeUrl = value => { if (!value) return ''; try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).href; } catch { return ''; } };
const domainFromUrl = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; } };
const supplierUrl = supplier => [supplier?.identifier?.uri, supplier?.contactPoint?.url].map(normalizeUrl).find(url => url && !/(prozorro|facebook|instagram|linkedin|youtube|t\.me)/i.test(url)) || '';
const excludedReason = title => exclusions.find(([, pattern]) => pattern.test(title || ''))?.[0] || '';

const searchHits = [];
for (let ci = 0; ci < configs.length; ci += 1) {
  const config = configs[ci];
  for (let page = config.pages[0]; page <= config.pages[1]; page += 1) {
    const url = new URL('https://prozorro.gov.ua/api/search/tenders');
    url.searchParams.set('text', config.query); url.searchParams.set('page', String(page));
    const payload = await fetchJson(url, { method:'POST' });
    for (const row of payload.data || []) {
      if (tenderYear(row.tenderID) < 2024 || priorTenderIds.has(row.tenderID)) continue;
      if (!config.match.test(row.title || '')) continue;
      searchHits.push({ segment:config.segment, search_query:config.query, search_page:page, ...row });
    }
    await delay(140);
  }
  console.error(`search ${ci + 1}/${configs.length} ${config.segment}: ${searchHits.length} matches`);
  await delay(220);
}

const byTender = new Map();
for (const hit of searchHits) {
  const current = byTender.get(hit.tenderID) || { ...hit, segments:[], search_queries:[] };
  if (!current.segments.includes(hit.segment)) current.segments.push(hit.segment);
  if (!current.search_queries.includes(hit.search_query)) current.search_queries.push(hit.search_query);
  byTender.set(hit.tenderID, current);
}
const seeds = [...byTender.values()]; let detailProgress = 0;
const details = await mapLimit(seeds, 6, async seed => {
  const summary = await fetchJson(`https://prozorro.gov.ua/api/tenders/${encodeURIComponent(seed.tenderID)}/summary`);
  if (!summary.id) throw new Error(`No API id for ${seed.tenderID}`);
  const full = await fetchJson(`https://public-api.prozorro.gov.ua/api/2.5/tenders/${summary.id}`);
  detailProgress += 1;
  if (detailProgress % 50 === 0) console.error(`details ${detailProgress}/${seeds.length}`);
  return { seed, tender:full.data };
});

const rawRecords = [];
for (const entry of details) {
  if (!entry || entry.__error) continue;
  const { seed, tender } = entry;
  const contractsByAward = new Map((tender.contracts || []).map(contract => [contract.awardID, contract]));
  const deliveryEndDates = (tender.items || []).map(item => item.deliveryDate?.endDate).filter(Boolean).sort();
  for (const award of (tender.awards || []).filter(a => a.status === 'active' && a.suppliers?.length)) {
    const contract = contractsByAward.get(award.id) || null;
    for (const supplier of award.suppliers || []) {
      const edrpou = String(supplier.identifier?.id || '').replace(/\D/g,'');
      if (!edrpou) continue;
      const url = supplierUrl(supplier);
      rawRecords.push({
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

const excludedRecords = rawRecords.map(record => ({ ...record, excluded_reason:excludedReason(record.tender_title) })).filter(x => x.excluded_reason);
const records = rawRecords.filter(record => !excludedReason(record.tender_title));
const grouped = new Map();
for (const record of records) {
  const current = grouped.get(record.supplier_edrpou) || {
    supplier_edrpou:record.supplier_edrpou, names:new Set(), urls:new Set(), domains:new Set(), regions:new Set(), localities:new Set(), scales:new Set(),
    segments:new Set(), tenderIds:new Set(), tenderTitles:[], tenderUrls:[], tender_count:0, total_award_value_uah:0,
    active_contract_count:0, latest_award_date:'', latest_delivery_end_date:'',
  };
  current.names.add(record.supplier_name); if (record.supplier_url) current.urls.add(record.supplier_url); if (record.supplier_domain) current.domains.add(record.supplier_domain);
  if (record.supplier_region) current.regions.add(record.supplier_region); if (record.supplier_locality) current.localities.add(record.supplier_locality); if (record.supplier_scale) current.scales.add(record.supplier_scale);
  record.segments.forEach(segment => current.segments.add(segment));
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
    verification_status:'official_prozorro_award_work_scope', research_date:'2026-08-24',
  };
}).sort((a,b)=>b.intent_score-a.intent_score || b.total_award_value_uah-a.total_award_value_uah || a.company_name.localeCompare(b.company_name,'uk'));

const reasonCounts = excludedRecords.reduce((acc, x) => ((acc[x.excluded_reason] = (acc[x.excluded_reason] || 0) + 1), acc), {});
const summary = {
  generated_at:'2026-08-24T23:59:59+03:00', source:'Official Prozorro search and public tender APIs', search_configs:configs.length,
  search_pages:configs.reduce((n,c)=>n+c.pages[1]-c.pages[0]+1,0), prior_tender_ids_excluded:priorTenderIds.size,
  matching_search_hits:searchHits.length, unique_new_tenders_scanned:seeds.length, successful_tender_details:details.filter(x=>x&&!x.__error).length,
  tender_detail_errors:details.filter(x=>x?.__error).length, raw_award_records:rawRecords.length, excluded_service_or_supply_records:excludedRecords.length,
  exclusion_reason_counts:reasonCounts, eligible_award_records:records.length, eligible_unique_tenders:new Set(records.map(x=>x.tender_id)).size,
  unique_supplier_leads:supplierLeads.length, priority_counts:supplierLeads.reduce((a,x)=>((a[x.intent_priority]=(a[x.intent_priority]||0)+1),a),{}),
  segment_counts:supplierLeads.flatMap(x=>x.segments).reduce((a,x)=>((a[x]=(a[x]||0)+1),a),{}),
};

fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave5_search_hits_2026-08-24.json'),JSON.stringify(searchHits,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave5_tender_records_raw_2026-08-24.json'),JSON.stringify(rawRecords,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave5_tender_records_cleaned_2026-08-24.json'),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave5_excluded_records_2026-08-24.json'),JSON.stringify(excludedRecords,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave5_supplier_leads_cleaned_2026-08-24.json'),JSON.stringify(supplierLeads,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave5_summary_2026-08-24.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
console.log('Top cleaned leads:');
console.log(supplierLeads.slice(0,30).map(x=>({company:x.company_name,edrpou:x.edrpou,segment:x.primary_segment,intent:x.intent_score,priority:x.intent_priority,tenders:x.tender_count,value:x.total_award_value_uah,domain:x.domain})));
