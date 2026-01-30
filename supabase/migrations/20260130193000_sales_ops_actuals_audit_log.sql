-- Sales Ops audit log with 7-day retention

create table if not exists public.sales_ops_actuals_audit (
  id bigserial primary key,
  event_time timestamptz not null default now(),
  action text not null check (action in ('insert','update','delete')),
  table_name text not null,

  project_id uuid,
  year int,
  month int,
  channel text,
  source text,
  bucket text,
  closed_project_id uuid,
  source_project_id uuid,

  actor_id uuid,
  actor_role text,
  actor_email text,
  actor_name text,

  old_row jsonb,
  new_row jsonb
);

create index if not exists idx_sales_ops_audit_event_time
  on public.sales_ops_actuals_audit (event_time desc);

create index if not exists idx_sales_ops_audit_project_month
  on public.sales_ops_actuals_audit (project_id, year, month);

create index if not exists idx_sales_ops_audit_table
  on public.sales_ops_actuals_audit (table_name);

alter table public.sales_ops_actuals_audit enable row level security;

drop policy if exists sales_ops_audit_select on public.sales_ops_actuals_audit;
create policy sales_ops_audit_select
  on public.sales_ops_actuals_audit
  for select
  to authenticated
  using (public.current_user_role() in ('cmo','sales_ops','brand_manager'));

create or replace function public.log_sales_ops_actuals_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(TG_OP);
  v_new jsonb := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;
  v_old jsonb := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;
  v_project_id uuid;
  v_year int;
  v_month int;
  v_channel text;
  v_source text;
  v_bucket text;
  v_closed_project_id uuid;
  v_source_project_id uuid;
  v_actor_id uuid := auth.uid();
  v_actor_role text := coalesce((auth.jwt()->>'role'), nullif(current_setting('request.jwt.claim.role', true), ''), public.current_user_role());
  v_actor_email text := coalesce((auth.jwt()->>'email'), nullif(current_setting('request.jwt.claim.email', true), ''));
  v_actor_name text;
begin
  v_project_id := coalesce(
    (v_new->>'project_id')::uuid,
    (v_old->>'project_id')::uuid,
    (v_new->>'closed_project_id')::uuid,
    (v_old->>'closed_project_id')::uuid,
    (v_new->>'source_project_id')::uuid,
    (v_old->>'source_project_id')::uuid
  );
  v_year := coalesce(
    (v_new->>'year')::int,
    (v_old->>'year')::int,
    (v_new->>'close_year')::int,
    (v_old->>'close_year')::int
  );
  v_month := coalesce(
    (v_new->>'month')::int,
    (v_old->>'month')::int,
    (v_new->>'close_month')::int,
    (v_old->>'close_month')::int
  );
  v_channel := coalesce(v_new->>'channel', v_old->>'channel');
  v_source := coalesce(v_new->>'source', v_old->>'source');
  v_bucket := coalesce(v_new->>'bucket', v_old->>'bucket');
  v_closed_project_id := coalesce(
    (v_new->>'closed_project_id')::uuid,
    (v_old->>'closed_project_id')::uuid
  );
  v_source_project_id := coalesce(
    (v_new->>'source_project_id')::uuid,
    (v_old->>'source_project_id')::uuid
  );

  if v_actor_id is not null then
    select full_name into v_actor_name from public.profiles where id = v_actor_id;
  end if;

  insert into public.sales_ops_actuals_audit (
    action,
    table_name,
    project_id,
    year,
    month,
    channel,
    source,
    bucket,
    closed_project_id,
    source_project_id,
    actor_id,
    actor_role,
    actor_email,
    actor_name,
    old_row,
    new_row
  ) values (
    v_action,
    TG_TABLE_NAME,
    v_project_id,
    v_year,
    v_month,
    v_channel,
    v_source,
    v_bucket,
    v_closed_project_id,
    v_source_project_id,
    v_actor_id,
    v_actor_role,
    v_actor_email,
    v_actor_name,
    v_old,
    v_new
  );

  return null;
end;
$$;

drop trigger if exists trg_log_sales_ops_channels on public.project_actuals_channels;
create trigger trg_log_sales_ops_channels
after insert or update or delete on public.project_actuals_channels
for each row execute function public.log_sales_ops_actuals_audit();

drop trigger if exists trg_log_sales_ops_digital_sources on public.project_actuals_digital_sources;
create trigger trg_log_sales_ops_digital_sources
after insert or update or delete on public.project_actuals_digital_sources
for each row execute function public.log_sales_ops_actuals_audit();

drop trigger if exists trg_log_sales_ops_attribution_events on public.sales_attribution_events;
create trigger trg_log_sales_ops_attribution_events
after insert or update or delete on public.sales_attribution_events
for each row execute function public.log_sales_ops_actuals_audit();

create or replace function public.purge_sales_ops_actuals_audit()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sales_ops_actuals_audit
  where event_time < now() - interval '7 days';
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge_sales_ops_actuals_audit') then
    perform cron.unschedule('purge_sales_ops_actuals_audit');
  end if;
  perform cron.schedule(
    'purge_sales_ops_actuals_audit',
    '0 3 * * *',
    $job$select public.purge_sales_ops_actuals_audit();$job$
  );
end $$;
