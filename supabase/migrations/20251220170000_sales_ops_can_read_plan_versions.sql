-- Sales Ops should be able to view project plan versions (read-only)
-- so project dashboards can display approved plan + allocations.

drop policy if exists plan_versions_select on public.project_plan_versions;
create policy plan_versions_select
on public.project_plan_versions
for select
to authenticated
using (
  public.current_user_role() = 'cmo'
  or public.current_user_role() = 'viewer'
  or public.current_user_role() = 'sales_ops'
  or created_by = auth.uid()
  or (public.current_user_role() = 'brand_manager' and public.is_assigned_to_project(project_id))
);

