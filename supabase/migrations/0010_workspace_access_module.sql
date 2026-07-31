-- 0010: workspace-access module (v0.1-M1). Additive: no baseline object is
-- renamed or dropped. The tenant root REMAINS public.organizations; every new
-- table's tenant column is named workspace_id and references organizations(id)
-- (plan decision 1 in docs/superpowers/plans/2026-07-30-goproceed-v0.1-m1-contract-baseline.md).
--
-- Rollback (dev only): drop the nine new tables in reverse order; drop
-- organizations.locale / organizations.default_own_party_id; restore the 0001
-- memberships role/status checks and default. Forward fix (staging/prod): new
-- migration; never edit this one after deploy.

-- ── memberships hardening (ADR-002 four governance roles) ────────────────────
-- Guard: abort if any environment holds a row the canonical sets would break.
do $$ begin
  if exists (select 1 from public.memberships
              where role not in ('owner','admin','member','auditor')) then
    raise exception 'memberships contains non-canonical role values; manual review required';
  end if;
  if exists (select 1 from public.memberships
              where status not in ('active','suspended')) then
    raise exception 'memberships contains non-canonical status values; manual review required';
  end if;
end $$;

alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check
  check (role in ('owner','admin','member','auditor'));
alter table public.memberships drop constraint memberships_status_check;
alter table public.memberships add constraint memberships_status_check
  check (status in ('active','suspended','ended'));
alter table public.memberships alter column status set default 'active';
-- Tenant-safe FK target for member-bound rows (grants, responsibilities).
alter table public.memberships add constraint memberships_org_id_unique
  unique (organization_id, id);

-- ── workspace product columns (additive; legal authority NOT added) ──────────
alter table public.organizations
  add column if not exists locale text not null default 'uk-UA',
  add column if not exists default_own_party_id uuid;

-- ── invitations ──────────────────────────────────────────────────────────────
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('admin','member','auditor')),
  -- sha256 hex of the one-time token; plaintext never enters the database.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  accepted_membership_id uuid,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (token_hash),
  foreign key (workspace_id, accepted_membership_id)
    references public.memberships (organization_id, id)
);
create unique index invitations_pending_email_unique
  on public.invitations (workspace_id, lower(email)) where status = 'pending';
create index invitations_ws_status_idx
  on public.invitations (workspace_id, status, expires_at);

-- ── parties (tenant-local; no global registry — ADR-002) ─────────────────────
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  display_name text not null check (length(btrim(display_name)) > 0),
  party_kind text not null default 'organization'
    check (party_kind in ('organization','individual')),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index parties_ws_name_idx on public.parties (workspace_id, display_name);

-- Circular by design: organizations.default_own_party_id → parties (nullable).
alter table public.organizations add constraint organizations_default_own_party_fk
  foreign key (id, default_own_party_id) references public.parties (workspace_id, id);

create table public.party_legal_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  party_id uuid not null,
  official_name text not null check (length(btrim(official_name)) > 0),
  -- ЄДРПОУ (8 digits) or РНОКПП (10 digits); nullable while a draft profile.
  edrpou text check (edrpou ~ '^[0-9]{8}$' or edrpou ~ '^[0-9]{10}$'),
  vat_number text,
  tax_status text,
  legal_address text,
  country_code char(2) not null default 'UA',
  version bigint not null default 1,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, party_id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);

-- Marks the workspace's own legal entities (stricter permission, INV-020).
create table public.own_legal_entity_profiles (
  workspace_id uuid not null references public.organizations(id),
  party_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (workspace_id, party_id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id),
  -- An own profile requires an existing legal profile row (completeness of
  -- official_name/edrpou is validated by the command; the FK is defense in depth).
  foreign key (workspace_id, party_id)
    references public.party_legal_profiles (workspace_id, party_id)
);

create table public.party_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  party_id uuid not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  role_title text,
  email text,
  phone text,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);
create index party_contacts_party_idx on public.party_contacts (workspace_id, party_id);

-- ── projects ─────────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) > 0),
  code text,
  address text,
  description text,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

-- Business relationship of a party to a project; NEVER grants access (ADR-002).
create table public.project_parties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  party_id uuid not null,
  relationship text not null check (relationship in
    ('customer','general_contractor','subcontractor','technical_supervision',
     'designer','performer','other')),
  note text,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, project_id, party_id, relationship),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);

-- Explicit, time-bounded, revocable member visibility/action grant (tenancy doc).
create table public.project_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  member_id uuid not null,
  capability text not null check (capability in
    ('project.admin','project.view','contracts.edit','imports.manage','imports.publish')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz check (valid_until is null or valid_until > valid_from),
  revoked_at timestamptz,
  granted_by uuid not null references auth.users(id),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, member_id) references public.memberships (organization_id, id)
);
create unique index project_access_active_unique
  on public.project_access_grants (workspace_id, project_id, member_id, capability)
  where revoked_at is null;
create index project_access_actor_idx
  on public.project_access_grants (workspace_id, member_id, project_id, valid_until);

-- Append-only operational accountability fact; never an access grant.
create table public.project_responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  member_id uuid not null,
  responsibility text not null check (responsibility in
    ('performer','progress_recorder','evidence_recorder','evidence_custodian',
     'requirement_owner','package_compiler','internal_verifier','package_submitter',
     'acceptance_liaison','commercial_observer')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz check (valid_until is null or valid_until > valid_from),
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, member_id) references public.memberships (organization_id, id)
);
create index project_responsibility_member_idx
  on public.project_responsibility_assignments (workspace_id, member_id, project_id, responsibility);
