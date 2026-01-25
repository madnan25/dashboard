-- Subtasks: track author + restrict who can link/unlink a ticket.
-- Also keep linked subtask assignee in sync with linked ticket assignee.

-- 1) Add created_by to subtasks (author)
ALTER TABLE public.task_subtasks
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Default author to the current user when inserting.
ALTER TABLE public.task_subtasks
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS task_subtasks_created_by_idx ON public.task_subtasks(created_by);

-- Best-effort backfill: use parent ticket creator, otherwise assignee/approver, otherwise CMO.
UPDATE public.task_subtasks s
SET created_by = COALESCE(t.created_by, t.assignee_id, t.approver_user_id, (SELECT id FROM public.profiles WHERE role = 'cmo' LIMIT 1))
FROM public.tasks t
WHERE s.created_by IS NULL
  AND t.id = s.task_id;

-- 2) Guard: only subtask author or marketing managers (or CMO) can change linked_task_id.
CREATE OR REPLACE FUNCTION public.guard_task_subtask_link_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.linked_task_id IS DISTINCT FROM OLD.linked_task_id THEN
    IF public.current_user_role() = 'cmo'
       OR public.is_marketing_manager_member(auth.uid())
       OR (OLD.created_by IS NOT NULL AND OLD.created_by = auth.uid()) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only the subtask author or a marketing manager can link/unlink tickets';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_subtask_link_updates ON public.task_subtasks;
CREATE TRIGGER trg_guard_task_subtask_link_updates
BEFORE UPDATE OF linked_task_id ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_subtask_link_updates();

-- 3) Guard: if a subtask is linked, its assignee must mirror the linked ticket's assignee.
CREATE OR REPLACE FUNCTION public.guard_linked_subtask_assignee_mirrors_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_assignee uuid;
BEGIN
  IF NEW.linked_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.assignee_id INTO linked_assignee
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  IF NEW.assignee_id IS DISTINCT FROM linked_assignee THEN
    RAISE EXCEPTION 'Linked subtask assignee is controlled by the linked ticket';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_linked_subtask_assignee_mirrors_ticket ON public.task_subtasks;
CREATE TRIGGER trg_guard_linked_subtask_assignee_mirrors_ticket
BEFORE INSERT OR UPDATE OF assignee_id, linked_task_id ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.guard_linked_subtask_assignee_mirrors_ticket();

-- 4) Extend linked-ticket sync: also mirror ticket assignee_id into linked subtasks.
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

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    UPDATE public.task_subtasks s
    SET status = public.map_task_status_to_subtask_stage(NEW.status),
        assignee_id = NEW.assignee_id
    WHERE s.linked_task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_linked_ticket_status_to_subtasks ON public.tasks;
CREATE TRIGGER trg_sync_linked_ticket_status_to_subtasks
AFTER UPDATE OF status, assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_linked_ticket_status_to_subtasks();

