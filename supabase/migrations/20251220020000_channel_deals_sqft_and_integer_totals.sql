-- Channel-wise deals & sqft (integers) + computed master totals

-- 1) Channel table: add deals_won + sqft_won (integers)
alter table public.project_actuals_channels
  add column if not exists deals_won int not null default 0,
  add column if not exists sqft_won int not null default 0;

-- 2) Master table: sqft_won must be integer (no decimals)
alter table public.project_actuals
  alter column sqft_won type int using round(sqft_won)::int;

-- 3) Sync totals into project_actuals (including deals_won + sqft_won)
create or replace function public.sync_project_actuals_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_year int;
  v_month int;
  s_leads int;
  s_qualified int;
  s_meetings_sched int;
  s_meetings_done int;
  s_deals int;
  s_sqft int;
begin
  v_project_id := coalesce(new.project_id, old.project_id);
  v_year := coalesce(new.year, old.year);
  v_month := coalesce(new.month, old.month);

  select
    coalesce(sum(c.leads), 0),
    coalesce(sum(c.qualified_leads), 0),
    coalesce(sum(c.meetings_scheduled), 0),
    coalesce(sum(c.meetings_done), 0),
    coalesce(sum(c.deals_won), 0),
    coalesce(sum(c.sqft_won), 0)
  into s_leads, s_qualified, s_meetings_sched, s_meetings_done, s_deals, s_sqft
  from public.project_actuals_channels c
  where c.project_id = v_project_id and c.year = v_year and c.month = v_month;

  insert into public.project_actuals (
    project_id, year, month,
    leads, qualified_leads, meetings_scheduled, meetings_done,
    deals_won, sqft_won,
    updated_by, updated_at
  )
  values (
    v_project_id, v_year, v_month,
    s_leads, s_qualified, s_meetings_sched, s_meetings_done,
    s_deals, s_sqft,
    auth.uid(), now()
  )
  on conflict (project_id, year, month) do update
    set leads = excluded.leads,
        qualified_leads = excluded.qualified_leads,
        meetings_scheduled = excluded.meetings_scheduled,
        meetings_done = excluded.meetings_done,
        deals_won = excluded.deals_won,
        sqft_won = excluded.sqft_won,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return null;
end;
$$;

