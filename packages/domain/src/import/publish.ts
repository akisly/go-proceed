/** Reimport lineage matching + diff (contract_versions.get / publish). */

export interface LineagePrevItem {
  id: string;
  sourceKey: string | null;
  workCode: string | null;
  description: string;
}
export interface LineageNextItem {
  position: number;
  sourceKey: string | null;
  workCode: string | null;
  description: string;
}

const descKey = (d: string): string => d.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * position → predecessor work-item id. Match priority: exact sourceKey, then
 * exact (workCode + normalized description). Each predecessor is consumed at
 * most once (first match in position order wins).
 */
export function matchLineage(
  prev: LineagePrevItem[], next: LineageNextItem[],
): Map<number, string> {
  const bySourceKey = new Map<string, LineagePrevItem[]>();
  const byCodeDesc = new Map<string, LineagePrevItem[]>();
  for (const p of prev) {
    if (p.sourceKey) {
      const list = bySourceKey.get(p.sourceKey) ?? [];
      list.push(p); bySourceKey.set(p.sourceKey, list);
    }
    if (p.workCode) {
      const k = `${p.workCode}|${descKey(p.description)}`;
      const list = byCodeDesc.get(k) ?? [];
      list.push(p); byCodeDesc.set(k, list);
    }
  }
  const used = new Set<string>();
  const out = new Map<number, string>();
  const take = (list: LineagePrevItem[] | undefined): string | null => {
    for (const p of list ?? []) if (!used.has(p.id)) { used.add(p.id); return p.id; }
    return null;
  };
  for (const n of [...next].sort((a, b) => a.position - b.position)) {
    const bySk = n.sourceKey ? take(bySourceKey.get(n.sourceKey)) : null;
    if (bySk) { out.set(n.position, bySk); continue; }
    if (n.workCode) {
      const byCd = take(byCodeDesc.get(`${n.workCode}|${descKey(n.description)}`));
      if (byCd) out.set(n.position, byCd);
    }
  }
  return out;
}

export interface DiffComparable {
  contractQuantity: string;      // canonical decimal text
  unitCode: string;
  unitPriceDecimal: string | null;
  netMinor: string;
}
export interface DiffCounts { added: number; removed: number; changed: number; unchanged: number }

/** Diff between a version and its predecessor from lineage pairs. */
export function computeDiff(
  prevById: Map<string, DiffComparable>,
  nextItems: { predecessorId: string | null; fields: DiffComparable }[],
): DiffCounts {
  let added = 0, changed = 0, unchanged = 0;
  const referenced = new Set<string>();
  for (const n of nextItems) {
    if (!n.predecessorId || !prevById.has(n.predecessorId)) { added++; continue; }
    referenced.add(n.predecessorId);
    const p = prevById.get(n.predecessorId)!;
    const same = p.contractQuantity === n.fields.contractQuantity
      && p.unitCode === n.fields.unitCode
      && p.unitPriceDecimal === n.fields.unitPriceDecimal
      && p.netMinor === n.fields.netMinor;
    if (same) unchanged++; else changed++;
  }
  const removed = [...prevById.keys()].filter((id) => !referenced.has(id)).length;
  return { added, removed, changed, unchanged };
}

/** Decimal { scaled, scale } (serialized as strings) → canonical text "10.500". */
export function decimalText(scaled: string, scale: number): string {
  const neg = scaled.startsWith("-");
  const digits = neg ? scaled.slice(1) : scaled;
  const padded = digits.padStart(scale + 1, "0");
  const intPart = padded.slice(0, padded.length - scale) || "0";
  const frac = scale > 0 ? "." + padded.slice(padded.length - scale) : "";
  return (neg ? "-" : "") + intPart + frac;
}
