-- Allow Brand Managers to write spend (actual) only.
-- Sales Ops continue to own actual funnel metrics.

-- 1) Expand actuals write policy to include brand_manager
drop policy if exists actuals_write_sales_ops_or_cmo on public.project_actuals;
create policy actuals_write_sales_ops_or_cmo
on public.project_actuals
for all
to authenticated
using (public.current_user_role() in ('cmo','sales_ops','brand_manager'))
with check (public.current_user_role() in ('cmo','sales_ops','brand_manager'));

-- 2) Guard trigger: brand_manager can only touch spend columns
create or replace function public.guard_project_actuals_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
begin
  role := public.current_user_role();

  if role = 'cmo' then
    return new;
  end if;

  if role = 'sales_ops' then
    return new;
  end if;

  if role <> 'brand_manager' then
    raise exception 'Only CMO, Sales Ops, or Brand Managers can write actuals';
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

drop trigger if exists trg_guard_project_actuals_write on public.project_actuals;
create trigger trg_guard_project_actuals_write
before insert or update on public.project_actuals
for each row execute function public.guard_project_actuals_write();

