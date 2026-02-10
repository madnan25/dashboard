-- Fix user deletion / FK cascades failing on task approval guard.
-- When a profile is deleted (e.g. via auth admin delete), Postgres may run internal updates
-- (e.g. ON DELETE SET NULL) with no request JWT context. The approval guard must not block
-- these system-driven updates.

CREATE OR REPLACE FUNCTION public.guard_task_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := auth.role();

  -- Admin / system contexts
  IF jwt_role IN ('service_role', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;
  -- FK cascades / internal maintenance operations can run without an authenticated user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_state = 'approved' THEN
    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NEW.approver_user_id IS NULL THEN
        RAISE EXCEPTION 'Approver is not set for this task';
      END IF;
      IF NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned approver can approve tasks';
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

  IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      IF NEW.approval_state = 'approved' THEN
        RAISE EXCEPTION 'Only the assigned approver can approve tasks';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

