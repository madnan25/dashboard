-- Marketing team gating for Tasks module

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_marketing_team boolean NOT NULL DEFAULT false;

-- Default marketing team: CMO + Brand Manager
UPDATE public.profiles
SET is_marketing_team = true
WHERE role IN ('cmo', 'brand_manager');

-- Helper: allow CMO + marketing team members (but never viewer/sales_ops)
CREATE OR REPLACE FUNCTION public.is_marketing_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR (
      public.current_user_role() NOT IN ('viewer', 'sales_ops')
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_marketing_team = true
      )
    )
  );
$$;

-- Tighten tasks RLS to marketing team only
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.is_marketing_team() AND public.current_user_role() IS DISTINCT FROM 'viewer');

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (public.is_marketing_team() AND public.current_user_role() IS DISTINCT FROM 'viewer')
WITH CHECK (public.is_marketing_team() AND public.current_user_role() IS DISTINCT FROM 'viewer');

-- Delete policy is further tightened in a later migration.
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (public.is_marketing_team());

-- Tighten task events read to marketing team only
DROP POLICY IF EXISTS task_events_select ON public.task_events;
CREATE POLICY task_events_select ON public.task_events
FOR SELECT TO authenticated
USING (public.is_marketing_team());

