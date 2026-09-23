import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, appClient, asActor } from "./pg";
import {
  dropRulesWorkspaces, raised, seedRulesWorld, sqlstate, type RulesFixture,
} from "./m1-rules-fixture";
import {
  insertOccurrence as insertOccurrenceRow, seedOccurrenceWorld, type OccurrenceWorld,
} from "./m2-occurrences-fixture";

/**
 * Migration 0059 — the requirement a site supplies from its own робоча
 * документація: the table (§1), its grants, RLS, guard trigger and archive
 * command (§2), and the vocabulary widening plus the second provenance (§3).
 *
 * EVERY CASE ATTEMPTS THE WRITE THE RULE EXISTS TO STOP, and every describe
 * carries a positive control beside its refusals — a suite that only reads the
 * catalog proves the DDL was typed, not that it holds, and a suite of refusals
 * with no positive control passes just as well against a table that refuses
 * everything. m1-rules-schema.test.ts:22-26 is the standing note about both.
 *
 * `sqlstate()` rather than a message match wherever the layer matters: 23514 is
 * a CHECK, 23503 a foreign key, 42501 a missing grant, P0001 a trigger's raise.
 * A refusal asserted only by its text cannot tell those four apart, and this
 * migration relies on all four.
 */

const WS_A = "b0591111-1111-1111-1111-111111111111";
const WS_B = "b0592222-2222-2222-2222-222222222222";
const USER_A = "b0593333-3333-3333-3333-333333333333";
const USER_B = "b0594444-4444-4444-4444-444444444444";
/** An ACTIVE member of WS_A holding role 'member': reads, never authors. */
const USER_M = "b0595555-5555-5555-5555-555555555555";
/**
 * A SECOND authorized archivist of WS_A, role 'admin'.
 *
 * Without a second one, a re-stamped archived_by_member_id would carry the same
 * value it already had and the corruption would be invisible in that column —
 * only the timestamp would move. The concurrency case below needs both halves
 * observable.
 */
const USER_D = "b0596666-6666-6666-6666-666666666666";

const TABLE = "project_sourced_requirement_items";

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
/** USER_D's membership id in WS_A — the value a losing racer would stamp. */
let adminMemberId: string;

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "PA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "PB" });

  // A second, non-owner member of WS_A. The read policy admits ANY active
  // member, and without a member who is not the author the SELECT case would
  // be indistinguishable from «the owner sees the row he wrote».
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
             $2,'',now(),now())
     on conflict (id) do nothing`, [USER_M, `${USER_M}@fixture.test`]);
  await c.query(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'member','active')`, [WS_A, USER_M]);

  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
             $2,'',now(),now())
     on conflict (id) do nothing`, [USER_D, `${USER_D}@fixture.test`]);
  const admin = await c.query<{ id: string }>(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'admin','active') returning id`, [WS_A, USER_D]);
  adminMemberId = admin.rows[0]!.id;
}, 120_000);

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

interface ItemOver {
  workspaceId?: string;
  projectId?: string;
  itemTextUk?: string | null;
  sourceDocument?: string | null;
  sourceSheet?: string | null;
  sourceDrawingNo?: string | null;
  sourceRevision?: string | null;
  verification?: string | null;
  status?: string;
  createdByMemberId?: string;
  archivedAt?: string | null;
  archivedByMemberId?: string | null;
}

/**
 * One item insert from the OWNER connection, with `over` replacing whatever the
 * probe is about. Owner rather than `asActor` on purpose: §1 is about CHECK
 * constraints, and a policy denial would answer 42501 long before a CHECK could
 * answer 23514. The policies get their own describe.
 *
 * The wording is synthetic and «Приклад-» prefixed. It must be: a project-sourced
 * item is a workspace's own documentation, so inventing a plausible Ukrainian
 * drawing reference here would put an unmarked fiction in the fixtures.
 */
function itemInsert(over: ItemOver = {}): [string, unknown[]] {
  const v = {
    workspace_id: over.workspaceId ?? WS_A,
    project_id: over.projectId ?? a.projectId,
    item_text_uk: over.itemTextUk === undefined
      ? "Приклад-вимога з робочої документації об'єкта." : over.itemTextUk,
    source_document: over.sourceDocument === undefined
      ? "Приклад-робоча документація, розділ ЕМ" : over.sourceDocument,
    source_sheet: over.sourceSheet === undefined ? "Приклад-аркуш 12" : over.sourceSheet,
    source_drawing_no: over.sourceDrawingNo === undefined
      ? "Приклад-ЕМ-12" : over.sourceDrawingNo,
    source_revision: over.sourceRevision === undefined ? null : over.sourceRevision,
    verification: over.verification === undefined ? "PROJECT_DOCUMENTATION" : over.verification,
    status: over.status ?? "active",
    created_by_member_id: over.createdByMemberId ?? a.memberId,
    archived_at: over.archivedAt === undefined ? null : over.archivedAt,
    archived_by_member_id: over.archivedByMemberId === undefined
      ? null : over.archivedByMemberId,
  };
  const cols = Object.keys(v);
  return [
    `insert into public.${TABLE} (${cols.join(",")})
     values (${cols.map((_, i) => `$${i + 1}`).join(",")})
     returning id`,
    cols.map((k) => (v as Record<string, unknown>)[k]),
  ];
}

function insertItem(over: ItemOver = {}): Promise<unknown> {
  const [sql, params] = itemInsert(over);
  return c.query(sql, params);
}

/** The same insert, returning the id — for the cases that need the row after. */
async function insertItemId(over: ItemOver = {}): Promise<string> {
  const [sql, params] = itemInsert(over);
  const r = await c.query<{ id: string }>(sql, params);
  return r.rows[0]!.id;
}

/** The SAME insert, through the application role — so a policy is what answers. */
function appInsertItem(user: string, ws: string, over: ItemOver = {}): Promise<unknown> {
  const [sql, params] = itemInsert(over);
  return asActor(user, ws, (cl) => cl.query(sql, params));
}

/**
 * An UPDATE from the OWNER connection.
 *
 * The application role holds no UPDATE grant at all (asserted separately
 * below), so 42501 is the only answer it can ever get and the trigger would
 * never run. Reaching the guard therefore means updating as the owner — which
 * is also the stronger statement: the immutability holds against the role that
 * owns the table, not merely against the one the routes use.
 */
function ownerUpdate(id: string, setClause: string): Promise<unknown> {
  return c.query(`update public.${TABLE} set ${setClause} where id = $1`, [id]);
}

/** Rows of `TABLE` with this id that `user` can see, reading as the app role. */
async function visible(user: string, ws: string, table: string, id: string): Promise<number> {
  const r = await asActor(user, ws, (cl) =>
    cl.query(`select 1 from public.${table} where id = $1`, [id]));
  return r.rowCount ?? 0;
}

/**
 * Opens a member transaction on a client the CALLER owns and leaves it open.
 *
 * `asActor` commits before it returns, which is right for every other case here
 * and useless for the concurrency case: driving an interleaving needs one
 * transaction still holding its row lock while a second one runs.
 */
async function beginAs(cl: Client, user: string, ws: string): Promise<void> {
  await cl.query("begin");
  await cl.query("set local role goproceed_app");
  await cl.query("select set_config('app.actor_user_id', $1, true)", [user]);
  await cl.query("select set_config('app.organization_id', $1, true)", [ws]);
}

/**
 * Blocks until some OTHER backend is waiting on a lock inside the archive
 * command, and fails loudly if none ever does.
 *
 * This is what turns the concurrency case below from a hoped-for interleaving
 * into a driven one. Committing the winner on a timer instead would let the
 * loser's snapshot be taken AFTER the commit, in which case it reads 'archived',
 * returns at the idempotency branch, and the case silently degrades into the
 * sequential replay that is already tested one `it` above — passing whether or
 * not the compare-and-swap is there.
 */
async function waitUntilBlockedOnArchive(budgetMs = 10_000): Promise<void> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const r = await c.query<{ n: number }>(
      // `pid <> pg_backend_pid()` because this poll's OWN text contains the
      // function name it searches for, inside the LIKE literal.
      `select count(*)::int as n from pg_stat_activity
        where pid <> pg_backend_pid()
          and wait_event_type = 'Lock'
          and query like '%archive_project_sourced_requirement_item%'`);
    if (r.rows[0]!.n > 0) return;
    if (Date.now() > deadline) {
      throw new Error(
        "no backend ever blocked inside app.archive_project_sourced_requirement_item; "
        + "the racing interleaving this test exists to drive did not happen");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** The one write path the transition has, called the way Task 12's route calls it. */
async function archiveViaFunction(ws: string, item: string, user = USER_A): Promise<void> {
  await asActor(user, ws, (cl) =>
    cl.query(`select app.archive_project_sourced_requirement_item($1,$2)`, [ws, item]));
}

// ───────────────────────────────────────────────────────────────────────────
// §1 — the table
// ───────────────────────────────────────────────────────────────────────────

describe("0059 §1 — what a site's own documentation may be stored as", () => {
  it("stores an item carrying text, a document, a sheet and a drawing number", async () => {
    // The positive control. Without it every refusal below would also hold for
    // a table that refuses everything, and for a table that does not exist.
    expect(await sqlstate(() => insertItem())).toBeNull();
  });

  it("refuses a source field that is only whitespace", async () => {
    // one-argument btrim strips spaces only; E'\t\n' is the probe that caught
    // the weaker guard in 0052.
    for (const blank of ["", "   ", "\t\n"]) {
      expect(await sqlstate(() => insertItem({ sourceSheet: blank })),
        `sourceSheet ${JSON.stringify(blank)}`).toBe("23514");
      expect(await sqlstate(() => insertItem({ sourceDocument: blank })),
        `sourceDocument ${JSON.stringify(blank)}`).toBe("23514");
      expect(await sqlstate(() => insertItem({ sourceDrawingNo: blank })),
        `sourceDrawingNo ${JSON.stringify(blank)}`).toBe("23514");
      expect(await sqlstate(() => insertItem({ itemTextUk: blank })),
        `itemTextUk ${JSON.stringify(blank)}`).toBe("23514");
    }
    // The non-breaking space — the character a citation pasted out of Word
    // arrives with, and the one 0052 was written for. Written as
    // the escape: a literal NBSP is invisible in every diff it appears in.
    expect(await sqlstate(() => insertItem({ sourceSheet: "\u00A0" }))).toBe("23514");
  });

  it("refuses a NULL where the source must be identified, and admits a NULL revision", async () => {
    // The three identifying fields are structural (ADR-010 decision 3), so
    // their absence is 23502 and not an editorial matter. The revision is the
    // one field a drawing may genuinely not carry.
    expect(await sqlstate(() => insertItem({ sourceDocument: null }))).toBe("23502");
    expect(await sqlstate(() => insertItem({ sourceSheet: null }))).toBe("23502");
    expect(await sqlstate(() => insertItem({ sourceDrawingNo: null }))).toBe("23502");
    expect(await sqlstate(() => insertItem({ sourceRevision: null }))).toBeNull();
    // Present but blank is still refused: a revision column that admitted '  '
    // would carry a revision nobody can act on.
    expect(await sqlstate(() => insertItem({ sourceRevision: "\t" }))).toBe("23514");
  });

  it("refuses any verification value but PROJECT_DOCUMENTATION", async () => {
    expect(await sqlstate(() => insertItem({ verification: "VERIFIED_PRIMARY" }))).toBe("23514");
    expect(await sqlstate(() => insertItem({ verification: "UNVERIFIED" }))).toBe("23514");
  });

  it("refuses an archived row that records neither when nor who", async () => {
    expect(await sqlstate(() => insertItem({ status: "archived" }))).toBe("23514");
  });

  it("refuses a status outside active and archived", async () => {
    expect(await sqlstate(() => insertItem({ status: "deleted" }))).toBe("23514");
  });

  it("refuses a project of ANOTHER workspace, and a member of another workspace", async () => {
    // INV-001 as a key rather than as a WHERE clause: the composite foreign
    // keys are what make a cross-tenant citation unrepresentable.
    expect(await sqlstate(() => insertItem({ projectId: b.projectId }))).toBe("23503");
    expect(await sqlstate(() => insertItem({ createdByMemberId: b.memberId }))).toBe("23503");
  });

  it("offers unique (workspace_id, id) and leads EVERY foreign key with workspace_id", async () => {
    const unique = await c.query(
      `select 1 from pg_constraint con
         join pg_class rel on rel.oid = con.conrelid
        where rel.relname = $1 and con.contype in ('u','p')
          and (select array_agg(att.attname::text order by att.attname)
                 from unnest(con.conkey) k
                 join pg_attribute att on att.attrelid = rel.oid and att.attnum = k)
              = array['id','workspace_id']`, [TABLE]);
    expect(unique.rows.length).toBeGreaterThan(0);

    const fks = await c.query<{ conname: string; first_col: string; arity: number; ref: string }>(
      `select con.conname,
              (select att.attname from pg_attribute att
                where att.attrelid = con.conrelid and att.attnum = con.conkey[1]) as first_col,
              cardinality(con.conkey)::int as arity,
              ref.relname as ref
         from pg_constraint con
         join pg_class rel on rel.oid = con.conrelid
         join pg_namespace n on n.oid = rel.relnamespace
         join pg_class ref on ref.oid = con.confrelid
        where n.nspname = 'public' and rel.relname = $1 and con.contype = 'f'`, [TABLE]);
    // Stated generically, so a foreign key ADDED LATER without the tenant
    // column fails here rather than on the day it reaches another tenant's row.
    expect(fks.rows.length).toBeGreaterThan(0);
    for (const fk of fks.rows) {
      expect(fk.first_col, fk.conname).toBe("workspace_id");
      if (fk.ref !== "organizations") expect(fk.arity, fk.conname).toBeGreaterThanOrEqual(2);
    }
  });

  it("is indexed workspace-first for the list the route reads", async () => {
    const r = await c.query(
      `select 1 from pg_index i
         join pg_class rel on rel.oid = i.indrelid
         join pg_attribute att on att.attrelid = rel.oid and att.attnum = i.indkey[0]
        where rel.relname = $1 and att.attname = 'workspace_id'`, [TABLE]);
    expect(r.rows.length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §2 — grants, RLS, and the one admissible transition
// ───────────────────────────────────────────────────────────────────────────

describe("0059 §2 — who may read, who may append, and what may change", () => {
  it("the app role may read and append and nothing else", async () => {
    const r = await c.query<{ privilege_type: string }>(
      `select distinct privilege_type from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public' and table_name = $1
        order by privilege_type`, [TABLE]);
    // Not «does not contain UPDATE»: the WHOLE grant is stated, so a grant
    // added later is visible here rather than passing a negative check.
    expect(r.rows.map((x) => x.privilege_type)).toEqual(["INSERT", "SELECT"]);
  });

  it("anon, authenticated and the service principal hold nothing on it", async () => {
    // goproceed_service gets nothing because this table records no
    // server-observed fact, so 0035's server-only plane does not apply.
    const r = await c.query<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = $1
          and grantee in ('anon','authenticated','goproceed_service','goproceed_worker','public')`,
      [TABLE]);
    expect(r.rows).toEqual([]);
  });

  it("has RLS enabled and NOT forced, because the archive writes as the owner", async () => {
    // The shape trap 0041 §7 records. app.archive_project_sourced_requirement_item
    // is SECURITY DEFINER and is the ONLY write path the transition has; there
    // is no UPDATE policy on this table, so with FORCE on, the definer's own
    // UPDATE would match no policy, update zero rows, and be reported as an
    // archive that did not happen.
    const r = await c.query<{ rls: boolean; forced: boolean }>(
      `select relrowsecurity as rls, relforcerowsecurity as forced
         from pg_class where oid = ('public.' || $1)::regclass`, [TABLE]);
    expect(r.rows[0]).toEqual({ rls: true, forced: false });
  });

  it("shows a row to any active member of its workspace and to nobody else", async () => {
    const itemA = await insertItemId();
    expect(await visible(USER_A, WS_A, TABLE, itemA)).toBe(1);
    expect(await visible(USER_M, WS_A, TABLE, itemA)).toBe(1);
    expect(await visible(USER_B, WS_B, TABLE, itemA)).toBe(0);
    // And naming A's workspace does not help B: the policy resolves the
    // MEMBERSHIP, never the GUC the caller supplies.
    expect(await visible(USER_B, WS_A, TABLE, itemA)).toBe(0);
  });

  it("lets an owner append and refuses a plain member and an outsider", async () => {
    // The positive control for the INSERT policy, first: without it the two
    // refusals below would also hold for a table nobody can write.
    expect(await sqlstate(() => appInsertItem(USER_A, WS_A))).toBeNull();
    // 42501 — «new row violates row-level security policy». project_requirements.manage
    // is a workspace capability, and packages/domain/src/authz.ts maps it to
    // owner/admin.
    expect(await sqlstate(() => appInsertItem(USER_M, WS_A))).toBe("42501");
    expect(await sqlstate(() => appInsertItem(USER_B, WS_A))).toBe("42501");
  });

  it("gives the application role no UPDATE and no DELETE to use", async () => {
    // The grant is the first layer and the guard is the second. Asserted
    // separately, because a guard whose grant was quietly restored would still
    // look fine from the message of a single failed statement.
    const id = await insertItemId();
    expect(await sqlstate(() => asActor(USER_A, WS_A, (cl) => cl.query(
      `update public.${TABLE} set status = 'archived' where id = $1`, [id])))).toBe("42501");
    expect(await sqlstate(() => asActor(USER_A, WS_A, (cl) => cl.query(
      `delete from public.${TABLE} where id = $1`, [id])))).toBe("42501");
  });

  it("refuses an UPDATE of the text and permits only active -> archived", async () => {
    const itemA = await insertItemId();
    expect(await sqlstate(() => ownerUpdate(itemA, "item_text_uk = 'інше'"))).toBe("P0001");
    await expect(archiveViaFunction(WS_A, itemA)).resolves.toBeUndefined();
    // idempotent by state: the operation is idempotency-required, a replay must not raise
    await expect(archiveViaFunction(WS_A, itemA)).resolves.toBeUndefined();
  });

  it("refuses DELETE outright, even from the owner", async () => {
    const id = await insertItemId();
    expect(await raised(() => c.query(`delete from public.${TABLE} where id = $1`, [id])))
      .toMatch(/not deletable/i);
    const still = await c.query(`select 1 from public.${TABLE} where id = $1`, [id]);
    expect(still.rows).toHaveLength(1);
  });

  it("refuses an archive that also rewrites the citation, and one that records no archivist", async () => {
    const id = await insertItemId();
    expect(await raised(() => c.query(
      `update public.${TABLE}
          set status = 'archived', archived_at = now(), archived_by_member_id = $2,
              source_sheet = 'Приклад-аркуш 13'
        where id = $1`, [id, a.memberId])))
      .toMatch(/must not alter the requirement text or its citation/);

    expect(await raised(() => ownerUpdate(id, "status = 'archived'")))
      .toMatch(/must record archived_at and the archiving member/);

    const untouched = await c.query<{ status: string; source_sheet: string }>(
      `select status, source_sheet from public.${TABLE} where id = $1`, [id]);
    expect(untouched.rows[0]!.status).toBe("active");
    expect(untouched.rows[0]!.source_sheet).toBe("Приклад-аркуш 12");
  });

  it("admits no transition out of archived, and none back into active", async () => {
    const id = await insertItemId();
    await archiveViaFunction(WS_A, id);
    expect(await raised(() => c.query(
      `update public.${TABLE}
          set status = 'active', archived_at = null, archived_by_member_id = null
        where id = $1`, [id]))).toMatch(/admits only the active -> archived transition/);
  });

  it("leaves the text and the citation exactly as written, and stamps the archivist", async () => {
    // The complement of every refusal above: the one admissible transition must
    // actually happen, and must touch nothing else.
    const id = await insertItemId();
    const before = await c.query<{ item_text_uk: string; source_sheet: string; created_at: Date }>(
      `select item_text_uk, source_sheet, created_at from public.${TABLE} where id = $1`, [id]);
    await archiveViaFunction(WS_A, id);
    const after = await c.query<{
      status: string; archived_at: Date | null; archived_by_member_id: string | null;
      item_text_uk: string; source_sheet: string; created_at: Date;
    }>(`select status, archived_at, archived_by_member_id, item_text_uk, source_sheet, created_at
          from public.${TABLE} where id = $1`, [id]);
    const row = after.rows[0]!;
    expect(row.status).toBe("archived");
    expect(row.archived_at).not.toBeNull();
    expect(row.archived_by_member_id).toBe(a.memberId);
    expect(row.item_text_uk).toBe(before.rows[0]!.item_text_uk);
    expect(row.source_sheet).toBe(before.rows[0]!.source_sheet);
    expect(row.created_at.toISOString()).toBe(before.rows[0]!.created_at.toISOString());
  });

  it("answers a replayed archive with the ORIGINAL archivist and timestamp, not a fresh pair", async () => {
    // Idempotent by STATE, not by an UPDATE that re-stamps: re-stamping would
    // rewrite when the item stopped being authorable from AND who stopped it.
    // The replay is issued by a DIFFERENT authorized archivist, so a re-stamp
    // would move both columns and neither assertion could pass by accident.
    const id = await insertItemId();
    await archiveViaFunction(WS_A, id);
    const first = await c.query<{ archived_at: Date; archived_by_member_id: string }>(
      `select archived_at, archived_by_member_id from public.${TABLE} where id = $1`, [id]);
    await archiveViaFunction(WS_A, id, USER_D);
    const second = await c.query<{ archived_at: Date; archived_by_member_id: string }>(
      `select archived_at, archived_by_member_id from public.${TABLE} where id = $1`, [id]);
    expect(second.rows[0]!.archived_at.toISOString())
      .toBe(first.rows[0]!.archived_at.toISOString());
    expect(second.rows[0]!.archived_by_member_id).toBe(a.memberId);
    expect(second.rows[0]!.archived_by_member_id).not.toBe(adminMemberId);
  });

  it("keeps the first archivist when a second one RACES it, not merely when one replays", async () => {
    // THE CASE THE SEQUENTIAL REPLAY ABOVE CANNOT REACH. A replay returns at
    // the status read; a racer never sees that status. Both calls read
    // 'active', both proceed to the UPDATE, and only the compare-and-swap in
    // app.archive_project_sourced_requirement_item decides what the row says
    // afterwards — so the interleaving is DRIVEN here rather than hoped for.
    const id = await insertItemId();
    const winner = appClient();
    const loser = appClient();
    await winner.connect();
    await loser.connect();
    let loserError: unknown;
    try {
      // The winner runs its UPDATE and holds the row lock, uncommitted.
      await beginAs(winner, USER_A, WS_A);
      await winner.query(
        `select app.archive_project_sourced_requirement_item($1,$2)`, [WS_A, id]);

      // The loser takes its own snapshot, reads a row that is STILL 'active',
      // passes the idempotency branch, and blocks on that lock. A wait here is
      // bounded by the commit two statements down, so a timeout is a bug rather
      // than a slow machine.
      await beginAs(loser, USER_D, WS_A);
      await loser.query("set local lock_timeout = '15s'");
      const blocked = loser
        .query(`select app.archive_project_sourced_requirement_item($1,$2)`, [WS_A, id])
        .catch((e: unknown) => { loserError = e; });

      // Not a sleep: the winner commits only once the loser is PROVABLY past
      // its status read and waiting on the row lock.
      await waitUntilBlockedOnArchive();
      await winner.query("commit");
      await blocked;
      await loser.query("commit");
    } finally {
      await winner.end().catch(() => undefined);
      await loser.end().catch(() => undefined);
    }
    // The losing call is not an error — it is a no-op. Raising would make a
    // concurrent archive fail an operation scope-v0.1.csv marks
    // idempotency-required.
    expect(loserError).toBeUndefined();

    const row = await c.query<{ status: string; archived_by_member_id: string }>(
      `select status, archived_by_member_id from public.${TABLE} where id = $1`, [id]);
    expect(row.rows[0]!.status).toBe("archived");
    // Who archived it and when is the fact this function exists to protect.
    // Without `and status = 'active'` on the UPDATE the loser's WHERE still
    // matches after the winner commits, and this reads adminMemberId instead.
    expect(row.rows[0]!.archived_by_member_id).toBe(a.memberId);
    expect(row.rows[0]!.archived_by_member_id).not.toBe(adminMemberId);
  });

  it("refuses an outsider's archive and a plain member's, before it reads anything", async () => {
    // The authorization runs first so a raise cannot become a cross-tenant
    // oracle: B is told they are not authorized, never whether the id exists.
    const id = await insertItemId();
    expect(await raised(() => archiveViaFunction(WS_A, id, USER_B))).toMatch(/not authorized/);
    expect(await raised(() => archiveViaFunction(WS_A, id, USER_M))).toMatch(/not authorized/);
    // Both refusals must be the SAME refusal a nonexistent id gets, or the
    // message itself would answer «does this id exist in that workspace».
    const absent = "b05999aa-9999-9999-9999-999999999999";
    expect(await raised(() => archiveViaFunction(WS_A, absent, USER_B))).toMatch(/not authorized/);

    const still = await c.query<{ status: string }>(
      `select status from public.${TABLE} where id = $1`, [id]);
    expect(still.rows[0]!.status).toBe("active");
  });

  it("tells an authorized caller that an unknown item is unknown", async () => {
    const absent = "b05999bb-9999-9999-9999-999999999999";
    expect(await raised(() => archiveViaFunction(WS_A, absent)))
      .toMatch(/unknown project-sourced requirement item/);
  });

  it("refuses to reach across the tenant boundary even for an owner of both halves", async () => {
    // A's item named with B's workspace: the SELECT is keyed on BOTH, so an
    // owner of B is told the item is unknown rather than being allowed to
    // archive a row of A.
    const id = await insertItemId();
    expect(await raised(() => archiveViaFunction(WS_B, id, USER_B)))
      .toMatch(/unknown project-sourced requirement item/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §3 — the vocabulary widening and the second provenance
// ───────────────────────────────────────────────────────────────────────────

interface RuleVersionOver {
  workspaceId?: string;
  normRef?: string | null;
  normRefVerification?: string | null;
  normRefSource?: string | null;
  requirementLibraryItemId?: string | null;
  projectSourcedRequirementItemId?: string | null;
  /** Overrides the latest-image pin the helper computes (INV-108 probes). */
  referenceImageVersionId?: string | null;
}

/**
 * A PUBLISHED rule version, inserted directly, with the provenance columns
 * under the caller's control.
 *
 * `seedRuleVersion` in m1-rules-fixture.ts cannot stand in here: it composes
 * norm_ref, norm_ref_verification and norm_ref_source by SELECTing them out of
 * the cited library item, which is exactly the path a project-sourced tag never
 * takes. `project_sourced_requirement_item_id` is named in the column list ONLY
 * when the caller supplies it, so a run against the un-widened schema fails on
 * the CHECK where the CHECK is the subject and on the missing column where the
 * column is.
 */
async function insertRuleVersion(over: RuleVersionOver = {}): Promise<string> {
  const ws = over.workspaceId ?? WS_A;
  const author = ws === WS_B ? b.memberId : a.memberId;
  const v: Record<string, unknown> = {
    workspace_id: ws,
    version_no: 1,
    ordinal: 1,
    status: "published",
    work_type_key: "montazh-elektrotekhnichnykh-ustanovok",
    stage_key: "prykhovani-roboty-0059",
    intervention_type: "hold",
    blocking_scope: "blocks_stage_closure",
    timing: "before_concealment",
    evidence_kind: "photo",
    acceptance_criterion: "Приклад-критерій приймання за робочою документацією.",
    performer_role: "foreman",
    approver_role: "technical_supervisor",
    allowed_media: JSON.stringify({ mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024 }),
    norm_ref: over.normRef === undefined
      ? "Приклад-робоча документація, аркуш 12" : over.normRef,
    norm_ref_verification: over.normRefVerification === undefined
      ? "PROJECT_DOCUMENTATION" : over.normRefVerification,
    norm_ref_source: over.normRefSource === undefined ? "Приклад-ЕМ-12" : over.normRefSource,
    published_by_member_id: author,
    created_by_member_id: author,
  };
  if (over.requirementLibraryItemId !== undefined) {
    v.requirement_library_item_id = over.requirementLibraryItemId;
    const pin = await c.query(`select id from public.requirement_reference_image_versions
      where workspace_id=$1 and requirement_library_item_id=$2 order by version_no desc limit 1`,
      [ws, over.requirementLibraryItemId]);
    v.reference_image_version_id = over.referenceImageVersionId !== undefined
      ? over.referenceImageVersionId : pin.rows[0]?.id ?? null;
  }
  if (over.projectSourcedRequirementItemId !== undefined) {
    v.project_sourced_requirement_item_id = over.projectSourcedRequirementItemId;
  }
  const cols = Object.keys(v);
  const r = await c.query<{ id: string }>(
    `insert into public.requirement_rule_versions
       (requirement_rule_id, rule_version_hash, published_at, ${cols.join(",")})
     values (gen_random_uuid(), repeat('a',64), now(),
             ${cols.map((_, i) => `$${i + 1}`).join(",")})
     returning id`,
    cols.map((k) => v[k]));
  return r.rows[0]!.id;
}

describe("0059 §3 — the vocabulary widens by one value, in the two places a tag travels", () => {
  let w: OccurrenceWorld;
  let libItem: string;
  let psItem: string;

  beforeAll(async () => {
    // A real occurrence, materialised the way the product materialises one:
    // a rule version bound while the baseline was a draft, the baseline then
    // published, an assignment and a concealed stage on it. The tag is COPIED
    // into the occurrence at that step (occurrence-writer.ts,
    // materialiseOccurrences), which is why the second CHECK has to widen too.
    w = await seedOccurrenceWorld(c, a);
    libItem = a.libraryItemIds.get("Н.15/1")!;
    psItem = await insertItemId();
  }, 120_000);

  it("stores a rule version and an occurrence tagged PROJECT_DOCUMENTATION", async () => {
    await expect(insertRuleVersion({ normRefVerification: "PROJECT_DOCUMENTATION" }))
      .resolves.toBeDefined();
    await expect(insertOccurrenceRow(c, w, {
      normRef: "Приклад-робоча документація, аркуш 12",
      normRefVerification: "PROJECT_DOCUMENTATION",
      normRefSource: "Приклад-ЕМ-12",
    })).resolves.toBeDefined();
  });

  it("still refuses a value nobody defined, on BOTH tables", async () => {
    // The widening is by exactly one value. Without this the first case would
    // pass just as well against a CHECK that had been dropped.
    expect(await sqlstate(() => insertRuleVersion({ normRefVerification: "UNVERIFIED" })))
      .toBe("23514");
    expect(await sqlstate(() => insertOccurrenceRow(c, w, {
      normRef: "Приклад-джерело", normRefVerification: "UNVERIFIED",
      normRefSource: "Приклад-ЕМ-12",
    }))).toBe("23514");
  });

  it("leaves the library and the act form two-valued, which is the whole point", async () => {
    // requirement_library_items.verification must NOT widen: the seeded Додаток Н
    // set never carries this tag, and making it storable there would let
    // authoring corrupt the verified set. statutory_act_versions
    // .form_citation_verification must not either — it tags the ACT FORM's own
    // citation, which is Додаток В whatever the requirement's source is.
    const r = await c.query<{ conname: string; def: string }>(
      `select conname, pg_get_constraintdef(oid) as def from pg_constraint
        where conname in (
          'requirement_rule_versions_norm_ref_verification_check',
          'requirement_occurrences_norm_ref_verification_check',
          'requirement_library_items_verification_check',
          'statutory_act_versions_form_citation_verification_check')`);
    const byName = new Map(r.rows.map((x) => [x.conname, x.def]));
    expect(byName.size).toBe(4);
    expect(byName.get("requirement_rule_versions_norm_ref_verification_check"))
      .toMatch(/PROJECT_DOCUMENTATION/);
    expect(byName.get("requirement_occurrences_norm_ref_verification_check"))
      .toMatch(/PROJECT_DOCUMENTATION/);
    expect(byName.get("requirement_library_items_verification_check"))
      .not.toMatch(/PROJECT_DOCUMENTATION/);
    expect(byName.get("statutory_act_versions_form_citation_verification_check"))
      .not.toMatch(/PROJECT_DOCUMENTATION/);
  });

  it("refuses a rule version citing both a library item and a project-sourced item", async () => {
    expect(await sqlstate(() => insertRuleVersion({
      requirementLibraryItemId: libItem, projectSourcedRequirementItemId: psItem,
    }))).toBe("23514");
  });

  it("stores a rule version citing exactly one of the two, and one citing neither", async () => {
    // The positive control for the exclusivity CHECK. requirement_library_item_id
    // was already nullable because making it NOT NULL would have baked v0.1 into
    // the schema; the new column is its sibling and «neither» stays storable.
    await expect(insertRuleVersion({ projectSourcedRequirementItemId: psItem }))
      .resolves.toBeDefined();
    await expect(insertRuleVersion({
      requirementLibraryItemId: libItem,
      normRefVerification: "VERIFIED_PRIMARY",
      normRefSource: "ДБН А.3.1-5:2016 Додаток Н",
    })).resolves.toBeDefined();
    await expect(insertRuleVersion({
      requirementLibraryItemId: null, projectSourcedRequirementItemId: null,
    })).resolves.toBeDefined();
  });

  it("cites a project-sourced item of its OWN workspace, as a composite key", async () => {
    const fk = await c.query<{ def: string }>(
      `select pg_get_constraintdef(con.oid) as def from pg_constraint con
         join pg_class rel on rel.oid = con.conrelid
        where rel.relname = 'requirement_rule_versions' and con.contype = 'f'
          and pg_get_constraintdef(con.oid) like '%project_sourced_requirement_items%'`);
    expect(fk.rows.map((x) => x.def)).toEqual([
      "FOREIGN KEY (workspace_id, project_sourced_requirement_item_id) "
      + "REFERENCES project_sourced_requirement_items(workspace_id, id)",
    ]);
    // And the key refuses in practice, not only in the catalog.
    const foreign = await insertItemId({ workspaceId: WS_B, projectId: b.projectId,
      createdByMemberId: b.memberId });
    expect(await sqlstate(() => insertRuleVersion({
      projectSourcedRequirementItemId: foreign,
    }))).toBe("23503");
  });

  it("freezes the new column without any edit to the rule-version guard", async () => {
    // app.guard_requirement_rule_version() (0041 §6) compares to_jsonb(new)
    // against to_jsonb(old) with four keys subtracted rather than enumerating
    // columns, so this column is frozen from the moment it exists.
    //
    // THE PROBE IS A RETIREMENT AND NOT A BARE UPDATE, and that is what this
    // case is about. The guard raises INV-067 from three branches — DELETE,
    // a transition other than published -> retired, and the content diff — and
    // ONLY THE THIRD says anything about this column. An UPDATE that just
    // nulled it leaves `status` at 'published', so
    // `old.status <> 'published' or new.status <> 'retired'` fires FIRST and
    // the row is refused for its transition; the column could have been left
    // out of the subtraction entirely and such a probe would still be green.
    // So the write attempted below is a LEGAL retirement that also drops the
    // provenance, which is the only shape that reaches the diff, and the
    // assertion is on the diff branch's OWN message rather than on «INV-067»
    // that all three branches carry.
    const id = await insertRuleVersion({ projectSourcedRequirementItemId: psItem });
    expect(await raised(() => c.query(
      `update public.requirement_rule_versions
          set status = 'retired', retired_at = now(), retired_by_member_id = $2,
              project_sourced_requirement_item_id = null
        where id = $1`, [id, a.memberId])))
      .toMatch(/retirement must not alter frozen rule-version content \(INV-067\)/);
  });

  it("still retires a version that changes nothing else — the positive control", async () => {
    // Without this the case above passes just as well against a guard that
    // refused EVERY retirement, and «the column is frozen» would be
    // indistinguishable from «the row is unretirable». Retirement stops future
    // binding and is a thing the product does; what it may not do is move
    // frozen content.
    const id = await insertRuleVersion({ projectSourcedRequirementItemId: psItem });
    expect(await raised(() => c.query(
      `update public.requirement_rule_versions
          set status = 'retired', retired_at = now(), retired_by_member_id = $2
        where id = $1`, [id, a.memberId]))).toBe("");
    // AND THE PROVENANCE SURVIVED IT. The occurrence that pinned this version
    // still cites the item it was published against (INV-067).
    const r = await c.query<{ status: string; ps: string | null }>(
      `select status, project_sourced_requirement_item_id as ps
         from public.requirement_rule_versions where id = $1`, [id]);
    expect(r.rows[0]).toEqual({ status: "retired", ps: psItem });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §4 — app.project_in_workspace, added review fix round 1 on Task 11
// ───────────────────────────────────────────────────────────────────────────

describe("0059 §4 — the tenant-existence helper's own ACL", () => {
  // Not a functional re-test of the route's fix: that lives in
  // project-requirements.int.test.ts ("succeeds for a second admin who did
  // not create the project"). This pins only the posture a SECURITY DEFINER
  // helper needs to be safe to call from goproceed_app in the first place —
  // 0009's deny-by-default strips automatic EXECUTE from every new function,
  // and this is the check that a later grant did not quietly widen it.
  it("goproceed_app may execute it; anon and authenticated may not", async () => {
    const fn = "app.project_in_workspace(uuid, uuid)";
    const r = await c.query<{ app: boolean; anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('goproceed_app', $1, 'execute') as app,
              has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authenticated`,
      [fn]);
    expect(r.rows[0]).toEqual({ app: true, anon: false, authenticated: false });
  });
});

describe("0095 / INV-108 — a library rule pins the latest illustration, or none while none exists", () => {
  const verified = { normRefVerification: "VERIFIED_PRIMARY", normRefSource: "ДБН А.3.1-5:2016 Додаток Н" };
  let libItem: string;
  let v1: string;
  let v2: string;

  async function addVersion(ws: string, item: string, versionNo: number): Promise<string> {
    const r = await c.query<{ id: string }>(`insert into public.requirement_reference_image_versions
      (id,workspace_id,requirement_library_item_id,version_no,storage_key,sha256,byte_size,
       mime_type,width,height,alt_text_uk,rights_holder,license,source_uri,manifest_sha256)
      values (gen_random_uuid(),$1,$2,$3,gen_random_uuid()::text || '/' || gen_random_uuid()::text,
        repeat('e',64),3,'image/jpeg',1,1,'Приклад-тестовий ракурс','TEST ONLY','TEST ONLY',
        'https://example.com/test-only',repeat('f',64)) returning id`, [ws, item, versionNo]);
    return r.rows[0]!.id;
  }

  beforeAll(async () => {
    libItem = a.libraryItemIds.get("Н.14/2")!;
    const seeded = await c.query<{ id: string }>(`select id from public.requirement_reference_image_versions
      where workspace_id=$1 and requirement_library_item_id=$2 and version_no=1`, [WS_A, libItem]);
    v1 = seeded.rows[0]!.id;
    v2 = await addVersion(WS_A, libItem, 2);
  });

  it("stores a rule pinned to the latest version", async () => {
    await expect(insertRuleVersion({ requirementLibraryItemId: libItem, ...verified, referenceImageVersionId: v2 }))
      .resolves.toBeDefined();
  });

  it("refuses a stale pin and a missing pin once an illustration exists", async () => {
    expect(await sqlstate(() => insertRuleVersion({
      requirementLibraryItemId: libItem, ...verified, referenceImageVersionId: v1 }))).toBe("23514");
    expect(await sqlstate(() => insertRuleVersion({
      requirementLibraryItemId: libItem, ...verified, referenceImageVersionId: null }))).toBe("23514");
  });

  it("stores an unpinned library rule while that item has no illustration", async () => {
    const bare = await c.query<{ id: string }>(`insert into public.requirement_library_items
        (workspace_id, source_standard, position_code, position_title_uk, item_no, item_text_uk,
         verification, source_citation)
      values ($1,'Приклад-стандарт без ілюстрації','Н.15','Монтаж електротехнічних установок',1,
              'Приклад-текст без ілюстрації.','VERIFIED_PRIMARY','Приклад-джерело') returning id`, [WS_A]);
    await expect(insertRuleVersion({ requirementLibraryItemId: bare.rows[0]!.id, ...verified }))
      .resolves.toBeDefined();
  });

  it("refuses another workspace's illustration", async () => {
    const other = await c.query<{ id: string }>(`select id from public.requirement_reference_image_versions
      where workspace_id=$1 limit 1`, [WS_B]);
    // The guard compares against this workspace's latest first; either refusal holds the boundary.
    expect(["23503", "23514"]).toContain(await sqlstate(() => insertRuleVersion({
      requirementLibraryItemId: libItem, ...verified, referenceImageVersionId: other.rows[0]!.id })));
  });
});
