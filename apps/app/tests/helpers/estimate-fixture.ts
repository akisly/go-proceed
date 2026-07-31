import ExcelJS from "exceljs";

/**
 * Sanitized synthetic estimate («Приклад-» naming — transparently fake).
 * Columns: A №п/п | B Шифр | C Найменування робіт | D Од.вим. | E Кількість |
 * F Ціна за од., грн | G Сума, грн — uk-UA number formatting as TEXT cells.
 *
 * Row «1.5» carries a source amount 150,00 грн ABOVE qty×price (blocking
 * mismatch: 15 000 minor units > tolAbs 100 and > 10 bps).
 * Row «1.6» has Сума as an inert FORMULA cell with a correct cached result.
 */
export const MAPPING_V1 = {
  sourceKey: "A", workCode: "B", description: "C", unit: "D",
  quantity: "E", unitPrice: "F", amount: "G",
} as const;

interface Row { key: string; code: string; name: string; unit: string; qty: string; price: string; sum?: string }

const V1_ROWS: Row[] = [
  { key: "1.1", code: "Е8-3-1", name: "Мурування цегляних стін", unit: "м3", qty: "24,5", price: "1 850,00", sum: "45 325,00" },
  { key: "1.2", code: "Е8-4-2", name: "Штукатурення фасаду", unit: "м2", qty: "310", price: "245,50", sum: "76 105,00" },
  { key: "1.3", code: "Е11-2-9", name: "Улаштування стяжки підлоги", unit: "м2", qty: "185,5", price: "198,00", sum: "36 729,00" },
  { key: "1.4", code: "Е12-1-4", name: "Фарбування стель водоемульсійною фарбою", unit: "м2", qty: "96", price: "87,25", sum: "8 376,00" },
  { key: "1.5", code: "Е10-5-2", name: "Монтаж металевих огорож", unit: "м", qty: "25", price: "320,50", sum: "8 162,50" }, // qty×price = 8 012,50 → mismatch +150,00
  { key: "1.6", code: "Е9-7-1", name: "Утеплення фасаду мінеральною ватою", unit: "м2", qty: "142", price: "560,00" },       // Сума = formula
  { key: "1.7", code: "Е6-2-3", name: "Улаштування гідроізоляції покрівлі", unit: "м2", qty: "88,8", price: "310,10", sum: "27 536,88" },
  { key: "1.8", code: "Е4-1-8", name: "Демонтаж тимчасових конструкцій", unit: "шт", qty: "12", price: "150,00", sum: "1 800,00" },
];

/** Expected v1 minor-unit net totals (tax exclusive 20% applies on top):
 * 45325,00 + 76105,00 + 36729,00 + 8376,00 + 8162,50(approved) + 79520,00 +
 * 27536,88 + 1800,00 — where 1.5 uses the APPROVED source amount and the rest
 * derive from qty×price. */
export const V1_EXPECTED_NET_MINOR = (
  4532500n + 7610500n + 3672900n + 837600n + 816250n + 7952000n + 2753688n + 180000n
).toString();

async function build(rows: Row[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Приклад-Кошторис");
  ws.addRow(["№ п/п", "Шифр", "Найменування робіт", "Од. вим.", "Кількість", "Ціна за од., грн", "Сума, грн"]);
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    if (r.sum === undefined) {
      ws.addRow([r.key, r.code, r.name, r.unit, r.qty, r.price,
        { formula: `E${rowNo}*F${rowNo}`, result: 142 * 560 }]);
    } else {
      ws.addRow([r.key, r.code, r.name, r.unit, r.qty, r.price, r.sum]);
    }
  });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export function buildEstimateV1(): Promise<Uint8Array> {
  return build(V1_ROWS);
}

/** V2: 1.2 quantity 310→330 (changed); 1.8 removed; 1.9 added; 1.5 keeps the
 * clean derived amount (no mismatch in the reimport). */
export function buildEstimateV2(): Promise<Uint8Array> {
  const v2: Row[] = [
    ...V1_ROWS.filter((r) => r.key !== "1.8").map((r) => {
      if (r.key === "1.2") return { ...r, qty: "330", sum: "81 015,00" };
      if (r.key === "1.5") return { ...r, sum: "8 012,50" };
      return r;
    }),
    { key: "1.9", code: "Е13-3-1", name: "Монтаж підвісних стель", unit: "м2", qty: "64", price: "425,00", sum: "27 200,00" },
  ];
  return build(v2);
}
