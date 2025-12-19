-- Add CMO-configurable funnel rates (per project/month)

alter table public.project_targets
  add column if not exists qualified_to_meeting_done_percent numeric not null default 10;

alter table public.project_targets
  add column if not exists meeting_done_to_close_percent numeric not null default 40;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_project_targets_rates_range') then
    alter table public.project_targets
      add constraint chk_project_targets_rates_range
      check (
        qualified_to_meeting_done_percent >= 0 and qualified_to_meeting_done_percent <= 100
        and meeting_done_to_close_percent >= 0 and meeting_done_to_close_percent <= 100
      );
  end if;
end $$;
