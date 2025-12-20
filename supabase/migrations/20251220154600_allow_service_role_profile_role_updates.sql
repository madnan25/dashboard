-- Allow server-side service_role operations to update profiles.role
-- while still preventing normal users from changing roles.

create or replace function public.guard_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
begin
  -- Service role bypass (used by server-side admin operations)
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- CMO can change roles
  if public.current_user_role() = 'cmo' then
    return new;
  end if;

  -- Everyone else: role is immutable
  if new.role is distinct from old.role then
    raise exception 'Only CMO can change user roles';
  end if;

  return new;
end;
$$;

