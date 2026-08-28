import fs from "node:fs/promises";

const OUT = "/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d";
const existing = JSON.parse(await fs.readFile(`${OUT}/prospects_unified_165_2026-08-24.json`, "utf8"));
const raw = JSON.parse(await fs.readFile(`${OUT}/wave2_candidates_2026-08-24_raw.json`, "utf8"));

const domainOf = (value) => {
  if (!value) return "";
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(value).toLowerCase().replace(/^www\./, "").split("/")[0];
  }
};

const templates = {
  "ГНБ / безтраншейні мережі": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Власник / директор; керівник будівництва; керівник ПТО",
    trigger: "Траса, пілотна свердловина, розширення та протягування стають невидимими; потрібні журнали, геоприв'язка й докази до здачі переходу."
  },
  "Водоочищення та очисні споруди": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Комерційний директор; керівник проєктів; головний технолог / ПТО",
    trigger: "Трубопроводи, закладні, резервуари, мембрани й пусконалагодження потребують поетапних актів, фото та протоколів."
  },
  "Промислова автоматизація / SCADA": {
    workflow: 5, hidden: 4, scale: 4, docs: 5, buyer: 5,
    target: "Комерційний директор; керівник проєктів АСК ТП; керівник пусконалагодження",
    trigger: "Шафи, кабелі, маркування, loop-check та FAT/SAT створюють пакет доказів між монтажем, ПНР і замовником."
  },
  "Промисловий холод": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Власник / директор; керівник проєктів; головний холодильний інженер / ПТО",
    trigger: "Трубопроводи холодоагенту, ізоляція, випробування та ПНР закриваються послідовно і потребують протоколів."
  },
  "Пожежогасіння": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Директор; керівник проєктів; керівник монтажу / ПТО",
    trigger: "Трубопроводи, проходки, спринклери, адресація й випробування потребують доказів до оздоблення та введення."
  },
  "Резервне живлення": {
    workflow: 5, hidden: 4, scale: 4, docs: 5, buyer: 5,
    target: "Комерційний директор; керівник енергетичних проєктів; ПТО / ПНР",
    trigger: "Кабельні траси, АВР, заземлення, налаштування ДБЖ і тест під навантаженням формують контрольний пакет."
  },
  "Безпека / СКУД / CCTV": {
    workflow: 5, hidden: 4, scale: 4, docs: 5, buyer: 5,
    target: "Власник / комерційний директор; керівник проєктів; керівник монтажу / ПТО",
    trigger: "Кабельні траси, адресація, налаштування й acceptance-тести розподілені між монтажником, інтегратором і замовником."
  },
  "ВОЛЗ / телеком-мережі": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Директор; керівник будівництва мереж; керівник ПТО / проєктів",
    trigger: "Траси, муфти, зварювання волокон, рефлектограми й виконавчі схеми мають бути прив'язані до конкретних ділянок."
  },
  "Газопостачання / котельні": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Директор; головний інженер; керівник ПТО / пусконалагодження",
    trigger: "Трубопроводи, зварні стики, випробування, автоматика й ПНР потребують актів і протоколів до введення."
  },
  "Медичні гази": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Комерційний директор; керівник проєктів; ПТО / відповідальний за якість",
    trigger: "Мідні трубопроводи, пайка, маркування, чистота, випробування й валідація утворюють критичний приймальний пакет."
  },
  "Стиснене повітря / компресорні": {
    workflow: 5, hidden: 5, scale: 4, docs: 4, buyer: 5,
    target: "Директор; керівник інженерних проєктів; головний інженер / сервіс",
    trigger: "Пневмомережі, дренаж, фільтрація, випробування герметичності й ПНР здаються поетапно."
  },
  "Технологічні трубопроводи": {
    workflow: 5, hidden: 5, scale: 5, docs: 5, buyer: 5,
    target: "Директор; керівник ПТО; головний зварювальник / контроль якості",
    trigger: "Зварні стики, НК, опори, очищення, гідровипробування й ізоляція вимагають простежуваного пакета до закриття."
  },
  "Мости та інфраструктура": {
    workflow: 5, hidden: 5, scale: 5, docs: 5, buyer: 5,
    target: "Комерційний директор; головний інженер; керівник ПТО / якості",
    trigger: "Армування, опори, зварювання, бетонування, гідроізоляція й лабораторні протоколи приймаються до наступного шару."
  },
  "Підсилення та ремонт бетону": {
    workflow: 5, hidden: 5, scale: 4, docs: 5, buyer: 5,
    target: "Власник / директор; керівник проєктів; ПТО / контроль якості",
    trigger: "Підготовка основи, ін'єкції, армування, торкрет і захисні шари стають невидимими та потребують фото й актів."
  }
};

const existingDomains = new Set(existing.map((x) => domainOf(x.domain || x.source_url)));
const seen = new Set(existingDomains);
const overlaps = [];
const candidates = [];

for (const item of raw) {
  const domain = domainOf(item.source_url);
  if (!domain || seen.has(domain)) {
    overlaps.push({ company: item.company, domain, source_url: item.source_url });
    continue;
  }
  seen.add(domain);
  const t = templates[item.segment];
  const weakTitle = /^(DM Project|Cool Factory|Fortis PRO|TEKNOSEL|Dalgakiran|ObjectSCADA)/i.test(item.company);
  const oldHttp = item.source_url.startsWith("http://");
  const evidenceConfidence = weakTitle || oldHttp ? "medium" : "high";
  const reachability = oldHttp ? 3 : weakTitle ? 4 : 5;
  const expansionScore = t.workflow * 5 + t.hidden * 4 + t.docs * 4 + t.scale * 3 + t.buyer * 2 + reachability * 2;
  const pilotNowScore = 1 * 8 + t.workflow * 3 + t.hidden * 2 + t.scale * 2 + t.docs * 2 + t.buyer * 2 + reachability;
  const priority = expansionScore >= 88 ? "D1" : expansionScore >= 78 ? "D2" : "D3";
  candidates.push({
    lead_id: `W2-${String(candidates.length + 1).padStart(3, "0")}`,
    wave: "Проєктний сигнал — 24.08",
    company_name: item.company,
    domain,
    segment: item.segment,
    account_type: "specialist_contractor_or_integrator",
    route: "2-тижневий workflow discovery — потрібні вимоги одного проєкту",
    current_requirement_coverage: 1,
    workflow_fit: t.workflow,
    hidden_intensity: t.hidden,
    scale_signal: t.scale,
    docs_signal: t.docs,
    buyer_fit: t.buyer,
    reachability,
    fit_evidence: `${item.search_signal}. Пошуковий результат веде на індексовану сторінку корпоративного домену: ${item.source_title}.`,
    pilot_trigger: t.trigger,
    target_role: t.target,
    source_url: item.source_url,
    source_access: evidenceConfidence === "high" ? "indexed_official_service_page" : "indexed_official_page_manual_check",
    evidence_confidence: evidenceConfidence,
    verification_status: evidenceConfidence === "high" ? "google_index_verified_2026-08-24" : "google_index_verified_manual_check_2026-08-24",
    research_date: "2026-08-24",
    contact_status: "Новий — не контактували",
    next_action: "2-тижневий discovery: запросити вимоги 1 активного проєкту + 1 знеособлений артефакт",
    edrpou: "",
    owner: "Олександр",
    lane: "Expansion discovery",
    pilot_now_score: pilotNowScore,
    expansion_score: expansionScore,
    priority
  });
}

const unified = [...existing, ...candidates];
const byLane = Object.fromEntries([...new Set(unified.map((x) => x.lane))].map((lane) => [lane, unified.filter((x) => x.lane === lane).length]));
const byConfidence = Object.fromEntries([...new Set(unified.map((x) => x.evidence_confidence))].map((c) => [c, unified.filter((x) => x.evidence_confidence === c).length]));
const bySegment = Object.entries(unified.reduce((acc, x) => ((acc[x.segment] = (acc[x.segment] || 0) + 1), acc), {}))
  .map(([segment, count]) => ({ segment, count }))
  .sort((a, b) => b.count - a.count || a.segment.localeCompare(b.segment));

await fs.writeFile(`${OUT}/wave2_candidates_2026-08-24_normalized.json`, JSON.stringify(candidates, null, 2));
await fs.writeFile(`${OUT}/wave2_overlaps_2026-08-24.json`, JSON.stringify(overlaps, null, 2));
await fs.writeFile(`${OUT}/prospects_unified_268_2026-08-24.json`, JSON.stringify(unified, null, 2));
await fs.writeFile(`${OUT}/report_data_v3.json`, JSON.stringify({
  summary: [{
    total_accounts: unified.length,
    previous_accounts: existing.length,
    new_unique_accounts: candidates.length,
    raw_candidates: raw.length,
    duplicate_domains_removed: overlaps.length,
    high_confidence: unified.filter((x) => x.evidence_confidence === "high").length,
    pilot_now: unified.filter((x) => x.lane === "Pilot now").length,
    expansion_discovery: unified.filter((x) => x.lane === "Expansion discovery").length,
    later: unified.filter((x) => x.lane === "Later / requirements").length,
    requalify: unified.filter((x) => x.lane === "Requalify").length,
    evidenced_sends: 21,
    replies: 0
  }],
  lanes: Object.entries(byLane).map(([lane, account_count]) => ({
    lane,
    account_count,
    top_priority_count: unified.filter((x) => x.lane === lane && ["P1", "D1"].includes(x.priority)).length,
    high_confidence_count: unified.filter((x) => x.lane === lane && x.evidence_confidence === "high").length,
    medium_confidence_count: unified.filter((x) => x.lane === lane && x.evidence_confidence === "medium").length
  })),
  wave2_segments: candidates.reduce((acc, x) => {
    const row = acc.find((r) => r.segment === x.segment);
    if (row) {
      row.account_count += 1;
      row.high_confidence_count += x.evidence_confidence === "high" ? 1 : 0;
      row.top_priority_count += x.priority === "D1" ? 1 : 0;
    } else {
      acc.push({ segment: x.segment, account_count: 1, high_confidence_count: x.evidence_confidence === "high" ? 1 : 0, top_priority_count: x.priority === "D1" ? 1 : 0 });
    }
    return acc;
  }, []).sort((a, b) => b.account_count - a.account_count || a.segment.localeCompare(b.segment)),
  current_top: unified.filter((x) => x.lane === "Pilot now").sort((a, b) => b.pilot_now_score - a.pilot_now_score || a.company_name.localeCompare(b.company_name)).slice(0, 15).map((x) => ({ company: x.company_name, priority: x.priority, pilot_now_score: x.pilot_now_score, segment: x.segment, target_role: x.target_role, domain: x.domain, source_url: x.source_url, evidence_confidence: x.evidence_confidence })),
  expansion_top: unified.filter((x) => x.lane === "Expansion discovery").sort((a, b) => b.expansion_score - a.expansion_score || a.company_name.localeCompare(b.company_name)).slice(0, 20).map((x) => ({ company: x.company_name, priority: x.priority, expansion_score: x.expansion_score, segment: x.segment, target_role: x.target_role, domain: x.domain, source_url: x.source_url, evidence_confidence: x.evidence_confidence })),
  all_segments: bySegment,
  confidence: byConfidence
}, null, 2));

console.log(JSON.stringify({ raw: raw.length, overlaps: overlaps.length, new_unique: candidates.length, total: unified.length, byLane, byConfidence, topSegments: bySegment.slice(0, 20) }, null, 2));
