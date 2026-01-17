-- Enforce assigned-manager approvals with CMO override.

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
    SELECT i.current_step_order INTO cur_step
    FROM public.task_flow_instances i
    WHERE i.id = NEW.flow_instance_id;

    IF cur_step IS NULL OR NEW.step_order IS DISTINCT FROM cur_step THEN
      RAISE EXCEPTION 'Only the current flow step can be approved';
    END IF;

    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NOT public.is_marketing_manager() THEN
        RAISE EXCEPTION 'Only ticket managers can approve';
      END IF;

      IF NEW.approver_user_id IS NULL OR NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned approver can approve this step';
      END IF;
    END IF;

    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_task_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_id uuid;
BEGIN
  IF NEW.approval_state = 'approved' THEN
    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NOT public.is_marketing_manager() THEN
        RAISE EXCEPTION 'Only ticket managers can approve tasks';
      END IF;

      SELECT c.user_id INTO manager_id
      FROM public.task_contributions c
      WHERE c.task_id = NEW.id AND c.role = 'coordinator'
      LIMIT 1;

      IF manager_id IS NULL THEN
        RAISE EXCEPTION 'Ticket manager is required before approval';
      END IF;

      IF manager_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned ticket manager can approve tasks';
      END IF;
    END IF;

    NEW.approved_by := auth.uid();
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
  ELSE
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;
