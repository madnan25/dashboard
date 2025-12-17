-- Rejected plan retention: delete rejected plan versions after 7 days

alter table public.project_plan_versions
  add column if not exists rejected_at timestamptz;

-- Backfill for any existing rejected rows where we previously reused approved_at.
update public.project_plan_versions
set rejected_at = coalesce(rejected_at, approved_at, updated_at)
where status = 'rejected' and rejected_at is null;

create or replace function public.purge_rejected_plan_versions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_plan_versions
  where status = 'rejected'
    and rejected_at is not null
    and rejected_at < now() - interval '7 days';
end;
$$;

-- Try to schedule daily cleanup via pg_cron if available (Supabase supports this on most tiers).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Idempotent schedule: unschedule existing job (if present), then add.
    declare v_jobid int;
    begin
      select jobid into v_jobid from cron.job where jobname = 'purge_rejected_plan_versions_daily' limit 1;
      if v_jobid is not null then
        perform cron.unschedule(v_jobid);
      end if;
    exception when others then
      -- ignore if cron schema differs / not accessible
    end;

    perform cron.schedule(
      'purge_rejected_plan_versions_daily',
      '0 3 * * *',
      $cmd$select public.purge_rejected_plan_versions();$cmd$
    );
  end if;
end $$;

