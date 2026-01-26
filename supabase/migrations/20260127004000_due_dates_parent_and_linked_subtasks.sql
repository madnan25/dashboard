-- Due dates:
-- 1) Linked subtasks mirror the linked ticket's due date (and assignee).
-- 2) A linked child ticket cannot have a due date after its parent ticket due date.

-- 1) When a subtask is linked, force assignee_id + due_at to mirror the linked ticket.
CREATE OR REPLACE FUNCTION public.guard_linked_subtask_assignee_mirrors_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_assignee uuid;
  linked_due date;
BEGIN
  IF NEW.linked_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.assignee_id, t.due_at
    INTO linked_assignee, linked_due
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  -- Auto-fix to keep UX smooth.
  NEW.assignee_id := linked_assignee;
  NEW.due_at := linked_due;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_linked_subtask_assignee_mirrors_ticket ON public.task_subtasks;
CREATE TRIGGER trg_guard_linked_subtask_assignee_mirrors_ticket
BEFORE INSERT OR UPDATE OF assignee_id, due_at, linked_task_id ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.guard_linked_subtask_assignee_mirrors_ticket();

-- 2) If a task is linked to a subtask (task_subtasks.linked_task_id), keep subtask status/assignee/due date in sync.
CREATE OR REPLACE FUNCTION public.sync_linked_ticket_status_to_subtasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     OR NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    UPDATE public.task_subtasks s
    SET status = public.map_task_status_to_subtask_stage(NEW.status),
        assignee_id = NEW.assignee_id,
        due_at = NEW.due_at
    WHERE s.linked_task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_linked_ticket_status_to_subtasks ON public.tasks;
CREATE TRIGGER trg_sync_linked_ticket_status_to_subtasks
AFTER UPDATE OF status, assignee_id, due_at ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_linked_ticket_status_to_subtasks();

-- 3) Guard: child ticket due date cannot be after parent ticket due date.
-- Parent is inferred from task_subtasks.linked_task_id -> child ticket.
CREATE OR REPLACE FUNCTION public.guard_task_due_at_not_after_parent_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_due date;
BEGIN
  -- If the child has no due date, it's always valid.
  IF NEW.due_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- If multiple parents exist, enforce against the earliest parent due date (most restrictive).
  SELECT MIN(t.due_at) INTO parent_due
  FROM public.task_subtasks s
  JOIN public.tasks t ON t.id = s.task_id
  WHERE s.linked_task_id = NEW.id
    AND t.due_at IS NOT NULL;

  IF parent_due IS NOT NULL AND NEW.due_at > parent_due THEN
    RAISE EXCEPTION 'Due date cannot be after parent ticket due date (%)', parent_due;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_due_at_not_after_parent_ticket ON public.tasks;
CREATE TRIGGER trg_guard_task_due_at_not_after_parent_ticket
BEFORE INSERT OR UPDATE OF due_at ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_due_at_not_after_parent_ticket();

