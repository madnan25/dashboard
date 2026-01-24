-- Align "marketing team" membership to roles (member/brand_manager/cmo) + legacy flag.
--
-- Fixes confusing UX where a user can have role=member and/or manager access but not be
-- selectable in approver/assignee dropdowns due to is_marketing_team=false.

-- 1) Backfill: role-based marketing users should be in marketing team.
UPDATE public.profiles
SET is_marketing_team = true
WHERE role IN ('cmo', 'brand_manager', 'member');

-- 2) Normalize helper: check marketing membership by user id
CREATE OR REPLACE FUNCTION public.is_marketing_team_member(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.role NOT IN ('viewer', 'sales_ops')
      AND (
        p.role IN ('cmo', 'brand_manager', 'member')
        OR p.is_marketing_team = true
      )
  );
$$;

-- 3) Normalize helper: check marketing manager membership by user id (CMO + brand_manager always count)
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
      AND p.role NOT IN ('viewer', 'sales_ops')
      AND (
        p.role IN ('cmo', 'brand_manager')
        OR (public.is_marketing_team_member(p.id) AND p.is_marketing_manager = true)
      )
  );
$$;

-- 4) Profiles select policy: allow marketing team members to read marketing team profiles by role or flag.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'cmo'
  OR (
    public.is_marketing_team()
    AND (
      is_marketing_team = true
      OR role IN ('cmo','brand_manager','member')
    )
  )
);

-- 5) Team approver guard: must be present and a marketing manager.
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

