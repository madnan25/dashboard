-- Dashboard schema v1
-- Roles: cmo (admin), brand_manager, sales_ops
-- Tenancy: single-org (no org_id); can be extended later.

-- Extensions
create extension if not exists pgcrypto;

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('cmo','brand_manager','sales_ops')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: role lookup based on auth.uid()
-- (Overridden later by a SECURITY DEFINER version, but this keeps dependencies simple.)
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- Assign brand managers to projects (future-proofing)
create table if not exists public.project_assignments (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- CMO targets + budget cap per project/month
create table if not exists public.project_targets (
  project_id uuid not null references public.projects (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  sales_target_sqft numeric not null default 0,
  avg_sqft_per_deal numeric not null default 0,
  total_budget numeric not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, year, month)
);

drop trigger if exists set_project_targets_updated_at on public.project_targets;
create trigger set_project_targets_updated_at
before update on public.project_targets
for each row execute function public.set_updated_at();

-- Brand plan versioning + approvals
create type public.plan_status as enum ('draft','submitted','approved','rejected');

create table if not exists public.project_plan_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),

  created_by uuid not null references public.profiles (id),
  status public.plan_status not null default 'draft',

  approved_by uuid references public.profiles (id),
  approved_at timestamptz,

  active boolean not null default false,
  supersedes_version_id uuid references public.project_plan_versions (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_versions_project_month on public.project_plan_versions (project_id, year, month);
create index if not exists idx_plan_versions_created_by on public.project_plan_versions (created_by);

drop trigger if exists set_project_plan_versions_updated_at on public.project_plan_versions;
create trigger set_project_plan_versions_updated_at
before update on public.project_plan_versions
for each row execute function public.set_updated_at();

-- Channel inputs per plan version
create type public.plan_channel as enum ('digital','activations','inbound');

create table if not exists public.project_plan_channel_inputs (
  plan_version_id uuid not null references public.project_plan_versions (id) on delete cascade,
  channel public.plan_channel not null,
  expected_leads int not null default 0,
  qualification_percent numeric not null default 0, -- 0-100
  target_contribution_percent numeric not null default 0, -- 0-100
  allocated_budget numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_version_id, channel)
);

drop trigger if exists set_project_plan_channel_inputs_updated_at on public.project_plan_channel_inputs;
create trigger set_project_plan_channel_inputs_updated_at
before update on public.project_plan_channel_inputs
for each row execute function public.set_updated_at();

-- Enforce budget cap: sum(channel allocated_budget) <= project_targets.total_budget
create or replace function public.enforce_plan_budget_cap()
returns trigger
language plpgsql
as $$
declare
  v_project_id uuid;
  v_year int;
  v_month int;
  v_total_alloc numeric;
  v_budget_cap numeric;
begin
  select pv.project_id, pv.year, pv.month
    into v_project_id, v_year, v_month
  from public.project_plan_versions pv
  where pv.id = new.plan_version_id;

  select coalesce(sum(ci.allocated_budget), 0)
    into v_total_alloc
  from public.project_plan_channel_inputs ci
  where ci.plan_version_id = new.plan_version_id;

  select coalesce(t.total_budget, 0)
    into v_budget_cap
  from public.project_targets t
  where t.project_id = v_project_id and t.year = v_year and t.month = v_month;

  if v_total_alloc > v_budget_cap then
    raise exception 'Allocated budget (%) exceeds cap (%) for project/month', v_total_alloc, v_budget_cap;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_plan_budget_cap on public.project_plan_channel_inputs;
create trigger trg_enforce_plan_budget_cap
after insert or update on public.project_plan_channel_inputs
for each row execute function public.enforce_plan_budget_cap();

-- Sales ops actuals per project/month
create table if not exists public.project_actuals (
  project_id uuid not null references public.projects (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  leads int not null default 0,
  qualified_leads int not null default 0,
  meetings_scheduled int not null default 0,
  meetings_done int not null default 0,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (project_id, year, month)
);

drop trigger if exists set_project_actuals_updated_at on public.project_actuals;
create trigger set_project_actuals_updated_at
before update on public.project_actuals
for each row execute function public.set_updated_at();