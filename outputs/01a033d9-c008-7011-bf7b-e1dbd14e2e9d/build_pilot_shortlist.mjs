import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const SOURCE_FILE = process.env.PROSPECTS_FILE || 'prospects_unified_v8_2026-08-24.json';
const DATE_TAG = process.env.PILOT_DATE_TAG || '2026-08-25';
const AS_OF = new Date(`${DATE_TAG}T23:59:59+03:00`);
const rows = JSON.parse(fs.readFileSync(path.join(OUT_DIR, SOURCE_FILE), 'utf8'));

const electricalFit = /електромонтаж|промислова електрика|підстанц|силов.*мереж|блискавк|заземлен|резервне живлення|зовнішнє освітлен|кабельн.*ліні|повітрян.*ліні|релейн.*захист|комерційн.*облік.*електро/iu;
const mepFit = /hvac|овік|внутрішн.*сантех|внутрішня сантех|теплові пункти|вузли обліку тепла|котельн|медичні гази|димовидален/iu;
const publicOrUtility = /управління поліції|поліції охорони|головне управління|військова частина|міська рада|селищна рада|районна адміністрац|комунальн.*підприємств|державн.*підприємств|обленерго|електромереж|укренерго|оператор.*систем.*розподіл|газорозподільні мережі україни|теплокомуненерго|водоканал|автодор|служб.*автомобільн.*доріг|бюджетн.*установ|казенн.*підприємств/iu;
const strategicChannel = /будівельн.*компан|генпідряд|консорціум|механізован.*колон|дск|техно.?буд|енергобуд|буд.?інвест|промислов.*буд/iu;
const solePattern = /^\s*(фоп|фізичн)|sole_proprietor/iu;

function verificationRows(file) {
  const full = path.join(OUT_DIR, file);
  if (!fs.existsSync(full)) return [];
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  return data.records || data.verified || data.companies || [];
}

const verificationByEdrpou = new Map();
for (const file of [
  'wave5_browser_verification_2026-08-24.json',
  'wave6_browser_verification_2026-08-24.json',
  'wave7_browser_verification_2026-08-24.json',
  `pilot_browser_verification_${DATE_TAG}.json`,
]) {
  for (const item of verificationRows(file)) {
    const key = String(item.edrpou || '').padStart(8, '0');
    if (!key) continue;
    const previous = verificationByEdrpou.get(key) || {};
    verificationByEdrpou.set(key, {
      ...previous,
      ...item,
      status: item.status || previous.status || '',
      evidence: item.evidence || item.finding || previous.evidence || previous.finding || '',
      url: item.company_url || item.url || item.registry_profile || previous.url || '',
    });
  }
}

const strongVerification = /direct_fit_confirmed|official_company|official_website|industry_profile|keep_pilot|upgrade_pilot|construction_registry_n1[45]_fit/iu;
const requalifyVerification = /requalify/iu;

function daysSince(value) {
  const date = new Date(value || '2000-01-01');
  return Number.isFinite(date.getTime()) ? Math.max(0, Math.floor((AS_OF - date) / 86400000)) : 9999;
}
function fitGroup(row) {
  if (electricalFit.test(row.segment || '')) return 'N.15 — електромонтаж / силові системи';
  if (mepFit.test(row.segment || '')) return 'N.14 — сантехніка / HVAC / тепло';
  return 'Adjacent workflow — discovery до пілоту';
}
function readinessScore(row, verification) {
  const direct = electricalFit.test(row.segment || '') || mepFit.test(row.segment || '');
  const recencyDays = daysSince(row.latest_award_date);
  const recency = recencyDays <= 60 ? 10 : recencyDays <= 120 ? 8 : recencyDays <= 240 ? 5 : 2;
  const intent = Math.round(Math.min(25, Number(row.intent_score || 0) * 0.25));
  const live = Number(row.live_project_count || 0) >= 3 ? 15 : Number(row.live_project_count || 0) >= 1 ? 11 : 2;
  const evidence = row.evidence_confidence === 'high' ? 8 : row.evidence_confidence === 'medium' ? 4 : 0;
  const reachability = row.domain || /^https?:\/\//i.test(row.company_url || '') ? 5 : 1;
  const entity = solePattern.test(`${row.company_name} ${row.account_type}`) ? 3 : 7;
  const product = direct ? 30 : Math.min(18, Number(row.current_requirement_coverage || 0) * 4 + Number(row.workflow_fit || 0));
  const priorNoReply = /Надіслано|follow-up/iu.test(row.contact_status || '') ? -5 : 0;
  const publicPenalty = publicOrUtility.test(`${row.company_name} ${row.account_type}`) || row.public_non_contractor_signal ? -35 : 0;
  const browserBonus = strongVerification.test(verification?.status || '') ? 5 : 0;
  const requalifyPenalty = requalifyVerification.test(verification?.status || '') ? -12 : 0;
  return Math.max(0, Math.min(100, product + intent + live + evidence + reachability + entity + recency + priorNoReply + publicPenalty + browserBonus + requalifyPenalty));
}

const scored = rows.map(row => {
  const verification = verificationByEdrpou.get(String(row.edrpou || '').padStart(8, '0')) || {};
  const direct = electricalFit.test(row.segment || '') || mepFit.test(row.segment || '');
  const publicSignal = publicOrUtility.test(`${row.company_name} ${row.account_type}`) || row.public_non_contractor_signal || row.lane === 'Requalify';
  const browserStrong = strongVerification.test(verification.status || '');
  const browserRequalify = requalifyVerification.test(verification.status || '');
  const score = readinessScore(row, verification);
  const live = Number(row.live_project_count || 0);
  const companyRoute = Boolean(row.domain || /official_company|official_website/iu.test(`${verification.status || ''} ${row.website_status || ''}`));
  const tenderReady = row.evidence_confidence === 'high' && Number(row.intent_score || 0) >= 85 && live > 0;
  const outreachReady = direct && live > 0 && !publicSignal && !browserRequalify && (companyRoute || browserStrong || tenderReady);
  let pilot_group;
  if (publicSignal) pilot_group = 'D — Не отправлять / переквалифицировать';
  else if (direct && score >= 80 && outreachReady) pilot_group = 'A1 — Запуск пилота 30–45 дней';
  else if (direct && score >= 68) pilot_group = 'A2 — Квалификация перед пилотом';
  else if (!direct && score >= 66 && Number(row.workflow_fit || 0) >= 4) pilot_group = 'B1 — Discovery → пилот';
  else if (strategicChannel.test(row.company_name || '') && Number(row.intent_score || 0) >= 70) pilot_group = 'C — Генподрядчик / канал';
  else pilot_group = 'D — Не отправлять / низкий приоритет';
  const nextStep = pilot_group.startsWith('A1')
    ? 'Запросить 20 минут и один обезличенный пакет; при подтверждении боли предложить 30–45 дней бесплатно'
    : pilot_group.startsWith('A2')
      ? 'Проверить собственное выполнение, ПТО и активный проект; затем предложить узкий бесплатный пилот'
      : pilot_group.startsWith('B1')
        ? 'Провести 2-недельный workflow discovery на одном пакете; пилот только после fit verdict'
        : pilot_group.startsWith('C')
          ? 'Проверить роль генподрядчика и попросить представить ПТО/субподрядчика по N.14/N.15'
          : 'Не включать в текущую outbound-волну';
  return {
    lead_id:row.lead_id,
    company_name:row.company_name,
    edrpou:row.edrpou || '',
    segment:row.segment,
    fit_group:fitGroup(row),
    pilot_group,
    pilot_readiness_score:score,
    intent_priority:row.intent_priority || '',
    intent_score:Number(row.intent_score || 0),
    pilot_now_score:Number(row.pilot_now_score || 0),
    tender_count:Number(row.tender_count || 0),
    live_project_count:live,
    total_award_value_uah:Number(row.total_award_value_uah || 0),
    latest_award_date:row.latest_award_date || '',
    latest_delivery_end_date:row.latest_delivery_end_date || '',
    latest_tender_id:row.latest_tender_id || '',
    latest_tender_title:row.latest_tender_title || '',
    latest_tender_url:row.latest_tender_url || row.source_url || '',
    domain:row.domain || '',
    company_url:row.company_url || '',
    website_status:row.website_status || '',
    evidence_confidence:row.evidence_confidence || '',
    browser_verification_status:verification.status || '',
    browser_verification_url:verification.url || '',
    browser_verification_evidence:verification.evidence || '',
    browser_verified_direct_fit:browserStrong,
    browser_requalification_required:browserRequalify,
    contact_route_quality:companyRoute ? '1 — Офіційний сайт' : browserStrong ? '2 — Перевірений публічний профіль' : '3 — Prozorro / реєстр; route потрібен',
    outreach_ready:outreachReady,
    contact_status:row.contact_status || 'Не контактували',
    target_role:row.target_role || 'Власник / директор; керівник ПТО',
    next_step:nextStep,
    pilot_funnel_status:/Надіслано|follow-up/iu.test(row.contact_status || '') ? '1 — Запрошення надіслано' : '0 — Не запрошували',
    interest_confirmed:false,
    artifact_received:false,
    pilot_agreed:false,
    agreement_evidence:'',
    pilot_start_date:'',
    owner:row.owner || '',
    notes:'',
  };
}).sort((a,b) => {
  const order = {'A1 — Запуск пилота 30–45 дней':0,'A2 — Квалификация перед пилотом':1,'B1 — Discovery → пилот':2,'C — Генподрядчик / канал':3};
  return (order[a.pilot_group] ?? 9) - (order[b.pilot_group] ?? 9) || Number(b.browser_verified_direct_fit)-Number(a.browser_verified_direct_fit) || b.pilot_readiness_score-a.pilot_readiness_score || b.intent_score-a.intent_score || b.live_project_count-a.live_project_count || a.company_name.localeCompare(b.company_name,'uk');
});

const a1 = scored.filter(x=>x.pilot_group.startsWith('A1')).slice(0,30);
const a2 = scored.filter(x=>x.pilot_group.startsWith('A2')).slice(0,50);
const b1 = scored.filter(x=>x.pilot_group.startsWith('B1')).slice(0,30);
const c = scored.filter(x=>x.pilot_group.startsWith('C')).slice(0,20);
const shortlist = [...a1,...a2,...b1,...c];
const batchSize = 10;
const counters = new Map();
for (let i=0;i<shortlist.length;i+=1) {
  const item = shortlist[i];
  const stage = item.pilot_group.startsWith('C') ? 'C' : item.pilot_group.slice(0,2);
  const priorContact = /Надіслано|follow-up/iu.test(item.contact_status || '');
  item.outreach_queue = priorContact ? 'Re-engagement' : 'New outbound';
  const key = `${stage}-${priorContact ? 'R' : 'N'}`;
  const count = counters.get(key) || 0;
  counters.set(key, count + 1);
  item.outreach_batch = `${key}${String(Math.floor(count / batchSize) + 1).padStart(2,'0')}`;
  item.outreach_order = i + 1;
  item.batch_order = count + 1;
}

// Optional execution-layer enrichment: exact-EDRPOU corporate routes researched for A1-N01.
// This never changes contact/funnel status and never creates inferred interest or agreement.
const outreachFile = path.join(OUT_DIR, `pilot_outreach_A1-N01_${DATE_TAG}.json`);
if (fs.existsSync(outreachFile)) {
  const outreach = JSON.parse(fs.readFileSync(outreachFile, 'utf8'));
  const outreachByEdrpou = new Map((outreach.records || []).map((x) => [String(x.edrpou || '').padStart(8, '0'), x]));
  for (const item of shortlist) {
    const route = outreachByEdrpou.get(String(item.edrpou || '').padStart(8, '0'));
    if (!route) continue;
    item.contact_route_quality = route.route_quality === 'official_company_website'
      ? '1 — Офіційний сайт'
      : '2 — Перевірений корпоративний маршрут';
    item.outreach_ready = true;
    item.outreach_channel = route.channel || '';
    item.corporate_route = route.corporate_route || '';
    item.route_source_url = route.route_source_url || '';
    item.contact_route_verified_at = route.route_checked_at || '';
    item.send_readiness = route.send_readiness || '';
    item.next_step = item.outreach_batch === 'A1-N01'
      ? 'Замінити demo-link, додати відправника, отримати дозвіл і запустити A1-N01; згоду рахувати лише за явною відповіддю'
      : item.next_step;
  }
}

const summary = {
  generated_at:`${DATE_TAG}T23:59:59+03:00`,
  source_file:SOURCE_FILE,
  source_accounts:rows.length,
  shortlist_accounts:shortlist.length,
  group_counts:shortlist.reduce((a,x)=>((a[x.pilot_group]=(a[x.pilot_group]||0)+1),a),{}),
  fit_counts:shortlist.reduce((a,x)=>((a[x.fit_group]=(a[x.fit_group]||0)+1),a),{}),
  core_launch_accounts:shortlist.filter(x=>x.pilot_group.startsWith('A1') || x.pilot_group.startsWith('A2')).length,
  discovery_reserve_accounts:shortlist.filter(x=>x.pilot_group.startsWith('B1') || x.pilot_group.startsWith('C')).length,
  batches:new Set(shortlist.map(x=>x.outreach_batch)).size,
  queue_counts:shortlist.reduce((a,x)=>((a[x.outreach_queue]=(a[x.outreach_queue]||0)+1),a),{}),
  contact_route_counts:shortlist.reduce((a,x)=>((a[x.contact_route_quality]=(a[x.contact_route_quality]||0)+1),a),{}),
  browser_verified_direct_fit:shortlist.filter(x=>x.browser_verified_direct_fit).length,
  browser_requalification_required:shortlist.filter(x=>x.browser_requalification_required).length,
  confirmed_interest:shortlist.filter(x=>x.interest_confirmed).length,
  agreed_pilots:shortlist.filter(x=>x.pilot_agreed).length,
  rules:{
    a1:'Direct N.14/N.15 fit, readiness >=80, at least one future published completion signal, no public/non-contractor or Browser requalification signal, and a verified public route or strong tender evidence',
    a2:'Direct N.14/N.15 fit and readiness >=68; requires qualification before pilot offer',
    b1:'Adjacent workflow with readiness >=66 and workflow fit >=4; discovery before pilot',
    c:'Strong tender intent and general-contractor/channel signal',
    agreement:'pilot_agreed is true only after an explicit positive response; no inferred agreements',
  },
};

fs.writeFileSync(path.join(OUT_DIR,`pilot_shortlist_${DATE_TAG}.json`),JSON.stringify(shortlist,null,2));
fs.writeFileSync(path.join(OUT_DIR,`pilot_scored_all_${DATE_TAG}.json`),JSON.stringify(scored,null,2));
fs.writeFileSync(path.join(OUT_DIR,`pilot_shortlist_summary_${DATE_TAG}.json`),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
console.log(shortlist.slice(0,30).map(x=>({order:x.outreach_order,company:x.company_name,segment:x.segment,group:x.pilot_group,score:x.pilot_readiness_score,intent:x.intent_score,live:x.live_project_count,domain:x.domain,tender:x.latest_tender_id})));
