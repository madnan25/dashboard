-- Allow users to read parent tasks when assigned a subtask.

-- Recreate tasks_select policy to include subtask assignee visibility.
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'cmo'
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR approver_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.task_subtasks s
    WHERE s.task_id = id
      AND s.assignee_id = auth.uid()
  )
);

