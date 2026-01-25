-- Remove redundant "Design work for:" line from linked design ticket descriptions.

CREATE OR REPLACE FUNCTION public.sync_subtask_to_linked_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_status public.task_status;
  managed text;
  details text;
BEGIN
  IF NEW.linked_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  details := COALESCE(NEW.description, '');

  managed := concat(
    'Parent ticket: /tasks/', NEW.task_id::text, E'\n',
    'Subtask: ', NEW.title, E'\n',
    'Subtask details:', E'\n',
    details
  );

  SELECT t.status INTO linked_status
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  PERFORM set_config('dashboard.system_update', '1', true);
  UPDATE public.tasks
  SET description = managed
  WHERE id = NEW.linked_task_id;

  UPDATE public.task_subtasks
  SET status = public.map_task_status_to_subtask_stage(linked_status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

