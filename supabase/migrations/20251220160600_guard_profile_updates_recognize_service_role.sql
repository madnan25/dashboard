-- Fix: guard_profile_updates should recognize service_role reliably.
-- Using auth.jwt() is more robust than relying only on request GUCs.

create or replace function public.guard_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  jwt_role text := coalesce(jwt ->> 'role', nullif(current_setting('request.jwt.claim.role', true), ''), '');
begin
  -- Service role bypass (server-side admin operations)
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


