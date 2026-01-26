-- Design ticket numbering + remove parent line from linked design ticket descriptions.

-- 1) Sequence + RPC for design ticket numbers
CREATE SEQUENCE IF NOT EXISTS public.design_ticket_seq;

DO $$
DECLARE
  max_val bigint;
BEGIN
  SELECT COALESCE(MAX((substring(title from '^DES-([0-9]+):'))::bigint), 0)
  INTO max_val
  FROM public.tasks
  WHERE title ~ '^DES-[0-9]+:';

  PERFORM setval('public.design_ticket_seq', max_val);
END;
$$;

CREATE OR REPLACE FUNCTION public.next_design_ticket_number()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.design_ticket_seq');
$$;

-- 2) Linked design tickets: managed description without parent ticket line
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

