-- Master Calendar: tag tasks as master items + provide a safe read-only RPC.
--
-- Goal:
-- - Allow privileged users to tag a task as a master-calendar item (marketing vs sales).
-- - Provide a SECURITY DEFINER RPC that returns only the minimal fields needed for a view-only calendar.
-- - Keep full tasks table visibility scoped to marketing team (RLS unchanged).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'task_master_calendar_tag'
  ) THEN
    CREATE TYPE public.task_master_calendar_tag AS ENUM ('marketing','sales');
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS master_calendar_tag public.task_master_calendar_tag;

-- Index for calendar queries (tag + due date).
CREATE INDEX IF NOT EXISTS idx_tasks_master_calendar_tag_due_at
  ON public.tasks (master_calendar_tag, due_at);

-- Ensure non-privileged users cannot edit the new property.
CREATE OR REPLACE FUNCTION public.guard_task_property_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Privileged: CMO, marketing manager, or the creator of the ticket.
  is_privileged := (public.current_user_role() = 'cmo')
                  OR public.is_marketing_manager()
                  OR (OLD.created_by IS NOT NULL AND OLD.created_by = auth.uid());

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged marketing users: allow only status changes among work states.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('queued','in_progress','submitted','blocked','on_hold','dropped') THEN
      RAISE EXCEPTION 'Only managers can set that status';
    END IF;
  END IF;

  -- Block any property edits (including approval fields) for non-privileged users.
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.due_at IS DISTINCT FROM OLD.due_at
     OR NEW.master_calendar_tag IS DISTINCT FROM OLD.master_calendar_tag
     OR NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id
     OR NEW.approval_state IS DISTINCT FROM OLD.approval_state
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  THEN
    RAISE EXCEPTION 'Only the creator or a marketing manager can edit ticket properties';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_property_updates ON public.tasks;
CREATE TRIGGER trg_guard_task_property_updates
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_property_updates();

-- View-only master calendar list.
-- SECURITY DEFINER so it can be used by non-marketing roles without exposing the full tasks table.
CREATE OR REPLACE FUNCTION public.list_master_calendar_tasks(p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  title text,
  due_at date,
  master_calendar_tag text,
  priority public.task_priority,
  status public.task_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.due_at,
    t.master_calendar_tag::text,
    t.priority,
    t.status
  FROM public.tasks t
  WHERE t.master_calendar_tag IS NOT NULL
    AND (p_due_from IS NULL OR t.due_at >= p_due_from)
    AND (p_due_to IS NULL OR t.due_at <= p_due_to)
  ORDER BY t.due_at NULLS LAST, t.updated_at DESC;
END;
$$;

