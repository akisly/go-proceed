import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const WAVE = Number(process.env.PROZORRO_WAVE || 7);
const AS_OF = new Date(process.env.PROZORRO_AS_OF || '2026-08-24T23:59:59+03:00');
const DATE_TAG = process.env.PROZORRO_DATE_TAG || '2026-08-24';
const CONFIG_FILE = process.env.PROZORRO_CONFIG_FILE || `prozorro_wave${WAVE}_search_configs.json`;
const BASE_FILE = process.env.PROZORRO_BASE_FILE || `prospects_unified_v${Math.max(1, WAVE)}_2026-08-24.json`;
const OUTPUT_PREFIX = `prozorro_wave${WAVE}`;

const readJson = name => JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), 'utf8'));
const priorTenderIds = new Set();
for (const file of [
  'prozorro_wave3_tender_records_2026-08-24.json',
  'prozorro_wave4_tender_records_2026-08-24.json',
  'prozorro_wave5_tender_records_raw_merged_2026-08-24.json',
  'prozorro_wave6_tender_records_raw_merged_2026-08-24.json',
  'prozorro_wave7_tender_records_raw_merged_2026-08-24.json',
]) {
  if (!fs.existsSync(path.join(OUT_DIR, file))) continue;
  for (const row of readJson(file)) if (row.tender_id) priorTenderIds.add(row.tender_id);
}
for (const row of readJson(BASE_FILE)) {
  if (row.latest_tender_id) priorTenderIds.add(row.latest_tender_id);
}

const pages = [1, 8];
const wave6Configs = [
  { segment:'Промисловий демонтаж', query:'демонтаж промислових споруд', pages, match:/(демонтаж|розбирання|знесення).*(промислов|виробнич|будівл|споруд|цех|котельн)/iu },
  { segment:'Промисловий демонтаж', query:'знесення будівлі роботи', pages, match:/(знесення|демонтаж|розбирання).*(будівл|споруд|конструкц)/iu },
  { segment:'Підпірні конструкції', query:'підпірна стінка капітальний ремонт', pages, match:/(капітальн.*ремонт|реконструкц|будівницт|відновлення|влаштування).*(підпірн.*стін|підпорн.*стін)/iu },
  { segment:'Підпірні конструкції', query:'будівництво підпірної стінки', pages, match:/(будівницт|влаштування|реконструкц|укріплення).*(підпірн.*стін|підпорн.*стін)/iu },
  { segment:'Габіони / укріплення схилів', query:'габіонні конструкції влаштування', pages, match:/(влаштування|монтаж|будівницт|укріплення|реконструкц).*(габіон|підпірн.*конструкц)/iu },
  { segment:'Габіони / укріплення схилів', query:'укріплення схилу', pages, match:/(укріплення|стабілізац|протиаварійн.*робот|реконструкц).*(схил|зсув|відкос|укос)/iu },
  { segment:'Палі / спеціальні фундаменти', query:'влаштування пальового фундаменту', pages, match:/(влаштування|будівницт|монтаж|підсилення).*(пальов.*фундамент|буронабивн.*пал|свай|шпунт)/iu },
  { segment:'Палі / спеціальні фундаменти', query:'буронабивні палі роботи', pages, match:/(влаштування|будівницт|монтаж|підсилення).*(буронабивн.*пал|пальов.*пол|палі)/iu },
  { segment:'Гідротехнічні споруди', query:'реконструкція гідротехнічної споруди', pages, match:/(реконструкц|капітальн.*ремонт|будівницт|відновлення).*(гідротехнічн.*споруд|гребл|дамб|водоскид|шлюз)/iu },
  { segment:'Берегоукріплення', query:'берегоукріплення роботи', pages, match:/(берегоукріп|укріплення.*берег|протирозмивн|відновлення.*берегов)/iu },
  { segment:'Гідротехнічні споруди', query:'ремонт дамби', pages, match:/(ремонт|реконструкц|будівницт|відновлення).*(дамб|гребл|водозахисн.*споруд)/iu },
  { segment:'Днопоглиблення / порти', query:'днопоглиблювальні роботи', pages, match:/(днопоглиб|очищення.*дна|розчистк.*русла|поглиблення.*акватор)/iu },
  { segment:'Днопоглиблення / порти', query:'ремонт причалу', pages, match:/(ремонт|реконструкц|будівницт|відновлення).*(причал|пірс|портов.*споруд|набережн)/iu },
  { segment:'Тунелі / підземні споруди', query:'реконструкція тунелю', pages, match:/(реконструкц|капітальн.*ремонт|будівницт|відновлення).*(тунел|метрополітен|підземн.*споруд)/iu },
  { segment:'Тунелі / підземні споруди', query:'підземний перехід капітальний ремонт', pages, match:/(капітальн.*ремонт|реконструкц|будівницт|відновлення).*(підземн.*переход|пішохідн.*тунел)/iu },
  { segment:'Аеродромна інфраструктура', query:'ремонт злітно посадкової смуги', pages, match:/(ремонт|реконструкц|будівницт|відновлення).*(злітн.*посадков.*смуг|аеродромн.*покрит|руліжн.*доріж)/iu },
  { segment:'Аеродромна інфраструктура', query:'аеродромне світлосигнальне обладнання монтаж', pages, match:/(монтаж|встановлення|реконструкц|модернізац).*(світлосигнальн.*обладнан|аеродромн.*вогн|вогн.*аеродром)/iu },
  { segment:'Світлофори / дорожня автоматика', query:'будівництво світлофорного обєкта', pages, match:/(будівницт|реконструкц|монтаж|влаштування|капітальн.*ремонт).*(світлофорн.*об.?єкт|світлофор|дорожн.*контролер)/iu },
  { segment:'Світлофори / дорожня автоматика', query:'автоматизована система керування дорожнім рухом', pages, match:/(монтаж|впровадження|реконструкц|модернізац|будівницт).*(керування.*дорожн.*рух|аскдр|інтелектуальн.*транспортн.*систем)/iu },
  { segment:'Релейний захист / автоматика', query:'релейний захист автоматика монтаж', pages, match:/(монтаж|реконструкц|модернізац|пусконалагодж).*(релейн.*захист|протиаварійн.*автоматик|рза\b)/iu },
  { segment:'Релейний захист / автоматика', query:'автоматизація підстанції АСУ ТП', pages, match:/(монтаж|реконструкц|модернізац|впровадження).*(асу.?тп|автоматизац).*(підстанц|розподільч.*пристро)/iu },
  { segment:'Повітряні лінії електропередачі', query:'реконструкція повітряної лінії електропередачі', pages, match:/(реконструкц|будівницт|капітальн.*ремонт|модернізац).*(повітрян.*ліні|леп\b|пл[\s-]*(?:10|35|110|330))/iu },
  { segment:'Кабельні лінії електропередачі', query:'будівництво кабельної лінії', pages, match:/(будівницт|прокладання|реконструкц|монтаж).*(кабельн.*ліні|силов.*кабел|кл[\s-]*(?:6|10|35|110))/iu },
  { segment:'Залізнична автоматика / сигналізація', query:'залізнична автоматика сигналізація монтаж', pages, match:/(монтаж|реконструкц|модернізац|будівницт).*(залізничн.*автоматик|сигналізаці.*централізац|сцб\b|переїзн.*сигналізаці)/iu },
  { segment:'Залізнична електрифікація', query:'реконструкція контактної мережі залізниці', pages, match:/(реконструкц|будівницт|монтаж|модернізац|капітальн.*ремонт).*(контактн.*мереж|електрифікац.*заліз)/iu },
  { segment:'Свердловини / водозабір', query:'буріння артезіанської свердловини', pages, match:/(буріння|будівницт|облаштування|реконструкц|відновлення).*(артезіан.*свердловин|водозабірн.*свердловин|свердловин.*вод)/iu },
  { segment:'Зрошення / меліорація', query:'реконструкція зрошувальної системи', pages, match:/(реконструкц|будівницт|капітальн.*ремонт|відновлення).*(зрошувальн.*систем|зрошувальн.*мереж|іригаційн)/iu },
  { segment:'Зрошення / меліорація', query:'меліоративна система реконструкція', pages, match:/(реконструкц|будівницт|капітальн.*ремонт|відновлення).*(меліоративн.*систем|осушувальн.*систем|меліоративн.*мереж)/iu },
  { segment:'Сортування / переробка відходів', query:'сортувальна станція відходів будівництво', pages, match:/(будівницт|монтаж|реконструкц|облаштування).*(сортувальн.*станц|сортувальн.*ліні|переробк.*відход)/iu },
  { segment:'Полігони відходів', query:'реконструкція полігону твердих побутових відходів', pages, match:/(реконструкц|будівницт|капітальн.*ремонт|облаштування).*(полігон.*відход|полігон.*тпв|сміттєзвалищ)/iu },
  { segment:'Полігони відходів', query:'дегазація полігону монтаж', pages, match:/(монтаж|будівницт|реконструкц|влаштування).*(дегазаці.*полігон|газозбірн.*систем|фільтрат.*полігон)/iu },
  { segment:'Модульні будівлі', query:'монтаж модульної будівлі', pages, match:/(монтаж|встановлення|будівницт|облаштування).*(модульн.*будівл|модульн.*споруд|швидкомонтован.*будівл)/iu },
  { segment:'Модульні укриття', query:'будівництво модульного укриття', pages, match:/(будівницт|монтаж|встановлення|облаштування).*(модульн.*укрит|швидкоспоруджуван.*укрит|захисн.*модул)/iu },
  { segment:'Промислові підлоги', query:'влаштування промислової підлоги', pages, match:/(влаштування|ремонт|відновлення|нанесення).*(промислов.*підлог|полімерн.*підлог|епоксидн.*покрит)/iu },
  { segment:'Фальшпідлоги / спеціальні покриття', query:'фальшпідлога монтаж', pages, match:/(монтаж|влаштування|встановлення).*(фальшпідлог|піднят.*підлог|антистатичн.*підлог)/iu },
  { segment:'Резервуари / промислові ємності', query:'ремонт резервуара роботи', pages, match:/(ремонт|реконструкц|відновлення|монтаж|будівницт).*(резервуар|ємност|бак.*зберіган)/iu },
  { segment:'Електрохімічний захист', query:'електрохімічний захист трубопроводу монтаж', pages, match:/(монтаж|реконструкц|модернізац|ремонт).*(електрохімічн.*захист|катодн.*захист|станц.*катодн)/iu },
  { segment:'Когенерація', query:'когенераційна установка монтаж', pages, match:/(монтаж|встановлення|будівницт|підключення|реконструкц).*(когенераційн.*установ|когенераційн.*модул|когенерац)/iu },
  { segment:'Когенерація', query:'газопоршнева установка монтаж', pages, match:/(монтаж|встановлення|будівницт|підключення|реконструкц).*(газопоршнев.*установ|газопоршнев.*генератор|газов.*когенерац)/iu },
  { segment:'Зарядна інфраструктура', query:'зарядна станція електромобілів монтаж', pages, match:/(монтаж|встановлення|будівницт|підключення).*(зарядн.*станц.*електромоб|електрозарядн.*станц|ev.?charging)/iu },
  { segment:'Комерційний облік електроенергії', query:'АСКОЕ монтаж', pages, match:/(монтаж|впровадження|реконструкц|модернізац|створення).*(аско[еэ]|комерційн.*облік.*електроенерг|автоматизован.*облік.*електро)/iu },
  { segment:'Вузли обліку тепла', query:'вузол обліку теплової енергії монтаж', pages, match:/(монтаж|встановлення|реконструкц|облаштування).*(вузол.*облік.*тепл|теплолічильн|комерційн.*облік.*теплов)/iu },
  { segment:'Обробка осаду / мулу', query:'зневоднення осаду монтаж', pages, match:/(монтаж|реконструкц|будівницт|модернізац).*(зневоднення.*осад|обробк.*мул|мулов.*майданчик|осушення.*осад)/iu },
  { segment:'Зерносховища / елеватори', query:'зерносховище будівництво', pages, match:/(будівницт|монтаж|реконструкц|облаштування).*(зерносховищ|елеватор|зернов.*комплекс)/iu },
  { segment:'Зерносховища / елеватори', query:'монтаж зернового силосу', pages, match:/(монтаж|будівницт|встановлення|реконструкц).*(зернов.*силос|силос.*зерн|бункер.*зерн)/iu },
  { segment:'Промислові теплиці', query:'теплиця будівництво роботи', pages, match:/(будівницт|монтаж|реконструкц|облаштування).*(теплиц|тепличн.*комплекс|оранжере)/iu },
  { segment:'Пилогазоочищення', query:'пилогазоочищення реконструкція', pages, match:/(реконструкц|монтаж|будівницт|модернізац).*(пилогазоочищ|газоочисн.*установ|рукавн.*фільтр|електрофільтр)/iu },
  { segment:'Спортивні покриття', query:'спортивне покриття влаштування', pages, match:/(влаштування|монтаж|реконструкц|капітальн.*ремонт).*(спортивн.*покрит|бігов.*доріж|футбольн.*пол|стадіон)/iu },
  { segment:'Шумозахисні споруди', query:'шумозахисний екран монтаж', pages, match:/(монтаж|встановлення|будівницт|влаштування).*(шумозахисн.*екран|акустичн.*екран|протишумн.*екран)/iu },
  { segment:'Мости / спеціальні елементи', query:'деформаційний шов мосту ремонт', pages, match:/(ремонт|заміна|монтаж|влаштування).*(деформаційн.*шов|опорн.*частин).*(мост|шляхопровод|естакад)|(?:мост|шляхопровод).*(деформаційн.*шов|опорн.*частин)/iu },
];

const configs = readJson(CONFIG_FILE).map(row => ({
  segment:row.segment,
  query:row.query,
  pages:[1,8],
  match:new RegExp(row.pattern, 'iu'),
}));

const exclusions = [
  ['survey_or_land', /топограф|геодез|геологіч|землевпоряд|землеустро|землевідвед|кадастров|інженерн.*вишукуван/iu],
  ['supervision_or_consulting', /технічн(?:ий|ого)?\s+нагляд|авторськ(?:ий|ого)?\s+нагляд|інженер.?консультант|консультаційн|технічн.*умов|науково.?технічн.*супровід/iu],
  ['expertise', /експертиз|експертн.*звіт|експертн.*оцін|сертифікаці|оцінк.*відповідност/iu],
  ['design_documentation', /розроб(?:ка|лення).*?(?:проєктн|проектн|кошторисн).*документац|виготовлення.*?(?:проєктн|проектн|кошторисн).*документац|проєктно.?кошторисн|проектно.?кошторисн|коригування.*(?:проєктн|проектн).*документац|послуги з інженерного про[єе]ктування|архітектурн.*про[єе]ктуван/iu],
  ['inspection_or_inventory', /обстеження.*(?:будів|споруд|мереж|конструкц|дна|тунел)|паспортизац|технічн.*інвентаризац|діагностик.*конструкц/iu],
  ['maintenance_only', /^(?!.*(?:монтаж|встановлення|підключення|будівницт|реконструкц|ремонт|облаштування|влаштування|модернізац|прокладання|пусконалагодж)).*(?:технічне|сервісне|регламентне)\s+обслуговування/iu],
  ['training_or_rental', /навчання|підвищення кваліфікац|оренда.*(?:технік|машин|обладнан)|прокат.*обладнан/iu],
  ['equipment_only', /^(?!.*(?:монтаж|встановлення|підключення|будівницт|реконструкц|ремонт|облаштування|влаштування|модернізац|прокладання|пусконалагодж|виконання робіт)).*(?:поставка|закупівля|придбання|товар|обладнання).*$/iu],
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchJson(url, options = {}, attempt = 1) {
  try {
    const response = await fetch(url, {
      ...options,
      signal:AbortSignal.timeout(25000),
      headers:{ accept:'application/json', 'user-agent':`GoProceed-prospect-research/${WAVE}.0`, ...(options.headers || {}) },
    });
    if (!response.ok) {
      if (attempt < 7 && (response.status === 429 || response.status >= 500)) {
        await delay(response.status === 429 ? Math.min(30000, 4000 * attempt) : Math.min(12000, 1200 * attempt));
        return fetchJson(url, options, attempt + 1);
      }
      throw new Error(String(response.status) + ' ' + response.statusText + ' ' + url);
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
const normalizeUrl = value => { if (!value) return ''; try { return new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value).href; } catch { return ''; } };
const domainFromUrl = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; } };
const supplierUrl = supplier => [supplier?.identifier?.uri, supplier?.contactPoint?.url].map(normalizeUrl).find(url => url && !/(prozorro|facebook|instagram|linkedin|youtube|t\.me)/i.test(url)) || '';
const excludedReason = title => exclusions.find(([, pattern]) => pattern.test(title || ''))?.[0] || '';

const searchHits = [];
for (let ci = 0; ci < configs.length; ci += 1) {
  const config = configs[ci];
  for (let page = config.pages[0]; page <= config.pages[1]; page += 1) {
    const url = new URL('https://prozorro.gov.ua/api/search/tenders');
    url.searchParams.set('text', config.query);
    url.searchParams.set('page', String(page));
    const payload = await fetchJson(url, { method:'POST' });
    for (const row of payload.data || []) {
      if (tenderYear(row.tenderID) < 2024 || priorTenderIds.has(row.tenderID)) continue;
      if (!config.match.test(row.title || '')) continue;
      searchHits.push({ segment:config.segment, search_query:config.query, search_page:page, ...row });
    }
    await delay(130);
  }
  console.error('search ' + (ci + 1) + '/' + configs.length + ' ' + config.segment + ': ' + searchHits.length + ' matches');
  await delay(180);
}

const byTender = new Map();
for (const hit of searchHits) {
  const current = byTender.get(hit.tenderID) || { ...hit, segments:[], search_queries:[] };
  if (!current.segments.includes(hit.segment)) current.segments.push(hit.segment);
  if (!current.search_queries.includes(hit.search_query)) current.search_queries.push(hit.search_query);
  byTender.set(hit.tenderID, current);
}
const seeds = [...byTender.values()];
let detailProgress = 0;
const details = await mapLimit(seeds, 6, async seed => {
  const summary = await fetchJson('https://prozorro.gov.ua/api/tenders/' + encodeURIComponent(seed.tenderID) + '/summary');
  if (!summary.id) throw new Error('No API id for ' + seed.tenderID);
  const full = await fetchJson('https://public-api.prozorro.gov.ua/api/2.5/tenders/' + summary.id);
  detailProgress += 1;
  if (detailProgress % 50 === 0) console.error('details ' + detailProgress + '/' + seeds.length);
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
        tender_id:tender.tenderID,
        tender_uuid:tender.id,
        tender_url:'https://prozorro.gov.ua/tender/' + tender.tenderID,
        public_api_url:'https://public-api.prozorro.gov.ua/api/2.5/tenders/' + tender.id,
        tender_title:tender.title || seed.title,
        tender_status:tender.status,
        award_value_uah:Number(award.value?.amount || contract?.value?.amount || 0),
        award_date:award.date || tender.dateModified,
        contract_status:contract?.status || '',
        delivery_end_date:deliveryEndDates.at(-1) || '',
        supplier_name:supplier.identifier?.legalName || supplier.name || '',
        supplier_edrpou:edrpou,
        supplier_scale:supplier.scale || '',
        supplier_url:url,
        supplier_domain:domainFromUrl(url),
        supplier_region:supplier.address?.region || '',
        supplier_locality:supplier.address?.locality || '',
        segments:seed.segments,
        search_queries:seed.search_queries,
        buyer_name:tender.procuringEntity?.identifier?.legalName || tender.procuringEntity?.name || '',
      });
    }
  }
}

const excludedRecords = rawRecords.map(record => ({ ...record, excluded_reason:excludedReason(record.tender_title) })).filter(x => x.excluded_reason);
const records = rawRecords.filter(record => !excludedReason(record.tender_title));
const grouped = new Map();
for (const record of records) {
  const current = grouped.get(record.supplier_edrpou) || {
    supplier_edrpou:record.supplier_edrpou,
    names:new Set(),
    urls:new Set(),
    domains:new Set(),
    regions:new Set(),
    localities:new Set(),
    scales:new Set(),
    segments:new Set(),
    tenderIds:new Set(),
    tenderTitles:[],
    tenderUrls:[],
    tender_count:0,
    total_award_value_uah:0,
    active_contract_count:0,
    latest_award_date:'',
    latest_delivery_end_date:'',
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
    if (['active','pending'].includes(record.contract_status)) current.active_contract_count += 1;
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
    company_name,
    edrpou:row.supplier_edrpou,
    domain:[...row.domains][0] || '',
    company_url:[...row.urls][0] || '',
    company_type:/^\s*(фоп|фізичн)/iu.test(company_name) ? 'sole_proprietor' : 'legal_entity',
    regions:[...row.regions],
    localities:[...row.localities],
    segments,
    primary_segment:segments[0] || 'Спеціалізований підрядник',
    tender_count:row.tender_count,
    total_award_value_uah:Math.round(row.total_award_value_uah * 100) / 100,
    active_contract_count:row.active_contract_count,
    latest_award_date:row.latest_award_date,
    latest_delivery_end_date:row.latest_delivery_end_date,
    latest_tender_id:[...row.tenderIds].sort().at(-1) || '',
    latest_tender_url:row.tenderUrls[0] || '',
    tender_ids:[...row.tenderIds],
    tender_titles:[...new Set(row.tenderTitles)].slice(0,10),
    tender_urls:[...new Set(row.tenderUrls)].slice(0,10),
    intent_score:score,
    intent_priority:score >= 75 ? 'I1' : score >= 58 ? 'I2' : 'I3',
    evidence_confidence:'high',
    verification_status:'official_prozorro_award_work_scope',
    research_date:DATE_TAG,
  };
}).sort((a,b)=>b.intent_score-a.intent_score || b.total_award_value_uah-a.total_award_value_uah || a.company_name.localeCompare(b.company_name,'uk'));

const errors = details.filter(x=>x?.__error).map(x=>({ error:x.__error, tender_id:x.input?.tenderID, segment:x.input?.segment, search_queries:x.input?.search_queries }));
const reasonCounts = excludedRecords.reduce((acc, x) => ((acc[x.excluded_reason] = (acc[x.excluded_reason] || 0) + 1), acc), {});
const summary = {
  generated_at:AS_OF.toISOString(),
  source:'Official Prozorro search and public tender APIs',
  search_configs:configs.length,
  search_pages:configs.reduce((n,c)=>n+c.pages[1]-c.pages[0]+1,0),
  prior_tender_ids_excluded:priorTenderIds.size,
  matching_search_hits:searchHits.length,
  unique_new_tenders_scanned:seeds.length,
  successful_tender_details:details.filter(x=>x&&!x.__error).length,
  tender_detail_errors:errors.length,
  raw_award_records:rawRecords.length,
  excluded_service_or_supply_records:excludedRecords.length,
  exclusion_reason_counts:reasonCounts,
  eligible_award_records:records.length,
  eligible_unique_tenders:new Set(records.map(x=>x.tender_id)).size,
  unique_supplier_leads:supplierLeads.length,
  priority_counts:supplierLeads.reduce((a,x)=>((a[x.intent_priority]=(a[x.intent_priority]||0)+1),a),{}),
  segment_counts:supplierLeads.flatMap(x=>x.segments).reduce((a,x)=>((a[x]=(a[x]||0)+1),a),{}),
};

fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_search_hits_${DATE_TAG}.json`),JSON.stringify(searchHits,null,2));
fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_tender_records_raw_${DATE_TAG}.json`),JSON.stringify(rawRecords,null,2));
fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_tender_records_cleaned_${DATE_TAG}.json`),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_excluded_records_${DATE_TAG}.json`),JSON.stringify(excludedRecords,null,2));
fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_supplier_leads_${DATE_TAG}.json`),JSON.stringify(supplierLeads,null,2));
fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_errors_${DATE_TAG}.json`),JSON.stringify(errors,null,2));
fs.writeFileSync(path.join(OUT_DIR,`${OUTPUT_PREFIX}_summary_${DATE_TAG}.json`),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
console.log('Top cleaned leads:');
console.log(supplierLeads.slice(0,30).map(x=>({company:x.company_name,edrpou:x.edrpou,segment:x.primary_segment,intent:x.intent_score,priority:x.intent_priority,tenders:x.tender_count,value:x.total_award_value_uah,domain:x.domain})));
