-- Fix linked ticket description dedupe regex:
-- Use E'' literals so regex backslashes are not double-escaped under standard_conforming_strings.
-- This ensures the managed linked-subtask block is actually removed (globally) before rewriting.

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
  tail text;
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

  -- Remove ALL existing managed blocks (they can accumulate per-keystroke if not stripped).
  tail := COALESCE(existing_desc, '');
  tail := regexp_replace(
    tail,
    E'<!--dashboard:linked-subtask-->[\\s\\S]*?<!--dashboard:linked-subtask-end-->\\s*',
    '',
    'g'
  );
  tail := btrim(tail);

  next_desc := managed;
  IF tail <> '' THEN
    next_desc := next_desc || E'\n\n' || tail;
  END IF;

  -- Mark as system update so property guard doesn't block it.
  PERFORM set_config('dashboard.system_update', '1', true);
  UPDATE public.tasks
  SET description = next_desc
  WHERE id = NEW.linked_task_id;

  -- Align status/assignee (assignee is handled by guard + linked-ticket sync).
  UPDATE public.task_subtasks
  SET status = public.map_task_status_to_subtask_stage(linked_status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

