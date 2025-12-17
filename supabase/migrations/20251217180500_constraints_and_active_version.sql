-- Constraints + active-version enforcement

begin;

-- Percent constraints
alter table public.project_plan_channel_inputs
  add constraint if not exists chk_qualification_percent_range
  check (qualification_percent >= 0 and qualification_percent <= 100);

alter table public.project_plan_channel_inputs
  add constraint if not exists chk_target_contribution_percent_range
  check (target_contribution_percent >= 0 and target_contribution_percent <= 100);

-- Non-negative money constraints
alter table public.project_targets
  add constraint if not exists chk_project_targets_non_negative
  check (sales_target_sqft >= 0 and avg_sqft_per_deal >= 0 and total_budget >= 0);

alter table public.project_plan_channel_inputs
  add constraint if not exists chk_plan_channel_budgets_non_negative
  check (allocated_budget >= 0);

alter table public.project_actuals
  add constraint if not exists chk_project_actuals_non_negative
  check (leads >= 0 and qualified_leads >= 0 and meetings_scheduled >= 0 and meetings_done >= 0);

-- Only one active plan version per project/month
create unique index if not exists uniq_active_plan_per_project_month
  on public.project_plan_versions (project_id, year, month)
  where active;

-- Active requires approved
create or replace function public.enforce_active_requires_approved()
returns trigger
language plpgsql
as $$
begin
  if new.active and new.status <> 'approved' then
    raise exception 'Only approved plan versions can be active';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_active_requires_approved on public.project_plan_versions;
create trigger trg_enforce_active_requires_approved
before insert or update on public.project_plan_versions
for each row execute function public.enforce_active_requires_approved();

-- When a version becomes active, deactivate any other active versions for that project/month
create or replace function public.ensure_single_active_plan_version()
returns trigger
language plpgsql
as $$
begin
  if new.active then
    update public.project_plan_versions
      set active = false
    where project_id = new.project_id
      and year = new.year
      and month = new.month
      and id <> new.id
      and active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_single_active_plan_version on public.project_plan_versions;
create trigger trg_ensure_single_active_plan_version
after insert or update of active on public.project_plan_versions
for each row execute function public.ensure_single_active_plan_version();

commit;

