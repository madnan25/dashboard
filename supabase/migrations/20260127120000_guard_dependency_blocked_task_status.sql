-- Guard: tasks blocked by dependencies cannot change status until resolved.

CREATE OR REPLACE FUNCTION public.task_has_unresolved_dependencies(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.task_dependencies d
      JOIN public.tasks t ON t.id = d.blocker_task_id
      WHERE d.blocked_task_id = p_task_id
        AND NOT public.task_status_is_resolved(t.status)
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_subtasks s
      JOIN public.task_subtask_dependencies d ON d.blocked_subtask_id = s.id
      LEFT JOIN public.tasks bt ON bt.id = d.blocker_task_id
      LEFT JOIN public.task_subtasks bs ON bs.id = d.blocker_subtask_id
      WHERE s.linked_task_id = p_task_id
        AND (
          (d.blocker_task_id IS NOT NULL AND NOT public.task_status_is_resolved(bt.status))
          OR (d.blocker_subtask_id IS NOT NULL AND NOT public.subtask_stage_is_resolved(bs.status))
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.guard_task_status_change_when_dependency_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- If unresolved dependencies exist, only allow setting status to 'blocked'.
    IF NEW.status::text <> 'blocked' AND public.task_has_unresolved_dependencies(NEW.id) THEN
      RAISE EXCEPTION 'Task is blocked by unresolved dependencies';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_status_change_when_dependency_blocked ON public.tasks;
CREATE TRIGGER trg_guard_task_status_change_when_dependency_blocked
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_status_change_when_dependency_blocked();

