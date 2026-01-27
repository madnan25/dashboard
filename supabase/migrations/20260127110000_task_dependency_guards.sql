-- Dependency guards (bugfixes)

-- Prevent a subtask from depending on its own linked ticket.
CREATE OR REPLACE FUNCTION public.guard_subtask_dependency_not_self_linked_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_task uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.blocker_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.linked_task_id INTO linked_task
  FROM public.task_subtasks s
  WHERE s.id = NEW.blocked_subtask_id;

  IF linked_task IS NOT NULL AND linked_task = NEW.blocker_task_id THEN
    RAISE EXCEPTION 'A subtask cannot depend on its own linked ticket';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_subtask_dependency_not_self_linked_ticket ON public.task_subtask_dependencies;
CREATE TRIGGER trg_guard_subtask_dependency_not_self_linked_ticket
BEFORE INSERT ON public.task_subtask_dependencies
FOR EACH ROW EXECUTE FUNCTION public.guard_subtask_dependency_not_self_linked_ticket();

