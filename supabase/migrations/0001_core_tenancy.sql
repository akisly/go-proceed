-- Core tenancy tables: organizations, legal_entities, memberships.
-- Column definitions copied verbatim from technical/schema.sql (lines 10-60).

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  edrpou text,
  base_currency char(3) not null default 'UAH',
  timezone text not null default 'Europe/Kyiv',
  status text not null default 'trial' check (status in ('trial','active','suspended','closing','closed')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_name text not null,
  registration_code text,
  vat_number text,
  country_code char(2) not null default 'UA',
  billing_email text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','commercial_manager','pto_manager','project_manager','foreman','field_worker','internal_reviewer','estimator','accountant','viewer','integration_admin','security_admin')),
  status text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
  all_projects boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, user_id, id)
);
