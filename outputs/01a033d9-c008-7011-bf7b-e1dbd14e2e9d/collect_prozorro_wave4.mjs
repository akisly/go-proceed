import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const AS_OF = new Date('2026-08-24T23:59:59+03:00');
const priorRecords = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave3_tender_records_2026-08-24.json'), 'utf8'));
const priorTenderIds = new Set(priorRecords.map(row => row.tender_id));

const configs = [
  { segment:'Покрівлі та гідроізоляція', query:'покрівельні роботи', pages:[1,5], match:/(ремонт|монтаж|реконструкц|влаштування|заміна).*(покрівл|даху?)/iu },
  { segment:'Покрівлі та гідроізоляція', query:'гідроізоляційні роботи', pages:[1,5], match:/(гідроізоляц|водоізоляц).*(робіт|покрит|фундамент|покрівл)|(?:робіт|влаштування).*(гідроізоляц)/iu },
  { segment:'Фасади та скління', query:'утеплення фасаду', pages:[1,5], match:/(утеплен|термомодернізац|ремонт|монтаж).*(фасад)/iu },
  { segment:'Фасади та скління', query:'вентильований фасад монтаж', pages:[1,5], match:/(монтаж|влаштування|реконструкц).*(вентильован.*фасад|фасадн.*систем)/iu },
  { segment:'Фасади та скління', query:'монтаж алюмінієвих конструкцій скління', pages:[1,5], match:/(монтаж|встановлення|заміна).*(вікон|склін|алюмінієв.*конструкц|світлопрозор)/iu },
  { segment:'Промислові підлоги та бетон', query:'влаштування промислової підлоги', pages:[1,5], match:/(влаштування|ремонт|улаштування).*(промислов.*підлог|бетонн.*підлог|полімерн.*підлог)/iu },
  { segment:'Промислові підлоги та бетон', query:'бетонні роботи армування', pages:[1,5], match:/(бетонуван|бетонн.*робіт|армуван|залізобетон).*(конструкц|фундамент|плит|стін)|(?:влаштування|ремонт).*(бетонн)/iu },
  { segment:'Палі та фундаменти', query:'пальові роботи фундамент', pages:[1,5], match:/(пальов|буронабивн.*пал|забиван.*пал|влаштування пал|фундаментн.*робіт)/iu },
  { segment:'Металоконструкції', query:'монтаж металоконструкцій', pages:[1,5], match:/(монтаж|виготовлення|влаштування|ремонт).*(металоконструкц|сталев.*конструкц)/iu },
  { segment:'Металоконструкції', query:'зварювальні роботи металоконструкції', pages:[1,5], match:/(зварювальн.*робіт|зварюван).*(металоконструкц|трубопровод|конструкц)|(?:ремонт|монтаж).*(зварн.*конструкц)/iu },
  { segment:'Пасивний вогнезахист', query:'вогнезахисна обробка конструкцій', pages:[1,5], match:/(вогнезахисн|вогнегасн.*оброб|вогнетривк).*(конструкц|покрит|дерев|метал)/iu },
  { segment:'Пасивний вогнезахист', query:'вогнезахист кабельних проходок', pages:[1,5], match:/(вогнезахист|протипожежн).*(проходок|кабел|перешкод|клапан)/iu },
  { segment:'Промислова теплоізоляція', query:'теплоізоляція трубопроводів', pages:[1,5], match:/(теплоізоляц|ізоляц).*(трубопровод|теплов.*мереж|обладнан|резервуар)/iu },
  { segment:'СКС / BMS / слаботочка', query:'монтаж структурованої кабельної системи', pages:[1,5], match:/(монтаж|влаштування|побудова).*(структурован.*кабельн|скс|локальн.*мереж)/iu },
  { segment:'СКС / BMS / слаботочка', query:'монтаж BMS диспетчеризації будівлі', pages:[1,5], match:/(монтаж|впровадження|реконструкц).*(bms|диспетчеризац|автоматизац.*будів)/iu },
  { segment:'СКС / BMS / слаботочка', query:'монтаж слаботочних систем', pages:[1,5], match:/(монтаж|влаштування|реконструкц).*(слаботочн|слабкострум)/iu },
  { segment:'Ліфти та підйомники', query:'монтаж ліфта', pages:[1,5], match:/(монтаж|заміна|модернізац|капітальн.*ремонт).*(ліфт|підйомник)/iu },
  { segment:'Ліфти та підйомники', query:'монтаж ескалатора', pages:[1,5], match:/(монтаж|заміна|модернізац|ремонт).*(ескалатор|траволатор)/iu },
  { segment:'Чисті приміщення', query:'монтаж чистих приміщень', pages:[1,5], match:/(монтаж|облаштування|реконструкц).*(чист.*приміщ|операційн.*блок|стерильн.*зон)/iu },
  { segment:'Басейни та водні комплекси', query:'будівництво басейну монтаж обладнання', pages:[1,5], match:/(будівницт|реконструкц|монтаж|ремонт).*(басейн|чаш.*басейн|водн.*комплекс)/iu },
  { segment:'Дорожні роботи', query:'капітальний ремонт дорожнього покриття', pages:[1,5], match:/(капітальн.*ремонт|реконструкц|будівницт|відновлення).*(дорог|дорожн.*покрит|проїзн.*частин)/iu },
  { segment:'Благоустрій', query:'комплексний благоустрій території', pages:[1,5], match:/(благоустр|влаштування|реконструкц).*(територ|майданчик|тротуар|пішохід)/iu },
  { segment:'Стиснене повітря / компресорні', query:'монтаж системи стисненого повітря', pages:[1,5], match:/(монтаж|реконструкц|будівницт).*(стиснен.*повітр|пневмомереж|компресорн)/iu },
  { segment:'Газові мережі', query:'будівництво газопроводу', pages:[1,5], match:/(будівницт|реконструкц|ремонт|перекладання).*(газопровод|газов.*мереж|газопостач)/iu },
  { segment:'Пожежогасіння', query:'монтаж автоматичної системи пожежогасіння', pages:[1,5], match:/(монтаж|встановлення|реконструкц).*(пожежогасін|спринклер|дренчер|внутрішн.*протипожежн.*водопровод)/iu },
  { segment:'Підстанції / силові мережі', query:'будівництво трансформаторної підстанції', pages:[1,5], match:/(будівницт|реконструкц|монтаж|модернізац).*(трансформаторн.*підстанц|кТП|пс\s*\d|розподільч.*пункт)/iu },
  { segment:'Підстанції / силові мережі', query:'реконструкція електричної підстанції', pages:[1,5], match:/(реконструкц|будівницт|модернізац).*(електричн.*підстанц|підстанц.*кв|розподільч.*установ)/iu },
  { segment:'Зливова каналізація / дренаж', query:'будівництво зливової каналізації', pages:[1,5], match:/(будівницт|реконструкц|ремонт|влаштування).*(зливов.*каналіз|дощов.*каналіз|дренажн.*систем)/iu },
  { segment:'Зовнішнє освітлення', query:'будівництво мереж зовнішнього освітлення', pages:[1,5], match:/(будівницт|реконструкц|монтаж|капітальн.*ремонт).*(зовнішн.*освітлен|вуличн.*освітлен|мереж.*освітлен)/iu },
  { segment:'Промислова вентиляція', query:'монтаж промислової вентиляції', pages:[1,5], match:/(монтаж|реконструкц|будівницт).*(промислов.*вентиляц|аспіраці|димовидален)/iu },
  { segment:'Внутрішні сантехнічні системи', query:'внутрішні санітарно технічні роботи', pages:[4,8], match:/(монтаж|ремонт|реконструкц|влаштування).*(внутрішн.*водопостач|внутрішн.*каналіз|санітарно.?технічн)/iu },
  { segment:'Електромонтаж', query:'електромонтажні роботи', pages:[4,8], match:/(електромонтаж|електричн.*мереж|силов.*кабел|кабельн.*ліні)/iu },
  { segment:'HVAC / ОВіК', query:'монтаж системи вентиляції', pages:[4,8], match:/(монтаж|встановлення|реконструкц).*(вентиляц|кондиціон)/iu },
  { segment:'Пожежогасіння', query:'монтаж системи пожежної сигналізації', pages:[4,8], match:/(монтаж|встановлення|пусконалагодж).*(пожежн|сигналіза)/iu },
  { segment:'Водоочищення / очисні споруди', query:'реконструкція очисних споруд', pages:[4,8], match:/(будівницт|реконструкц|ремонт|модернізац).*(очисн.*споруд|водоочист|станц.*очищ)/iu },
  { segment:'Теплові мережі', query:'реконструкція теплових мереж', pages:[4,8], match:/(реконструкц|будівницт|ремонт|заміна).*(теплов.*мереж|теплотрас)/iu },
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchJson(url, options = {}, attempt = 1) {
  try {
    const response = await fetch(url, { ...options, signal:AbortSignal.timeout(20000), headers:{ accept:'application/json', 'user-agent':'GoProceed-prospect-research/1.1', ...(options.headers || {}) } });
    if (!response.ok) {
      if (attempt < 7 && (response.status === 429 || response.status >= 500)) {
        const waitMs = response.status === 429 ? Math.min(30000, 4000 * attempt) : Math.min(10000, 1000 * attempt);
        await delay(waitMs);
        return fetchJson(url, options, attempt + 1);
      }
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    }
    return response.json();
  } catch (error) {
    if (attempt < 4) { await delay(500 * attempt); return fetchJson(url, options, attempt + 1); }
    throw error;
  }
}
async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length); let cursor = 0;
  async function worker() { while (cursor < values.length) { const index = cursor++; try { results[index] = await mapper(values[index], index); } catch (error) { results[index] = { __error:String(error), input:values[index] }; } } }
  await Promise.all(Array.from({length:limit}, worker)); return results;
}
const tenderYear = id => Number(/^UA-(\d{4})-/.exec(id || '')?.[1] || 0);
const normalizeUrl = value => { if (!value) return ''; try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).href; } catch { return ''; } };
const domainFromUrl = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; } };
const supplierUrl = supplier => [supplier?.identifier?.uri, supplier?.contactPoint?.url].map(normalizeUrl).find(url => url && !/(prozorro|facebook|instagram|linkedin|youtube|t\.me)/i.test(url)) || '';

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
    await delay(180);
  }
  console.error(`search ${ci + 1}/${configs.length} ${config.segment}: ${searchHits.length} matches`);
  await delay(300);
}

const byTender = new Map();
for (const hit of searchHits) {
  const current = byTender.get(hit.tenderID) || { ...hit, segments:[], search_queries:[] };
  if (!current.segments.includes(hit.segment)) current.segments.push(hit.segment);
  if (!current.search_queries.includes(hit.search_query)) current.search_queries.push(hit.search_query);
  byTender.set(hit.tenderID, current);
}
const seeds = [...byTender.values()]; let progress = 0;
const details = await mapLimit(seeds, 5, async seed => {
  const summary = await fetchJson(`https://prozorro.gov.ua/api/tenders/${encodeURIComponent(seed.tenderID)}/summary`);
  if (!summary.id) throw new Error(`No API id for ${seed.tenderID}`);
  const full = await fetchJson(`https://public-api.prozorro.gov.ua/api/2.5/tenders/${summary.id}`);
  progress += 1; if (progress % 50 === 0) console.error(`details ${progress}/${seeds.length}`);
  return { seed, tender:full.data };
});

const tenderRecords = [];
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
      tenderRecords.push({
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

const grouped = new Map();
for (const record of tenderRecords) {
  const current = grouped.get(record.supplier_edrpou) || { supplier_edrpou:record.supplier_edrpou, names:new Set(), urls:new Set(), domains:new Set(), regions:new Set(), localities:new Set(), scales:new Set(), segments:new Set(), tenderIds:new Set(), tenderTitles:[], tenderUrls:[], tender_count:0, total_award_value_uah:0, active_contract_count:0, latest_award_date:'', latest_delivery_end_date:'' };
  current.names.add(record.supplier_name); if(record.supplier_url) current.urls.add(record.supplier_url); if(record.supplier_domain) current.domains.add(record.supplier_domain);
  if(record.supplier_region) current.regions.add(record.supplier_region); if(record.supplier_locality) current.localities.add(record.supplier_locality); if(record.supplier_scale) current.scales.add(record.supplier_scale);
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
  return { company_name, edrpou:row.supplier_edrpou, domain:[...row.domains][0] || '', company_url:[...row.urls][0] || '', company_type:/^\s*(фоп|фізичн)/iu.test(company_name) ? 'sole_proprietor' : 'legal_entity', regions:[...row.regions], localities:[...row.localities], segments, primary_segment:segments[0] || 'Спеціалізований підрядник', tender_count:row.tender_count, total_award_value_uah:Math.round(row.total_award_value_uah*100)/100, active_contract_count:row.active_contract_count, latest_award_date:row.latest_award_date, latest_delivery_end_date:row.latest_delivery_end_date, latest_tender_id:[...row.tenderIds].sort().at(-1) || '', latest_tender_url:row.tenderUrls[0] || '', tender_ids:[...row.tenderIds], tender_titles:[...new Set(row.tenderTitles)].slice(0,10), tender_urls:[...new Set(row.tenderUrls)].slice(0,10), intent_score:score, intent_priority:score>=75?'I1':score>=58?'I2':'I3', evidence_confidence:'high', verification_status:'official_prozorro_award', research_date:'2026-08-24' };
}).sort((a,b)=>b.intent_score-a.intent_score || b.total_award_value_uah-a.total_award_value_uah || a.company_name.localeCompare(b.company_name,'uk'));

const summary = { generated_at:'2026-08-24T23:59:59+03:00', source:'Official Prozorro search and public tender APIs', search_configs:configs.length, search_pages:configs.reduce((n,c)=>n+c.pages[1]-c.pages[0]+1,0), prior_tender_ids_excluded:priorTenderIds.size, matching_search_hits:searchHits.length, unique_new_tenders_scanned:seeds.length, successful_tender_details:details.filter(x=>x&&!x.__error).length, tender_detail_errors:details.filter(x=>x?.__error).length, tender_records_with_active_awards:tenderRecords.length, unique_supplier_leads:supplierLeads.length, priority_counts:supplierLeads.reduce((a,x)=>((a[x.intent_priority]=(a[x.intent_priority]||0)+1),a),{}), segment_counts:supplierLeads.flatMap(x=>x.segments).reduce((a,x)=>((a[x]=(a[x]||0)+1),a),{}) };
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave4_search_hits_2026-08-24.json'),JSON.stringify(searchHits,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave4_tender_records_2026-08-24.json'),JSON.stringify(tenderRecords,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave4_supplier_leads_2026-08-24.json'),JSON.stringify(supplierLeads,null,2));
fs.writeFileSync(path.join(OUT_DIR,'prozorro_wave4_summary_2026-08-24.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
