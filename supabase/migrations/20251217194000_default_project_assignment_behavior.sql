-- Default assignment behavior (single-org bootstrap)
-- If a project has NO assignments, treat it as "open" to brand managers.
-- Once a project has 1+ assignments, only assigned brand managers can create/see plan versions via RLS.

create or replace function public.is_assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1
      from public.project_assignments a
      where a.project_id = p_project_id
    ) then true
    else exists (
      select 1
      from public.project_assignments a
      where a.project_id = p_project_id
        and a.user_id = auth.uid()
    )
  end
$$;


