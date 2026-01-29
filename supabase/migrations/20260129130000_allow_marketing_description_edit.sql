-- Allow marketing team members to edit task descriptions.

CREATE OR REPLACE FUNCTION public.guard_task_property_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
  jwt_role text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  jwt_role := auth.role();
  IF jwt_role IN ('service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  is_privileged := (public.current_user_role() = 'cmo')
                  OR public.is_marketing_manager()
                  OR (OLD.created_by IS NOT NULL AND OLD.created_by = auth.uid());

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('queued','in_progress','submitted','blocked','on_hold','dropped') THEN
      RAISE EXCEPTION 'Only managers can set that status';
    END IF;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR (NOT public.is_marketing_team() AND NEW.description IS DISTINCT FROM OLD.description)
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
