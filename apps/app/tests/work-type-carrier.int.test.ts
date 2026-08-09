import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";
import {
  ADMIN_URL, q, truncateAll, jsonReq, baselineFixture, type BaselineFixture,
} from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, patchLine, publishRuleVersion,
  publishVersion, retireRuleVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked, no migration was applied,
 * and no claim is made that any assertion below passes or that the migration it
 * depends on applies. Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * THE WORK-TYPE CARRIER — migration 0050, and the systemic condition it closes.
 *
 * Before it, `apps/app/src/lib/requirement-materialisation.ts` `workTypeKeyOf`
 * returned null for every row: the rule predicate is (work type, stage),
 * `public.work_items` carried no work type, and so ZERO OCCURRENCES
 * MATERIALISED IN ANY PILOT. Every stage was empty, every closure vacuous, and
 * every M3-M6 suite reached the gate by supplying a work type the product could
 * not store. The most important assertion in this file is the plainest one —
 * «assignments.create materialises an occurrence» — because until 0050 it could
 * not have been written at all.
 *
 * EVERY ASSERTION HERE IS REQUIRED BEHAVIOUR, in six groups:
 *
 *   1. THE WRITE PATH REFUSES A KEY THAT RESOLVES TO NOTHING. A plain nullable
 *      text column would have reintroduced silently the failure the null stub
 *      avoided loudly: one typo, no match, no occurrence, a vacuous closure,
 *      and every per-row constraint still satisfied. A carrier whose wrong
 *      value is indistinguishable from its right value is not a fix, so the
 *      refusal is the deliverable and not a nicety.
 *   2. NULL STAYS LEGAL AND STAYS DISCLOSED. Every line the frozen importer
 *      wrote carries NULL and must keep working (ADR-006 decision 6 freezes
 *      import expansion; INV-015 freezes a published line, so an imported
 *      baseline can never acquire a work type). It publishes, it assigns, and
 *      every surface says `work_type_unresolved`.
 *   3. PUBLICATION MAKES AN UNREACHABLE GATE VISIBLE, AND REFUSES ONLY THE
 *      TOTAL CASE. ADR-006 decision 4.2: «a work type with no matching rule
 *      must still be NAMED IN THE COMMAND'S OUTPUT». A version whose typed
 *      lines reach NONE of its bound rule versions is INV-083's hole one level
 *      in and is refused with the same code.
 *   4. RETIREMENT NARROWS WHAT IS NAMEABLE AND TRAPS NOTHING. The last carrier
 *      of a key being retired must not make an existing draft line
 *      uncorrectable, and must not stop a draft that already bound that version
 *      from naming its work type.
 *   5. THE VOCABULARY IS PER WORKSPACE. It is emergent — whatever keys a
 *      workspace's own published rule versions carry (migration 0050 §3) — and
 *      an emergent vocabulary is exactly the kind that leaks: nothing declares
 *      it, so nothing but the resolver's own WHERE clause keeps one tenant's
 *      keys out of another's. Asserted at the route AND at
 *      `app.work_type_key_is_bindable` itself, per arm, because a route that
 *      stopped calling the function would hide a leaky resolver and a resolver
 *      test alone would not notice a route that passed the wrong workspace.
 *   6. THE REFUSAL IS STRUCTURAL, NOT MERELY ROUTED. Migration 0050 §5 puts the
 *      rule in a trigger so no write path can forget it, and asserts — never
 *      having observed it — that `work_items_guard` sorts before
 *      `work_items_work_type_guard` so INV-015's message wins on a published
 *      line. Both claims are written here as tests rather than left as the two
 *      things §8 asks a reviewer with a database to run first.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const ELECTRIC = "montazh-elektrotekhnichnykh-ustanovok";
const MASONRY = "muruvannia-tsehliane";
/** A key no rule version in the fixture ever carries. The typo. */
const TYPO = "montazh-elektrotekhnichnyh-ustanovok";

const LINE = {
  description: "Приклад-прокладка кабелю в штробі",
  unitCode: "м",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "199.99",
};

let fx: BaselineFixture;
let library: Map<string, string>;

async function newRuleVersion(over: Record<string, unknown> = {}): Promise<string> {
  const item = library.get("Н.15/1");
  if (!item) throw new Error("work-type-carrier: the library fixture seeded no Н.15/1");
  const res = await publishRuleVersion(fx.workspaceId, ruleVersionBody(item, over));
  if (res.status !== 201) {
    throw new Error(`requirement_rule_versions.publish ${res.status} ${await res.text()}`);
  }
  return (await res.json()).ruleVersionId as string;
}

async function newDraft(): Promise<{ versionId: string; versionNo: number }> {
  const res = await createDraft(fx.contractId);
  if (res.status !== 201) {
    throw new Error(`contract_versions.create ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return { versionId: body.contractVersionId, versionNo: body.versionNo };
}

async function line(
  versionId: string, over: Record<string, unknown> = {},
): Promise<{ status: number; body: any }> {
  const res = await addLine(versionId, { ...LINE, ...over });
  return { status: res.status, body: await res.json() };
}

async function publish(
  versionId: string, versionNo: number,
): Promise<{ status: number; body: any }> {
  const view = await (await getVersion(fx.contractId, versionNo)).json();
  const res = await publishVersion(versionId, manifestOf(view));
  return { status: res.status, body: await res.json() };
}

const storedKey = async (workItemId: string): Promise<string | null> => {
  const rows = await q<{ work_type_key: string | null }>(
    `select work_type_key from public.work_items where id = $1`, [workItemId]);
  return rows[0]?.work_type_key ?? null;
};

const lineCount = async (versionId: string): Promise<number> => {
  const rows = await q<{ n: string }>(
    `select count(*) n from public.work_items where contract_version_id = $1`, [versionId]);
  return Number(rows[0]!.n);
};

const occurrenceCount = async (assignmentId: string): Promise<number> => {
  const rows = await q<{ n: string }>(
    `select count(*) n from public.requirement_occurrences where work_assignment_id = $1`,
    [assignmentId]);
  return Number(rows[0]!.n);
};

async function createAssignment(workItemId: string): Promise<{ status: number; body: any }> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baselineFixture(A);
  const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", {
    memberId: fx.memberId, capabilities: ["rule_bindings.manage", "assignments.manage"],
  }), { params: Promise.resolve({ projectId: fx.projectId }) });
  library = await seedRequirementLibrary(fx.workspaceId);
});

describe("a work type that names nothing is refused, not absorbed", () => {
  it("refuses a key no published rule version in the workspace carries", async () => {
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();

    const res = await line(draft.versionId, { workTypeKey: TYPO });

    // A CATALOGUED FIELD ERROR AND NOT A TRIGGER'S RAISE. The trigger
    // `work_items_work_type_guard` makes the rule structural so no write path
    // can forget it; the route asks first so a typo — an ordinary mistake —
    // comes back as one instead of a 500.
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.fieldErrors.map((f: { path: string }) => f.path)).toContain("workTypeKey");
    // The value is not echoed: VALIDATION_FAILED's log policy is
    // field_codes_no_values (technical/error-catalog.csv:15).
    expect(JSON.stringify(res.body)).not.toContain(TYPO);
    expect(await lineCount(draft.versionId)).toBe(0);
  });

  it("accepts a key a published rule version carries, and stores it byte for byte", async () => {
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();

    const res = await line(draft.versionId, { workTypeKey: ELECTRIC });

    expect(res.status).toBe(201);
    expect(res.body.workItem.workTypeKey).toBe(ELECTRIC);
    // NOT NORMALISED. The column refuses padding outright so that the
    // workspace-side resolver and the materialisation predicate are both exact
    // string equality; a trim on one side only is how two comparisons come to
    // disagree about which lines match.
    expect(await storedKey(res.body.workItem.workItemId)).toBe(ELECTRIC);
  });

  it("still accepts a line with no work type at all, and stores NULL", async () => {
    // The pre-0050 shape and every imported line. Making the field required
    // would refuse a line whose work carries no ДБН hidden-works requirement
    // and would push the typist toward whichever key looks closest, which is
    // worse than an honest blank.
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();

    const res = await line(draft.versionId);

    expect(res.status).toBe(201);
    expect(res.body.workItem.workTypeKey).toBeNull();
    expect(await storedKey(res.body.workItem.workItemId)).toBeNull();
  });

  it("refuses on correction too, and clearing the key back to null is allowed", async () => {
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    const created = await line(draft.versionId, { workTypeKey: ELECTRIC });
    const id = created.body.workItem.workItemId;

    const bad = await patchLine(id, { workTypeKey: TYPO });
    expect(bad.status).toBe(422);
    expect(await storedKey(id)).toBe(ELECTRIC);

    // Clearing is a real correction: a typist who classified a line wrongly and
    // has not decided what it should be must be able to say so, and the honest
    // intermediate state is the blank one every pre-0050 line already carries.
    const cleared = await patchLine(id, { workTypeKey: null });
    expect(cleared.status).toBe(200);
    expect(await storedKey(id)).toBeNull();
  });
});

describe("publication makes an unreachable gate visible", () => {
  it("names by position every typed line no bound rule version matches, and publishes", async () => {
    // The PARTIAL case. ADR-006 decision 4.2 requires it be named rather than
    // hidden; refusing it would leave the caller no escape but to clear the
    // work type, trading a disclosed hole for a silent one.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    await newRuleVersion({ workTypeKey: MASONRY, stageKey: "muruvannia-stage" });
    const draft = await newDraft();
    await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    await line(draft.versionId, { workTypeKey: MASONRY, sourceKey: "1.2" });
    await line(draft.versionId, { sourceKey: "1.3" });
    // Only the electric rule is bound: the masonry line names a real work type
    // this baseline did not agree to.
    const bind = await bindRules(draft.versionId, [electric]);
    expect(bind.status).toBe(201);

    const res = await publish(draft.versionId, draft.versionNo);

    expect(res.status).toBe(201);
    expect(res.body.workTypeCoverage).toEqual({
      coveredLineCount: 1,
      typedLineCount: 2,
      untypedLineCount: 1,
      // Position 2 after renumbering, which is the number the caller and the
      // printed act both read — publication renumbers in the same transaction.
      unmatchedPositions: [2],
    });
  });

  it("records the same coverage in the audit row, because that is what outlives the response", async () => {
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    await newRuleVersion({ workTypeKey: MASONRY, stageKey: "muruvannia-stage" });
    const draft = await newDraft();
    await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    await line(draft.versionId, { workTypeKey: MASONRY, sourceKey: "1.2" });
    await bindRules(draft.versionId, [electric]);

    await publish(draft.versionId, draft.versionNo);

    const rows = await q<{ details: { workTypeCoverage?: { unmatchedPositions: number[] } } }>(
      `select details from public.audit_events
        where action = 'contract_version.published' and object_id = $1`, [draft.versionId]);
    expect(rows[0]!.details.workTypeCoverage?.unmatchedPositions).toEqual([2]);
  });

  it("refuses when NOT ONE typed line reaches any bound rule version", async () => {
    // INV-083's hole one level in: the version carries bindings and the gate
    // they describe can never fire, so the same code and the same catalogued
    // user action apply.
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const masonry = await newRuleVersion({ workTypeKey: MASONRY, stageKey: "muruvannia-stage" });
    const draft = await newDraft();
    await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    await bindRules(draft.versionId, [masonry]);

    const res = await publish(draft.versionId, draft.versionNo);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RULE_BINDING_REQUIRED");
    expect(res.body.userAction).toBe("bind_rule_versions_then_publish");
    const rows = await q<{ status: string }>(
      `select status from public.contract_versions where id = $1`, [draft.versionId]);
    expect(rows[0]!.status).toBe("draft");
  });

  it("REFUSES a baseline whose lines are all untyped, because clearing the type was the escape", async () => {
    // THIS CASE ASSERTED THE OPPOSITE, WITH A REASON THAT WAS FALSE.
    //
    // It excused the all-untyped publish as "every imported baseline". The
    // importer never reaches this route — it inserts an already-published row
    // through import-batches/[batchId]/publish — so every version arriving here
    // is manual-origin, and the exemption protected nothing it named.
    //
    // What it did protect was a one-field escape: bind obligations, then PATCH
    // every line's work type to null. typedLineCount fell to 0, the refusal
    // vanished, and the version published immutably carrying a binding no line
    // could ever reach. Every stage empty, every closure vacuous — the exact
    // state the refusal exists to prevent, reached by the cheapest edit
    // available. So the assertion is inverted rather than deleted.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    await line(draft.versionId, { sourceKey: "1.1" });
    await line(draft.versionId, { sourceKey: "1.2" });
    await bindRules(draft.versionId, [electric]);

    const res = await publish(draft.versionId, draft.versionNo);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RULE_BINDING_REQUIRED");

    // And it is still a draft, so the escape leaves nothing immutable behind.
    const rows = await q<{ status: string }>(
      "select status from public.contract_versions where id = $1", [draft.versionId]);
    expect(rows[0]!.status).toBe("draft");
  });

  it("publishes when at least one line is covered, and discloses the rest", async () => {
    // Partial non-coverage stays legal (ADR-006 decision 4.2): the hole is
    // named in the response rather than refused, because the only escape from a
    // refusal would be clearing the work type — trading a disclosed hole for a
    // silent one.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    await line(draft.versionId, { sourceKey: "1.1", workTypeKey: ELECTRIC });
    await line(draft.versionId, { sourceKey: "1.2" });
    await bindRules(draft.versionId, [electric]);

    const res = await publish(draft.versionId, draft.versionNo);

    expect(res.status).toBe(201);
    expect(res.body.workTypeCoverage.coveredLineCount).toBe(1);
    expect(res.body.workTypeCoverage.untypedLineCount).toBe(1);
  });

  it("returns the work type from contract_versions.get, so the caller can confirm the manifest", async () => {
    // The digest publication demands is computed over exactly the fields this
    // read returns. If the read omitted the work type the caller could not
    // reproduce the digest and every publish would fail with VERSION_CONFLICT.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    await bindRules(draft.versionId, [electric]);

    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();
    expect(view.workItems[0].workTypeKey).toBe(ELECTRIC);
    const res = await publishVersion(draft.versionId, manifestOf(view));
    expect(res.status).toBe(201);
  });
});

describe("the gate finally fires", () => {
  it("materialises an occurrence for a typed line — the thing no pilot could do before 0050", async () => {
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    const created = await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    await bindRules(draft.versionId, [electric]);
    expect((await publish(draft.versionId, draft.versionNo)).status).toBe(201);

    const res = await createAssignment(created.body.workItem.workItemId);

    expect(res.status).toBe(201);
    expect(res.body.requirementOccurrences.coverage).toBe("covered");
    expect(res.body.requirementOccurrences.occurrenceCount).toBeGreaterThan(0);
    expect(res.body.requirementOccurrences.stageCount).toBeGreaterThan(0);
    // Asserted against the ROWS and not only the response: a 201 that counted
    // something it did not write is exactly the shape of vacuous success this
    // whole slice exists against.
    expect(await occurrenceCount(res.body.assignmentId))
      .toBe(res.body.requirementOccurrences.occurrenceCount);
  });

  it("still materialises nothing for an untyped line, and still says why", async () => {
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    // THE UNTYPED LINE TRAVELS WITH A COVERED ONE, and it has to. A baseline
    // whose lines are ALL untyped intersects the bound set nowhere and
    // contract_versions.publish refuses it 409 RULE_BINDING_REQUIRED — the case
    // directly above this one asserts exactly that. With no published version,
    // assignments.create answered 422 and this case never reached the coverage
    // it is named for. One covered line is also the only shape a real baseline
    // takes: a version exists to carry obligations, and an unclassified line
    // rides along inside it.
    await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    const created = await line(draft.versionId, { sourceKey: "1.2" });
    await bindRules(draft.versionId, [electric]);
    expect((await publish(draft.versionId, draft.versionNo)).status).toBe(201);

    const res = await createAssignment(created.body.workItem.workItemId);

    expect(res.status).toBe(201);
    expect(res.body.requirementOccurrences.coverage).toBe("work_type_unresolved");
    expect(res.body.requirementOccurrences.occurrenceCount).toBe(0);
  });

  it("reports a typed line no bound rule names as no_matching_rule, not as unresolved", async () => {
    // Two different owners: an unfinished binding versus an unclassified line.
    // Collapsing them sends the finding to the wrong person.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    await newRuleVersion({ workTypeKey: MASONRY, stageKey: "muruvannia-stage" });
    const draft = await newDraft();
    await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    const masonryLine = await line(draft.versionId, { workTypeKey: MASONRY, sourceKey: "1.2" });
    await bindRules(draft.versionId, [electric]);
    await publish(draft.versionId, draft.versionNo);

    const res = await createAssignment(masonryLine.body.workItem.workItemId);

    expect(res.status).toBe(201);
    expect(res.body.requirementOccurrences.coverage).toBe("no_matching_rule");
    expect(res.body.requirementOccurrences.occurrenceCount).toBe(0);
  });
});

describe("retirement narrows what is nameable and traps nothing", () => {
  it("lets a draft that already bound the version keep naming its work type after retirement", async () => {
    // Arm 2 of app.work_type_key_is_bindable. Retirement stops FUTURE binding
    // and changes nothing about a baseline that already bound the version
    // (INV-067), so the occurrences this key would materialise are exactly the
    // ones the draft already agreed to.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    expect((await bindRules(draft.versionId, [electric])).status).toBe(201);
    expect((await retireRuleVersion(electric)).status).toBe(200);

    const res = await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });

    expect(res.status).toBe(201);
    expect(await storedKey(res.body.workItem.workItemId)).toBe(ELECTRIC);
  });

  it("refuses the same key on a draft that bound nothing carrying it", async () => {
    // Correct rather than harsh: retirement stops future binding, so this key
    // can reach no new baseline and a line naming it would materialise nothing.
    // Refusing at the keystroke is the honest form of that fact.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    expect((await retireRuleVersion(electric)).status).toBe(200);
    const draft = await newDraft();

    const res = await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });

    expect(res.status).toBe(422);
    expect(res.body.fieldErrors.map((f: { path: string }) => f.path)).toContain("workTypeKey");
  });

  it("leaves an existing draft line correctable after its key's last carrier is retired", async () => {
    // The trap a naive `before update` check would set: a person fixing a typo
    // in a description, days later, told their line is now illegal. The guard
    // short-circuits when the key is unchanged, so it never fires here.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    const created = await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    const id = created.body.workItem.workItemId;
    expect((await retireRuleVersion(electric)).status).toBe(200);

    const res = await patchLine(id, { description: "Приклад-виправлений опис" });

    expect(res.status).toBe(200);
    expect(await storedKey(id)).toBe(ELECTRIC);
  });
});

/**
 * A SECOND WORKSPACE, with its own library, its own published rule version and
 * its own bound draft.
 *
 * The same user creates it, so nothing here is testing authentication: both
 * workspaces are ones this caller is an active member of, which is the ONLY
 * shape in which a vocabulary leak is interesting. A caller who could not reach
 * the second workspace at all would be kept out by RLS and the resolver's
 * `workspace_id` predicate would never be the thing under test.
 */
interface Neighbour {
  workspaceId: string;
  contractVersionId: string;
  ruleVersionId: string;
}

/** A key published ONLY in the neighbouring workspace. */
const NEIGHBOUR_KEY = "zemlyani-roboty-susidnii-prostir";

async function neighbouringWorkspace(): Promise<Neighbour> {
  const other = await baselineFixture(A);
  const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const granted = await grant(jsonReq("http://x", {
    memberId: other.memberId, capabilities: ["rule_bindings.manage"],
  }), { params: Promise.resolve({ projectId: other.projectId }) });
  if (granted.status >= 300) {
    throw new Error(`neighbour grant ${granted.status} ${await granted.text()}`);
  }
  const otherLibrary = await seedRequirementLibrary(other.workspaceId);
  const published = await publishRuleVersion(other.workspaceId,
    ruleVersionBody(otherLibrary.get("Н.15/1")!, {
      workTypeKey: NEIGHBOUR_KEY, stageKey: "zemlyani-etap" }));
  if (published.status !== 201) {
    throw new Error(`neighbour publish ${published.status} ${await published.text()}`);
  }
  const ruleVersionId = (await published.json()).ruleVersionId as string;

  const draft = await createDraft(other.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const bound = await bindRules(contractVersionId, [ruleVersionId]);
  if (bound.status !== 201) {
    throw new Error(`neighbour bind ${bound.status} ${await bound.text()}`);
  }
  return { workspaceId: other.workspaceId, contractVersionId, ruleVersionId };
}

const isBindable = async (ws: string, cv: string, key: string): Promise<boolean> => {
  const rows = await q<{ ok: boolean }>(
    `select app.work_type_key_is_bindable($1, $2, $3) as ok`, [ws, cv, key]);
  return rows[0]!.ok;
};

describe("the vocabulary belongs to the workspace", () => {
  it("refuses a key that only a NEIGHBOURING workspace has published", async () => {
    // The emergent vocabulary's tenancy, at the route. The key is real, spelled
    // correctly, and carried by a published rule version — in someone else's
    // workspace. Absorbing it would let one tenant's library silently define
    // another's classification, and the line would then match nothing here for
    // reasons no one in this workspace could see.
    const neighbour = await neighbouringWorkspace();
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();

    const res = await line(draft.versionId, { workTypeKey: NEIGHBOUR_KEY });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.fieldErrors.map((f: { path: string }) => f.path)).toContain("workTypeKey");
    expect(await lineCount(draft.versionId)).toBe(0);
    // The neighbour is unharmed and its own key still works there — which is
    // what makes the refusal above isolation rather than a broken fixture.
    expect(await isBindable(neighbour.workspaceId, neighbour.contractVersionId, NEIGHBOUR_KEY))
      .toBe(true);
  });

  it("keeps arm 1 inside the workspace, asked of the resolver itself", async () => {
    // ARM 1 is `published rule versions of this workspace`. Asked directly,
    // because the route could be right for the wrong reason — it passes a
    // workspace id it read from the version, and a resolver that ignored the
    // argument would still look correct through it.
    const neighbour = await neighbouringWorkspace();
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();

    expect(await isBindable(fx.workspaceId, draft.versionId, NEIGHBOUR_KEY)).toBe(false);
    // …and the same key, in the workspace that published it, resolves.
    expect(await isBindable(neighbour.workspaceId, neighbour.contractVersionId, NEIGHBOUR_KEY))
      .toBe(true);
  });

  it("keeps arm 2 inside the workspace, even when the contract version argument is the neighbour's",
    async () => {
      // ARM 2 is `bound to THIS contract version`, and it is the arm with a
      // cross-tenant shape: it takes a contract version id from the caller. The
      // predicate pairs `b.workspace_id = ws` with `b.contract_version_id = cv`,
      // so a neighbour's version id passed with this workspace's id matches no
      // binding. Without the first conjunct it would match the neighbour's, and
      // the resolver would answer a question about another tenant's agreement.
      //
      // Unreachable through a route today — `work_items.create` reads both ids
      // off the same version row — which is exactly why it is asserted of the
      // function: the pairing is a property of the resolver, and the next caller
      // does not have to derive its arguments the same way.
      const neighbour = await neighbouringWorkspace();
      const draft = await newDraft();

      expect(await isBindable(fx.workspaceId, neighbour.contractVersionId, NEIGHBOUR_KEY))
        .toBe(false);

      // The neighbour's OWN pair is what arm 2 admits, retired or not (INV-067)
      // — and this is migration 0050 §8's second owed check, written as an
      // assertion rather than left as an instruction. After the retirement arm 1
      // is false (`status = 'published'` no longer holds), so a `true` here can
      // only come from the binding. If it comes back false, arm 2 does not read
      // what §5 reads it to read, and the retirement analysis is wrong in the
      // direction that traps a person mid-draft.
      expect((await retireRuleVersion(neighbour.ruleVersionId)).status).toBe(200);
      expect(await isBindable(neighbour.workspaceId, neighbour.contractVersionId, NEIGHBOUR_KEY))
        .toBe(true);
    });

  it("does not let a key stored on another workspace's LINE become nameable here", async () => {
    // The other direction of the same leak: the string now exists in
    // public.work_items rather than only in a rule version. A resolver that
    // consulted the column it guards — «somebody has used this key» — would
    // admit it, and one workspace's typo would become another's vocabulary.
    const neighbour = await neighbouringWorkspace();
    const neighbourDraftLine = await addLine(neighbour.contractVersionId, {
      ...LINE, sourceKey: "1.1", workTypeKey: NEIGHBOUR_KEY });
    expect(neighbourDraftLine.status, await neighbourDraftLine.clone().text()).toBe(201);

    const draft = await newDraft();
    const res = await line(draft.versionId, { workTypeKey: NEIGHBOUR_KEY });

    expect(res.status).toBe(422);
    expect(await lineCount(draft.versionId)).toBe(0);
  });
});

/**
 * Runs one statement as the table OWNER and returns the raise, or null.
 *
 * NOT `q` FROM THE FIXTURES HELPER, and the reason is mechanical rather than
 * stylistic: `q` calls `c.end()` after the query, so a statement that RAISES
 * leaks its pg Client — and a leaked Client holds the event loop open. Every
 * assertion below is about a statement that must fail, so the whole block would
 * be built out of leaks. The `finally` here is the entire difference.
 */
async function raiseFrom(sql: string, params: unknown[]): Promise<string | null> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  try {
    await c.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    await c.end();
  }
}

describe("the refusal is structural, not merely routed", () => {
  it("refuses an unresolvable key written straight to the table, past every route", async () => {
    // Migration 0050 §5: the trigger exists so no write path can forget the
    // rule, and it RAISES rather than returning false so a route that skipped
    // the check fails loudly instead of storing a key nothing can use. This
    // writes as the table owner — past the routes, past RLS — which is the only
    // way to ask whether the guarantee belongs to the trigger or to the command.
    await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    const created = await line(draft.versionId, { workTypeKey: ELECTRIC });
    const id = created.body.workItem.workItemId;

    const raised = await raiseFrom(
      `update public.work_items set work_type_key = $2 where id = $1`, [id, TYPO]);

    expect(raised).toMatch(/names no rule version this workspace can bind/);
    expect(await storedKey(id)).toBe(ELECTRIC);

    // An UPDATE that leaves the key alone re-checks nothing: the short-circuit
    // that stops a retirement trapping a draft line mid-correction. Asserted
    // here too, because it is the trigger's own branch and not the route's.
    expect(await raiseFrom(`update public.work_items set description = $2 where id = $1`,
      [id, "Приклад-опис змінено повз маршрут"])).toBeNull();
    expect(await storedKey(id)).toBe(ELECTRIC);
  });

  it("raises INV-015's message and not the work type's when the line is already published", async () => {
    // THE FIRING ORDER MIGRATION 0050 §5 ASSERTS AND §8 SAYS NOBODY HAS
    // OBSERVED. PostgreSQL fires same-event BEFORE triggers in NAME order, and
    // `work_items_guard` (0042 §3) sorts before `work_items_work_type_guard`.
    // If it did not, a person correcting a frozen line would be told their work
    // type is unknown — a true statement about the wrong problem, naming a field
    // they may not have touched, on a line that could not be edited either way.
    //
    // Both halves are asserted. «It raised» is satisfied by the wrong trigger.
    const electric = await newRuleVersion({ workTypeKey: ELECTRIC });
    const draft = await newDraft();
    const created = await line(draft.versionId, { workTypeKey: ELECTRIC, sourceKey: "1.1" });
    const id = created.body.workItem.workItemId;
    await bindRules(draft.versionId, [electric]);
    expect((await publish(draft.versionId, draft.versionNo)).status).toBe(201);

    const raised = await raiseFrom(
      `update public.work_items set work_type_key = $2 where id = $1`, [id, TYPO]);

    expect(raised).toMatch(/immutable once it is published/);
    expect(raised).not.toMatch(/names no rule version/);
    expect(await storedKey(id)).toBe(ELECTRIC);
  });
});
