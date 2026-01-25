-- Linked design tickets: make description fully managed (single block).
-- This guarantees no duplicate header blocks and ensures subtask details always transfer.
-- (Use comments for additional notes on the design ticket.)

CREATE OR REPLACE FUNCTION public.sync_subtask_to_linked_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_title text;
  linked_status public.task_status;
  managed text;
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
    'Design work for: ', COALESCE(parent_title, '—'), E'\n',
    'Parent ticket: /tasks/', NEW.task_id::text, E'\n',
    'Subtask: ', NEW.title, E'\n',
    'Subtask details:', E'\n',
    details
  );

  SELECT t.status INTO linked_status
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  -- Mark as system update so property guard doesn't block it.
  PERFORM set_config('dashboard.system_update', '1', true);
  UPDATE public.tasks
  SET description = managed
  WHERE id = NEW.linked_task_id;

  -- Align status/assignee (assignee is handled by guard + linked-ticket sync).
  UPDATE public.task_subtasks
  SET status = public.map_task_status_to_subtask_stage(linked_status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

