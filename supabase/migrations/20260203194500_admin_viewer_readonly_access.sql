-- Admin viewer role: read-only across tasks/projects, no planning edits

-- 1) Add role to constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('cmo','brand_manager','sales_ops','viewer','member','admin_viewer'));

-- 2) Marketing team helper excludes admin_viewer
CREATE OR REPLACE FUNCTION public.is_marketing_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR (
      public.current_user_role() NOT IN ('sales_ops','admin_viewer')
      AND (
        public.current_user_role() IN ('brand_manager','member')
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_marketing_team = true
        )
      )
    )
  );
$$;

-- 3) Marketing membership helpers exclude admin_viewer
CREATE OR REPLACE FUNCTION public.is_marketing_team_member(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.role NOT IN ('viewer', 'sales_ops', 'admin_viewer')
      AND (
        p.role IN ('cmo', 'brand_manager', 'member')
        OR p.is_marketing_team = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_marketing_manager_member(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.role NOT IN ('viewer', 'sales_ops', 'admin_viewer')
      AND (
        p.role IN ('cmo', 'brand_manager')
        OR (public.is_marketing_team_member(p.id) AND p.is_marketing_manager = true)
      )
  );
$$;

-- 4) Profiles select: allow admin_viewer read-only
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'cmo'
  OR public.current_user_role() = 'admin_viewer'
  OR (
    public.is_marketing_team()
    AND (
      is_marketing_team = true
      OR role IN ('cmo','brand_manager','member')
    )
  )
);

-- 5) Tasks + collaboration: admin_viewer read-only access
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_events_select ON public.task_events;
CREATE POLICY task_events_select ON public.task_events
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_subtasks_select ON public.task_subtasks;
CREATE POLICY task_subtasks_select ON public.task_subtasks
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_contributions_select ON public.task_contributions;
CREATE POLICY task_contributions_select ON public.task_contributions
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
CREATE POLICY task_comments_select ON public.task_comments
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_dependencies_select ON public.task_dependencies;
CREATE POLICY task_dependencies_select ON public.task_dependencies
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_subtask_dependencies_select ON public.task_subtask_dependencies;
CREATE POLICY task_subtask_dependencies_select ON public.task_subtask_dependencies
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
CREATE POLICY task_attachments_select ON public.task_attachments
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_comment_mentions_select ON public.task_comment_mentions;
CREATE POLICY task_comment_mentions_select ON public.task_comment_mentions
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_comment_attachments_select ON public.task_comment_attachments;
CREATE POLICY task_comment_attachments_select ON public.task_comment_attachments
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

-- Storage objects for task attachments
DROP POLICY IF EXISTS task_attachments_storage_select ON storage.objects;
CREATE POLICY task_attachments_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer')
  AND EXISTS (
    SELECT 1 FROM public.task_attachments a
    WHERE a.storage_path = name
  )
);

-- Task flow + scoring: read-only for admin_viewer
DROP POLICY IF EXISTS task_flow_templates_select ON public.task_flow_templates;
CREATE POLICY task_flow_templates_select ON public.task_flow_templates
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_flow_template_steps_select ON public.task_flow_template_steps;
CREATE POLICY task_flow_template_steps_select ON public.task_flow_template_steps
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_flow_instances_select ON public.task_flow_instances;
CREATE POLICY task_flow_instances_select ON public.task_flow_instances
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_flow_step_instances_select ON public.task_flow_step_instances;
CREATE POLICY task_flow_step_instances_select ON public.task_flow_step_instances
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_weight_config_select ON public.task_weight_config;
CREATE POLICY task_weight_config_select ON public.task_weight_config
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

DROP POLICY IF EXISTS task_points_ledger_select ON public.task_points_ledger;
CREATE POLICY task_points_ledger_select ON public.task_points_ledger
FOR SELECT TO authenticated
USING (public.is_marketing_team() OR public.current_user_role() = 'admin_viewer');

-- 6) Planning read access: allow admin_viewer to view plan data (no writes)
DROP POLICY IF EXISTS plan_versions_select ON public.project_plan_versions;
CREATE POLICY plan_versions_select
ON public.project_plan_versions
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'cmo'
  OR public.current_user_role() = 'viewer'
  OR public.current_user_role() = 'sales_ops'
  OR public.current_user_role() = 'member'
  OR public.current_user_role() = 'admin_viewer'
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
        OR public.current_user_role() = 'admin_viewer'
        OR pv.created_by = auth.uid()
        OR (public.current_user_role() = 'brand_manager' AND public.is_assigned_to_project(pv.project_id))
      )
  )
);

