-- Tighten permissions:
-- - Only marketing managers (or CMO) can approve flow steps.
-- - Only marketing managers (or CMO) can close tickets; optionally require approved first.

CREATE OR REPLACE FUNCTION public.guard_task_flow_step_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_step int;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Must be manager (CMO counts as manager)
    IF NOT public.is_marketing_manager() THEN
      RAISE EXCEPTION 'Only ticket managers can approve';
    END IF;

    SELECT i.current_step_order INTO cur_step
    FROM public.task_flow_instances i
    WHERE i.id = NEW.flow_instance_id;

    IF cur_step IS NULL OR NEW.step_order IS DISTINCT FROM cur_step THEN
      RAISE EXCEPTION 'Only the current flow step can be approved';
    END IF;

    -- Must be assigned approver (CMO is allowed if also manager; current helper treats CMO as manager)
    IF NEW.approver_user_id IS NULL OR NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the assigned approver can approve this step';
    END IF;

    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Close guard
CREATE OR REPLACE FUNCTION public.guard_task_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    IF NOT public.is_marketing_manager() THEN
      RAISE EXCEPTION 'Only ticket managers can close tickets';
    END IF;

    -- Optional: require approval before close
    IF NEW.approval_state IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Ticket must be approved before closing';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_close ON public.tasks;
CREATE TRIGGER trg_guard_task_close
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_close();


