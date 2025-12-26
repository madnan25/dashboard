-- Add 'member' role for marketing execution-only users.
-- Members:
-- - Can access tasks (active: create/update)
-- - Cannot access Planning & Actuals (treated like viewer in the app UI)
--
-- Viewers:
-- - If added to marketing, can view tasks only (no create/update/delete)
-- - If not added to marketing, cannot access tasks
--
-- Sales Ops:
-- - Cannot access tasks

-- 1) Add role to constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('cmo','brand_manager','sales_ops','viewer','member'));

-- 2) Tasks access rules:
-- - sales_ops: blocked
-- - brand_manager/cmo/member: active access (insert/update)
-- - viewer with marketing flag: read-only (select)

CREATE OR REPLACE FUNCTION public.is_marketing_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR (
      public.current_user_role() IS DISTINCT FROM 'sales_ops'
      AND (
        public.current_user_role() IN ('brand_manager','member')
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_marketing_team = true
        )
      )
    )
  );
$$;

-- Reader policy remains: tasks_select uses is_marketing_team()
-- and task_events_select uses is_marketing_team()

-- Write policies: only active roles can write
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team())
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

-- Delete policy is defined in later migrations.

