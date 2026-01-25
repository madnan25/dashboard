-- Make linked-ticket header stripping robust:
-- Remove *all* auto-generated "Design work for / Parent ticket / Subtask / Subtask details" blocks,
-- even if blocks are back-to-back, separated by varying whitespace, or contain blank lines.

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

  tail := COALESCE(existing_desc, '');

  -- Marker-wrapped legacy blocks
  tail := regexp_replace(
    tail,
    '(?s)<!--dashboard:linked-subtask-->.*?<!--dashboard:linked-subtask-end-->\\s*',
    '',
    'g'
  );

  -- Unwrapped header blocks (match until next header block or end-of-string)
  tail := regexp_replace(
    tail,
    '(?ms)^\\s*Design work for:.*?\\n\\s*Parent ticket:.*?\\n\\s*Subtask:.*?\\n(?:\\s*\\n)?\\s*Subtask details:.*?(?=^\\s*Design work for:|\\z)',
    '',
    'g'
  );

  tail := btrim(tail);

  next_desc := managed;
  IF tail <> '' THEN
    next_desc := next_desc || E'\\n\\n' || tail;
  END IF;

  PERFORM set_config('dashboard.system_update', '1', true);
  UPDATE public.tasks
  SET description = next_desc
  WHERE id = NEW.linked_task_id;

  UPDATE public.task_subtasks
  SET status = public.map_task_status_to_subtask_stage(linked_status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

