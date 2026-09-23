import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, appClient, asActor } from "./pg";

// Migrations 0036-0040 close five findings from
// docs/delivery/package-review-2026-08-04.md. Each case below is written to
// fail against 0035 and pass against 0040 — the assertion is on the fixed
// state, never on "current behaviour", so none of these can later defend the
// defect it was written to remove.

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("0036 the bookkeeping drain no longer races the claim protocol", () => {
  it("no cron job invokes drain_outbox", async (ctx) => {
    const c = await adminClient();
    try {
      const ext = await c.query(
        "select 1 from pg_extension where extname = 'pg_cron'");
      // ctx.skip(), not a bare return: a silent pass here would read as proof.
      if (ext.rowCount === 0) ctx.skip();
      const r = await c.query(
        "select jobname, schedule, command from cron.job where command ilike '%drain_outbox%'");
      expect(r.rows).toEqual([]);
    } finally {
      await c.end();
    }
  });

  it("no non-superuser role may execute drain_outbox", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(`
        select
          has_function_privilege('service_role',    'public.drain_outbox(int)', 'execute') as service_role,
          has_function_privilege('anon',            'public.drain_outbox(int)', 'execute') as anon,
          has_function_privilege('authenticated',   'public.drain_outbox(int)', 'execute') as authenticated,
          has_function_privilege('goproceed_app',     'public.drain_outbox(int)', 'execute') as app`);
      expect(r.rows[0]).toEqual({
        service_role: false, anon: false, authenticated: false, app: false,
      });
    } finally {
      await c.end();
    }
  });
});

describe("0037 every public table carries row level security", () => {
  // Deliberately written as a whole-schema invariant rather than a test of
  // outbox_dead_letters alone: this is the assertion that catches the NEXT
  // table someone adds without RLS, which is how this one arrived.
  it("no table in schema public has RLS disabled", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(`
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        order by c.relname`);
      expect(r.rows.map((x) => x.relname)).toEqual([]);
    } finally {
      await c.end();
    }
  });

  it("goproceed_worker holds no SELECT on outbox_dead_letters", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(
        `select has_table_privilege('goproceed_worker', 'public.outbox_dead_letters', 'select') as sel`);
      expect(r.rows[0].sel).toBe(false);
    } finally {
      await c.end();
    }
  });

  it("RLS is enabled but NOT forced, so the owner write path survives", async () => {
    // The shape trap 0037 must not fall into. app.fail_outbox (0008) inserts
    // dead letters as the table owner inside SECURITY DEFINER; FORCE would
    // apply RLS to the owner too and break the write path this table exists
    // for. Asserted directly on the catalog rather than by driving the retry
    // budget to exhaustion, so the guard cannot pass for the wrong reason.
    const c = await adminClient();
    try {
      const r = await c.query(`
        select c.relrowsecurity, c.relforcerowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'outbox_dead_letters'`);
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: false });
    } finally {
      await c.end();
    }
  });

  it("no policy grants the table back to anyone", async () => {
    // RLS with zero policies denies every row to every non-owner. A later
    // policy keyed off app.current_actor() would return nothing for a worker
    // (which never sets that GUC) while reading as though access existed.
    const c = await adminClient();
    try {
      const r = await c.query(
        "select policyname from pg_policies where schemaname='public' and tablename='outbox_dead_letters'");
      expect(r.rows).toEqual([]);
    } finally {
      await c.end();
    }
  });
});

describe("0038 the purge functions name a principal other than the superuser", () => {
  // 0038 granted the four to goproceed_worker and service_role. 0090 (DEV-036,
  // BL-030) moved them to the unexposed `app` schema and gave them — with a
  // fifth, the health count — to a principal of the purge's own, because
  // goproceed_worker also holds the outbox and service_role is the Data API's
  // key. The fixed state 0038 was written for (a non-superuser principal, and
  // no browser-reachable role) is what this case keeps asserting.
  const FNS = [
    "app.expire_upload_intents()",
    "app.claim_upload_purge(integer)",
    "app.complete_upload_purge(uuid)",
    "app.fail_upload_purge(uuid, text)",
    "app.upload_purge_health()",
  ];

  it("goproceed_purge_worker may execute all five", async () => {
    const c = await adminClient();
    try {
      for (const fn of FNS) {
        const r = await c.query(
          "select has_function_privilege('goproceed_purge_worker', $1, 'execute') as ok", [fn]);
        expect(r.rows[0], fn).toEqual({ ok: true });
      }
    } finally {
      await c.end();
    }
  });

  it("browser-reachable roles, the BFF role, the Data API key and the outbox worker may not", async () => {
    // 0021 revoked from PUBLIC only, which does not strip the direct EXECUTE
    // the local stack grants anon/authenticated at creation time.
    const c = await adminClient();
    try {
      for (const fn of FNS) {
        const r = await c.query(
          `select has_function_privilege('anon',             $1, 'execute') as anon,
                  has_function_privilege('authenticated',    $1, 'execute') as authenticated,
                  has_function_privilege('goproceed_app',    $1, 'execute') as app,
                  has_function_privilege('service_role',     $1, 'execute') as service_role,
                  has_function_privilege('goproceed_worker', $1, 'execute') as worker`, [fn]);
        expect(r.rows[0], fn).toEqual(
          { anon: false, authenticated: false, app: false, service_role: false, worker: false });
      }
    } finally {
      await c.end();
    }
  });
});

describe("0039 organizations has no UPDATE path", () => {
  it("goproceed_app holds SELECT and INSERT but not UPDATE", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(`
        select
          has_table_privilege('goproceed_app', 'public.organizations', 'select') as sel,
          has_table_privilege('goproceed_app', 'public.organizations', 'insert') as ins,
          has_table_privilege('goproceed_app', 'public.organizations', 'update') as upd`);
      expect(r.rows[0]).toEqual({ sel: true, ins: true, upd: false });
    } finally {
      await c.end();
    }
  });

  it("an owner's UPDATE is refused outright rather than silently affecting zero rows", async () => {
    // This is the point of 0039. Before it, RLS made the UPDATE a no-op that
    // COMMITTED — the worst failure mode, because a settings screen built on
    // it would report success. After it, the grant is gone and Postgres
    // raises 42501 (insufficient_privilege).
    const org = randomUUID();
    await asActor(A, org, async (c) => {
      await c.query(
        "insert into public.organizations (id, legal_name, display_name) values ($1,'Приклад-Орг','Приклад-Орг')", [org]);
      await c.query(
        "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
        [org, A]);
    });

    const c = appClient();
    await c.connect();
    let code: string | undefined;
    try {
      await c.query("begin");
      await c.query("set local role goproceed_app");
      await c.query("select set_config('app.actor_user_id', $1, true)", [A]);
      await c.query("select set_config('app.organization_id', $1, true)", [org]);
      await c.query("update public.organizations set display_name = 'changed' where id = $1", [org]);
      await c.query("commit");
    } catch (e) {
      code = (e as { code?: string }).code;
      await c.query("rollback").catch(() => {});
    } finally {
      await c.end();
    }
    expect(code).toBe("42501");
  });

  it("the external-gate columns are not column-grantable either", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(`
        select
          has_column_privilege('goproceed_app', 'public.organizations', 'evidence_quota_bytes', 'update') as quota,
          has_column_privilege('goproceed_app', 'public.organizations', 'blocked_content_retention_days', 'update') as retention`);
      expect(r.rows[0]).toEqual({ quota: false, retention: false });
    } finally {
      await c.end();
    }
  });
});

describe("0040 audit_events names a project of its own tenant", () => {
  async function seedOrgWithProject(c: Awaited<ReturnType<typeof adminClient>>) {
    const org = await c.query(
      "insert into public.organizations (legal_name, display_name) values ('Приклад-Орг','Приклад-Орг') returning id");
    const orgId = org.rows[0].id as string;
    const proj = await c.query(
      "insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Обʼєкт',$2) returning id",
      [orgId, A]);
    return { orgId, projectId: proj.rows[0].id as string };
  }

  it("the constraint exists, is validated, and is tenant-safe (two columns)", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(`
        select c.convalidated, cardinality(c.conkey) as cols, ref.relname as refs
        from pg_constraint c
        join pg_class rel on rel.oid = c.conrelid
        join pg_class ref on ref.oid = c.confrelid
        where rel.relname = 'audit_events' and c.contype = 'f' and c.conname = 'audit_project_tenant_fk'`);
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].cols).toBe(2);
      expect(r.rows[0].convalidated).toBe(true);
      expect(r.rows[0].refs).toBe("projects");
    } finally {
      await c.end();
    }
  });

  it("an audit row may cite a project of its own tenant", async () => {
    const c = await adminClient();
    try {
      const { orgId, projectId } = await seedOrgWithProject(c);
      await c.query(
        `insert into public.audit_events (organization_id, project_id, actor_type, action, object_type, object_id)
         values ($1,$2,'system','probe.ok','probe','1')`, [orgId, projectId]);
    } finally {
      await c.end();
    }
  });

  it("an audit row may not cite a project of another tenant", async () => {
    const c = await adminClient();
    try {
      const one = await seedOrgWithProject(c);
      const two = await seedOrgWithProject(c);
      await expect(c.query(
        `insert into public.audit_events (organization_id, project_id, actor_type, action, object_type, object_id)
         values ($1,$2,'system','probe.cross','probe','1')`, [one.orgId, two.projectId]),
      ).rejects.toMatchObject({ code: "23503" });
    } finally {
      await c.end();
    }
  });

  it("a workspace-scoped audit row with a NULL project still inserts", async () => {
    // MATCH SIMPLE regression guard. All 28 workspace-scoped recordAudit call
    // sites pass NULL; MATCH FULL would reject every one of them.
    const c = await adminClient();
    try {
      const { orgId } = await seedOrgWithProject(c);
      await c.query(
        `insert into public.audit_events (organization_id, actor_type, action, object_type, object_id)
         values ($1,'system','probe.null','probe','1')`, [orgId]);
    } finally {
      await c.end();
    }
  });
});
