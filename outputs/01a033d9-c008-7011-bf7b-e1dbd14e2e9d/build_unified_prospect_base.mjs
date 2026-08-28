import fs from "node:fs/promises";

const OUT_DIR = "/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d";
const existing = JSON.parse(await fs.readFile(`${OUT_DIR}/existing_leads_50.json`, "utf8"));
const prior51 = JSON.parse(await fs.readFile(`${OUT_DIR}/new_candidates_2026-08-24_reverified.json`, "utf8"));
const expanded64 = JSON.parse(await fs.readFile(`${OUT_DIR}/expanded_candidates_2026-08-24_reverified.json`, "utf8"));

const segmentMap = {
  electrical: "Електромонтаж",
  low_voltage: "Слаботочні системи",
  hvac: "HVAC / вентиляція",
  external_networks: "Зовнішні мережі",
  plumbing: "Внутрішня сантехніка",
  solar: "Сонячна енергетика",
  maintenance: "Сервіс / експлуатація",
  fire_safety: "Пожежна безпека",
  mep: "MEP / інженерні системи",
  commercial_fitout_mep: "Генпідряд / MEP fit-out",
  electrical_low_voltage: "Електрика + слаботочка",
  external_networks_electrical: "Зовнішні мережі + електрика",
  fire_hvac: "Пожежні системи + HVAC",
  fire_hvac_electrical: "Пожежні системи + HVAC + електрика",
  fire_security: "Пожежна безпека + охорона",
  fire_systems: "Пожежні системи",
  hvac_internal: "Внутрішній HVAC",
  industrial_electrical: "Промислова електрика",
  industrial_electrical_fire: "Промислова електрика + пожежні системи",
  industrial_electrical_solar: "Промислова електрика + СЕС",
  industrial_hvac_mep: "Промисловий HVAC / MEP",
  industrial_mep: "Промисловий MEP",
  industrial_refrigeration: "Промислове холодопостачання",
  plumbing_hvac_internal: "Внутрішня сантехніка + HVAC",
  security_fire_low_voltage: "Безпека + пожежні + слаботочка",
  solar_electrical: "СЕС + електрика",
};

const legacyCoverage = { electrical: 5, low_voltage: 3, hvac: 4, external_networks: 1, plumbing: 5, solar: 5, maintenance: null, fire_safety: 2, mep: 5 };
const legacyRoute = {
  electrical: "Пілот зараз — Н.15",
  low_voltage: "Discovery — частково Н.15 + вимоги проєкту",
  hvac: "Пілот зараз — Н.14",
  external_networks: "Пізніше — вимоги проєкту",
  plumbing: "Пілот зараз — Н.14",
  solar: "Пілот зараз — Н.15",
  maintenance: "Перекваліфікувати",
  fire_safety: "Discovery — вимоги проєкту",
  mep: "Пілот зараз — Н.14 + Н.15",
};

const normalizeDomain = (value = "") => value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const laneFor = (route = "") => {
  if (/Пілот зараз|Now|Зараз/.test(route)) return "Pilot now";
  if (/Discovery|Validate|Перевірити/.test(route)) return "Expansion discovery";
  if (/Пізніше|Later/.test(route)) return "Later / requirements";
  return "Requalify";
};
const scores = (x) => {
  const factors = [x.current_requirement_coverage, x.workflow_fit, x.hidden_intensity, x.scale_signal, x.docs_signal, x.buyer_fit, x.reachability];
  if (!factors.every(Number.isFinite)) return { pilot_now_score: null, expansion_score: null };
  return {
    pilot_now_score: x.current_requirement_coverage * 8 + x.workflow_fit * 3 + x.hidden_intensity * 2 + x.scale_signal * 2 + x.docs_signal * 2 + x.buyer_fit * 2 + x.reachability,
    expansion_score: x.workflow_fit * 5 + x.hidden_intensity * 4 + x.docs_signal * 4 + x.scale_signal * 3 + x.buyer_fit * 2 + x.reachability * 2,
  };
};
const priorityFor = (x) => {
  const { pilot_now_score, expansion_score } = scores(x);
  if (x.lane === "Pilot now") return pilot_now_score >= 84 ? "P1" : pilot_now_score >= 72 ? "P2" : "P3";
  if (x.lane === "Expansion discovery") return expansion_score >= 88 ? "D1" : expansion_score >= 78 ? "D2" : "D3";
  if (x.lane === "Later / requirements") return "L";
  return "Legacy";
};

const base = [];

for (const [index, item] of existing.entries()) {
  const complete = [item.hidden_work_intensity, item.crew_signal, item.multi_project_scale, item.doc_complexity, item.reachability].every(Number.isFinite);
  const route = complete ? (legacyRoute[item.trade] || "Перекваліфікувати") : "Перекваліфікувати";
  const normalized = {
    lead_id: item.pool_id || `OLD-${String(index + 1).padStart(3, "0")}`,
    wave: item.origin === "new_research_2026-07-28" ? "Досліджено 28.07" : "Legacy 28",
    company_name: item.company_name,
    domain: normalizeDomain(item.domain),
    segment: segmentMap[item.trade] || item.trade || "Інше",
    account_type: "specialist_contractor",
    route,
    current_requirement_coverage: complete ? (legacyCoverage[item.trade] ?? null) : null,
    workflow_fit: complete ? 5 : null,
    hidden_intensity: complete ? item.hidden_work_intensity : null,
    scale_signal: complete ? Math.max(item.crew_signal || 0, item.multi_project_scale || 0) : null,
    docs_signal: complete ? item.doc_complexity : null,
    buyer_fit: complete ? 5 : null,
    reachability: complete ? item.reachability : null,
    fit_evidence: item.fit_evidence || "Legacy-запис потребує повторної публічної перевірки.",
    pilot_trigger: item.hidden_work_trigger || "Уточнити, які етапи та докази стають недоступними після закриття робіт.",
    target_role: "Власник / директор; керівник ПТО",
    source_url: item.verification_url || item.registry_url || (item.domain ? `https://${normalizeDomain(item.domain)}` : ""),
    source_access: complete ? "historical_official_research" : "legacy_not_reverified",
    evidence_confidence: complete ? "medium" : "low",
    verification_status: complete ? "historical_research_2026-07-28" : "needs_full_reverification",
    research_date: item.origin === "new_research_2026-07-28" ? "2026-07-28" : "",
    contact_status: item.origin === "new_research_2026-07-28" ? "Надіслано 28.07 — follow-up" : "Потрібна повторна перевірка",
    next_action: item.origin === "new_research_2026-07-28" ? "Follow-up з review-link; далі попросити 1 анонімізований артефакт" : "Повністю перевірити сайт і поточний проєкт перед контактом",
    edrpou: item.edrpou || "",
    owner: "Олександр",
  };
  normalized.lane = laneFor(route);
  Object.assign(normalized, scores(normalized));
  normalized.priority = priorityFor(normalized);
  base.push(normalized);
}

const priorManual = {
  "terra-plus.com.ua": { evidence_confidence: "high", verification_status: "official_content_reverified_via_search_index", source_access: "live_site_redirects_to_hosting_panel", reachability: 2 },
  "spz-montage.com.ua": { evidence_confidence: "high", verification_status: "official_content_reverified_via_search_index", source_access: "live_site_bad_ssl_certificate", reachability: 2 },
  "voltmontage.com.ua": { evidence_confidence: "high", verification_status: "official_content_reverified_via_search_index", source_access: "live_site_unreachable_in_browser", reachability: 2 },
  "knk.ua": { evidence_confidence: "high", verification_status: "official_homepage_and_pdf_reverified", source_access: "official_homepage_indexed_pdf_reachable", reachability: 4 },
  "office-construction.ua": { evidence_confidence: "high", verification_status: "official_portfolio_pdf_reverified", source_access: "official_pdf_reachable", reachability: 4 },
};

const priorRoute = (item) => {
  if ((item.pilot_track || "").startsWith("Now — Н.14 + Н.15")) return "Пілот зараз — Н.14 + Н.15";
  if ((item.pilot_track || "").startsWith("Now — Н.14")) return "Пілот зараз — Н.14";
  if ((item.pilot_track || "").startsWith("Now — Н.15")) return "Пілот зараз — Н.15";
  if ((item.pilot_track || "").startsWith("Validate")) return "Discovery — частково Н.15 + вимоги проєкту";
  if ((item.pilot_track || "").startsWith("Later")) return "Пізніше — вимоги проєкту";
  return "Перекваліфікувати";
};

for (const [index, item] of prior51.entries()) {
  const domain = normalizeDomain(item.domain);
  const manual = priorManual[domain] || {};
  const route = priorRoute(item);
  const normalized = {
    lead_id: `AUG-${String(index + 1).padStart(3, "0")}`,
    wave: "Перевірено 51 — 24.08",
    company_name: item.company_name,
    domain,
    segment: segmentMap[item.segment] || item.segment || "Інше",
    account_type: item.account_type || "specialist_contractor",
    route,
    current_requirement_coverage: item.product_coverage,
    workflow_fit: 5,
    hidden_intensity: item.hidden_intensity,
    scale_signal: item.scale_signal,
    docs_signal: item.docs_signal,
    buyer_fit: item.buyer_fit,
    reachability: manual.reachability ?? item.reachability,
    fit_evidence: item.fit_evidence,
    pilot_trigger: item.pilot_trigger,
    target_role: item.target_role,
    source_url: item.source_url_rechecked || item.source_url,
    source_access: manual.source_access || (item.http_status === 200 ? "official_source_reachable" : item.verification_status),
    evidence_confidence: manual.evidence_confidence || item.verification_confidence,
    verification_status: manual.verification_status || item.verification_status,
    research_date: "2026-08-24",
    contact_status: "Новий — не контактували",
    next_action: laneFor(route) === "Pilot now" ? "Персоналізувати review-flow за доказом; попросити 1 артефакт" : "Discovery-call: перевірити процес і отримати вимоги конкретного проєкту",
    edrpou: "",
    owner: "Олександр",
  };
  normalized.lane = laneFor(route);
  Object.assign(normalized, scores(normalized));
  normalized.priority = priorityFor(normalized);
  base.push(normalized);
}

const expansionManual = {
  "enremo.ua": { evidence_confidence: "medium", verification_status: "official_content_reverified_via_search_index", source_access: "live_site_unreachable_in_browser", reachability: 2 },
  "cleanroom.com.ua": { evidence_confidence: "high", verification_status: "official_page_and_search_index_reverified", source_access: "official_page_reachable_dynamic_content", reachability: 4 },
  "brasgroup.com.ua": { evidence_confidence: "medium", verification_status: "official_content_reverified_via_search_index", source_access: "http_423_live_site", reachability: 2 },
};

for (const [index, item] of expanded64.entries()) {
  const domain = normalizeDomain(item.domain);
  const manual = expansionManual[domain] || {};
  const normalized = {
    lead_id: `EXP-${String(index + 1).padStart(3, "0")}`,
    wave: "Розширення ніш — 24.08",
    company_name: item.company_name,
    domain,
    segment: item.segment,
    account_type: item.account_type,
    route: item.route,
    current_requirement_coverage: item.current_requirement_coverage,
    workflow_fit: item.workflow_fit,
    hidden_intensity: item.hidden_intensity,
    scale_signal: item.scale_signal,
    docs_signal: item.docs_signal,
    buyer_fit: item.buyer_fit,
    reachability: manual.reachability ?? item.reachability,
    fit_evidence: item.fit_evidence,
    pilot_trigger: item.pilot_trigger,
    target_role: item.target_role,
    source_url: item.source_url_rechecked || item.source_url,
    source_access: manual.source_access || (item.http_status === 200 ? "official_source_reachable" : item.verification_status),
    evidence_confidence: manual.evidence_confidence || item.verification_confidence,
    verification_status: manual.verification_status || item.verification_status,
    research_date: "2026-08-24",
    contact_status: "Новий — не контактували",
    next_action: "Discovery-call: отримати 1 реальний артефакт і вимоги проєкту; не обіцяти готове покриття",
    edrpou: "",
    owner: "Олександр",
  };
  normalized.lane = laneFor(item.route);
  Object.assign(normalized, scores(normalized));
  normalized.priority = priorityFor(normalized);
  base.push(normalized);
}

const seen = new Map();
const duplicates = [];
for (const item of base) {
  if (item.domain && seen.has(item.domain)) duplicates.push({ domain: item.domain, first: seen.get(item.domain), duplicate: item.company_name });
  else if (item.domain) seen.set(item.domain, item.company_name);
}
if (duplicates.length) throw new Error(`Duplicate domains: ${JSON.stringify(duplicates)}`);
if (base.length !== 165) throw new Error(`Expected 165 accounts, got ${base.length}`);

const rank = { P1: 0, P2: 1, P3: 2, D1: 3, D2: 4, D3: 5, L: 6, Legacy: 7 };
base.sort((a, b) => (rank[a.priority] - rank[b.priority]) || ((b.pilot_now_score || b.expansion_score || 0) - (a.pilot_now_score || a.expansion_score || 0)) || a.company_name.localeCompare(b.company_name, "uk"));

await fs.writeFile(`${OUT_DIR}/prospects_unified_165_2026-08-24.json`, JSON.stringify(base, null, 2), "utf8");
console.log(JSON.stringify({
  count: base.length,
  byWave: base.reduce((a,x) => { a[x.wave] = (a[x.wave] || 0) + 1; return a; }, {}),
  byLane: base.reduce((a,x) => { a[x.lane] = (a[x.lane] || 0) + 1; return a; }, {}),
  byPriority: base.reduce((a,x) => { a[x.priority] = (a[x.priority] || 0) + 1; return a; }, {}),
  byConfidence: base.reduce((a,x) => { a[x.evidence_confidence] = (a[x.evidence_confidence] || 0) + 1; return a; }, {}),
}, null, 2));
