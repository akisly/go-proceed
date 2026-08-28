import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d';
const AS_OF_DATE = '2026-08-24';
const base = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prospects_unified_268_2026-08-24.json'), 'utf8'));
const tenderLeads = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave3_supplier_leads_2026-08-24.json'), 'utf8'));
const tenderRecords = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'prozorro_wave3_tender_records_2026-08-24.json'), 'utf8'));

const browserVerifiedWebsites = new Map([
  ['31575976', { domain: 'avto-m.zp.ua', company_url: 'https://avto-m.zp.ua/', website_status: 'verified_live_2026-08-24' }],
  ['41705516', { domain: 'harborenergy.org', company_url: 'https://harborenergy.org/', website_status: 'verified_live_2026-08-24' }],
  ['38324272', { domain: 'dkselektrik.com.ua', company_url: 'https://dkselektrik.com.ua/uk/', website_status: 'indexed_server_error_2026-08-24' }],
  ['35379855', { domain: 'fasad-servis.com.ua', company_url: 'https://fasad-servis.com.ua/', website_status: 'indexed_tls_error_2026-08-24' }],
  ['34630463', { domain: 'tekhexgas.com.ua', company_url: 'https://tekhexgas.com.ua/', website_status: 'verified_live_2026-08-24' }],
]);

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
const legalStopTokens = new Set(['тов', 'тзов', 'пп', 'фоп', 'мпп', 'кп', 'дп', 'ат', 'пат', 'прaт', 'компанія', 'фірма', 'україна', 'україни']);

function normalizedName(value) {
  let text = String(value || '').toLowerCase().normalize('NFKC');
  for (const pattern of legalStopPhrases) text = text.replace(pattern, ' ');
  text = text.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(token => token && !legalStopTokens.has(token)).join(' ');
}

function tokens(value) {
  return new Set(normalizedName(value).split(' ').filter(token => token.length >= 3));
}

function jaccard(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function domain(value) {
  return String(value || '').toLowerCase().replace(/^www\./, '').trim();
}

function isPlaceholder(lead) {
  const id = String(lead.edrpou || '').replace(/\D/g, '');
  if (!/^(\d{8}|\d{10})$/.test(id)) return true;
  if (/^(\d)\1+$/.test(id)) return true;
  if (/оборонн.*постачальник|конфіденційн|невідом/i.test(lead.company_name || '')) return true;
  return false;
}

const recordsByEdrpou = new Map();
for (const record of tenderRecords) {
  const rows = recordsByEdrpou.get(record.supplier_edrpou) || [];
  rows.push(record);
  recordsByEdrpou.set(record.supplier_edrpou, rows);
}

const baseByEdrpou = new Map(base.filter(row => row.edrpou).map(row => [String(row.edrpou).replace(/\D/g, ''), row]));
const baseByDomain = new Map(base.filter(row => row.domain).map(row => [domain(row.domain), row]));
const baseByNormalizedName = new Map(base.map(row => [normalizedName(row.company_name), row]));

function findBaseMatch(lead) {
  const edrpou = String(lead.edrpou || '').replace(/\D/g, '');
  if (baseByEdrpou.has(edrpou)) return { match: baseByEdrpou.get(edrpou), reason: 'edrpou' };
  if (lead.domain && baseByDomain.has(domain(lead.domain))) return { match: baseByDomain.get(domain(lead.domain)), reason: 'domain' };
  const norm = normalizedName(lead.company_name);
  if (norm && baseByNormalizedName.has(norm)) return { match: baseByNormalizedName.get(norm), reason: 'normalized_name' };
  if (norm.length >= 6) {
    for (const row of base) {
      const candidate = normalizedName(row.company_name);
      if (candidate.length < 6) continue;
      if ((norm.includes(candidate) || candidate.includes(norm)) && Math.min(norm.length, candidate.length) / Math.max(norm.length, candidate.length) >= 0.72) {
        return { match: row, reason: 'name_containment' };
      }
      const leftTokens = tokens(norm);
      const rightTokens = tokens(candidate);
      const sharedTokens = [...leftTokens].filter(token => rightTokens.has(token));
      if (leftTokens.size >= 2 && rightTokens.size >= 2 && sharedTokens.length >= 2 && jaccard(norm, candidate) >= 0.82) {
        return { match: row, reason: 'name_token_similarity' };
      }
    }
  }
  return null;
}

function scaleSignal(value) {
  if (value >= 10_000_000) return 5;
  if (value >= 2_000_000) return 4;
  if (value >= 500_000) return 3;
  if (value >= 100_000) return 2;
  return 1;
}

function isSoleProprietor(lead) {
  const id = String(lead.edrpou || '').replace(/\D/g, '');
  return id.length === 10 || /^\s*(фоп|фізична особа)/iu.test(lead.company_name || '');
}

function liveProjectCount(records) {
  return new Set(records.filter(record => record.delivery_end_date && record.delivery_end_date.slice(0, 10) >= AS_OF_DATE).map(record => record.tender_id)).size;
}

function latestRecord(records) {
  return [...records].sort((a, b) => String(b.award_date).localeCompare(String(a.award_date)))[0] || null;
}

function intentScore(lead, records) {
  const latest = latestRecord(records);
  const latestDate = latest?.award_date ? new Date(latest.award_date) : new Date('2000-01-01');
  const asOf = new Date('2026-08-24T23:59:59+03:00');
  const days = Math.max(0, Math.floor((asOf - latestDate) / 86400000));
  const recency = days <= 45 ? 30 : days <= 120 ? 24 : days <= 240 ? 16 : 8;
  const activity = Math.min(20, lead.tender_count * 5);
  const live = Math.min(15, liveProjectCount(records) * 5);
  const value = lead.total_award_value_uah >= 10_000_000 ? 20 : lead.total_award_value_uah >= 2_000_000 ? 16 : lead.total_award_value_uah >= 500_000 ? 12 : lead.total_award_value_uah >= 100_000 ? 8 : 4;
  const breadth = Math.min(10, lead.segments.length * 3);
  const entity = isSoleProprietor(lead) ? 2 : 5;
  return Math.min(100, recency + activity + live + value + breadth + entity);
}

const supportedSegments = new Map([
  ['Електромонтаж', { route: 'Пілот зараз — Н.15', coverage: 5 }],
  ['Внутрішні сантехнічні системи', { route: 'Пілот зараз — Н.14', coverage: 5 }],
  ['HVAC / ОВіК', { route: 'Пілот зараз — Н.14', coverage: 5 }],
]);

function pilotScore({ coverage, workflow, hidden, scale, docs, buyer, reachability }) {
  return Math.min(100, coverage * 8 + workflow * 3 + hidden * 2 + scale * 2 + docs * 2 + buyer * 2 + reachability);
}

function expansionScore({ workflow, hidden, scale, docs, buyer, reachability }) {
  return Math.min(100, workflow * 5 + hidden * 4 + docs * 4 + scale * 3 + buyer * 2 + reachability * 2);
}

const filtered = tenderLeads.filter(lead => !isPlaceholder(lead));
const overlaps = [];
const uniqueNew = [];

for (const raw of filtered) {
  const records = recordsByEdrpou.get(raw.edrpou) || [];
  const latest = latestRecord(records);
  const score = intentScore(raw, records);
  const liveCount = liveProjectCount(records);
  const intentPriority = score >= 75 ? 'I1' : score >= 58 ? 'I2' : 'I3';
  const normalized = {
    ...raw,
    ...(browserVerifiedWebsites.get(String(raw.edrpou)) || {}),
    company_type: isSoleProprietor(raw) ? 'sole_proprietor' : 'legal_entity',
    intent_score: score,
    intent_priority: intentPriority,
    live_project_count: liveCount,
    latest_award_date: latest?.award_date || raw.latest_award_date,
    latest_delivery_end_date: latest?.delivery_end_date || raw.latest_delivery_end_date,
    latest_tender_id: latest?.tender_id || raw.latest_tender_id,
    latest_tender_url: latest?.tender_url || raw.latest_tender_url,
    latest_tender_title: latest?.tender_title || raw.tender_titles?.[0] || '',
  };
  const baseMatch = findBaseMatch(normalized);
  if (baseMatch) {
    overlaps.push({ ...normalized, matched_lead_id: baseMatch.match.lead_id, matched_company_name: baseMatch.match.company_name, match_reason: baseMatch.reason });
  } else {
    uniqueNew.push(normalized);
  }
}

uniqueNew.sort((a, b) => b.intent_score - a.intent_score || b.total_award_value_uah - a.total_award_value_uah || a.company_name.localeCompare(b.company_name, 'uk'));

const enrichedBase = base.map(row => {
  const overlap = overlaps.find(item => item.matched_lead_id === row.lead_id);
  if (!overlap) {
    return {
      ...row,
      intent_score: row.intent_score || 0,
      intent_priority: row.intent_priority || '—',
      tender_count: row.tender_count || 0,
      live_project_count: row.live_project_count || 0,
      total_award_value_uah: row.total_award_value_uah || 0,
      latest_tender_id: row.latest_tender_id || '',
      latest_tender_url: row.latest_tender_url || '',
      latest_tender_title: row.latest_tender_title || '',
      latest_award_date: row.latest_award_date || '',
      latest_delivery_end_date: row.latest_delivery_end_date || '',
      tender_segments: row.tender_segments || '',
    };
  }
  return {
    ...row,
    intent_score: overlap.intent_score,
    intent_priority: overlap.intent_priority,
    tender_count: overlap.tender_count,
    live_project_count: overlap.live_project_count,
    total_award_value_uah: overlap.total_award_value_uah,
    latest_tender_id: overlap.latest_tender_id,
    latest_tender_url: overlap.latest_tender_url,
    latest_tender_title: overlap.latest_tender_title,
    latest_award_date: overlap.latest_award_date,
    latest_delivery_end_date: overlap.latest_delivery_end_date,
    tender_segments: overlap.segments.join('; '),
    next_action: `Повторне звернення з посиланням на ${overlap.latest_tender_id}; попросити 1 пакет здачі з поточного workflow`,
  };
});

const wave3Rows = uniqueNew.map((lead, index) => {
  const supported = supportedSegments.get(lead.primary_segment);
  const scale = scaleSignal(lead.total_award_value_uah);
  const sole = lead.company_type === 'sole_proprietor';
  const coverage = supported?.coverage || 1;
  const workflow = 5;
  const hidden = supported ? 5 : 4;
  const docs = 5;
  const buyer = sole ? 3 : 5;
  const reachability = 5;
  const lane = supported ? 'Pilot now' : 'Expansion discovery';
  const pilot = pilotScore({ coverage, workflow, hidden, scale, docs, buyer, reachability });
  const expansion = expansionScore({ workflow, hidden, scale, docs, buyer, reachability });
  const fitPriority = lane === 'Pilot now' && lead.intent_priority === 'I1' ? 'P1'
    : lane === 'Pilot now' && lead.intent_priority === 'I2' ? 'P2'
      : lane === 'Expansion discovery' && lead.intent_priority === 'I1' ? 'D1'
        : lane === 'Expansion discovery' && lead.intent_priority === 'I2' ? 'D2'
          : lane === 'Pilot now' ? 'P3' : 'D3';
  return {
    lead_id: `W3-${String(index + 1).padStart(3, '0')}`,
    wave: 'Prozorro winners — 24.08',
    company_name: lead.company_name,
    domain: lead.domain || '',
    segment: lead.primary_segment,
    account_type: sole ? 'sole_proprietor_contractor' : 'tender_proven_contractor',
    route: supported?.route || 'Discovery розширення — 2 тижні',
    current_requirement_coverage: coverage,
    workflow_fit: workflow,
    hidden_intensity: hidden,
    scale_signal: scale,
    docs_signal: docs,
    buyer_fit: buyer,
    reachability,
    fit_evidence: `${lead.tender_count} підтверджених перемог/договорів у Prozorro на ${Math.round(lead.total_award_value_uah).toLocaleString('uk-UA')} грн; ${lead.live_project_count} проєктів зі строком виконання не раніше 24.08.2026.`,
    pilot_trigger: `${lead.latest_tender_title}${lead.latest_delivery_end_date ? `; строк до ${lead.latest_delivery_end_date.slice(0, 10)}` : ''}. Попросити один знеособлений пакет здачі за цим workflow.`,
    target_role: sole ? 'Власник / виконавець; відповідальний за договір' : 'Власник / директор; керівник ПТО; відповідальний за договори',
    source_url: lead.latest_tender_url,
    source_access: 'official_prozorro_api',
    evidence_confidence: 'high',
    verification_status: 'official_prozorro_award_2025_2026',
    research_date: '2026-08-24',
    contact_status: 'Не контактували',
    next_action: supported
      ? `Персоналізований free-pilot outreach по ${lead.latest_tender_id}; попросити 1 пакет Н.14/Н.15`
      : `Workflow-audit outreach по ${lead.latest_tender_id}; попросити 1 пакет здачі та вимоги проєкту`,
    edrpou: lead.edrpou,
    owner: '',
    lane,
    pilot_now_score: pilot,
    expansion_score: expansion,
    priority: fitPriority,
    intent_score: lead.intent_score,
    intent_priority: lead.intent_priority,
    tender_count: lead.tender_count,
    live_project_count: lead.live_project_count,
    total_award_value_uah: lead.total_award_value_uah,
    latest_tender_id: lead.latest_tender_id,
    latest_tender_url: lead.latest_tender_url,
    latest_tender_title: lead.latest_tender_title,
    latest_award_date: lead.latest_award_date,
    latest_delivery_end_date: lead.latest_delivery_end_date,
    tender_segments: lead.segments.join('; '),
    company_url: lead.company_url || '',
    website_status: lead.website_status || (lead.domain ? 'supplier_provided_url' : 'not_found_in_top_search'),
  };
});

const unified = [...enrichedBase, ...wave3Rows];

const summary = {
  generated_at: '2026-08-24T23:45:00+03:00',
  input_supplier_leads: tenderLeads.length,
  invalid_or_redacted_removed: tenderLeads.length - filtered.length,
  valid_supplier_leads: filtered.length,
  overlaps_with_base_268: overlaps.length,
  unique_new_supplier_leads: wave3Rows.length,
  unified_total: unified.length,
  company_type_counts: wave3Rows.reduce((acc, row) => ((acc[row.account_type] = (acc[row.account_type] || 0) + 1), acc), {}),
  intent_priority_counts: wave3Rows.reduce((acc, row) => ((acc[row.intent_priority] = (acc[row.intent_priority] || 0) + 1), acc), {}),
  lane_counts: unified.reduce((acc, row) => ((acc[row.lane] = (acc[row.lane] || 0) + 1), acc), {}),
  high_confidence_count: unified.filter(row => row.evidence_confidence === 'high').length,
  tender_signal_count: unified.filter(row => Number(row.tender_count || 0) > 0).length,
  live_project_signal_count: unified.filter(row => Number(row.live_project_count || 0) > 0).length,
  tender_award_value_uah: wave3Rows.reduce((sum, row) => sum + Number(row.total_award_value_uah || 0), 0),
};

fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_validated_leads_2026-08-24.json'), JSON.stringify(uniqueNew, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prozorro_wave3_validated_overlaps_2026-08-24.json'), JSON.stringify(overlaps, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'prospects_unified_v4_2026-08-24.json'), JSON.stringify(unified, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'wave3_normalization_summary_2026-08-24.json'), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
console.log('Top new leads:');
console.log(wave3Rows.slice(0, 20).map(row => ({ id: row.lead_id, company: row.company_name, edrpou: row.edrpou, lane: row.lane, intent: row.intent_score, priority: row.intent_priority, tenders: row.tender_count, live: row.live_project_count, value: row.total_award_value_uah })));
