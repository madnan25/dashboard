-- Enforce that the ticket "Manager" (stored as task_contributions.role='coordinator') must be a marketing manager (or CMO).

CREATE OR REPLACE FUNCTION public.is_user_marketing_manager(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        p.role = 'cmo'
        OR (p.is_marketing_team = true AND p.is_marketing_manager = true)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_task_contribution_manager_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'coordinator' THEN
    IF NEW.user_id IS NULL OR NOT public.is_user_marketing_manager(NEW.user_id) THEN
      RAISE EXCEPTION 'Ticket manager must be a marketing manager';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_contribution_manager_role ON public.task_contributions;
CREATE TRIGGER trg_guard_task_contribution_manager_role
BEFORE INSERT OR UPDATE ON public.task_contributions
FOR EACH ROW EXECUTE FUNCTION public.guard_task_contribution_manager_role();


