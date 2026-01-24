-- Expand task visibility + collaboration to marketing team members.
-- Fixes: tasks created by one marketing user not visible to other marketing users.

-- Tasks: marketing team can read; active marketing roles can write.
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team())
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

-- Subtasks: any active marketing role can create/update for any task (still marketing-only).
DROP POLICY IF EXISTS task_subtasks_write ON public.task_subtasks;
CREATE POLICY task_subtasks_write ON public.task_subtasks
FOR ALL TO authenticated
USING (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team())
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

-- Comments: marketing team can read/insert (moderation remains marketing managers/CMO via existing policies).
DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
CREATE POLICY task_comments_select ON public.task_comments
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_comments_insert ON public.task_comments;
CREATE POLICY task_comments_insert ON public.task_comments
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_marketing_team());

