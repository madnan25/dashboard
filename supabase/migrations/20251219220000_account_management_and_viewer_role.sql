-- Account management + viewer role
-- - Store email in profiles for CMO user list
-- - Add 'viewer' to allowed roles
-- - Allow viewer read access to project stats (plans + channel inputs)
-- - Populate profiles.email for new + existing users

-- 1) profiles.email
alter table public.profiles
  add column if not exists email text;

-- unique-ish constraint via partial unique index (allows nulls)
create unique index if not exists profiles_email_unique
  on public.profiles (email)
  where email is not null;

-- Backfill email from auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email is distinct from u.email);

-- 2) Add viewer role to constraint
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('cmo','brand_manager','sales_ops','viewer'));

-- 3) Ensure new users capture email in profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'brand_manager',
    coalesce(new.raw_user_meta_data->>'full_name', null),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email
  ;
  return new;
end;
$$;

-- 4) Viewer read access for plan versions + channel inputs (stats only)
drop policy if exists plan_versions_select on public.project_plan_versions;
create policy plan_versions_select
on public.project_plan_versions
for select
to authenticated
using (
  public.current_user_role() = 'cmo'
  or public.current_user_role() = 'viewer'
  or created_by = auth.uid()
  or (public.current_user_role() = 'brand_manager' and public.is_assigned_to_project(project_id))
);

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
        or public.current_user_role() = 'viewer'
        or pv.created_by = auth.uid()
        or (public.current_user_role() = 'brand_manager' and public.is_assigned_to_project(pv.project_id))
        or public.current_user_role() = 'sales_ops'
      )
  )
);

