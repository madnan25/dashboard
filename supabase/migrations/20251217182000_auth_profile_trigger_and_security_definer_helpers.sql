-- Auth profile bootstrap + SECURITY DEFINER helpers (required for RLS-heavy setups)

begin;

-- Make role/assignment helpers SECURITY DEFINER so policies/triggers don't deadlock on RLS.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.project_assignments a
    where a.project_id = p_project_id
      and a.user_id = auth.uid()
  )
$$;

-- Auto-create a profile row for every new Supabase Auth user.
-- Default role is brand_manager; you can promote specific users to cmo/sales_ops via SQL.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'brand_manager', coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;

