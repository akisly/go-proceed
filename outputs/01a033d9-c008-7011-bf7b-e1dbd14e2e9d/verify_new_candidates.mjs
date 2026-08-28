import fs from "node:fs/promises";

const OUT_DIR = "/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d";
const inputName = process.argv[2] || "new_candidates_2026-08-24.json";
const outputName = process.argv[3] || "new_candidates_2026-08-24_reverified.json";
const input = JSON.parse(await fs.readFile(`${OUT_DIR}/${inputName}`, "utf8"));

const keywords = [
  "монтаж", "будів", "строит", "об'єкт", "объект", "проєкт", "проект",
  "електр", "электр", "кабель", "вентиляц", "опален", "водоп", "каналіз",
  "пожеж", "пожар", "інженер", "инженер", "соняч", "solar", "тепл",
  "холод", "сантех", "слаботоч", "безпек", "автоматизац", "пусконалагод",
  "покрів", "кровл", "гідроізол", "фасад", "підлог", "пол", "бетон", "пал",
  "фундамент", "металоконструк", "ізоляц", "ліфт", "басейн", "cleanroom", "скс", "bms",
];

const stripHtml = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();

const titleFrom = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 220) : "";
};

async function verify(item) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  const started = Date.now();
  try {
    const response = await fetch(item.source_url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",
        "accept-language": "uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.6",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const text = stripHtml(raw).toLowerCase().slice(0, 180000);
    const matched = keywords.filter(k => text.includes(k));
    const domainMention = text.includes(item.domain.replace(/^www\./, "").split(".")[0].toLowerCase());
    const isPdf = contentType.toLowerCase().includes("pdf") || item.source_url.toLowerCase().includes(".pdf");
    const companyToken = item.company_name.toLowerCase().replace(/[«»“”"'’`.,()\-–—]/g, " ").split(/\s+/).filter(t => t.length >= 5)[0] || "";
    const companyMention = companyToken ? text.includes(companyToken) : false;
    let verification = "needs_browser_review";
    if (response.ok && (isPdf || matched.length >= 3) && (companyMention || domainMention || matched.length >= 6)) verification = "official_source_reverified";
    else if (response.ok && matched.length >= 2) verification = "reachable_relevant_recheck";
    else if (response.ok) verification = "reachable_low_signal";
    else verification = `http_${response.status}_needs_review`;
    return {
      ...item,
      source_url_rechecked: response.url,
      http_status: response.status,
      content_type: contentType.slice(0, 120),
      page_title: titleFrom(raw),
      matched_keywords: matched.slice(0, 12),
      verification_status: verification,
      verification_confidence: verification === "official_source_reverified" ? "high" : verification === "reachable_relevant_recheck" ? "medium" : "low",
      verified_at: "2026-08-24",
      response_ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ...item,
      source_url_rechecked: item.source_url,
      http_status: null,
      content_type: "",
      page_title: "",
      matched_keywords: [],
      verification_status: error.name === "AbortError" ? "timeout_needs_browser_review" : "fetch_error_needs_browser_review",
      verification_confidence: "low",
      verified_at: "2026-08-24",
      response_ms: Date.now() - started,
      verification_error: String(error.message || error).slice(0, 240),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const output = new Array(input.length);
let next = 0;
async function worker() {
  while (next < input.length) {
    const index = next++;
    output[index] = await verify(input[index]);
  }
}
await Promise.all(Array.from({ length: 7 }, () => worker()));

await fs.writeFile(`${OUT_DIR}/${outputName}`, JSON.stringify(output, null, 2), "utf8");
const summary = output.reduce((acc, item) => {
  acc[item.verification_status] = (acc[item.verification_status] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ count: output.length, summary, lowConfidence: output.filter(x => x.verification_confidence === "low").map(x => ({ company: x.company_name, url: x.source_url, status: x.verification_status, http: x.http_status })) }, null, 2));
