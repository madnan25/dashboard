-- Intelligence Desk sync schedule settings (CMO-controlled)
--
-- Stores the desired local time (PKT by default) and re-schedules the existing pg_cron job
-- that calls the `intelligence-cron` edge function.

create table if not exists public.intelligence_sync_settings (
  id int primary key default 1,
  timezone text not null default 'Asia/Karachi',
  sync_time time not null default '12:00',
  jobname text not null default 'intelligence_cron_daily',
  edge_function_url text,
  cron_secret text,
  schedule_utc text,
  updated_at timestamptz not null default now(),
  constraint intelligence_sync_settings_singleton check (id = 1)
);

alter table public.intelligence_sync_settings enable row level security;

-- Keep the table private; access via RPC functions below.
revoke all on table public.intelligence_sync_settings from anon, authenticated;

create or replace function public.get_intelligence_sync_settings()
returns table (
  timezone text,
  sync_time time,
  schedule_utc text,
  jobname text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, cron, net
as $$
begin
  if public.current_user_role() <> 'cmo' then
    raise exception 'CMO only';
  end if;

  insert into public.intelligence_sync_settings (id)
  values (1)
  on conflict (id) do nothing;

  -- Best-effort bootstrap from existing cron job if missing.
  update public.intelligence_sync_settings s
  set
    edge_function_url = coalesce(s.edge_function_url, substring(j.command from 'net\.http_get\(''([^'']+)''')),
    cron_secret = coalesce(s.cron_secret, substring(j.command from E'\\\\\"x-cron-secret\\\\\":\\\\\"([^\\\\\"]+)\\\\\"')),
    schedule_utc = coalesce(s.schedule_utc, j.schedule),
    updated_at = now()
  from cron.job j
  where s.id = 1
    and j.jobname = s.jobname
    and (s.edge_function_url is null or s.cron_secret is null or s.schedule_utc is null);

  return query
  select s.timezone, s.sync_time, s.schedule_utc, s.jobname, s.updated_at
  from public.intelligence_sync_settings s
  where s.id = 1;
end;
$$;

create or replace function public.set_intelligence_sync_time(p_sync_time time, p_timezone text default 'Asia/Karachi')
returns table (
  timezone text,
  sync_time time,
  schedule_utc text,
  jobname text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, cron, net
as $$
declare
  v_jobname text;
  v_jobid int;
  v_url text;
  v_secret text;
  v_schedule text;
  v_local_ts timestamp;
  v_utc_ts timestamptz;
  v_hour int;
  v_min int;
  v_headers jsonb;
  v_command text;
begin
  if public.current_user_role() <> 'cmo' then
    raise exception 'CMO only';
  end if;

  if p_sync_time is null then
    raise exception 'sync_time is required';
  end if;

  -- Keep it simple: PKT by default. (We can extend timezone choices later.)
  if p_timezone is null or p_timezone = '' then
    p_timezone := 'Asia/Karachi';
  end if;
  if p_timezone not in ('Asia/Karachi', 'UTC') then
    raise exception 'Unsupported timezone';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not enabled';
  end if;

  insert into public.intelligence_sync_settings (id)
  values (1)
  on conflict (id) do nothing;

  select jobname, edge_function_url, cron_secret
  into v_jobname, v_url, v_secret
  from public.intelligence_sync_settings
  where id = 1;

  -- Bootstrap from existing cron job if missing.
  if v_url is null or v_secret is null then
    select
      substring(j.command from 'net\.http_get\(''([^'']+)''') as url,
      substring(j.command from E'\\\\\"x-cron-secret\\\\\":\\\\\"([^\\\\\"]+)\\\\\"') as secret
    into v_url, v_secret
    from cron.job j
    where j.jobname = v_jobname
    limit 1;
  end if;

  if v_url is null or v_secret is null then
    raise exception 'Missing cron target configuration (edge function URL / secret)';
  end if;

  -- Convert local time (p_timezone) to a UTC hour/min cron expression for "every day".
  v_local_ts := date_trunc('day', now() at time zone p_timezone) + p_sync_time;
  v_utc_ts := v_local_ts at time zone p_timezone;
  v_hour := extract(hour from (v_utc_ts at time zone 'UTC'));
  v_min := extract(minute from (v_utc_ts at time zone 'UTC'));
  v_schedule := format('%s %s * * *', v_min, v_hour);

  -- Rebuild command using existing target URL + secret header.
  v_headers := jsonb_build_object('x-cron-secret', v_secret);
  v_command := format(
    'select net.http_get(%L, %L::jsonb, %L::jsonb);',
    v_url,
    '{}'::text,
    v_headers::text
  );

  -- Unschedule existing job (if present), then re-schedule with the new cron expression.
  begin
    select jobid into v_jobid from cron.job where jobname = v_jobname limit 1;
    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;
  exception when others then
    -- ignore if cron schema differs / not accessible
  end;

  perform cron.schedule(v_jobname, v_schedule, v_command);

  update public.intelligence_sync_settings
  set
    timezone = p_timezone,
    sync_time = p_sync_time,
    edge_function_url = v_url,
    cron_secret = v_secret,
    schedule_utc = v_schedule,
    updated_at = now()
  where id = 1;

  return query
  select s.timezone, s.sync_time, s.schedule_utc, s.jobname, s.updated_at
  from public.intelligence_sync_settings s
  where s.id = 1;
end;
$$;

-- Allow authenticated users to call these, but the function itself enforces CMO-only.
grant execute on function public.get_intelligence_sync_settings() to authenticated;
grant execute on function public.set_intelligence_sync_time(time, text) to authenticated;

