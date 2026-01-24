-- Task teams: approver is required and must be a marketing manager (CMO counts).
--
-- UI enforces this, but we also enforce in DB so it can't be bypassed.

-- Helper: check marketing manager membership by user id
CREATE OR REPLACE FUNCTION public.is_marketing_manager_member(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND (
        p.role = 'cmo'
        OR (
          p.is_marketing_team = true
          AND p.role NOT IN ('viewer', 'sales_ops')
          AND p.is_marketing_manager = true
        )
      )
  );
$$;

-- Backfill: if any existing teams lack an approver, default to the CMO (if present).
UPDATE public.task_teams
SET approver_user_id = (
  SELECT p.id
  FROM public.profiles p
  WHERE p.role = 'cmo'
  ORDER BY p.id
  LIMIT 1
)
WHERE approver_user_id IS NULL;

-- Optional hardening: set NOT NULL only if we successfully backfilled all rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.task_teams WHERE approver_user_id IS NULL) THEN
    ALTER TABLE public.task_teams
      ALTER COLUMN approver_user_id SET NOT NULL;
  END IF;
END $$;

-- Upgrade existing guard to require non-null and manager membership.
CREATE OR REPLACE FUNCTION public.guard_task_team_approver_marketing_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approver_user_id IS NULL THEN
    RAISE EXCEPTION 'Approver is required';
  END IF;

  IF NOT public.is_marketing_manager_member(NEW.approver_user_id) THEN
    RAISE EXCEPTION 'Team approver must be a marketing manager';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_team_approver_marketing_team ON public.task_teams;
CREATE TRIGGER trg_guard_task_team_approver_marketing_team
BEFORE INSERT OR UPDATE ON public.task_teams
FOR EACH ROW EXECUTE FUNCTION public.guard_task_team_approver_marketing_team();

