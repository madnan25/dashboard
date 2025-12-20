-- Allow Sales Ops to write to project_actuals via the channel totals sync trigger.
-- Direct writes by Sales Ops to project_actuals remain blocked.

create or replace function public.guard_project_actuals_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text := public.current_user_role();
  jwt jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  jwt_role text := coalesce(jwt ->> 'role', nullif(current_setting('request.jwt.claim.role', true), ''), '');
begin
  -- Service role bypass (server-side admin operations)
  if jwt_role = 'service_role' then
    return new;
  end if;

  if role = 'cmo' then
    return new;
  end if;

  -- Sales Ops: allow ONLY when invoked from another trigger (channel->totals sync)
  if role = 'sales_ops' then
    if pg_trigger_depth() > 1 then
      return new;
    end if;
    raise exception 'Sales Ops must write actuals via project_actuals_channels';
  end if;

  if role <> 'brand_manager' then
    raise exception 'Only CMO or Brand Managers can write project actuals';
  end if;

  -- brand_manager: spend-only
  if tg_op = 'INSERT' then
    if coalesce(new.leads, 0) <> 0
      or coalesce(new.qualified_leads, 0) <> 0
      or coalesce(new.meetings_scheduled, 0) <> 0
      or coalesce(new.meetings_done, 0) <> 0
      or coalesce(new.deals_won, 0) <> 0
      or coalesce(new.sqft_won, 0) <> 0
    then
      raise exception 'Brand Managers can only set spend fields';
    end if;
    return new;
  end if;

  -- UPDATE: disallow changes to non-spend columns and PK
  if new.project_id is distinct from old.project_id
    or new.year is distinct from old.year
    or new.month is distinct from old.month
  then
    raise exception 'Cannot change actuals identity fields';
  end if;

  if new.leads is distinct from old.leads
    or new.qualified_leads is distinct from old.qualified_leads
    or new.meetings_scheduled is distinct from old.meetings_scheduled
    or new.meetings_done is distinct from old.meetings_done
    or new.deals_won is distinct from old.deals_won
    or new.sqft_won is distinct from old.sqft_won
  then
    raise exception 'Brand Managers can only update spend fields';
  end if;

  return new;
end;
$$;

