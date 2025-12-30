-- Add adjustment buckets to project_actuals + sync from sales_attribution_events

alter table public.project_actuals
  add column if not exists deals_won_transfer_in int not null default 0,
  add column if not exists sqft_won_transfer_in int not null default 0,
  add column if not exists deals_won_misc int not null default 0,
  add column if not exists sqft_won_misc int not null default 0;

-- Guard: brand_manager remains spend-only (include new adjustment columns)
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

  -- Sales Ops: allow ONLY when invoked from another trigger
  -- (e.g., channel->totals sync or attribution->adjustments sync)
  if role = 'sales_ops' then
    if pg_trigger_depth() > 1 then
      return new;
    end if;
    raise exception 'Sales Ops must write actuals via project_actuals_channels or sales_attribution_events';
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
      or coalesce(new.deals_won_transfer_in, 0) <> 0
      or coalesce(new.sqft_won_transfer_in, 0) <> 0
      or coalesce(new.deals_won_misc, 0) <> 0
      or coalesce(new.sqft_won_misc, 0) <> 0
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
    or new.deals_won_transfer_in is distinct from old.deals_won_transfer_in
    or new.sqft_won_transfer_in is distinct from old.sqft_won_transfer_in
    or new.deals_won_misc is distinct from old.deals_won_misc
    or new.sqft_won_misc is distinct from old.sqft_won_misc
  then
    raise exception 'Brand Managers can only update spend fields';
  end if;

  return new;
end;
$$;

-- Sync adjustments into project_actuals (do not touch funnel metrics or spend)
create or replace function public.sync_project_actuals_adjustments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_year int;
  v_month int;
  s_transfer_deals int;
  s_transfer_sqft int;
  s_misc_deals int;
  s_misc_sqft int;
begin
  v_project_id := coalesce(new.closed_project_id, old.closed_project_id);
  v_year := coalesce(new.close_year, old.close_year);
  v_month := coalesce(new.close_month, old.close_month);

  select
    coalesce(sum(case when e.bucket = 'transfer' then e.deals_won else 0 end), 0),
    coalesce(sum(case when e.bucket = 'transfer' then e.sqft_won else 0 end), 0),
    coalesce(sum(case when e.bucket = 'misc' then e.deals_won else 0 end), 0),
    coalesce(sum(case when e.bucket = 'misc' then e.sqft_won else 0 end), 0)
  into s_transfer_deals, s_transfer_sqft, s_misc_deals, s_misc_sqft
  from public.sales_attribution_events e
  where e.closed_project_id = v_project_id
    and e.close_year = v_year
    and e.close_month = v_month;

  insert into public.project_actuals (
    project_id, year, month,
    deals_won_transfer_in, sqft_won_transfer_in,
    deals_won_misc, sqft_won_misc,
    updated_by, updated_at
  )
  values (
    v_project_id, v_year, v_month,
    s_transfer_deals, s_transfer_sqft,
    s_misc_deals, s_misc_sqft,
    auth.uid(), now()
  )
  on conflict (project_id, year, month) do update
    set deals_won_transfer_in = excluded.deals_won_transfer_in,
        sqft_won_transfer_in = excluded.sqft_won_transfer_in,
        deals_won_misc = excluded.deals_won_misc,
        sqft_won_misc = excluded.sqft_won_misc,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return null;
end;
$$;

drop trigger if exists trg_sync_project_actuals_adjustments on public.sales_attribution_events;
create trigger trg_sync_project_actuals_adjustments
after insert or update or delete on public.sales_attribution_events
for each row execute function public.sync_project_actuals_adjustments();


