-- Deal-level attribution + misc ledger (Sales Ops)

create table if not exists public.sales_attribution_events (
  id uuid primary key default gen_random_uuid(),
  closed_project_id uuid not null references public.projects (id) on delete cascade,
  close_year int not null check (close_year between 2000 and 2100),
  close_month int not null check (close_month between 1 and 12),

  deals_won int not null default 1 check (deals_won >= 0),
  sqft_won int not null default 0 check (sqft_won >= 0),

  source_kind text not null check (source_kind in ('campaign','project','unknown')),
  source_campaign text,
  source_project_id uuid references public.projects (id) on delete set null,

  bucket text not null check (bucket in ('transfer','misc')),
  notes text,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_attr_events_closed_month
on public.sales_attribution_events (closed_project_id, close_year, close_month);

create index if not exists idx_sales_attr_events_bucket
on public.sales_attribution_events (bucket);

drop trigger if exists set_sales_attribution_events_updated_at on public.sales_attribution_events;
create trigger set_sales_attribution_events_updated_at
before update on public.sales_attribution_events
for each row execute function public.set_updated_at();

alter table public.sales_attribution_events enable row level security;

drop policy if exists sales_attr_events_select on public.sales_attribution_events;
create policy sales_attr_events_select
on public.sales_attribution_events
for select
to authenticated
using (true);

drop policy if exists sales_attr_events_write_sales_ops_or_cmo on public.sales_attribution_events;
create policy sales_attr_events_write_sales_ops_or_cmo
on public.sales_attribution_events
for all
to authenticated
using (public.current_user_role() in ('cmo','sales_ops'))
with check (public.current_user_role() in ('cmo','sales_ops'));


