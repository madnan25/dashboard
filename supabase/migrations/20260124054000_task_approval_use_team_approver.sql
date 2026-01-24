-- Align task approval to team approver (tasks.approver_user_id) with CMO override.
-- This replaces the legacy task_contributions(coordinator) based approval guard.

CREATE OR REPLACE FUNCTION public.guard_task_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when changing approval state.
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_state = 'approved' AND (OLD.approval_state IS DISTINCT FROM 'approved') THEN
    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NEW.approver_user_id IS NULL THEN
        RAISE EXCEPTION 'Approver is required before approval';
      END IF;
      IF NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned approver can approve tasks';
      END IF;
    END IF;

    NEW.approved_by := auth.uid();
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
  ELSIF NEW.approval_state IS DISTINCT FROM 'approved' THEN
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

