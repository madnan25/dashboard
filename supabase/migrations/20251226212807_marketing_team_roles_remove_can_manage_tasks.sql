-- Marketing team roles (member/manager) and removal of legacy can_manage_tasks

-- 1) Add marketing team role
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marketing_team_role text NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_marketing_team_role_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_marketing_team_role_check
    CHECK (marketing_team_role IN ('member','manager'));
  END IF;
END $$;

-- Ensure defaults: CMO is always marketing + manager; Brand is marketing + member
UPDATE public.profiles
SET is_marketing_team = true,
    marketing_team_role = 'manager'
WHERE role = 'cmo';

UPDATE public.profiles
SET is_marketing_team = true,
    marketing_team_role = 'member'
WHERE role = 'brand_manager' AND marketing_team_role IS DISTINCT FROM 'manager';

-- 2) Helper for manager privileges (CMO always)
CREATE OR REPLACE FUNCTION public.is_marketing_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR (
      public.is_marketing_team()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_marketing_team = true AND p.marketing_team_role = 'manager'
      )
    )
  );
$$;

-- 3) Update tasks delete policy: marketing managers only
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (public.is_marketing_manager());

-- 4) Remove legacy toggle and helper if present
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS can_manage_tasks;

DROP FUNCTION IF EXISTS public.can_manage_tasks();

