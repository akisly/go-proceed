import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const WAVE = Number(process.env.PROZORRO_WAVE || 7);
const AS_OF_DATE = process.env.PROZORRO_AS_OF_DATE || '2026-08-24';
const DATE_TAG = process.env.PROZORRO_DATE_TAG || '2026-08-24';
const BASE_FILE = process.env.PROZORRO_BASE_FILE || 'prospects_unified_v7_2026-08-24.json';
const LEADS_FILE = process.env.PROZORRO_LEADS_FILE || `prozorro_wave${WAVE}_supplier_leads_final_${DATE_TAG}.json`;
const RECORDS_FILE = process.env.PROZORRO_RECORDS_FILE || `prozorro_wave${WAVE}_tender_records_cleaned_final_${DATE_TAG}.json`;
const OUTPUT_VERSION = Number(process.env.PROSPECTS_OUTPUT_VERSION || WAVE + 1);
const base = JSON.parse(fs.readFileSync(path.join(OUT_DIR, BASE_FILE), 'utf8'));
const leads = JSON.parse(fs.readFileSync(path.join(OUT_DIR, LEADS_FILE), 'utf8'));
const records = JSON.parse(fs.readFileSync(path.join(OUT_DIR, RECORDS_FILE), 'utf8'));

const browserVerifiedWebsites = new Map([
  ['38119659', {
    company_url:'https://opendatabot.ua/c/38119659',
    website_status:'browser_verified_registry_profile_no_company_site_found_2026-08-24',
  }],
  ['42356035', {
    company_url:'https://opendatabot.ua/c/42356035',
    website_status:'browser_verified_registry_architecture_profile_requalify_2026-08-24',
  }],
  ['43187830', {
    company_url:'https://opendatabot.ua/c/43187830',
    website_status:'browser_verified_registry_agriculture_profile_requalify_2026-08-24',
  }],
  ['40682121', {
    company_url:'https://opendatabot.ua/c/40682121',
    website_status:'browser_verified_registry_and_prozorro_award_2026-08-24',
  }],
  ['46158743', {
    company_url:'https://opendatabot.ua/c/46158743',
    website_status:'browser_verified_registry_architecture_engineering_requalify_2026-08-24',
  }],
  ['41008865', {
    company_url:'https://opendatabot.ua/c/41008865',
    website_status:'browser_verified_registry_pipeline_construction_2026-08-24',
  }],
  ['34329599', {
    company_url:'https://e-construction.gov.ua/organizations_detail/2283351179398218946?org_type=3',
    website_status:'browser_verified_official_construction_registry_n14_fit_2026-08-24',
  }],
  ['36699380', {
    company_url:'https://e-construction.gov.ua/organizations_detail/2283351183407973805?org_type=14',
    website_status:'browser_verified_official_construction_registry_n15_fit_2026-08-24',
  }],
  ['33330969', {
    domain:'zavodm.com.ua',
    company_url:'http://zavodm.com.ua/',
    website_status:'browser_verified_official_company_site_2026-08-24',
  }],
]);
const browserRequalifyEdrpou = new Set(['42356035','43187830','46158743']);
const legalStopPhrases = [
  /товариство з обмеженою відповідальністю/giu,
  /товариство з додатковою відповідальністю/giu,
  /фізична особа[\s-]*підприємець/giu,
  /приватне підприємство/giu,
  /колективне підприємство/giu,
  /комунальне підприємство/giu,
  /державне підприємство/giu,
  /дочірнє підприємство/giu,
  /акціонерне товариство/giu,
  /виробничо[\s-]*комерційна фірма/giu,
  /науково[\s-]*виробниче підприємство/giu,
];
const legalStopTokens = new Set(['тов','тзов','пп','фоп','мпп','кп','дп','ат','пат','прaт','компанія','фірма','україна','україни']);
function normalizedName(value) {
  let text = String(value || '').toLowerCase().normalize('NFKC');
  for (const pattern of legalStopPhrases) text = text.replace(pattern, ' ');
  return text.replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().split(' ').filter(token => token && !legalStopTokens.has(token)).join(' ');
}
const normalizedDomain = value => String(value || '').toLowerCase().replace(/^www\./,'').trim();
function tokens(value) { return new Set(normalizedName(value).split(' ').filter(token => token.length >= 3)); }
function jaccard(a,b) {
  const left=tokens(a), right=tokens(b);
  if(!left.size || !right.size) return 0;
  let intersection=0;
  for(const token of left) if(right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}
function isPlaceholder(lead) {
  const id=String(lead.edrpou || '').replace(/\D/g,'');
  return !/^(\d{8}|\d{10})$/.test(id) || /^(\d)\1+$/.test(id) || /оборонн.*постачальник|конфіденційн|невідом|редагован/iu.test(lead.company_name || '');
}
function isSole(lead) {
  const id=String(lead.edrpou || '').replace(/\D/g,'');
  return id.length === 10 || /^\s*(фоп|фізична особа)/iu.test(lead.company_name || '');
}
function isPublicNonContractor(lead) {
  return /державн.*пожежно.?рятувальн.*загін|аварійно.?рятувальн.*загін|військова частина|головне управління.*дснс|територіальне управління|управління поліції охорони|комунальн.*служб.*автомобільн.*доріг|^\s*кп\s|муніципальн.*служб/iu.test(lead.company_name || '');
}

const recordsByEdrpou = new Map();
for (const record of records) {
  const rows=recordsByEdrpou.get(record.supplier_edrpou) || [];
  rows.push(record);
  recordsByEdrpou.set(record.supplier_edrpou, rows);
}
const baseByEdrpou = new Map(base.filter(x=>x.edrpou).map(x=>[String(x.edrpou).replace(/\D/g,''),x]));
const fuzzyBase = base.filter(x=>!String(x.edrpou || '').replace(/\D/g,''));
const baseByDomain = new Map(fuzzyBase.filter(x=>x.domain).map(x=>[normalizedDomain(x.domain),x]));
const baseByName = new Map(fuzzyBase.map(x=>[normalizedName(x.company_name),x]));
function findMatch(lead) {
  const id=String(lead.edrpou || '').replace(/\D/g,'');
  if(baseByEdrpou.has(id)) return {match:baseByEdrpou.get(id), reason:'edrpou'};
  const domain=normalizedDomain(lead.domain);
  if(domain && baseByDomain.has(domain)) return {match:baseByDomain.get(domain), reason:'domain'};
  const name=normalizedName(lead.company_name);
  if(name && baseByName.has(name)) return {match:baseByName.get(name), reason:'normalized_name'};
  if(name.length >= 7) {
    for(const row of fuzzyBase) {
      const candidate=normalizedName(row.company_name);
      if(candidate.length < 7) continue;
      if((name.includes(candidate) || candidate.includes(name)) && Math.min(name.length,candidate.length)/Math.max(name.length,candidate.length) >= 0.78) {
        return {match:row, reason:'name_containment'};
      }
      const left=tokens(name), right=tokens(candidate), shared=[...left].filter(token=>right.has(token));
      if(left.size >= 2 && right.size >= 2 && shared.length >= 2 && jaccard(name,candidate) >= 0.86) {
        return {match:row, reason:'name_token_similarity'};
      }
    }
  }
  return null;
}

const liveCount = rows => new Set(rows.filter(row=>row.delivery_end_date && row.delivery_end_date.slice(0,10) >= AS_OF_DATE).map(row=>row.tender_id)).size;
const latestRecord = rows => [...rows].sort((a,b)=>String(b.award_date).localeCompare(String(a.award_date)))[0] || null;
const scaleSignal = value => value >= 10_000_000 ? 5 : value >= 2_000_000 ? 4 : value >= 500_000 ? 3 : value >= 100_000 ? 2 : 1;
const pilotScore = ({coverage,workflow,hidden,scale,docs,buyer,reachability}) => Math.min(100,coverage*8+workflow*3+hidden*2+scale*2+docs*2+buyer*2+reachability);
const expansionScore = ({workflow,hidden,scale,docs,buyer,reachability}) => Math.min(100,workflow*5+hidden*4+docs*4+scale*3+buyer*2+reachability*2);
const supported = new Map([
  ['Промислова електрика / ПНР',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Зовнішнє освітлення',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Підстанції / силові мережі',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Блискавкозахист / заземлення',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Кабельні лінії електропередачі',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Розподільчі пристрої / підстанції',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Компенсація реактивної потужності',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['Резервне живлення',{route:'Пілот зараз — Н.15 subset',coverage:4}],
]);
const browserSupported = new Map([
  ['34329599',{route:'Пілот зараз — Н.14',coverage:5}],
  ['36699380',{route:'Пілот зараз — Н.15 subset',coverage:4}],
  ['33330969',{route:'Пілот зараз — Н.15 subset',coverage:4}],
]);
const highHidden = /електрик|освітлен|підстанц|заземлен|блискавк|кабел|генератор|дренаж|каналіз|котельн|труб|ліфт|ескалатор|пожеж|автоматик|scada|димов|градир|вітров|соняч|гідроенерг|теплов.*насос|медичн.*газ|покрів|гідроізол|мост|аерац|осад|укрит|залізнич|трамва|дорожн.*розмітк|бар.?єрн|антикороз|вогнезахист|палив|нафтобаз|очисн|водонапір/iu;

const filtered = leads.filter(lead=>!isPlaceholder(lead));
const overlaps=[];
const uniqueNew=[];
for(const raw of filtered) {
  const rows=recordsByEdrpou.get(String(raw.edrpou)) || [];
  const latest=latestRecord(rows);
  const normalized={
    ...raw,
    ...(browserVerifiedWebsites.get(String(raw.edrpou)) || {}),
    company_type:isSole(raw) ? 'sole_proprietor' : 'legal_entity',
    public_non_contractor_signal:isPublicNonContractor(raw),
    live_project_count:liveCount(rows),
    latest_award_date:latest?.award_date || raw.latest_award_date,
    latest_delivery_end_date:latest?.delivery_end_date || raw.latest_delivery_end_date,
    latest_tender_id:latest?.tender_id || raw.latest_tender_id,
    latest_tender_url:latest?.tender_url || raw.latest_tender_url,
    latest_tender_title:latest?.tender_title || raw.tender_titles?.[0] || '',
  };
  const found=findMatch(normalized);
  if(found) overlaps.push({...normalized, matched_lead_id:found.match.lead_id, matched_company_name:found.match.company_name, match_reason:found.reason});
  else uniqueNew.push(normalized);
}
uniqueNew.sort((a,b)=>b.intent_score-a.intent_score || b.total_award_value_uah-a.total_award_value_uah || a.company_name.localeCompare(b.company_name,'uk'));

const overlapByLead = new Map();
for(const item of overlaps) {
  const rows=overlapByLead.get(item.matched_lead_id) || [];
  rows.push(item);
  overlapByLead.set(item.matched_lead_id, rows);
}
const enrichedBase = base.map(row => {
  const additions=overlapByLead.get(row.lead_id) || [];
  if(!additions.length) return row;
  const newest=[...additions].sort((a,b)=>String(b.latest_award_date).localeCompare(String(a.latest_award_date)))[0];
  const mergedSegments=new Set(String(row.tender_segments || '').split(';').map(x=>x.trim()).filter(Boolean));
  additions.flatMap(x=>x.segments).forEach(segment=>mergedSegments.add(segment));
  return {
    ...row,
    intent_score:Math.max(Number(row.intent_score || 0), ...additions.map(x=>Number(x.intent_score || 0))),
    intent_priority:[row.intent_priority,...additions.map(x=>x.intent_priority)].includes('I1') ? 'I1' : [row.intent_priority,...additions.map(x=>x.intent_priority)].includes('I2') ? 'I2' : 'I3',
    tender_count:Number(row.tender_count || 0) + additions.reduce((n,x)=>n+Number(x.tender_count || 0),0),
    live_project_count:Number(row.live_project_count || 0) + additions.reduce((n,x)=>n+Number(x.live_project_count || 0),0),
    total_award_value_uah:Number(row.total_award_value_uah || 0) + additions.reduce((n,x)=>n+Number(x.total_award_value_uah || 0),0),
    latest_tender_id:newest.latest_tender_id,
    latest_tender_url:newest.latest_tender_url,
    latest_tender_title:newest.latest_tender_title,
    latest_award_date:newest.latest_award_date,
    latest_delivery_end_date:newest.latest_delivery_end_date,
    tender_segments:[...mergedSegments].join('; '),
    next_action:'Повторне звернення з новим тендерним сигналом ' + newest.latest_tender_id + '; попросити 1 пакет здачі',
  };
});

const waveRows = uniqueNew.map((lead,index) => {
  const product=browserSupported.get(String(lead.edrpou)) || supported.get(lead.primary_segment);
  const sole=lead.company_type === 'sole_proprietor';
  const publicSignal=lead.public_non_contractor_signal;
  const browserRequalify=browserRequalifyEdrpou.has(String(lead.edrpou));
  const requalifySignal=publicSignal || browserRequalify;
  const coverage=product?.coverage || 1;
  const workflow=5;
  const hidden=highHidden.test(lead.primary_segment) ? 5 : 4;
  const scale=scaleSignal(lead.total_award_value_uah);
  const docs=5;
  const buyer=requalifySignal ? 1 : sole ? 3 : 5;
  const reachability=lead.domain ? 5 : 3;
  const lane=requalifySignal ? 'Requalify' : product ? 'Pilot now' : 'Expansion discovery';
  const pilot=pilotScore({coverage,workflow,hidden,scale,docs,buyer,reachability});
  const expansion=expansionScore({workflow,hidden,scale,docs,buyer,reachability});
  const fitPriority=requalifySignal ? (lead.intent_priority === 'I1' ? 'R1' : 'R2') :
    lane === 'Pilot now' && lead.intent_priority === 'I1' ? 'P1' :
    lane === 'Pilot now' && lead.intent_priority === 'I2' ? 'P2' :
    lane === 'Expansion discovery' && lead.intent_priority === 'I1' ? 'D1' :
    lane === 'Expansion discovery' && lead.intent_priority === 'I2' ? 'D2' :
    lane === 'Pilot now' ? 'P3' : 'D3';
  return {
    lead_id:`W${WAVE}-` + String(index + 1).padStart(3,'0'),
    wave:`Prozorro vertical expansion ${WAVE} — ${DATE_TAG.slice(8,10)}.${DATE_TAG.slice(5,7)}`,
    company_name:lead.company_name,
    domain:lead.domain || '',
    segment:lead.primary_segment,
    account_type:publicSignal ? 'public_supplier_requalify' : browserRequalify ? 'business_activity_requalify' : sole ? 'sole_proprietor_contractor' : 'tender_proven_contractor',
    route:publicSignal ? 'Перевірити комерційність підрядної діяльності' : browserRequalify ? 'Перевірити фактичну підрядну діяльність до outreach' : product?.route || 'Discovery розширення — 2 тижні',
    current_requirement_coverage:coverage,
    workflow_fit:workflow,
    hidden_intensity:hidden,
    scale_signal:scale,
    docs_signal:docs,
    buyer_fit:buyer,
    reachability,
    fit_evidence:lead.tender_count + ' нових підтверджених перемог/договорів у Prozorro на ' + Math.round(lead.total_award_value_uah).toLocaleString('uk-UA') + ' грн; ' + lead.live_project_count + ' зі строком виконання не раніше ' + AS_OF_DATE.split('-').reverse().join('.') + '.',
    pilot_trigger:lead.latest_tender_title + (lead.latest_delivery_end_date ? '; опублікований строк до ' + lead.latest_delivery_end_date.slice(0,10) : '') + '. Попросити один знеособлений пакет здачі за цим workflow.',
    target_role:publicSignal ? 'Керівник підрозділу; перевірити право на комерційні роботи' : browserRequalify ? 'Директор; перевірити наявність власного виконання та ПТО' : sole ? 'Власник / виконавець; відповідальний за договір' : 'Власник / директор; керівник ПТО; відповідальний за договори',
    source_url:lead.latest_tender_url,
    source_access:'official_prozorro_api',
    evidence_confidence:'high',
    verification_status:'official_prozorro_award_2024_2026',
    research_date:DATE_TAG,
    contact_status:'Не контактували',
    next_action:publicSignal ? 'Кваліфікувати тип постачальника за ' + lead.latest_tender_id + ' до outreach' : browserRequalify ? 'Перевірити, чи виконували роботи власними силами за ' + lead.latest_tender_id + ', до outreach' : product ? 'Персоналізований free-pilot outreach по ' + lead.latest_tender_id + '; попросити 1 пакет Н.14/Н.15' : 'Workflow-audit outreach по ' + lead.latest_tender_id + '; попросити 1 пакет здачі та вимоги проєкту',
    edrpou:lead.edrpou,
    owner:'',
    lane,
    pilot_now_score:pilot,
    expansion_score:expansion,
    priority:fitPriority,
    intent_score:lead.intent_score,
    intent_priority:lead.intent_priority,
    tender_count:lead.tender_count,
    live_project_count:lead.live_project_count,
    total_award_value_uah:lead.total_award_value_uah,
    latest_tender_id:lead.latest_tender_id,
    latest_tender_url:lead.latest_tender_url,
    latest_tender_title:lead.latest_tender_title,
    latest_award_date:lead.latest_award_date,
    latest_delivery_end_date:lead.latest_delivery_end_date,
    tender_segments:lead.segments.join('; '),
    company_url:lead.company_url || '',
    website_status:lead.website_status || (lead.domain ? 'supplier_provided_url' : 'not_found_in_top_search'),
  };
});

const unified=[...enrichedBase,...waveRows];
const summary={
  generated_at:new Date(`${DATE_TAG}T23:59:59+03:00`).toISOString(),
  input_supplier_leads:leads.length,
  invalid_or_redacted_removed:leads.length-filtered.length,
  valid_supplier_leads:filtered.length,
  base_total:base.length,
  overlaps_with_base:overlaps.length,
  unique_new_supplier_leads:waveRows.length,
  unified_total:unified.length,
  public_supplier_requalify:waveRows.filter(x=>x.account_type === 'public_supplier_requalify').length,
  browser_activity_requalify:waveRows.filter(x=>x.account_type === 'business_activity_requalify').length,
  company_type_counts:waveRows.reduce((a,x)=>((a[x.account_type]=(a[x.account_type] || 0)+1),a),{}),
  intent_priority_counts:waveRows.reduce((a,x)=>((a[x.intent_priority]=(a[x.intent_priority] || 0)+1),a),{}),
  lane_counts:unified.reduce((a,x)=>((a[x.lane]=(a[x.lane] || 0)+1),a),{}),
  high_confidence_count:unified.filter(x=>x.evidence_confidence === 'high').length,
  tender_signal_count:unified.filter(x=>Number(x.tender_count || 0)>0).length,
  live_project_signal_count:unified.filter(x=>Number(x.live_project_count || 0)>0).length,
};

fs.writeFileSync(path.join(OUT_DIR,`prozorro_wave${WAVE}_validated_leads_${DATE_TAG}.json`),JSON.stringify(uniqueNew,null,2));
fs.writeFileSync(path.join(OUT_DIR,`prozorro_wave${WAVE}_validated_overlaps_${DATE_TAG}.json`),JSON.stringify(overlaps,null,2));
fs.writeFileSync(path.join(OUT_DIR,`prospects_unified_v${OUTPUT_VERSION}_${DATE_TAG}.json`),JSON.stringify(unified,null,2));
fs.writeFileSync(path.join(OUT_DIR,`wave${WAVE}_normalization_summary_${DATE_TAG}.json`),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
console.log('Top new leads:');
console.log(waveRows.slice(0,35).map(x=>({id:x.lead_id,company:x.company_name,edrpou:x.edrpou,segment:x.segment,lane:x.lane,intent:x.intent_score,priority:x.intent_priority,tenders:x.tender_count,live:x.live_project_count,value:x.total_award_value_uah,domain:x.domain})));
