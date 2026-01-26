-- Fix tasks_select RLS recursion by using a SECURITY DEFINER helper.
-- This avoids referencing task_subtasks directly inside the tasks policy (which can recurse with task_subtasks policies).

CREATE OR REPLACE FUNCTION public.user_is_assigned_to_task_via_subtask(p_task_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_subtasks s
    WHERE s.task_id = p_task_id
      AND s.assignee_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_assigned_to_task_via_subtask(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'cmo'
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR approver_user_id = auth.uid()
  OR public.user_is_assigned_to_task_via_subtask(id, auth.uid())
);

