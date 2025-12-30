-- Add transfer-out rollups for visibility (derived from sales_attribution_events)

alter table public.project_actuals
  add column if not exists deals_won_transfer_out int not null default 0,
  add column if not exists sqft_won_transfer_out int not null default 0;

-- Extend adjustments sync to also maintain transfer-out totals for source project/month.
create or replace function public.sync_project_actuals_adjustments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed_project_id uuid;
  v_source_project_id uuid;
  v_year int;
  v_month int;

  s_transfer_in_deals int;
  s_transfer_in_sqft int;
  s_misc_deals int;
  s_misc_sqft int;

  s_transfer_out_deals int;
  s_transfer_out_sqft int;

  src_project uuid;
begin
  v_closed_project_id := coalesce(new.closed_project_id, old.closed_project_id);
  v_year := coalesce(new.close_year, old.close_year);
  v_month := coalesce(new.close_month, old.close_month);

  -- Recompute IN + misc for the closed project
  select
    coalesce(sum(case when e.bucket = 'transfer' then e.deals_won else 0 end), 0),
    coalesce(sum(case when e.bucket = 'transfer' then e.sqft_won else 0 end), 0),
    coalesce(sum(case when e.bucket = 'misc' then e.deals_won else 0 end), 0),
    coalesce(sum(case when e.bucket = 'misc' then e.sqft_won else 0 end), 0)
  into s_transfer_in_deals, s_transfer_in_sqft, s_misc_deals, s_misc_sqft
  from public.sales_attribution_events e
  where e.closed_project_id = v_closed_project_id
    and e.close_year = v_year
    and e.close_month = v_month;

  insert into public.project_actuals (
    project_id, year, month,
    deals_won_transfer_in, sqft_won_transfer_in,
    deals_won_misc, sqft_won_misc,
    updated_by, updated_at
  )
  values (
    v_closed_project_id, v_year, v_month,
    s_transfer_in_deals, s_transfer_in_sqft,
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

  -- Maintain OUT totals for the affected source project(s) (new + old)
  for src_project in
    select distinct sp from (
      select new.source_project_id as sp
      union
      select old.source_project_id as sp
    ) x
    where sp is not null
  loop
    v_source_project_id := src_project;

    select
      coalesce(sum(e.deals_won), 0),
      coalesce(sum(e.sqft_won), 0)
    into s_transfer_out_deals, s_transfer_out_sqft
    from public.sales_attribution_events e
    where e.bucket = 'transfer'
      and e.source_project_id = v_source_project_id
      and e.close_year = v_year
      and e.close_month = v_month;

    insert into public.project_actuals (
      project_id, year, month,
      deals_won_transfer_out, sqft_won_transfer_out,
      updated_by, updated_at
    )
    values (
      v_source_project_id, v_year, v_month,
      s_transfer_out_deals, s_transfer_out_sqft,
      auth.uid(), now()
    )
    on conflict (project_id, year, month) do update
      set deals_won_transfer_out = excluded.deals_won_transfer_out,
          sqft_won_transfer_out = excluded.sqft_won_transfer_out,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end loop;

  return null;
end;
$$;


