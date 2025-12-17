-- RLS policies + workflow guards

begin;

-- Helper: is user assigned to a project as brand manager?
create or replace function public.is_assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.project_assignments a
    where a.project_id = p_project_id
      and a.user_id = auth.uid()
  )
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
alter table public.project_targets enable row level security;
alter table public.project_plan_versions enable row level security;
alter table public.project_plan_channel_inputs enable row level security;
alter table public.project_actuals enable row level security;

-- PROFILES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.current_user_role() = 'cmo');

drop policy if exists profiles_update_cmo_only on public.profiles;
create policy profiles_update_cmo_only
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'cmo')
with check (public.current_user_role() = 'cmo');

-- PROJECTS
drop policy if exists projects_select on public.projects;
create policy projects_select
on public.projects
for select
to authenticated
using (true);

drop policy if exists projects_cmo_write on public.projects;
create policy projects_cmo_write
on public.projects
for all
to authenticated
using (public.current_user_role() = 'cmo')
with check (public.current_user_role() = 'cmo');

-- PROJECT ASSIGNMENTS
drop policy if exists assignments_select on public.project_assignments;
create policy assignments_select
on public.project_assignments
for select
to authenticated
using (public.current_user_role() = 'cmo' or user_id = auth.uid());

drop policy if exists assignments_cmo_write on public.project_assignments;
create policy assignments_cmo_write
on public.project_assignments
for all
to authenticated
using (public.current_user_role() = 'cmo')
with check (public.current_user_role() = 'cmo');

-- TARGETS
drop policy if exists targets_select on public.project_targets;
create policy targets_select
on public.project_targets
for select
to authenticated
using (true);

drop policy if exists targets_cmo_write on public.project_targets;
create policy targets_cmo_write
on public.project_targets
for all
to authenticated
using (public.current_user_role() = 'cmo')
with check (public.current_user_role() = 'cmo');

-- PLAN VERSIONS
drop policy if exists plan_versions_select on public.project_plan_versions;
create policy plan_versions_select
on public.project_plan_versions
for select
to authenticated
using (
  public.current_user_role() = 'cmo'
  or created_by = auth.uid()
  or (public.current_user_role() = 'brand_manager' and public.is_assigned_to_project(project_id))
);

drop policy if exists plan_versions_insert_brand_manager on public.project_plan_versions;
create policy plan_versions_insert_brand_manager
on public.project_plan_versions
for insert
to authenticated
with check (
  (public.current_user_role() = 'brand_manager' and created_by = auth.uid() and public.is_assigned_to_project(project_id))
  or public.current_user_role() = 'cmo'
);

drop policy if exists plan_versions_update_brand_manager_or_cmo on public.project_plan_versions;
create policy plan_versions_update_brand_manager_or_cmo
on public.project_plan_versions
for update
to authenticated
using (
  public.current_user_role() = 'cmo'
  or (public.current_user_role() = 'brand_manager' and created_by = auth.uid())
)
with check (
  public.current_user_role() = 'cmo'
  or (public.current_user_role() = 'brand_manager' and created_by = auth.uid())
);

drop policy if exists plan_versions_delete_cmo_only on public.project_plan_versions;
create policy plan_versions_delete_cmo_only
on public.project_plan_versions
for delete
to authenticated
using (public.current_user_role() = 'cmo');

-- PLAN CHANNEL INPUTS
drop policy if exists plan_channel_select on public.project_plan_channel_inputs;
create policy plan_channel_select
on public.project_plan_channel_inputs
for select
to authenticated
using (
  exists (
    select 1
    from public.project_plan_versions pv
    where pv.id = plan_version_id
      and (
        public.current_user_role() = 'cmo'
        or pv.created_by = auth.uid()
        or (public.current_user_role() = 'brand_manager' and public.is_assigned_to_project(pv.project_id))
        or public.current_user_role() = 'sales_ops'
      )
  )
);

drop policy if exists plan_channel_write_brand_or_cmo on public.project_plan_channel_inputs;
create policy plan_channel_write_brand_or_cmo
on public.project_plan_channel_inputs
for all
to authenticated
using (
  public.current_user_role() = 'cmo'
  or exists (
    select 1
    from public.project_plan_versions pv
    where pv.id = plan_version_id
      and pv.created_by = auth.uid()
      and public.current_user_role() = 'brand_manager'
  )
)
with check (
  public.current_user_role() = 'cmo'
  or exists (
    select 1
    from public.project_plan_versions pv
    where pv.id = plan_version_id
      and pv.created_by = auth.uid()
      and public.current_user_role() = 'brand_manager'
  )
);

-- ACTUALS (Sales Ops-owned)
drop policy if exists actuals_select on public.project_actuals;
create policy actuals_select
on public.project_actuals
for select
to authenticated
using (true);

drop policy if exists actuals_write_sales_ops_or_cmo on public.project_actuals;
create policy actuals_write_sales_ops_or_cmo
on public.project_actuals
for all
to authenticated
using (public.current_user_role() in ('cmo','sales_ops'))
with check (public.current_user_role() in ('cmo','sales_ops'));

-- Workflow guards: prevent brand managers from approving/activating, and lock edits after submit.
create or replace function public.guard_plan_version_updates()
returns trigger
language plpgsql
as $$
declare
  role text;
begin
  role := public.current_user_role();

  if role = 'cmo' then
    return new;
  end if;

  if role <> 'brand_manager' then
    raise exception 'Only CMO or Brand Managers can modify plan versions';
  end if;

  if old.created_by <> auth.uid() then
    raise exception 'Brand managers can only modify their own plan versions';
  end if;

  -- Brand managers cannot approve/activate or set approval metadata.
  if new.status = 'approved' then
    raise exception 'Brand managers cannot approve plans';
  end if;
  if new.active <> old.active then
    raise exception 'Brand managers cannot change active version';
  end if;
  if new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then
    raise exception 'Brand managers cannot set approval metadata';
  end if;

  -- Once submitted, the row is locked (they should create a new version instead).
  if old.status = 'submitted' then
    raise exception 'Submitted plan versions are locked until approved/rejected';
  end if;

  -- Approved versions are immutable.
  if old.status = 'approved' then
    raise exception 'Approved plan versions are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_plan_version_updates on public.project_plan_versions;
create trigger trg_guard_plan_version_updates
before update on public.project_plan_versions
for each row execute function public.guard_plan_version_updates();

create or replace function public.guard_plan_channel_inputs_write()
returns trigger
language plpgsql
as $$
declare
  role text;
  v_status public.plan_status;
  v_created_by uuid;
begin
  role := public.current_user_role();

  select pv.status, pv.created_by
    into v_status, v_created_by
  from public.project_plan_versions pv
  where pv.id = new.plan_version_id;

  if role = 'cmo' then
    return new;
  end if;

  if role <> 'brand_manager' then
    raise exception 'Only CMO or Brand Managers can modify plan inputs';
  end if;

  if v_created_by <> auth.uid() then
    raise exception 'Brand managers can only modify their own plan version inputs';
  end if;

  if v_status = 'submitted' then
    raise exception 'Submitted plan versions are locked';
  end if;

  if v_status = 'approved' then
    raise exception 'Approved plan versions are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_plan_channel_inputs_write on public.project_plan_channel_inputs;
create trigger trg_guard_plan_channel_inputs_write
before insert or update on public.project_plan_channel_inputs
for each row execute function public.guard_plan_channel_inputs_write();

commit;

