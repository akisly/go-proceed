/**
 * Regression tests for the defects found by the post-implementation
 * engineering review of v0.1-M1. Each block names the defect it pins down.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  q, truncateAll, jsonReq, baselineFixture, createBatch, addFile, getBatch,
  type BaselineFixture,
} from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // owner
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // admin
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const enc = (s: string) => new TextEncoder().encode(s);
const MAPPING = { description: "A", unit: "B", quantity: "C", unitPrice: "D", amount: "E" };

async function validate(batchId: string, expectedVersion: number, mapping: Record<string, string> = MAPPING) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/validate/route");
  return POST(jsonReq("http://x", { mapping, config: { headerRow: 1 }, expectedVersion }),
    { params: Promise.resolve({ batchId }) });
}
async function resolve(batchId: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/resolutions/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ batchId }) });
}
async function publish(batchId: string, expectedVersion: number, manifest: string) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/publish/route");
  return POST(jsonReq("http://x", { expectedVersion, confirmedManifestHash: manifest }),
    { params: Promise.resolve({ batchId }) });
}

beforeEach(async () => { await truncateAll(); current = A; });

describe("INV-020 — an own legal entity's identity is owner-only", () => {
  let fx: BaselineFixture;
  beforeEach(async () => { fx = await baselineFixture(A); });

  it("admin cannot rewrite the legal profile of an OWN legal entity", async () => {
    await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'admin','active')",
      [fx.workspaceId, B]);
    current = B;
    const { PUT } = await import("../app/v1/parties/[partyId]/legal-profile/route");
    const res = await PUT(jsonReq("http://x", { officialName: "ТОВ Приклад-Підміна", edrpou: "99999999" }, "PUT"),
      { params: Promise.resolve({ partyId: fx.ownPartyId }) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_DENIED");
    const rows = await q<{ official_name: string }>(
      "select official_name from public.party_legal_profiles where workspace_id=$1 and party_id=$2",
      [fx.workspaceId, fx.ownPartyId]);
    expect(rows[0]!.official_name).toBe("ТОВ Приклад-Власна");
  });

  it("admin CAN still edit an ordinary counterparty's legal profile", async () => {
    await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'admin','active')",
      [fx.workspaceId, B]);
    current = B;
    const { PUT } = await import("../app/v1/parties/[partyId]/legal-profile/route");
    const res = await PUT(jsonReq("http://x", { officialName: "ТОВ Приклад-Замовник", edrpou: "11223344" }, "PUT"),
      { params: Promise.resolve({ partyId: fx.customerPartyId }) });
    expect(res.status).toBe(201);
  });

  it("admin cannot rename an own legal entity either", async () => {
    await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'admin','active')",
      [fx.workspaceId, B]);
    current = B;
    const { PATCH } = await import("../app/v1/parties/[partyId]/route");
    const res = await PATCH(jsonReq("http://x", { displayName: "Підміна", expectedVersion: 1 }, "PATCH"),
      { params: Promise.resolve({ partyId: fx.ownPartyId }) });
    expect(res.status).toBe(403);
  });
});

describe("Inclusive VAT — tax is extracted from the price, not added", () => {
  it("publishes net 1 666,58 + tax 333,32 = gross 1 999,90 for a 199,99 gross price", async () => {
    const fx = await baselineFixture(A, {
      contractBody: { contractNo: "Д-ПДВ/1", taxMode: "inclusive", taxRateBps: 2000 },
    });
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc("Назва;Од;К-сть;Ціна\nМурування;м2;10;199,99\n"));
    const val = await (await validate(batchId, 2, { description: "A", unit: "B", quantity: "C", unitPrice: "D" })).json();
    expect(val.status).toBe("preview_ready");
    const pub = await (await publish(batchId, val.version, val.sourceManifestHash)).json();
    const items = await q<{ net: string; tax: string; gross: string; price_basis: string }>(
      `select net_amount_minor_units net, tax_amount_minor_units tax,
              gross_amount_minor_units gross, price_basis
         from public.work_items where contract_version_id=$1`, [pub.contractVersionId]);
    expect(items[0]!.net).toBe("166658");
    expect(items[0]!.tax).toBe("33332");
    expect(items[0]!.gross).toBe("199990");
    expect(items[0]!.price_basis).toBe("gross");
  });

  it("rejects a taxable contract with no rate at creation", async () => {
    const fx = await baselineFixture(A);
    const { POST } = await import("../app/v1/projects/[projectId]/contracts/route");
    const res = await POST(jsonReq("http://x", {
      ownPartyId: fx.ownPartyId, customerPartyId: fx.customerPartyId,
      contractNo: "Д-БезСтавки/1", currency: "UAH", taxMode: "inclusive",
    }), { params: Promise.resolve({ projectId: fx.projectId }) });
    expect(res.status).toBe(422);
  });
});

describe("Lump-sum line (amount, no unit price)", () => {
  it("blocks instead of publishing zero, then carries real value once approved", async () => {
    const fx = await baselineFixture(A);
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv",
      enc("Назва;Од;К-сть;Ціна;Сума\nПусконалагодження;компл;1;;15 000,00\n"));
    const val = await (await validate(batchId, 2)).json();
    expect(val.status).toBe("validated");
    expect(val.rowResults[0].errorCodes).toContain("PRICE_MISSING_AMOUNT_PRESENT");
    expect(val.needsResolutionCount).toBe(1);

    const res = await resolve(batchId, {
      rowResultId: val.rowResults[0].rowResultId,
      chosenBasis: "approved_source_amount", reason: "Позиція «в цілому» без одиничної розцінки",
    });
    expect(res.status).toBe(201);
    const reval = await (await validate(batchId, val.version)).json();
    expect(reval.status).toBe("preview_ready");
    const pub = await (await publish(batchId, reval.version, reval.sourceManifestHash)).json();
    const items = await q<{ net: string; valuation_basis: string }>(
      `select net_amount_minor_units net, valuation_basis from public.work_items where contract_version_id=$1`,
      [pub.contractVersionId]);
    expect(items[0]!.net).toBe("1500000"); // 15 000,00 — not zero
    expect(items[0]!.valuation_basis).toBe("approved_source_amount");
  });
});

describe("Resolution integrity", () => {
  it("a resolution on file A row 2 does NOT unblock the same row number in file B", async () => {
    const fx = await baselineFixture(A);
    const batchId = await createBatch(fx.contractId);
    // Both files are CSV, so both carry worksheet = null and share row numbers.
    await addFile(batchId, "a.csv", enc("Назва;Од;К-сть;Ціна;Сума\nРоботи А;м2;10;100,00;1 500,00\n"));
    await addFile(batchId, "b.csv", enc("Назва;Од;К-сть;Ціна;Сума\nРоботи Б;м2;10;100,00;1 800,00\n"));
    const val = await (await validate(batchId, 3)).json();
    expect(val.status).toBe("validated");
    expect(val.needsResolutionCount).toBe(2);

    const rowA = val.rowResults.find((r: { mapped: { description: string } }) => r.mapped.description === "Роботи А");
    await resolve(batchId, {
      rowResultId: rowA.rowResultId, chosenBasis: "approved_source_amount", reason: "Узгоджено з А",
    });
    const reval = await (await validate(batchId, val.version)).json();
    // Only file A's row cleared; file B's identically-numbered row still blocks.
    expect(reval.status).toBe("validated");
    expect(reval.needsResolutionCount).toBe(1);
    const stillBlocking = reval.rowResults.filter((r: { severity: string }) => r.severity === "blocking");
    expect(stillBlocking).toHaveLength(1);
    expect(stillBlocking[0].mapped.description).toBe("Роботи Б");
  });

  it("a resolution stops applying when re-validation produces different amounts", async () => {
    const fx = await baselineFixture(A);
    const batchId = await createBatch(fx.contractId);
    // Column F holds a different amount than column E.
    await addFile(batchId, "кошторис.csv",
      enc("Назва;Од;К-сть;Ціна;СумаA;СумаБ\nМурування;м2;10;100,00;1 500,00;1 900,00\n"));
    const val = await (await validate(batchId, 2)).json();
    expect(val.needsResolutionCount).toBe(1);
    await resolve(batchId, {
      rowResultId: val.rowResults[0].rowResultId,
      chosenBasis: "approved_source_amount", reason: "Узгоджено 1 500,00",
    });
    expect((await (await validate(batchId, val.version)).json()).status).toBe("preview_ready");

    // Remap the amount column: the approval no longer describes these numbers.
    const remapped = await (await validate(batchId, val.version + 1,
      { ...MAPPING, amount: "F" })).json();
    expect(remapped.status).toBe("validated");
    expect(remapped.needsResolutionCount).toBe(1);
  });
});

describe("Mapped location column", () => {
  it("creates project locations and links them to the published work items", async () => {
    const fx = await baselineFixture(A);
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(
      "Назва;Од;К-сть;Ціна;Місце\nМурування;м2;10;100,00;Секція 1\nШтукатурення;м2;5;200,00;Секція 1\nПідлога;м2;8;150,00;Секція 2\n"));
    const val = await (await validate(batchId, 2,
      { description: "A", unit: "B", quantity: "C", unitPrice: "D", location: "E" })).json();
    expect(val.status).toBe("preview_ready");
    const pub = await (await publish(batchId, val.version, val.sourceManifestHash)).json();

    const locs = await q<{ name: string }>(
      "select name from public.locations where workspace_id=$1 and project_id=$2 order by name",
      [fx.workspaceId, fx.projectId]);
    expect(locs.map((l) => l.name)).toEqual(["Секція 1", "Секція 2"]);
    const linked = await q<{ n: string }>(
      "select count(*) n from public.work_items where contract_version_id=$1 and location_id is not null",
      [pub.contractVersionId]);
    expect(linked[0]!.n).toBe("3");
  });
});

describe("Invitation re-invite after expiry", () => {
  it("an expired pending invitation no longer blocks the address forever", async () => {
    const { POST: createW } = await import("../app/v1/workspaces/route");
    const w = await createW(jsonReq("http://x", { displayName: "Приклад-Запрошення" }), { params: Promise.resolve({}) });
    const workspaceId = (await w.json()).workspaceId as string;
    const { POST: invite } = await import("../app/v1/workspaces/[workspaceId]/invitations/route");
    const first = await invite(jsonReq("http://x", { email: "b@example.test", role: "member" }),
      { params: Promise.resolve({ workspaceId }) });
    expect(first.status).toBe(201);
    // Simulate the invitation ageing out.
    await q("update public.invitations set expires_at = now() - interval '1 day' where workspace_id=$1", [workspaceId]);
    const second = await invite(jsonReq("http://x", { email: "b@example.test", role: "member" }),
      { params: Promise.resolve({ workspaceId }) });
    expect(second.status).toBe(201);
    const rows = await q<{ status: string }>(
      "select status from public.invitations where workspace_id=$1 order by created_at", [workspaceId]);
    expect(rows.map((r) => r.status)).toEqual(["expired", "pending"]);
  });
});
