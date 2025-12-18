-- Allow users to update their own profile full_name (but not role)

-- RLS policy: allow update on own row
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Guard: prevent non-CMO users from changing role
create or replace function public.guard_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'cmo' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only CMO can change user roles';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_updates on public.profiles;
create trigger trg_guard_profile_updates
before update on public.profiles
for each row execute function public.guard_profile_updates();

