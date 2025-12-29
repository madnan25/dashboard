-- Allow marketing Members to view planning (read-only) like Viewer/Sales Ops.
-- This enables members to see filled plans created by brand managers.

DROP POLICY IF EXISTS plan_versions_select ON public.project_plan_versions;
CREATE POLICY plan_versions_select
ON public.project_plan_versions
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'cmo'
  OR public.current_user_role() = 'viewer'
  OR public.current_user_role() = 'sales_ops'
  OR public.current_user_role() = 'member'
  OR created_by = auth.uid()
  OR (public.current_user_role() = 'brand_manager' AND public.is_assigned_to_project(project_id))
);

DROP POLICY IF EXISTS plan_channel_select ON public.project_plan_channel_inputs;
CREATE POLICY plan_channel_select
ON public.project_plan_channel_inputs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_plan_versions pv
    WHERE pv.id = plan_version_id
      AND (
        public.current_user_role() = 'cmo'
        OR public.current_user_role() = 'viewer'
        OR public.current_user_role() = 'sales_ops'
        OR public.current_user_role() = 'member'
        OR pv.created_by = auth.uid()
        OR (public.current_user_role() = 'brand_manager' AND public.is_assigned_to_project(pv.project_id))
      )
  )
);


