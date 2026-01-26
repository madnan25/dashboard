-- Intelligence Desk cached summaries
create table if not exists public.intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null default 'manual',
  summary text not null,
  range_start date,
  range_end date,
  model text,
  token_usage jsonb,
  created_at timestamptz not null default now()
);

alter table public.intelligence_reports enable row level security;

create policy "intelligence_reports_cmo_read"
  on public.intelligence_reports
  for select
  using (public.current_user_role() = 'cmo');

create policy "intelligence_reports_cmo_insert"
  on public.intelligence_reports
  for insert
  with check (public.current_user_role() = 'cmo');

create policy "intelligence_reports_cmo_update"
  on public.intelligence_reports
  for update
  using (public.current_user_role() = 'cmo')
  with check (public.current_user_role() = 'cmo');
