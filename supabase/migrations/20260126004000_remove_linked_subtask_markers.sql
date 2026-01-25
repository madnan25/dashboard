-- Remove linked-subtask HTML comment markers from managed blocks.
-- Keep backwards compatibility by stripping legacy marker blocks if they exist.

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
    'Design work for: ', COALESCE(parent_title, '—'), E'\n',
    'Parent ticket: /tasks/', NEW.task_id::text, E'\n',
    'Subtask: ', NEW.title, E'\n',
    'Subtask details:', E'\n',
    details
  );

  SELECT t.status, t.description INTO linked_status, existing_desc
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  -- Preserve user notes by keeping everything outside the managed block,
  -- but strip any legacy auto-generated header blocks to avoid duplication.
  tail := COALESCE(existing_desc, '');
  tail := regexp_replace(
    tail,
    '(?s)<!--dashboard:linked-subtask-->.*?<!--dashboard:linked-subtask-end-->\\s*',
    '',
    'g'
  );
  tail := regexp_replace(
    tail,
    '(?s)^\\s*Design work for:.*?\\nParent ticket:.*?\\nSubtask:.*?(\\nSubtask details:.*?\\n.*?)*(\\n\\n|$)',
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

