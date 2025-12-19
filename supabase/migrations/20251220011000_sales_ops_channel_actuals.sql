-- Sales Ops channel-wise actuals
-- Sales Ops enters leads funnel metrics per channel; totals are derived.

create table if not exists public.project_actuals_channels (
  project_id uuid not null references public.projects (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  channel public.plan_channel not null,

  leads int not null default 0,
  qualified_leads int not null default 0,
  meetings_scheduled int not null default 0,
  meetings_done int not null default 0,

  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (project_id, year, month, channel)
);

drop trigger if exists set_project_actuals_channels_updated_at on public.project_actuals_channels;
create trigger set_project_actuals_channels_updated_at
before update on public.project_actuals_channels
for each row execute function public.set_updated_at();

alter table public.project_actuals_channels enable row level security;

drop policy if exists actuals_channels_select on public.project_actuals_channels;
create policy actuals_channels_select
on public.project_actuals_channels
for select
to authenticated
using (true);

drop policy if exists actuals_channels_write_sales_ops_or_cmo on public.project_actuals_channels;
create policy actuals_channels_write_sales_ops_or_cmo
on public.project_actuals_channels
for all
to authenticated
using (public.current_user_role() in ('cmo','sales_ops'))
with check (public.current_user_role() in ('cmo','sales_ops'));

-- Sync totals into project_actuals (do not touch spend or deal/sqft totals).
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
begin
  v_project_id := coalesce(new.project_id, old.project_id);
  v_year := coalesce(new.year, old.year);
  v_month := coalesce(new.month, old.month);

  select
    coalesce(sum(c.leads), 0),
    coalesce(sum(c.qualified_leads), 0),
    coalesce(sum(c.meetings_scheduled), 0),
    coalesce(sum(c.meetings_done), 0)
  into s_leads, s_qualified, s_meetings_sched, s_meetings_done
  from public.project_actuals_channels c
  where c.project_id = v_project_id and c.year = v_year and c.month = v_month;

  insert into public.project_actuals (
    project_id, year, month,
    leads, qualified_leads, meetings_scheduled, meetings_done,
    updated_by, updated_at
  )
  values (
    v_project_id, v_year, v_month,
    s_leads, s_qualified, s_meetings_sched, s_meetings_done,
    auth.uid(), now()
  )
  on conflict (project_id, year, month) do update
    set leads = excluded.leads,
        qualified_leads = excluded.qualified_leads,
        meetings_scheduled = excluded.meetings_scheduled,
        meetings_done = excluded.meetings_done,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return null;
end;
$$;

drop trigger if exists trg_sync_project_actuals_totals on public.project_actuals_channels;
create trigger trg_sync_project_actuals_totals
after insert or update or delete on public.project_actuals_channels
for each row execute function public.sync_project_actuals_totals();

