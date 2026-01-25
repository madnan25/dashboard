-- Linked design tickets:
-- - If a task is linked to a subtask (task_subtasks.linked_task_id), keep subtask status in sync with the linked task status:
--     approved/closed -> done
--     blocked -> blocked
--     on_hold -> on_hold
--     else -> not_done
-- - If the subtask title/description changes (or the link is added), update the linked ticket description block.

-- 1) Map task status -> subtask stage
CREATE OR REPLACE FUNCTION public.map_task_status_to_subtask_stage(p_status public.task_status)
RETURNS public.task_subtask_stage
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    CASE p_status::text
      WHEN 'approved' THEN 'done'
      WHEN 'closed' THEN 'done'
      WHEN 'blocked' THEN 'blocked'
      WHEN 'on_hold' THEN 'on_hold'
      ELSE 'not_done'
    END
  )::public.task_subtask_stage;
$$;

-- 2) When a linked ticket status changes, update all subtasks that link to it
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

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.task_subtasks s
    SET status = public.map_task_status_to_subtask_stage(NEW.status)
    WHERE s.linked_task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_linked_ticket_status_to_subtasks ON public.tasks;
CREATE TRIGGER trg_sync_linked_ticket_status_to_subtasks
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_linked_ticket_status_to_subtasks();

-- 3) When a subtask is linked/edited, update the linked ticket description + align status
CREATE OR REPLACE FUNCTION public.sync_subtask_to_linked_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_title text;
  linked_status public.task_status;
  existing_desc text;
  managed text;
  next_desc text;
  details text;
BEGIN
  IF NEW.linked_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.title INTO parent_title
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  details := COALESCE(NEW.description, '');

  managed := concat(
    '<!--dashboard:linked-subtask-->', E'\n',
    'Design work for: ', COALESCE(parent_title, '—'), E'\n',
    'Parent ticket: /tasks/', NEW.task_id::text, E'\n',
    'Subtask: ', NEW.title, E'\n',
    'Subtask details:', E'\n',
    details, E'\n',
    '<!--dashboard:linked-subtask-end-->'
  );

  SELECT t.status, t.description INTO linked_status, existing_desc
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  existing_desc := COALESCE(existing_desc, '');

  IF existing_desc ~ '<!--dashboard:linked-subtask-->' THEN
    next_desc := regexp_replace(
      existing_desc,
      '(?s)<!--dashboard:linked-subtask-->.*?<!--dashboard:linked-subtask-end-->',
      managed
    );
  ELSE
    next_desc := managed || E'\n\n' || existing_desc;
  END IF;

  UPDATE public.tasks
  SET description = next_desc
  WHERE id = NEW.linked_task_id;

  -- Align the linked subtask status to the linked ticket status (this UPDATE doesn't re-fire this trigger).
  UPDATE public.task_subtasks
  SET status = public.map_task_status_to_subtask_stage(linked_status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_subtask_to_linked_ticket ON public.task_subtasks;
CREATE TRIGGER trg_sync_subtask_to_linked_ticket
AFTER INSERT OR UPDATE OF title, description, linked_task_id, task_id ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.sync_subtask_to_linked_ticket();

