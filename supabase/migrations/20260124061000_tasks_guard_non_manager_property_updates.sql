-- Prevent non-manager (non-marketing-manager) users from editing task properties.
-- They may only change status among work states; approval/close remains guarded separately.

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

