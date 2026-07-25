# 35. Data Access, Supabase Exposure and Tenant Integrity

Версия: 1.0 — normative  
Дата: 22.07.2026

## 1. Решение

Канонический allowlist находится в `technical/data-access-surface.csv`. Отсутствие объекта/роли/операции в allowlist означает запрет. Три независимых барьера обязательны одновременно:

1. schema/object не доступен через нежелательную сетевую поверхность;
2. SQL role имеет только явно выданные privileges;
3. RLS/command authorization разрешает конкретную строку, действие, состояние и scope.

RLS без grants и grants без RLS не считаются контролем доступа.

## 2. Supabase Data API

- В `exposed_schemas` разрешён только `api`; `public`, `private`, storage-internal и extension schemas не публикуются.
- `api.project_list` — единственная прямая Pilot-проекция. Это `security_invoker` view; underlying `projects` RLS ограничивает организацию и project scope.
- `anon` не получает tenant-object grants. Публичный landing не читает tenant DB.
- Создание новой таблицы не означает её публикацию. Migration checklist отдельно проверяет schema exposure, grants, RLS и negative tests.
- Изменение списка exposed schemas — security-sensitive production change с ADR, rollback и повторным IDOR/RLS suite.

## 3. Runtime roles

| Role | Login | BYPASSRLS | Назначение | Standing access |
|---|---:|---:|---|---|
| `authenticated` | managed | no | клиентская Supabase-сессия | Auth + reviewed `api` views |
| `aktflow_app` | no | no | BFF query/command transaction | только строки `bff` allowlist |
| `aktflow_worker` | no | no | async job transaction | только строки `worker` allowlist |
| `aktflow_external` | no | no | exact-share review transaction | exact package/session capability |
| `aktflow_audit_writer` | no | no | append security event | insert-only restricted function |
| `aktflow_platform_billing` | no | no | isolated SaaS invoice issue/settlement/correction | guarded billing functions only; never granted to a tenant BFF session |
| `aktflow_support` | no | no | GA support plane | no table grants; approved functions under grant |
| `service_role` | provider | yes | migration/emergency | запрещён в normal runtime |

Group roles are `NOLOGIN NOBYPASSRLS`; environment login roles receive only the required group membership. Staging and production credentials are different. Role membership and grants are exported into release evidence and diffed in CI.

## 4. BFF actor-context protocol

Every database operation is inside a transaction:

1. validate bearer token with the auth provider on the server, not by trusting decoded client claims alone;
2. resolve active membership, role, `all_projects`, project/location scopes and membership version;
3. resolve the target row by `(organization_id, project_id, id)`; sensitive foreign IDs use not-found semantics;
4. begin transaction and `SET LOCAL ROLE aktflow_app`;
5. set transaction-local actor, membership-version, organization and request IDs through the reviewed gateway helper;
6. execute domain check and mutation with optimistic version/idempotency rules;
7. insert audit event and outbox intent in the same transaction;
8. commit; transaction-local context disappears before the pooled connection is reused.

Session-level tenant variables are prohibited. Organization headers are routing hints only and never authorization facts. A command that touches two organizations is prohibited outside a separately reviewed platform migration/support function.

Every authenticated tenant operation also carries `X-Organization-Id`, including project-addressed routes. The BFF resolves `(organization_id, project_id)` and rejects a mismatch with non-disclosing not-found semantics. The only authenticated domain exceptions are creation of a new organization and invitation redemption before an active tenant context exists.

Platform billing does not reuse this tenant actor protocol. The gateway validates a dedicated `platform_billing` audience and named operator/service identity, opens an audited transaction under `aktflow_platform_billing`, resolves the invoice organization from the immutable invoice record, and calls only guarded issue/settlement/adjustment functions. Supplying `X-Organization-Id`, owning the tenant or holding `saas_subscription` permission cannot grant this audience. `aktflow_app` has read-only access to tenant-visible SaaS billing history.

## 5. RLS policy families

| Family | Row predicate | Mutation additions |
|---|---|---|
| `org_role_project_location_state` | active membership for row organization; `all_projects`/project scope; location scope where present | permission action, object state, entitlement, deny override, SoD and optimistic version |
| `stored_job_tenant` | active lease; persisted job organization/project/resource equals target row | allowed job type/state transition, attempt number, idempotency and lease fencing token |
| `valid_share_session_exact_resource` | hashed share exists; session/TTL/revoke/lock/OTP valid; exact package ID and snapshot hash match | permitted decision only once per idempotency key; append-only receipt |
| `active_time_bound_grant` | named platform actor; active case/grant; allowed project/function; TTL and recent auth valid | tenant-visible banner/audit; no free-form SQL or bulk export unless separately granted |
| `request_actor_context` | trusted BFF/worker transaction with request ID | insert only; safe-metadata schema and redaction enforced |
| `platform_billing_actor_context` | dedicated platform audience, named actor/service, MFA/recent-auth where interactive and invoice-derived organization | guarded issue/settlement/adjustment only; append audit/outbox, no tenant impersonation or general table browsing |

Помимо шести базовых семей выше, `technical/data-access-surface.csv` использует производные метки, составленные из фиксированной грамматики токенов; каждая производная семья — только сужение (никогда не расширение) `org_role_project_location_state` либо платформенных семей:

- `org` — активное membership в организации строки; `role` — permission action для роли актора; `admin`/`owner`/`security` — команда ограничена соответственно Admin/Owner/Security Admin; `service_actor` — persisted job/service identity вместо интерактивного актора;
- `project` — project scope membership; `location` — location scope; `period`/`contract`/`assignment`/`subject`/`purpose`/`capture` — строка обязана совпадать по scope с указанным родителем (периодом, договором, назначением, subject-ом, purpose-ом upload-а, capture-сессией); `actor` — `actor_user_id` строки равен текущему актору;
- `scope` (без `state`) — только предикаты принадлежности, без object-state guard; `state` — mutation дополнительно проверяет допустимое состояние объекта.

Примеры: `org_role_project_state` = базовая семья без location-предиката; `org_owner_state` = только Owner с state-guard; `org_actor_project_assignment_state` = актор-владелец строки в scope назначения. Перечень меток в CSV закрыт этой грамматикой; метка вне грамматики — дефект валидации.

Канонические SQL-шаблоны предикатов (миграция генерирует по одному policy на семью × операцию; `app.actor_user_id`/`app.org_id` — transaction-local context):

```sql
-- org_role_project_location_state (базовая семья, SELECT)
create policy p_read on public.<table> for select using (
  organization_id = current_setting('app.org_id')::uuid
  and exists (select 1 from public.memberships m
    where m.organization_id = organization_id and m.user_id = current_setting('app.actor_user_id')::uuid
      and m.status = 'active')
  and public.has_project_scope(current_setting('app.actor_user_id')::uuid, project_id)
  and public.has_location_scope(current_setting('app.actor_user_id')::uuid, location_id)
);

-- ...state (mutation дополнительно проверяет permission action + допустимое состояние объекта)
create policy p_write on public.<table> for update using ( /* тот же membership/scope предикат */ )
  with check (
    public.has_permission(current_setting('app.actor_user_id')::uuid, '<resource>', '<action>')
    and <state_column> = any (public.allowed_target_states('<resource>', '<action>'))
  );

-- valid_share_session_exact_resource (external, append-only decision)
create policy p_external on public.<table> for insert with check (
  public.valid_share_session(current_setting('app.share_session')::uuid, package_version_id, snapshot_hash)
);
```

Полный policy-pack (~120 policy) генерируется по этим шаблонам из `permissions.csv` + `data-access-surface.csv` в задаче P0-A06, а deployment-гейт (§10) построчно доказывает соответствие allowlist.

Object state and entitlement checks live in command handlers and are repeated in guarded database functions/constraints where a bypass would corrupt money, quantity, evidence or package invariants. UI visibility never substitutes for either layer.

## 6. Composite tenant integrity

Every tenant child relation repeats organization and, where applicable, project. Core foreign keys use `(organization_id, project_id, id)` or `(organization_id, id)`, so an existing UUID from another tenant cannot be attached. The reference schema contains normalized links for package quantity/evidence provenance and support-grant projects; authorization-critical UUID arrays are prohibited.

Intentional polymorphic references (`audit_events.object_id`, job/outbox aggregate IDs, legal-hold scope) are not dereferenced directly. Their writers resolve and persist tenant context first; readers use typed domain resolvers. Package provenance is never polymorphic: normalized source rows carry tenant-bound foreign keys plus immutable source hashes.

## 7. Storage boundary

- buckets are private; no public URLs;
- BFF authorizes the declared purpose first (`estimate_import` → contract import authority and `contract_baseline`; `evidence` → evidence-create authority plus scoped work item, stable capture client operation and `evidence_original`), persists that immutable organization/project/purpose/subject/key/type/size/hash/expiry/retention tuple as an `upload_intent`, and only then returns its short-lived signed grant;
- new objects remain quarantined until server-side type/size/malware checks pass;
- original object inherits the intent retention class through a composite FK and is immutable; edit/redaction creates a same-tenant lineage derivative with `evidence_derivative` and no recycled upload intent;
- manifests, generated artifacts and temporary exports cannot become downloadable without complete key/hash/byte-size/MIME/retention metadata; exports also require an expiry;
- download grant is exact-object, short-lived and audited; external share cannot browse bucket paths;
- storage policy negative suite substitutes tenant/project/work/client-operation/intent and encoded path variants.

## 8. Migration and CI enforcement

Each migration that adds or changes a data object must update, in one PR:

- schema/migration and rollback/forward plan;
- `technical/data-access-surface.csv`;
- `technical/data-retention-catalog.csv` with exactly one entry for every SQL table;
- grants and policy-family tests;
- composite tenant key or documented intentional exception;
- retention/data-classification entry;
- API/traceability rows if reachable from product behavior.

CI fails when a tenant table is absent from the access or retention surface, a runtime role has `BYPASSRLS`, `public` is exposed, `anon` receives tenant privileges, a tenant/project relation has only a bare UUID without its composite companion, a view is not `security_invoker`, an object key lacks integrity/retention metadata, or cross-tenant/project/location negative fixtures do not fail. The spec validator additionally requires every project-bound table to have a database-enforced parent relation carrying both `organization_id` and `project_id`.

## 9. Required security tests

For each accessible object/action: unauthenticated; revoked/suspended membership; wrong organization; correct organization/wrong project; correct project/wrong location; wrong role; deny override; stale membership version; wrong object state; entitlement disabled; happy path. Repeat mutation tests through API and direct database policy harness. External tests add token guessing, exact-resource substitution, OTP bypass, expiry, revocation, replay and snapshot-hash mismatch. Worker tests add forged payload tenant, wrong stored resource, stale lease, duplicate attempt and replay after success.

## 10. Deployment gate

Reference `technical/schema.sql` is not applied directly. It is converted to ordered migrations. Before first live Pilot, a generated grant/policy report must prove that every row of the access allowlist is implemented and no extra effective privilege exists. Until that evidence is attached, tenant database admission remains a `PILOT-BLOCKER`.
